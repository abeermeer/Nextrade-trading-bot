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
- Railway auto-deploys from GitHub master branch (linked via Railway dashboard)
- Vercel: deploy manually (see Vercel section below for full command)
- Frontend build: `cd frontend && npm run build`

## Auth
- Admin: abeermeer7979@gmail.com (password in Railway ADMIN_PASSWORD env var, NOT in code)
- JWT Bearer tokens, bcrypt passwords, Fernet AES-256 key encryption
- JWT_SECRET, ENCRYPTION_KEY, FRONTEND_URL set on Railway

## Vercel
- SPA rewrites configured via `frontend/vercel.json` (all routes → index.html)
- **Current config**: `rootDirectory: "frontend"`, `outputDirectory: "dist"`, `buildCommand: ""` (empty — pre-built files committed)
- Pre-built frontend is force-committed to `frontend/dist/` (bypassed `.gitignore` with `git add -f`)
- **Rebuild locally**: `cd frontend && npm install --legacy-peer-deps && npm run build && git add -f frontend/dist/ && git commit -m "update frontend dist" && git push`
- Vercel project: `abeermeer1/dist`, aliased to `https://dist-rho-sandy-41.vercel.app`
- Vercel token: set in AGENTS.md (removed from committed version)

## Signal Thresholds
- **Paper mode**: min_signals=1, confidence_threshold=0.15, action_threshold=0.05 (more trades)
- **Live mode**: min_signals=2, confidence_threshold=0.5, action_threshold=0.15 (stricter, unchanged)
- `action_threshold` is configurable in `strategies.yaml` under `signal_resolution.action_threshold` and `signal_resolution.paper.action_threshold`
- Passed to `signal_aggregator.py` as `self.action_threshold` / `self.paper_action_threshold`

## Strategies (15)
RSI, MACD cross, EMA trend, Volume breakout, Bollinger squeeze, Supertrend, ADX, Ichimoku, Pullback, Range, CounterTrend, StochRSI, PSAR, MFI, VWAP
All in `analyst/strategies/` — simple BaseStrategy subclass, uses pandas_ta

Bearish market: CounterTrend (0.25) + StochRSI (0.20) + MFI (0.15) = 0.60 BUY weight, enough to overcome SELL signals for paper/live trades

## Key Rules
- NEVER return exchange keys to client (PUT only, form starts empty)
- WebSocket 4001 close -> redirect to /login (no reconnect loop)
- Stripe code written but blocked — needs STRIPE_SECRET_KEY etc on Railway
- AGENTS.md and SESSION_SUMMARY.md in .gitignore (local only, not in repo)
- CORS allows: localhost:5173, Vercel prod URLs, Railway backend
- Frontend sends token as `Authorization: Bearer` header via `request()` helper
- Backend platform_router endpoints accept Bearer header OR `?token=` query param

