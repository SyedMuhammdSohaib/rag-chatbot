import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import PromptPreset
from app.schemas import PromptPresetCreate, PromptPresetOut

router = APIRouter(prefix="/presets", tags=["presets"])


@router.get("", response_model=list[PromptPresetOut])
async def list_presets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PromptPreset).order_by(PromptPreset.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=PromptPresetOut)
async def create_preset(body: PromptPresetCreate, db: AsyncSession = Depends(get_db)):
    preset = PromptPreset(name=body.name, content=body.content)
    db.add(preset)
    await db.commit()
    await db.refresh(preset)
    return preset


@router.delete("/{preset_id}")
async def delete_preset(preset_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    preset = await db.get(PromptPreset, preset_id)
    if not preset:
        raise HTTPException(404, "Preset not found")
    await db.delete(preset)
    await db.commit()
    return {"deleted": True}
