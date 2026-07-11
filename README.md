<div align="center">
  <h1>NexTrade AI</h1>
  <p>Multi-exchange algorithmic trading platform — MEXC, Binance, Bybit</p>
  <p>
    <a href="https://mexc-trading-bot-production-c215.up.railway.app/health">
      <img src="https://img.shields.io/badge/backend-online-success?style=flat-square" alt="Backend">
    </a>
    <a href="https://dist-rho-sandy-41.vercel.app">
      <img src="https://img.shields.io/badge/frontend-deployed-blue?style=flat-square" alt="Frontend">
    </a>
    <img src="https://img.shields.io/badge/python-3.12-blue?style=flat-square" alt="Python 3.12">
    <img src="https://img.shields.io/badge/react-19-61DAFB?style=flat-square" alt="React 19">
    <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square" alt="FastAPI">
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License">
    <img src="https://img.shields.io/badge/strategies-15-orange?style=flat-square" alt="15 Strategies">
    <img src="https://img.shields.io/badge/tests-75%20passing-brightgreen?style=flat-square" alt="75 Tests Passing">
  </p>
</div>

---

## Overview

NexTrade AI is a production-grade algorithmic trading platform supporting **MEXC, Binance, and Bybit**. It features an autonomous analyst that scans markets using **15 strategies** across multiple timeframes, a self-improving **strategy scorer** that backtests and tracks real-time accuracy to dynamically adjust weights, and a multi-tenant trader that executes positions per user via Redis pub/sub.

The frontend is a **dark-only** React 19 SPA with an amber/gold accent palette and Inter typography — designed for extended trading sessions. The backend serves a full SaaS platform: JWT auth, encrypted API key storage (Fernet AES-256), Stripe subscriptions, and plan-based access control.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Vercel)                      │
│  React 19 + Tailwind v4 + Recharts + React Query         │
│  Dark-only · Amber accent · Inter + JetBrains Mono       │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS / JWT
┌────────────────────▼────────────────────────────────────┐
│                   Backend (Railway)                       │
│  FastAPI + SQLAlchemy async + Redis pub/sub               │
│  JWT auth · Plan enforcement · Rate limiting              │
│  Encrypted exchange key storage (Fernet AES-256)          │
│  Stripe subscriptions · GDPR compliance                   │
└──────┬──────────────────────────────┬───────────────────┘
       │ Redis pub/sub                │ Redis pub/sub
┌──────▼──────────┐          ┌───────▼───────────────────┐
│  Analyst Bot    │ signals  │     Trader Bot (Railway)   │
│  · 15 strategies│────────► │  · Multi-tenant sessions   │
│  · Strategy     │          │  · Per-user exchange clients│
│    scorer       │          │  · Paper + Live execution  │
│  · Heartbeat    │          │  · Risk management         │
└─────────────────┘          │  · Position tracking        │
                             └────────────────────────────┘