## File Layout
- web/ — FastAPI routers (auth, user, platform, stripe, withdrawal)
- frontend/src/pages/ — 22 lazy-loaded pages
- analyst/ — data_fetcher (ccxt), indicator_calculator, signal_aggregator, strategy_runner
- analyst/strategies/ — 15 trading strategies (BaseStrategy subclasses, pandas_ta)
- trader/ — multi-tenant paper/live executor
- backtest/ — backtester (uses analyst's DataFetcher for historical data)
- shared/ — encryption, redis, models, logger, plan_limits
- db/ — SQLAlchemy models + async session
- tests/ — pytest backend tests (64 passing)

## Railway Required Env Vars
Set these in Railway dashboard (Project → Variables):
- ADMIN_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, FRONTEND_URL
- REDIS_URL (from Railway Redis Plugin — attach to ALL 3 services)
- DATABASE_URL (auto-provisioned by Railway PostgreSQL)
- MEXC_API_KEY, MEXC_API_SECRET (for live mode)

## Railway Services Setup
You need 3 separate services in the Railway project:
1. **web** — Dockerfile.web (FastAPI dashboard, already running)
2. **analyst** — Dockerfile.analyst (signal generation)
3. **trader** — Dockerfile.trader (executes trades)

**CRITICAL**: The Redis Plugin MUST be attached to ALL 3 services (web, analyst, trader) so they share the same Redis instance. Without this, the analyst publishes signals to one Redis and the trader subscribes to another (or none) — resulting in 0 trades.

To fix: Railway dashboard → each service → Variables → Add Reference → Redis Plugin. Or add REDIS_URL manually as a shared variable across all services.

## Recent Fixes (Completed Jun 27)

### Redis Split-Redis Bug
- `shared/redis_client.py`: Now also loads `config/.env` if `REDIS_URL` not in env vars (fallback for Railway services without the Redis Plugin env var auto-set)
- `web/user_router.py`: `RedisClient()` → `create_redis_client()` so "Start Bot" commands reach the correct Redis instance
- **Symptom**: Analyst publishes signals, trader receives nothing → 0 trades

### Signal Aggregator Weights
- `analyst/signal_aggregator.py`: `_weighted_aggregate` now uses `strategy_weight * r.confidence` instead of just `r.confidence`. Action threshold lowered 0.2 → 0.15
- **Symptom**: Even with good market data, all signals were HOLD because strategy weights weren't applied

### 40 Pairs
- `max_pairs_to_analyze`: 10 → 40
- `DEFAULT_PAIRS`: 10 → 40 pairs (fallback when MEXC tickers fail)
- Trader realtime feed: 5 → 20 symbols

### Vercel 404 Fix
- `vercel.json` MUST be in `dist/` before deploy. Run:
  ```powershell
  cd frontend && npm run build && Copy-Item vercel.json dist\ && vercel deploy dist --prod --yes --token <token>
  ```

### DATABASE_URL Reference for Web Service
- Web service (`mexc-trading-bot`) was using local SQLite instead of shared PostgreSQL
- Admin user created in SQLite by seed_admin was invisible to trader (which reads PostgreSQL)
- Fixed: Added `DATABASE_URL=${{Postgres.DATABASE_URL}}` via Railway GraphQL API
- All 3 services (web, analyst, trader) must share the same PostgreSQL for users/trades to work

### Start Command Fix
- Dockerfile.web already has correct `CMD` — do NOT set custom startCommand
- Setting `startCommand: "python scripts/run_web.py"` broke deploy (file doesn't exist)
- Fixed by setting correct startCommand via `serviceInstanceUpdate` GraphQL mutation
- Lesson: Check if Dockerfile exists first; if yes, don't override CMD

## PostgreSQL Reference (All Services)
**CRITICAL**: DATABASE_URL (PostgreSQL) must be added to ALL 3 services, not just trader + analyst. Without it on the web service, user registrations/bot status go to local SQLite and the trader never sees them.

To add: Railway dashboard → each service → Variables → Add Reference → Postgres Plugin. Or via GraphQL API:
```graphql
mutation { variableUpsert(input: { projectId: "...", environmentId: "...", serviceId: "...", name: "DATABASE_URL", value: "${{Postgres.DATABASE_URL}}" }) }
```

## Start Command
- Web service Dockerfile.web has `CMD uvicorn web.main:app --host 0.0.0.0 --port ${PORT:-8000}`
- Do NOT set custom startCommand unless there's no Dockerfile. Overriding it breaks the deploy.
- To reset: `railway variable set --service web` won't fix it. Use `serviceInstanceUpdate` via API:
  ```graphql
  mutation { serviceInstanceUpdate(input: { startCommand: "uvicorn web.main:app --host 0.0.0.0 --port $PORT" }, serviceId: "...") }
  ```

## Railway GraphQL API
- URL: `https://backboard.railway.app/graphql/v2`
- Auth: `Authorization: Bearer <token>`
- Token type: Account/workspace token (set as `RAILWAY_API_TOKEN` env var) or project token (`RAILWAY_TOKEN`)

## Active Issues
- **Stripe**: Code written but needs `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` on Railway
- **Custom domain**: Purchase + point to Vercel + Railway
- **DB persistence**: Trades EXECUTE (BUY/SELL logs in Redis) but `save_position`/`save_trade` calls fail silently. `/api/trades` and `/api/positions` return `[]`. Debug prints added to `trader_bot.py` (`DBG save_position`, `DBG save_trade`, `DBG save SUCCESS/FAILED`) — check Railway deployment logs for the error.

## Fix: Stale DATABASE_URL Variables (Jun 27)

**Root cause**: Trader, analyst, and web services each had service-level `DATABASE_URL` variables that overrode the Railway Postgres plugin's auto-set value. If these were set to an old/incorrect database, `save_position`/`save_trade` would write to the wrong DB or fail silently.

**Fix summary**:
1. Deleted service-level `DATABASE_URL` from all 3 services via `variableDelete` GraphQL mutation
2. All 3 now inherit the Postgres plugin's auto-set value
3. All 3 successfully redeployed and confirmed healthy
4. `seed_admin.bot_active` changed `False` → `True` so admin auto-generates trader session

**Verify by**: Log into dashboard → `/api/positions` and `/api/trades` should show live data after trades execute.

## Railway GraphQL API Guide
- To delete a stale variable:
  ```graphql
  mutation { variableDelete(input: { projectId: "...", environmentId: "...", serviceId: "...", name: "DATABASE_URL" }) }
  ```
- To redeploy a service:
  ```graphql
  mutation { serviceInstanceRedeploy(serviceId: "...", environmentId: "...") }
  ```
- Listing all service IDs:
  ```graphql
  query { project(id: "...") { services { edges { node { id name } } } } }
  ```
- Variable list (helps find stale service-level vars):
  ```graphql
  query { environment(id: "...") { variables { edges { node { id name serviceId } } } } }
  ```
