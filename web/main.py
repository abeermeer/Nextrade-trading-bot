from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.database import init_db, close_db
from web.routers import router
from web.auth_router import router as auth_router, seed_admin
from web.user_router import router as user_router


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
        "https://mexc-trading-bot.netlify.app",
        "https://mexc-trading-bot-production-c215.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(user_router)
app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok"}
