from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session
from db.models import UserRecord, WithdrawalWhitelistRecord
from web.auth import get_current_user, get_admin_user

router = APIRouter(prefix="/api/withdrawal")


class AddWhitelistRequest(BaseModel):
    address: str
    network: str
    label: str


class UpdateDelayRequest(BaseModel):
    withdrawal_delay_hours: int


class WhitelistResponse(BaseModel):
    id: int
    user_id: int
    address: str
    network: str
    label: str | None
    is_approved: bool
    created_at: datetime
    approved_at: datetime | None


class SettingsResponse(BaseModel):
    withdrawal_delay_hours: int


class AdminPendingApprovalResponse(WhitelistResponse):
    user_email: str


@router.get("/whitelist")
async def get_whitelist(
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(WithdrawalWhitelistRecord).where(WithdrawalWhitelistRecord.user_id == user.id)
    )
    entries = result.scalars().all()
    return entries


@router.post("/whitelist", status_code=status.HTTP_201_CREATED)
async def add_whitelist(
    data: AddWhitelistRequest,
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    record = WithdrawalWhitelistRecord(
        user_id=user.id,
        address=data.address,
        network=data.network,
        label=data.label,
        is_approved=False,
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return record


@router.delete("/whitelist/{whitelist_id}")
async def delete_whitelist(
    whitelist_id: int,
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(WithdrawalWhitelistRecord).where(
            WithdrawalWhitelistRecord.id == whitelist_id,
            WithdrawalWhitelistRecord.user_id == user.id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Whitelist entry not found")
    await session.delete(record)
    await session.commit()
    return {"success": True}


@router.get("/settings")
async def get_settings(
    user: UserRecord = Depends(get_current_user),
):
    return SettingsResponse(withdrawal_delay_hours=user.withdrawal_delay_hours)


@router.put("/settings")
async def update_settings(
    data: UpdateDelayRequest,
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if data.withdrawal_delay_hours < 0:
        raise HTTPException(status_code=400, detail="Delay cannot be negative")
    user.withdrawal_delay_hours = data.withdrawal_delay_hours
    await session.commit()
    return {"success": True}


@router.get("/admin/pending-approvals")
async def pending_approvals(
    admin: UserRecord = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(WithdrawalWhitelistRecord).where(WithdrawalWhitelistRecord.is_approved == False)
    )
    entries = result.scalars().all()
    response = []
    for entry in entries:
        user_result = await session.execute(
            select(UserRecord).where(UserRecord.id == entry.user_id)
        )
        user_record = user_result.scalar_one_or_none()
        response.append({
            "id": entry.id,
            "user_id": entry.user_id,
            "address": entry.address,
            "network": entry.network,
            "label": entry.label,
            "is_approved": entry.is_approved,
            "created_at": entry.created_at,
            "approved_at": entry.approved_at,
            "user_email": user_record.email if user_record else "unknown",
        })
    return response


@router.post("/admin/approve/{whitelist_id}")
async def approve_whitelist(
    whitelist_id: int,
    admin: UserRecord = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(WithdrawalWhitelistRecord).where(WithdrawalWhitelistRecord.id == whitelist_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Whitelist entry not found")
    record.is_approved = True
    record.approved_at = datetime.now(timezone.utc)
    await session.commit()
    return {"success": True}
