"""AI proxy routes — all AI API keys stay server-side."""

import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import httpx

from app.core.config import get_settings
from app.core.dependencies import get_current_user, verify_csrf
from app.models.user import User
from app.schemas.ai import ChatRequest, ConsolidateRequest, CommandRequest, CommandResponse

router = APIRouter(
    prefix="/api/ai",
    tags=["ai"],
    dependencies=[Depends(get_current_user), Depends(verify_csrf)],
)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"


@router.post("/chat")
async def chat(body: ChatRequest):
    """Proxy chat to OpenRouter with SSE streaming."""
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="OpenRouter API key not configured")

    async def stream():
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": body.model,
                    "max_tokens": body.max_tokens,
                    "messages": body.messages,
                    "stream": True,
                },
            ) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        yield f"{line}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.post("/consolidate")
async def consolidate(body: ConsolidateRequest):
    """Proxy consolidation request to OpenRouter (non-streaming)."""
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="OpenRouter API key not configured")

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

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": body.model,
                "max_tokens": 8192,
                "messages": messages,
            },
        )
        resp.raise_for_status()
        return resp.json()


@router.post("/command", response_model=CommandResponse)
async def command(body: CommandRequest):
    """Proxy NL spreadsheet command parsing to Anthropic."""
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="Anthropic API key not configured")

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

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            ANTHROPIC_URL,
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": body.model,
                "max_tokens": 512,
                "system": system_prompt,
                "messages": [{"role": "user", "content": body.user_text}],
            },
        )
        resp.raise_for_status()
        data = resp.json()

    content = data.get("content", [{}])[0].get("text", "{}")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        parsed = {"op": None}

    return CommandResponse(op=parsed.get("op"), raw=parsed)
