import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Query, Request, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, func
from starlette.middleware.base import BaseHTTPMiddleware

from db.database import init_db, close_db, async_session_factory
from db.models import PositionRecord, TradeRecord, OrderStatusDB
from web.routers import router
from web.auth_router import router as auth_router
from scripts.seed_admin import seed_admin
from web.user_router import router as user_router
from web.wallet_router import router as wallet_router
from web.withdrawal_router import router as withdrawal_router
from web.platform_router import router as platform_router
from web.stripe_router import router as stripe_router
from web.auth import decode_token
from shared.redis_client import create_redis_client
from shared.config_loader import ConfigLoader


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith("/api/") and path not in ("/api/status", "/api/logs", "/health"):
            auth = request.headers.get("Authorization", "")
            token = None
            if auth.startswith("Bearer "):
                token = auth[7:]
            elif "token" in request.query_params:
                token = request.query_params["token"]
            if token:
                try:
                    payload = decode_token(token)
                    user_id = payload.get("sub") or payload.get("user_id")
                    if user_id:
                        from shared.redis_client import create_redis_client
                        from datetime import datetime, timezone
                        rc = create_redis_client()
                        await rc.connect()
                        key = f"ratelimit:user:{user_id}"
                        now = int(datetime.now(timezone.utc).timestamp())
                        window = now // 60
                        window_key = f"{key}:{window}"
                        count = await rc.get(window_key)
                        if count and int(count) >= 60:
                            await rc.disconnect()
                            return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})
                        await rc.set(window_key, str(int(count or 0) + 1), ttl=120)
                        await rc.disconnect()
                except Exception:
                    pass
        response = await call_next(request)
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_admin()
    yield
    await close_db()


app = FastAPI(title="MEXC Trading Bot Dashboard", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://dist-rho-sandy-41.vercel.app",
        "https://mexc-trading-bot-production-c215.up.railway.app",
    ],
    # Allow any Vercel deployment/preview URL (each deploy gets a unique *.vercel.app host)
    allow_origin_regex=r"https://[a-z0-9-]+\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RateLimitMiddleware)

app.include_router(auth_router)
app.include_router(wallet_router)
app.include_router(withdrawal_router)
app.include_router(platform_router)
app.include_router(user_router)
app.include_router(stripe_router)
app.include_router(router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    try:
        decode_token(token)
    except Exception:
        await websocket.close(code=4001)
        return

    await websocket.accept()

    try:
        while True:
            rc = None
            try:
                rc = create_redis_client()
                await rc.connect()

                now = datetime.now(timezone.utc)
                analyst_alive = False
                trader_alive = False

                recent = await rc.lrange("signals:recent", 0, 0)
                if recent:
                    signal_data = json.loads(recent[0])
                    ts = datetime.fromisoformat(signal_data.get("timestamp", ""))
                    if (now - ts.replace(tzinfo=timezone.utc)).total_seconds() < 300:
                        analyst_alive = True

                heartbeat = await rc.lrange("heartbeat:analyst", 0, 0)
                if heartbeat:
                    ts = datetime.fromisoformat(json.loads(heartbeat[0]).get("timestamp", ""))
                    if (now - ts.replace(tzinfo=timezone.utc)).total_seconds() < 120:
                        analyst_alive = True

                trader_hb = await rc.lrange("heartbeat:trader", 0, 0)
                if trader_hb:
                    ts = datetime.fromisoformat(json.loads(trader_hb[0]).get("timestamp", ""))
                    if (now - ts.replace(tzinfo=timezone.utc)).total_seconds() < 120:
                        trader_alive = True

                mode = "paper"
                try:
                    settings = ConfigLoader().load_settings()
                    mode = settings.get("bot", {}).get("mode", "paper")
                except Exception:
                    pass

                await websocket.send_json({
                    "type": "status",
                    "data": {
                        "mode": mode,
                        "analyst_alive": analyst_alive,
                        "trader_alive": trader_alive,
                        "uptime_seconds": 0,
                    }
                })

                raw = await rc.lrange("signals:recent", 0, 49)
                signals = []
                for item in raw:
                    s = json.loads(item)
                    signals.append({
                        "symbol": s.get("symbol"),
                        "action": s.get("action"),
                        "confidence": s.get("confidence"),
                        "price": s.get("price"),
                        "timestamp": s.get("timestamp"),
                        "timeframe": s.get("timeframe"),
                        "strategy_results": s.get("strategy_results", []),
                    })
                await websocket.send_json({"type": "signals", "data": signals})

                raw = await rc.lrange("logs:bot", 0, 49)
                logs = []
                for item in raw:
                    try:
                        logs.append(json.loads(item))
                    except Exception:
                        logs.append({"message": item})
                await websocket.send_json({"type": "logs", "data": logs})

                await rc.disconnect()
                rc = None
            except Exception:
                if rc:
                    try:
                        await rc.disconnect()
                    except Exception:
                        pass

            try:
                async with async_session_factory() as session:
                    result = await session.execute(
                        select(PositionRecord).where(PositionRecord.status == OrderStatusDB.open)
                    )
                    rows = result.scalars().all()
                    await websocket.send_json({
                        "type": "positions",
                        "data": [
                            {
                                "id": str(r.id),
                                "symbol": r.symbol,
                                "side": r.side.value,
                                "entry_price": r.entry_price,
                                "current_price": r.current_price,
                                "quantity": r.quantity,
                                "unrealized_pnl": r.unrealized_pnl,
                                "realized_pnl": r.realized_pnl,
                                "stop_loss": r.stop_loss,
                                "take_profit": r.take_profit,
                                "opened_at": r.opened_at.isoformat(),
                                "closed_at": r.closed_at.isoformat() if r.closed_at else None,
                                "status": r.status.value,
                            }
                            for r in rows
                        ]
                    })
            except Exception:
                pass

            try:
                async with async_session_factory() as session:
                    closed_result = await session.execute(
                        select(func.count(), func.coalesce(func.sum(TradeRecord.pnl), 0))
                        .where(TradeRecord.pnl.isnot(None))
                    )
                    total_trades, total_pnl = closed_result.one()

                    wins_result = await session.execute(
                        select(func.count()).where(TradeRecord.pnl > 0)
                    )
                    wins = wins_result.scalar() or 0
                    win_rate = (wins / total_trades * 100) if total_trades > 0 else 0.0

                    equity_result = await session.execute(
                        select(TradeRecord.created_at, TradeRecord.pnl)
                        .where(TradeRecord.pnl.isnot(None))
                        .order_by(TradeRecord.created_at)
                    )
                    equity_rows = equity_result.all()

                    running_total = 10000.0
                    equity_curve = []
                    for row in equity_rows:
                        running_total += (row.pnl or 0)
                        equity_curve.append({
                            "date": row.created_at.isoformat(),
                            "value": round(running_total, 2),
                        })

                    await websocket.send_json({
                        "type": "performance",
                        "data": {
                            "total_pnl": round(total_pnl, 2),
                            "win_rate": round(win_rate, 1),
                            "total_trades": total_trades,
                            "equity_curve": equity_curve,
                        }
                    })
            except Exception:
                pass

            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass


@app.get("/health")
async def health():
    return {"status": "ok"}
