"""Templates routes — stubs returning 501 until full implementation."""

from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_current_user

router = APIRouter(prefix="/api/templates", tags=["templates"])

_NOT_IMPLEMENTED = {"detail": "not implemented"}


def _501():
    raise HTTPException(status_code=501, detail="not implemented")


@router.get("")
async def list_templates(_user=Depends(get_current_user)):
    _501()


@router.post("")
async def create_template(_user=Depends(get_current_user)):
    _501()


@router.get("/{template_id}")
async def get_template(template_id: str, _user=Depends(get_current_user)):
    _501()


@router.get("/{template_id}/versions")
async def list_versions(template_id: str, _user=Depends(get_current_user)):
    _501()


@router.post("/{template_id}/versions")
async def create_version(template_id: str, _user=Depends(get_current_user)):
    _501()


@router.post("/{template_id}/publish")
async def publish_template(template_id: str, _user=Depends(get_current_user)):
    _501()


@router.post("/{template_id}/deprecate")
async def deprecate_template(template_id: str, _user=Depends(get_current_user)):
    _501()


@router.get("/{template_id}/submissions")
async def list_submissions(template_id: str, _user=Depends(get_current_user)):
    _501()


@router.post("/{template_id}/consolidate")
async def consolidate(template_id: str, _user=Depends(get_current_user)):
    _501()


@router.get("/{template_id}/consolidations")
async def list_consolidations(template_id: str, _user=Depends(get_current_user)):
    _501()


@router.get("/consolidations/{sheet_id}/download-url")
async def get_download_url(sheet_id: str, _user=Depends(get_current_user)):
    _501()


@router.post("/parse")
async def parse_template(_user=Depends(get_current_user)):
    _501()


@router.post("/assignments")
async def create_assignment(_user=Depends(get_current_user)):
    _501()


@router.post("/assignments/freeform")
async def create_freeform_assignment(_user=Depends(get_current_user)):
    _501()


@router.post("/{template_id}/ai/generate")
async def ai_generate(template_id: str, _user=Depends(get_current_user)):
    _501()


@router.post("/{template_id}/ai/finetune")
async def ai_finetune(template_id: str, _user=Depends(get_current_user)):
    _501()
