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
        if not resp.is_success:
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"OpenRouter error: {resp.text}"
            )
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


@router.post("/command", response_model=CommandResponse)
async def command(body: CommandRequest):
    """Proxy NL spreadsheet command parsing to OpenRouter."""
    system_prompt = (
        "You are a spreadsheet command parser. The user will describe a change "
        "to make to their spreadsheet. The current column headers are: "
        f"{json.dumps(body.column_headers)}.\n\n"
        "Return a JSON object with one of these operations:\n"
        '- {"op":"add_column","name":"...","position":null}\n'
        '- {"op":"remove_column","name":"..."}\n'
        '- {"op":"rename_column","old_name":"...","new_name":"..."}\n'
        '- {"op":"apply_formula","column":"...","formula":"..."}\n'
        '- {"op":"sort","column":"...","order":"asc"|"desc"}\n'
        '- {"op":"filter","column":"...","condition":"..."}\n'
        '- {"op":null} if not a spreadsheet command\n\n'
        "Return ONLY valid JSON, no markdown."
    )
    data = await _openrouter_post({
        "model": body.model,
        "max_tokens": 512,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": body.user_text},
        ],
    })
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        parsed = {"op": None}
    return CommandResponse(op=parsed.get("op"), raw=parsed)
