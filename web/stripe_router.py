import os
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import stripe

from db.database import get_session
from db.models import UserRecord
from web.auth import get_current_user

router = APIRouter(prefix="/api/subscribe")

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://mexc-trading-bot.netlify.app")

stripe.api_key = STRIPE_SECRET_KEY

PLAN_PRICE_IDS = {
    "basic": os.getenv("STRIPE_PRICE_BASIC", ""),
    "pro": os.getenv("STRIPE_PRICE_PRO", ""),
    "enterprise": os.getenv("STRIPE_PRICE_ENTERPRISE", ""),
}


class CreateCheckoutRequest(BaseModel):
    plan: str = "pro"
    success_url: str = f"{FRONTEND_URL}/dashboard"
    cancel_url: str = f"{FRONTEND_URL}/subscribe"


@router.post("/create-checkout")
async def create_checkout(
    data: CreateCheckoutRequest,
    user: UserRecord = Depends(get_current_user),
):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=501, detail="Stripe not configured")
    if data.plan not in PLAN_PRICE_IDS or not PLAN_PRICE_IDS[data.plan]:
        raise HTTPException(status_code=400, detail=f"Invalid plan or missing price ID: {data.plan}")

    try:
        checkout = stripe.checkout.Session.create(
            customer_email=user.email,
            mode="subscription",
            line_items=[{"price": PLAN_PRICE_IDS[data.plan], "quantity": 1}],
            success_url=data.success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=data.cancel_url,
            metadata={"user_id": str(user.id), "plan": data.plan},
        )
        return {"url": checkout.url, "session_id": checkout.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")


@router.get("/portal")
async def customer_portal(user: UserRecord = Depends(get_current_user)):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=501, detail="Stripe not configured")

    try:
        session = stripe.billing_portal.Session.create(
            customer=user.stripe_customer_id if hasattr(user, 'stripe_customer_id') and user.stripe_customer_id else "",
            return_url=f"{FRONTEND_URL}/settings",
        )
        return {"url": session.url}
    except Exception:
        checkout = stripe.checkout.Session.create(
            customer_email=user.email,
            mode="setup",
            success_url=f"{FRONTEND_URL}/settings",
            cancel_url=f"{FRONTEND_URL}/settings",
        )
        return {"url": checkout.url}


@router.get("/current")
async def current_subscription(user: UserRecord = Depends(get_current_user)):
    return {
        "plan": user.plan.value if hasattr(user.plan, 'value') else user.plan,
        "has_stripe_id": bool(user.stripe_customer_id if hasattr(user, 'stripe_customer_id') else False),
    }


@router.post("/webhook")
async def stripe_webhook(request: Request, session: AsyncSession = Depends(get_session)):
    if not STRIPE_WEBHOOK_SECRET:
        return {"status": "ignored", "detail": "Webhook secret not configured"}

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        sess = event["data"]["object"]
        user_id = sess.get("metadata", {}).get("user_id")
        plan = sess.get("metadata", {}).get("plan", "basic")
        customer_id = sess.get("customer")

        if user_id:
            user_result = await session.execute(select(UserRecord).where(UserRecord.id == int(user_id)))
            user_record = user_result.scalar_one_or_none()
            if user_record:
                user_record.plan = plan
                if hasattr(user_record, 'stripe_customer_id'):
                    user_record.stripe_customer_id = customer_id
                user_record.stripe_subscription_id = sess.get("subscription", "")
                await session.commit()

    elif event["type"] == "customer.subscription.updated":
        sub = event["data"]["object"]
        customer_id = sub.get("customer")
        status = sub.get("status")
        items = sub.get("items", {}).get("data", [])
        if items and customer_id:
            price_id = items[0].get("price", {}).get("id", "")
            plan_map = {v: k for k, v in PLAN_PRICE_IDS.items()}
            plan = plan_map.get(price_id, "basic")
            user_result = await session.execute(
                select(UserRecord).where(UserRecord.stripe_customer_id == customer_id)
            )
            user_record = user_result.scalar_one_or_none()
            if user_record and status == "active":
                user_record.plan = plan
                await session.commit()

    elif event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        customer_id = sub.get("customer")
        if customer_id:
            user_result = await session.execute(
                select(UserRecord).where(UserRecord.stripe_customer_id == customer_id)
            )
            user_record = user_result.scalar_one_or_none()
            if user_record:
                user_record.plan = "basic"
                await session.commit()

    return {"status": "ok"}