```

### Services

| Service | Stack | Hosting |
|---------|-------|---------|
| **Frontend** | React 19, TypeScript, Tailwind v4, Recharts, Framer Motion | Vercel |
| **Backend API** | FastAPI, SQLAlchemy (async), PostgreSQL, Redis | Railway |
| **Analyst Bot** | Python, pandas_ta, ccxt, Redis pub/sub, strategy scorer | Railway |
| **Trader Bot** | Python, ccxt, Redis pub/sub, multi-tenant sessions | Railway |
| **Database** | PostgreSQL (prod) / SQLite (dev) | Railway |
| **Cache** | Redis — signals, heartbeats, logs, rate limits | Railway |

## Strategy Scorer

Strategies are scored and weighted dynamically using a hybrid approach:

1. **Backtest scorer** — Walk-forward backtest on BTC/ETH/SOL 1h data every 6h. Composite score from Sharpe, win rate, and P&L.
2. **Real-time accuracy tracker** — Records each strategy's vote, checks price direction next cycle. Filters noise below 0.1%.
3. **Weight blender** — Blends backtest baseline (70%) with accuracy drift (30%). Dynamic weights published to Redis and consumed by the aggregator.

Poor performers naturally lose weight over time — no manual tuning needed.

## Production Safety (Audited)

All critical failure modes from independent code audits have been addressed:

| Category | Fix |
|----------|-----|
| **Fake balance** | Replaced hardcoded `$10,000` with live `exchange.fetch_balance()` via `_get_live_balance()` |
| **Restart recovery** | `recover_positions()` seeds `PositionTracker` from exchange on startup |
| **SL/TP tracking** | `reconcile_positions()` live-diffs exchange positions vs local tracker every cycle |
| **Order traceability** | UUIDv4 `clientOrderId` on every order; `exchange_order_id` column persisted to DB |
| **Fee extraction** | Real fee from `create_order` response `fee.cost`; 0.1% fallback for paper mode |
| **Credential errors** | All 3 exchange clients surface actual error messages (no silent bare `except`) |
| **Min notional** | `_validate_order()` rejects orders below `$5` notional |
| **Hard cap** | 50 concurrent position limit enforced |
| **Balance snapshots** | Per-user equity tracked to Redis every 15 seconds |
| **Circuit breaker** | Drawdown-based trading halt in `RiskManager` |
| **Precision rounding** | Amounts and prices rounded to exchange precision via `load_markets()` before every order |
| **Correlation cap** | `RiskManager` limits correlated positions (max 2 per group: BTC/ETH, L1s, DeFi, memes, infra) |
| **Edge case protection** | Stop-loss defaults to `0.0` if calculated value out of range (negative/zero price) |
| **Position reconciliation** | Live-diff against exchange positions each cycle; DB trade record persisted when exchange closes a position |
| **Docker resiliency** | `restart: unless-stopped` + healthchecks on all 4 services (Redis ping, backend HTTP, analyst/trader Redis) |

## Features

### Trading Engine
- **15 strategies**: RSI, MACD cross, EMA trend, Volume breakout, Bollinger squeeze, Supertrend, ADX, Ichimoku, Pullback, Range, CounterTrend, StochRSI, PSAR, MFI, VWAP
- **Multi-timeframe analysis**: 15m, 1h, 4h with configurable signal resolution
- **Self-improving strategy scoring**: automatic backtesting + real-time accuracy tracking with dynamic weight blending
- **Paper trading** with realistic fill simulation (slippage, spread)
- **Live trading** via MEXC, Binance, Bybit (spot + futures)
- **Risk management**: max position size, daily drawdown limits, circuit breaker, cooldown, configurable leverage
- **Per-user positions, signals, and trade history** stored in PostgreSQL

### SaaS Platform
- **JWT authentication** with bcrypt password hashing (24h token expiry)
- **Three subscription tiers**: Basic ($29), Pro ($79), Enterprise ($199)
- **Plan enforcement**: per-tier limits on pairs, bots, position size, and trade type
- **Encrypted API key storage**: Fernet AES-256 at rest
- **Multi-tenant trader**: shared executor with per-user isolated sessions
- **Stripe subscription management**: checkout, webhook, billing portal, plan sync
- **Real-time bot control** via Redis pub/sub
- **Rate limiting**: token bucket per user (60 requests/min)
- **Admin panel**: user management, plan overview, key status

### Frontend
- **Dark-only design** with amber/gold accent, Inter + JetBrains Mono fonts
- **21 pages**: Landing, Dashboard, Settings, Positions, Trades, Signals, Backtesting, Docs, Changelog, Whitepaper, About, Security, Status, Privacy, Terms, Subscribe, and auth pages
- **Dashboard**: Real-time P&L, equity curve, open positions, signal history, strategy intelligence (weights, accuracy, backtest scores)
- **Strategy Performance page**: per-strategy win rate, P&L, signal count + scorer data
- **Live stats**: landing page displays real user count and total trades from the database
- **Code splitting**: All routes lazily loaded via `React.lazy` + `Suspense`
- **Loading skeletons**: `Skeleton`, `TableSkeleton`, `CardSkeleton`
- **Error boundaries**: `ErrorBoundary` wrapping all routes with retry button
- **Real-time updates**: WebSocket endpoint (`/ws`) with JWT auth + REST polling fallback
- **Responsive**: full mobile layout with hamburger navigation

### Account Features
- **Crypto wallet auth**: SIWE (EIP-4361) for EVM (MetaMask) + Solana (Phantom)
- **Email verification**: token-based verification on registration
- **Password reset**: forgot/reset password flow with email
- **Withdrawal protection**: address whitelist + time-delayed withdrawals
- **User API keys**: generate/revoke keys for programmatic API access
- **GDPR compliance**: data export (full JSON) + account deletion
- **Backtesting UI**: pair + strategy + period selectors with equity curve chart

### Trust & Transparency
- **Live social proof**: Landing page displays live user count and total trades from the database
- **Full documentation**: Terms of Service, Privacy Policy, Whitepaper, Security, Changelog, About pages
- **Registered company**: NexTrade AI Ltd., Larnaca, Cyprus

## Subscription Plans

| Feature | Basic ($29) | Pro ($79) | Enterprise ($199) |
|---------|------------|-----------|-------------------|
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
- Exchange API keys (MEXC, Binance, or Bybit)

### 1. Clone & Setup

```bash
git clone https://github.com/abeermeer/Nextrade-trading-bot.git
cd Nextrade-trading-bot
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt && pip install -e .
cd frontend && npm install && cd ..
```

### 2. Configure

```bash
cp config/.env.example config/.env
# Edit config/.env with your exchange API keys
```

### 3. Run

```bash
# Start all services (requires Docker)
docker-compose up --build

