<div align="center">
  <h1>NexTrade AI</h1>
  <p>Multi-tenant algorithmic trading platform for MEXC exchange</p>
  <p>
    <img src="https://img.shields.io/badge/python-3.12-blue?style=flat-square" alt="Python 3.12">
    <img src="https://img.shields.io/badge/react-19-61DAFB?style=flat-square" alt="React 19">
    <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square" alt="FastAPI">
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License">
  </p>
</div>

## Overview

NexTrade AI is a production-grade algorithmic trading platform that runs on the MEXC cryptocurrency exchange. It features an autonomous market analyst that generates signals using 8 strategies, a multi-tenant trader that executes positions per user, and a full SaaS web dashboard with JWT authentication, encrypted API key storage, and plan-based access control.

**Live demo:** [mexc-trading-bot.netlify.app](https://mexc-trading-bot.netlify.app)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Netlify)                     │
│  React 19 + Tailwind v4 + Recharts + React Query         │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS / JWT
┌────────────────────▼────────────────────────────────────┐
│                   Backend (Railway)                       │
│  FastAPI + SQLAlchemy async + Redis pub/sub               │
│  JWT auth · Plan enforcement · Rate limiting              │
│  Encrypted MEXC key storage (Fernet AES-256)              │
└──────┬──────────────────────────────┬───────────────────┘
       │ Redis pub/sub                │ Redis pub/sub
┌──────▼──────────┐          ┌───────▼───────────────────┐
│  Analyst Bot    │          │     Trader Bot (Railway)   │
│  · 8 strategies │ signals  │  · Multi-tenant sessions   │
│  · Signal gen   │────────►  │  · Per-user MEXC clients  │
│  · Heartbeat    │          │  · Paper + Live execution  │
└─────────────────┘          │  · Risk management         │
                             │  · Position tracking        │
                             │  · Telegram/Email alerts    │
                             └────────────────────────────┘
```

### Services

| Service | Stack | Hosting |
|---|---|---|
| **Frontend** | React 19, TypeScript, Tailwind v4, Recharts | Netlify |
| **Backend API** | FastAPI, SQLAlchemy (async), PostgreSQL, Redis | Railway |
| **Analyst Bot** | Python, pandas_ta, ccxt, Redis pub/sub | Railway |
| **Trader Bot** | Python, ccxt, Redis pub/sub, multi-tenant | Railway |
| **Database** | PostgreSQL (prod) / SQLite (dev) | Railway |
| **Cache** | Redis — signals, heartbeats, logs, rate limits | Railway |

## Features

### Trading Engine
- **8 strategies**: RSI, MACD cross, EMA trend, Volume breakout, Bollinger squeeze, Supertrend, ADX, Ichimoku
- **Multi-timeframe analysis**: 15m, 1h, 4h with configurable signal resolution
- **Paper trading** with realistic fill simulation (slippage, spread)
- **Live trading** via MEXC exchange (spot + futures)
- **Risk management**: max position size, daily drawdown limits, circuit breaker, cooldown
- **Per-user positions, signals, and trade history** stored in PostgreSQL

### SaaS Platform
- **JWT authentication** with bcrypt password hashing (24h token expiry)
- **Three subscription tiers**: Basic ($29), Pro ($79), Enterprise ($199)
- **Plan enforcement**: per-tier limits on pairs, bots, position size, and trade type
- **Encrypted API key storage**: Fernet AES-256 at rest
- **Multi-tenant trader**: shared executor with per-user isolated sessions
- **Real-time bot control** via Redis pub/sub (no polling delay)
- **Rate limiting**: token bucket per user (60 requests/min)
- **Admin panel**: user management, plan overview, key status

### Monitoring
- **Analyst + Trader health monitoring** via Redis heartbeats
- **Real-time bot logs** streamed to Redis, visible in dashboard
- **Equity curve chart** with Recharts (auto-updating)
- **P&L tracking**, win rate, trade history
- **Notifications**: Telegram + Email (SMTP)

## Subscription Plans

| Feature | Basic ($29) | Pro ($79) | Enterprise ($199) |
|---|---|---|---|
| Concurrent bots | 1 | 3 | Unlimited |
| Trading pairs | 3 | 10 | Unlimited |
| Max position | $500 | $5,000 | Unlimited |
| Spot trading | ✅ | ✅ | ✅ |
| Futures trading | ❌ | ✅ | ✅ |
| API access | ✅ | ✅ | ✅ |

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- Redis 7+
- MEXC API keys

### 1. Clone & Setup

```bash
git clone https://github.com/abeeruniversity/mexc-trading-bot.git
cd mexc-trading-bot

# Python virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate     # Windows
pip install -r requirements.txt
pip install -e .

# Frontend
cd frontend
npm install
cd ..
```

### 2. Configure

```bash
# Required: MEXC API credentials
cp config/.env.example config/.env
# Edit config/.env with your keys

# Optional: Override via environment variables
export JWT_SECRET="your-jwt-secret"
export ENCRYPTION_KEY="your-fernet-key"
export DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/db"
export REDIS_URL="redis://:password@host:6379"
```

### 3. Run

```bash
# Start Redis (if not running)
docker-compose up redis -d

# Start backend
uvicorn web.main:app --reload --port 8000

# Start analyst (separate terminal)
python -m analyst.analyst_bot

# Start trader (separate terminal)
python -m trader.trader_bot

# Start frontend dev server (separate terminal)
cd frontend && npm run dev
```

### Docker

```bash
docker-compose up --build
```

This starts Redis, backend (FastAPI), analyst, and trader services.

## API Reference

The backend exposes a REST API at `/api/*`. All authenticated endpoints require `Authorization: Bearer <token>`.

### Public Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Current user profile |
| POST | `/api/auth/wallet-nonce` | Get SIWE message to sign (for wallet auth) |
| POST | `/api/auth/wallet-login` | Sign in with crypto wallet (EVM/Solana) |
| POST | `/api/auth/wallet-link` | Link wallet to existing email account |

### User Endpoints (authenticated)
| Method | Path | Description |
|---|---|---|
| GET | `/api/status` | Bot + analyst health |
| GET | `/api/signals` | Recent trading signals |
| GET | `/api/positions` | Open positions |
| GET | `/api/trades` | Trade history |
| GET | `/api/performance` | P&L, win rate, equity curve |
| GET | `/api/logs` | Real-time bot logs |
| PUT | `/api/user/mexc-keys` | Save encrypted MEXC keys |
| GET | `/api/user/mexc-keys` | Decrypt & return MEXC keys |
| PUT | `/api/user/settings` | Update mode, trade type, position limit |
| POST | `/api/user/bot` | Start/stop bot |
| GET | `/api/user/bot/status` | Bot configuration status |
| PUT | `/api/user/wallet` | Save/connect crypto wallet (sig verified) |
| GET | `/api/user/wallet` | Get connected wallet info |
| DELETE | `/api/user/wallet` | Disconnect wallet |

### Admin Endpoints (admin only)
| Method | Path | Description |
|---|---|---|
| GET | `/api/user/admin/users` | List all users with plan/status/key info |

## Project Structure

```
├── analyst/              # Market analyst — signal generation
│   ├── analyst_bot.py    # Main loop, strategy orchestration
│   └── strategies/       # 8 strategy implementations
├── backtest/             # Backtesting framework
├── config/               # YAML configuration files
│   ├── settings.yaml     # Bot/trader/analyst/redis config
│   └── strategies.yaml   # Strategy parameters
├── db/                   # Database layer
│   ├── database.py       # Async SQLAlchemy engine + sessions
│   ├── models.py         # UserRecord, SignalRecord, etc.
│   └── repository.py     # CRUD helpers
├── frontend/             # React 19 SPA
│   ├── src/pages/        # Landing, Dashboard, Settings, Admin, etc.
│   ├── src/api/          # API client with JWT Bearer auth
│   └── src/context/      # Auth context provider
├── shared/               # Shared modules
│   ├── models.py         # Pydantic models
│   ├── redis_client.py   # Redis pub/sub + lists + KV
│   ├── encryption.py     # Fernet AES-256 encrypt/decrypt
│   ├── plan_limits.py    # Per-plan limits + enforcement
│   ├── wallet.py         # SIWE nonce + EVM/Solana signature verification
│   └── rate_limiter.py   # Token bucket rate limiter
├── tests/                # 64 passing tests
├── trader/               # Multi-tenant trade executor
│   ├── trader_bot.py     # Main loop, UserSession management
│   ├── paper_engine.py   # Simulated trading engine
│   ├── risk_manager.py   # Position sizing, drawdown, circuit breaker
│   ├── position_tracker.py
│   ├── notifier.py       # Telegram + Email alerts
│   └── exchange/         # MEXC client (spot + futures)
├── web/                  # FastAPI web backend
│   ├── main.py           # App factory + middleware
│   ├── auth.py           # bcrypt + JWT utilities
│   ├── auth_router.py    # Register/login/me + admin seed
│   ├── wallet_router.py  # Wallet auth (nonce, login, link)
│   ├── user_router.py    # User settings, MEXC keys, bot control, wallet
│   └── routers.py        # Status, signals, positions, trades, logs
├── docker-compose.yml    # Local dev setup
├── Dockerfile.web         # Backend container
├── Dockerfile.analyst     # Analyst container
├── Dockerfile.trader      # Trader container
├── requirements.txt       # Python dependencies
└── pyproject.toml         # Project metadata + tool config
```

## Testing

```bash
# Run all 64 tests
pytest tests/ -v

# With coverage
pytest tests/ --cov=. --cov-report=term
```

## Deployment

The system is designed for a three-platform deployment:

| Component | Platform | Deployment |
|---|---|---|
| Frontend | **Netlify** | Auto-deploys from GitHub on push |
| Backend API | **Railway** | `railway up --service mexc-trading-bot` |
| Analyst Bot | **Railway** | `railway up --service analyst` |
| Trader Bot | **Railway** | `railway up --service trader` |
| PostgreSQL | **Railway** | Managed add-on |
| Redis | **Railway** | Managed add-on |

## License

MIT
