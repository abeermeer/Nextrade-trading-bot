import os
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import init_db, get_session
from db.models import UserRecord
from web.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth")


class RegisterRequest(BaseModel):
    email: str
    password: str
    plan: str = "basic"


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    email: str
    is_admin: bool
    plan: str
    mode: str
    trade_type: str
    bot_active: bool


class UserResponse(BaseModel):
    id: int
    email: str
    is_admin: bool
    plan: str
    mode: str
    trade_type: str
    bot_active: bool
    max_position_usdt: float
    has_mexc_keys: bool


@router.post("/register")
async def register(data: RegisterRequest, session: AsyncSession = Depends(get_session)):
    existing = await session.execute(select(UserRecord).where(UserRecord.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = UserRecord(
        email=data.email,
        password_hash=hash_password(data.password),
        plan=data.plan if data.plan in ("basic", "pro", "enterprise") else "basic",
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    token = create_access_token(user.id, user.email, user.is_admin)
    return AuthResponse(
        token=token, email=user.email, is_admin=user.is_admin,
        plan=user.plan.value, mode=user.mode.value, trade_type=user.trade_type.value,
        bot_active=user.bot_active,
    )


@router.post("/login")
async def login(data: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(UserRecord).where(UserRecord.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user.id, user.email, user.is_admin)
    return AuthResponse(
        token=token, email=user.email, is_admin=user.is_admin,
        plan=user.plan.value, mode=user.mode.value, trade_type=user.trade_type.value,
        bot_active=user.bot_active,
    )


@router.get("/me")
async def get_me(user: UserRecord = Depends(get_current_user)):
    return UserResponse(
        id=user.id, email=user.email, is_admin=user.is_admin,
        plan=user.plan.value, mode=user.mode.value, trade_type=user.trade_type.value,
        bot_active=user.bot_active, max_position_usdt=user.max_position_usdt,
        has_mexc_keys=bool(user.mexc_api_key and user.mexc_api_secret),
    )


async def seed_admin():
    await init_db()
    from db.database import async_session_factory
    async with async_session_factory() as session:
        result = await session.execute(select(UserRecord).where(UserRecord.email == "abeermeer7979@gmail.com"))
        if not result.scalar_one_or_none():
            admin = UserRecord(
                email="abeermeer7979@gmail.com",
                password_hash=hash_password("Abeer@123"),
                plan="enterprise",
                is_admin=True,
                bot_active=False,
                max_position_usdt=999999.0,
            )
            session.add(admin)
            await session.commit()
            print("Admin user seeded: abeermeer7979@gmail.com")
        else:
            print("Admin user already exists")
