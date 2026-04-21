"""AI proxy routes — all traffic via OpenRouter.

Auth is intentionally stripped while Whitehelmet's external auth service is
pending integration (see auth.py). Re-add `dependencies=[Depends(get_current_user),
Depends(verify_csrf)]` on the router once login is implemented.
"""

import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import httpx

from app.core.config import get_settings
from app.schemas.ai import ChatRequest, ConsolidateRequest, CommandRequest, CommandResponse

router = APIRouter(prefix="/api/ai", tags=["ai"])

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


async def _openrouter_post(payload: dict) -> dict:
    """Non-streaming POST to OpenRouter."""
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="OpenRouter API key not configured")
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


@router.post("/chat")
async def chat(body: ChatRequest):
    """Proxy chat to OpenRouter. SSE stream when body.stream=True, else JSON."""
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="OpenRouter API key not configured")

    payload = {
        "model": body.model,
        "max_tokens": body.max_tokens,
        "messages": body.messages,
        "stream": body.stream,
    }

    if not body.stream:
        return await _openrouter_post(payload)

    async def sse():
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            ) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        yield f"{line}\n\n"

    return StreamingResponse(sse(), media_type="text/event-stream")


@router.post("/consolidate")
async def consolidate(body: ConsolidateRequest):
    """Proxy consolidation to OpenRouter (non-streaming)."""
    system_prompt = (
        "You will receive Excel spreadsheet data as JSON arrays. "
        "Merge them into a single consolidated spreadsheet. "
        "Return ONLY a JSON array of arrays (rows). No markdown. "
        "After the JSON, on a new line write SUMMARY: followed by "
        "a brief paragraph explaining your merge decisions."
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(body.files_data)},
    ]
    return await _openrouter_post({
        "model": body.model,
        "max_tokens": 8192,
        "messages": messages,
    })


COMMAND_SYSTEM_PROMPT = """\
You are a spreadsheet command parser. Given a user message and the current \
spreadsheet state, return ONLY a JSON object (no markdown, no extra text).

Supported operations (return exactly one):
{"op":"add_column","name":"<header>","position":<0-based index or null for end>}
{"op":"remove_column","name":"<header>"}
{"op":"rename_column","from":"<old>","to":"<new>"}
{"op":"apply_formula","column":"<header>","formula":"<e.g. =A{row}+B{row}>"}
{"op":"sort","column":"<header>","order":"asc|desc"}
{"op":"filter","column":"<header>","operator":">|<|>=|<=|=|!=|contains","value":"<val>"}
{"op":"show_all_rows"}
{"op":"remove_empty_rows"}
{"op":"aggregate","column":"<header>","func":"sum|average|count|min|max"}
{"op":"find_duplicates","column":"<header>"}
{"op":"add_row","count":<number>,"position":<0-based or null for end>}
{"op":"format_cells","column":"<header or null>","row":<1-based or null>,"props":{"bold":true,"italic":true,"color":"#hex","bgColor":"#hex","align":"left|center|right"}}
{"op":"highlight_column","column":"<header>","bgColor":"#hex"}
{"op":"conditional_format","column":"<header>","operator":">|<|>=|<=|=|!=|contains","value":"<val>","props":{"bgColor":"#hex","color":"#hex","bold":true}}
{"op":"clear_format","column":"<header or null>"}
{"op":"export"}
{"op":"save_record"}
{"op":"show_dashboard"}
{"op":null}

Notes:
- filter: hide rows where column does NOT match the condition.
- show_all_rows: triggered by "show all", "clear filter", "unfilter".
- aggregate: report sum/avg/count/min/max in chat, no grid change.
- find_duplicates: report duplicate values in chat, no grid change.
- export: download spreadsheet as xlsx.
- save_record: save current grid to master records.
- show_dashboard: navigate to master records dashboard.
- format_cells: column=null means whole sheet; row=null means all data rows.
- If NOT a spreadsheet command return {"op":null}.
"""


@router.post("/command", response_model=CommandResponse)
async def command(body: CommandRequest):
    """Parse NL spreadsheet command via OpenRouter."""
    context_parts = []
    if body.snapshot:
        context_parts.append(body.snapshot)
    else:
        context_parts.append(f"Column headers: {json.dumps(body.headers)}")
    context_parts.append(f"User command: {body.message}")

    data = await _openrouter_post({
        "model": body.model,
        "max_tokens": 512,
        "messages": [
            {"role": "system", "content": COMMAND_SYSTEM_PROMPT},
            {"role": "user", "content": "\n\n".join(context_parts)},
        ],
    })
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
    try:
        parsed = json.loads(content.strip())
    except json.JSONDecodeError:
        parsed = {"op": None}

    op = parsed.pop("op", None)
    return CommandResponse(op=op, params=parsed)