# Or run individually:
# Terminal 1: uvicorn web.main:app --reload --port 8000
# Terminal 2: python scripts/run_analyst.py
# Terminal 3: python scripts/run_trader.py
# Terminal 4: cd frontend && npm run dev
```

## Demo

<video src="docs/demo.mp4" controls width="100%"></video>

## Testing

```bash
# Run backend tests
pytest tests/ -v

# With coverage
pytest tests/ --cov=. --cov-report=term
```

## Deployment

| Component | Platform | Method |
|-----------|----------|--------|
| Frontend | **Vercel** | `cd frontend && npm run build && vercel deploy dist --prod` |
| Backend API | **Railway** | Auto-deploys from GitHub master via Dockerfile.web |
| Analyst Bot | **Railway** | Auto-deploys from GitHub master via Dockerfile.analyst |
| Trader Bot | **Railway** | Auto-deploys from GitHub master via Dockerfile.trader |
| PostgreSQL | **Railway** | Managed add-on, shared across all services via `DATABASE_URL` |
| Redis | **Railway** | Managed add-on, must be attached to all 3 services |

## Configuration

Runtime behaviour is driven by two config files (no code changes needed):

| File | Controls |
|------|----------|
| `config/settings.yaml` | Analyst timeframes & filters (MTF, ADX regime, volume), strategy scorer, trader risk (leverage, profit-take, trailing stop, whitelists, daily-trade cap) |
| `config/strategies.yaml` | Per-strategy parameters and live/paper `signal_resolution` (confidence & action thresholds, min signals) |

Secrets are read from environment variables only — see `config/.env.example`. The same `ENCRYPTION_KEY` must be set on the **web, analyst, and trader** services (it decrypts each user's stored exchange keys).

## Risk Disclaimer

> **NexTrade AI executes real trades with real funds.** Algorithmic trading — especially leveraged futures — carries substantial risk of loss. Paper-trading results do not reflect live performance (fees, slippage, spread, and latency all apply live). Nothing here is financial advice. Trade only what you can afford to lose, start on a small balance, and validate in paper mode first. The authors accept no liability for financial losses.

## License

Released under the [MIT License](LICENSE).
