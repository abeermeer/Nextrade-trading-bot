import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session
from db.models import UserRecord
from web.auth import hash_password, verify_password, create_access_token, get_current_user, generate_verification_token, generate_reset_token
from shared.plan_limits import get_plan_limits
from trader.notifier import Notifier

router = APIRouter(prefix="/api/auth")

def _get_notifier() -> Notifier:
    return Notifier(
        smtp_host=os.getenv("SMTP_HOST"),
        smtp_port=int(os.getenv("SMTP_PORT", "587")),
        smtp_user=os.getenv("SMTP_USER"),
        smtp_password=os.getenv("SMTP_PASSWORD"),
        email_from=os.getenv("EMAIL_FROM"),
    )


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
    exchange: str = "mexc"
    bot_active: bool
    wallet_address: str = ""
    wallet_type: str = ""


class UserResponse(BaseModel):
    id: int
    email: str
    is_admin: bool
    plan: str
    mode: str
    trade_type: str
    exchange: str = "mexc"
    bot_active: bool
    max_position_usdt: float
    has_api_keys: bool
    keys_verified: bool = False
    wallet_address: str = ""
    wallet_type: str = ""


@router.post("/register")
async def register(data: RegisterRequest, session: AsyncSession = Depends(get_session)):
    existing = await session.execute(select(UserRecord).where(UserRecord.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    plan = data.plan if data.plan in ("basic", "pro", "enterprise") else "basic"
    limits = get_plan_limits(plan)
    verification_token = generate_verification_token()
    user = UserRecord(
        email=data.email,
        password_hash=hash_password(data.password),
        plan=plan,
        max_position_usdt=limits["max_position_usdt"],
        verification_token=verification_token,
        verification_token_expires=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    notifier = _get_notifier()
    verify_link = f"https://mexc-trading-bot.netlify.app/verify-email?token={verification_token}"
    try:
        await notifier.send_custom_email(
            to=user.email,
            subject="Verify your email - NexTrade AI",
            body=f"Welcome to NexTrade AI!\n\nPlease verify your email by clicking this link:\n{verify_link}\n\nThis link expires in 24 hours.",
            html_template="verify_email.html",
            verify_link=verify_link,
        )
        await notifier.send_custom_email(
            to=user.email,
            subject="Welcome to NexTrade AI - Getting Started",
            body=f"Hi {user.email},\n\nThanks for joining! Here's how to start:\n1. Get MEXC API keys\n2. Connect them in Settings\n3. Start Paper Trading\n\nThe dashboard link: https://mexc-trading-bot.netlify.app/dashboard",
            html_template="welcome.html",
            email=user.email,
        )
    except Exception as e:
        pass
    exchange = user.exchange.value if hasattr(user.exchange, 'value') else (user.exchange or "mexc")
    token = create_access_token(user.id, user.email, user.is_admin)
    return AuthResponse(
        token=token, email=user.email, is_admin=user.is_admin,
        plan=user.plan.value, mode=user.mode.value, trade_type=user.trade_type.value,
        exchange=exchange, bot_active=user.bot_active,
        wallet_address=user.wallet_address or "",
        wallet_type=user.wallet_type or "",
    )


@router.post("/login")
async def login(data: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(UserRecord).where(UserRecord.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    exchange = user.exchange.value if hasattr(user.exchange, 'value') else (user.exchange or "mexc")
    token = create_access_token(user.id, user.email, user.is_admin)
    return AuthResponse(
        token=token, email=user.email, is_admin=user.is_admin,
        plan=user.plan.value, mode=user.mode.value, trade_type=user.trade_type.value,
        exchange=exchange, bot_active=user.bot_active,
        wallet_address=user.wallet_address or "",
        wallet_type=user.wallet_type or "",
    )


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.get("/verify-email")
async def verify_email(token: str = Query(...), session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(UserRecord).where(UserRecord.verification_token == token))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    if user.verification_token_expires and user.verification_token_expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification token expired")
    user.email_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    await session.commit()
    return {"detail": "Email verified successfully"}


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(UserRecord).where(UserRecord.email == data.email))
    user = result.scalar_one_or_none()
    if not user:
        return {"detail": "If that email exists, a reset link has been sent"}
    reset_token = generate_reset_token()
    user.reset_token = reset_token
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    await session.commit()
    notifier = _get_notifier()
    reset_link = f"https://mexc-trading-bot.netlify.app/reset-password?token={reset_token}"
    try:
        await notifier.send_custom_email(
            to=user.email,
            subject="Reset your password - NexTrade AI",
            body=f"Reset your password by clicking this link:\n{reset_link}\n\nThis link expires in 1 hour.\n\nIf you did not request this, ignore this email.",
            html_template="reset_password.html",
            reset_link=reset_link,
        )
    except Exception as e:
        pass
    return {"detail": "If that email exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(UserRecord).where(UserRecord.reset_token == data.token))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if user.reset_token_expires and user.reset_token_expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token expired")
    user.password_hash = hash_password(data.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    await session.commit()
    return {"detail": "Password reset successfully"}


@router.get("/me")
async def get_me(user: UserRecord = Depends(get_current_user)):
    exchange = user.exchange.value if hasattr(user.exchange, 'value') else (user.exchange or "mexc")
    return UserResponse(
        id=user.id, email=user.email, is_admin=user.is_admin,
        plan=user.plan.value, mode=user.mode.value, trade_type=user.trade_type.value,
        exchange=exchange, bot_active=user.bot_active, max_position_usdt=user.max_position_usdt,
        has_api_keys=bool(user.mexc_api_key and user.mexc_api_secret),
        keys_verified=bool(user.mexc_keys_verified),
        wallet_address=user.wallet_address or "",
        wallet_type=user.wallet_type or "",
    )
