# Project: Nextrade-trading-bot

## Stack
- Backend: Python 3.12, FastAPI, ccxt (public OHLCV), SQLAlchemy async, Redis, PostgreSQL
- Frontend: React 19, Vite 8, Tailwind v4, Recharts
- Infra: Railway (backend + DB + Redis), Vercel (frontend), GitHub (code)

## URLs
- Backend: https://mexc-trading-bot-production-c215.up.railway.app
- Frontend: https://dist-rho-sandy-41.vercel.app
- Health: https://mexc-trading-bot-production-c215.up.railway.app/health
- GitHub: https://github.com/abeermeer/Nextrade-trading-bot

## Deploy
- Railway auto-deploys from GitHub master branch
- Vercel: pre-built `frontend/dist/` committed, `rootDirectory: "frontend"`, `outputDirectory: "dist"`, `buildCommand: ""`
- Frontend rebuild: `cd frontend && npm install --legacy-peer-deps && npm run build && git add -f frontend/dist/ && git commit -m "update frontend dist" && git push`

## Auth
- Admin: abeermeer7979@gmail.com (password in Railway ADMIN_PASSWORD env var)
- JWT Bearer tokens, bcrypt passwords, Fernet AES-256 key encryption

## Signal Thresholds
- **Paper mode**: min_signals=1, confidence_threshold=0.15, action_threshold=0.05
- **Live mode**: min_signals=2, confidence_threshold=0.5, action_threshold=0.15
- Configured in `config/strategies.yaml`

## PostgreSQL Reference (All Services)
All 3 services (web, analyst, trader) must have `DATABASE_URL=${{Postgres.DATABASE_URL}}` set for shared DB.
Added via Railway GraphQL API `variableUpsert` mutation.

## Completed Production Safety Fixes (Jun 28)
1. **Claude-1.1: Fake balance fixed** — `_get_live_balance()` fetches real exchange balance instead of hardcoded $10,000
2. **Claude-1.2: Position recovery on restart** — `recover_positions()` seeds PositionTracker from exchange on startup
3. **Claude-1.3: SL/TP fill reconciliation** — `reconcile_positions()` live-diffs exchange positions vs local tracker every cycle
4. **Claude-1.4: Exchange order ID stored** — `exchange_order_id` column added to `TradeRecord` with Alembic migration
5. **Claude-1.5: Real fee from exchange** — fee extracted from create_order response, falls back to 0.1% estimate
6. **Claude-1.6: Testnet path** — `EXCHANGE_SANDBOX` env var controls sandbox flag
7. **Claude-1.7: Credential error surfacing** — all 3 exchange clients store error messages instead of bare `except`
8. **Claude-2: Execution safety** — UUIDv4 clientOrderId on every order, `_validate_order()` with min $5 notional + 50-position hard cap
9. **Claude-3: Leverage configurable** — leverage read from `settings["trader"]["leverage"]`, defaults to 10x
10. **Claude-4: Balance snapshots** — per-user balance, position count, realized PnL pushed to Redis every 15s
11. **DB migration** — Alembic version `3500ebf4e74e` adds `exchange_order_id` to trades table
12. **Mine-3: Live threshold logging** — signals below live-mode thresholds are logged

## Active Issues
- **Strategy quality**: 200+ paper trades executing but P&L ~0 (signals flip-flop quickly). Need strategy improvements, not threshold tuning.
- **Stripe**: Code written but needs `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` on Railway
- **Custom domain**: Purchase + point to Vercel + Railway

## Key Rules
- NEVER return exchange keys to client
- AGENTS.md and SESSION_SUMMARY.md in .gitignore (local only)
- CORS allows: localhost:5173, Vercel prod, Railway backend
- All services share same Redis (REDIS_URL from Redis Plugin)
