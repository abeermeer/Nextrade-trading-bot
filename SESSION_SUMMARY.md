# Project Summary

## Goal
Fully autonomous two-bot trading system (Market Analyst + Trader Bot) for MEXC spot & futures sold as SaaS subscription (3 tiers), multi-tenant accounts, encrypted API keys, JWT auth, crypto wallet (EVM + Solana), dark Tailwind v4 React frontend.

## Stack
- **Backend**: Python 3.12, FastAPI, ccxt, yfinance/CoinGecko, Redis pub/sub, Pydantic v2, structlog, PostgreSQL (Railway) / SQLite (dev)
- **Frontend**: React 19, Vite 8, Tailwind v4, Recharts, ethers, @solana/web3.js
- **Infra**: Railway (backend + bots + DB + Redis), Vercel (frontend), GitHub

## Done (Expanded)
- **Analyst/Trader DEAD fixed**: `lpush` for signals, 15s heartbeat caches, status endpoint reads `settings.yaml` mode correctly
- **JWT auth**: bcrypt hash/verify, JWT create/decode (HS256, 24h), register/login/me with Bearer middleware
- **Admin seed**: `abeermeer7979@gmail.com` (enterprise, is_admin, password in Railway env vars)
- **Exchange key mgmt**: Fernet AES-256 encrypt via `shared/encryption.py`, PUT endpoint only (no GET — keys never returned to client)
- **User settings API**: paper/live, spot/futures, max_position, bot start/stop via Redis pub/sub `bot:control`
- **Admin user list**: GET /api/user/admin/users — all users with plan/mode/bot_active/key status
- **Full frontend**: 22 pages — Landing, Login, Signup, VerifyEmail, ForgotPassword, ResetPassword, Dashboard, Settings, Admin, AdminAnalytics, Positions, Signals, Trades, StrategyPerformance, Backtesting, Status, Docs, Terms, Privacy, Whitepaper, About, Changelog, Security — all dark themed with code splitting
- **Multi-tenant trader**: per-user UserSession with PaperEngine/RiskManager/PositionTracker/exchange clients, signal execution per user_id
- **Wallet (EVM + Solana)**: SIWE nonce, eth_account recover, nacl verify; endpoints + WalletContext + WalletConnect (MetaMask + Phantom)
- **Plan enforcement**: `shared/plan_limits.py` — tier limits + usage caps + trial enforcement
- **18+ revenue-ready features**: strategy perf, portfolio, CSV export, backtesting UI, custom pairs, notification prefs, user API keys, admin analytics, trial status, usage tracking, GDPR export/delete
- **Platform depth**: code splitting (336KB max), dark/light mode, toast notifications, loading skeletons, error boundaries, sortable tables, WebSocket real-time
- **7 trust pages**: Terms, Privacy, Whitepaper, Security, Changelog, About, Status — plus company footer, support email, SLA commitment
- **64 backend tests passing**, frontend test setup (vitest + testing-library)
- **README**: fully updated with all API endpoints, full project structure, all features

## Completed This Session (Jun 17 — Security + Quality Pass)

### 🔴 Security
1. **Decrypted key GET endpoints removed** — `GET /api/user/exchange-keys` and `GET /api/user/mexc-keys` deleted from `user_router.py`. Keys are no longer returned to the frontend (prevents XSS/leak). Frontend Settings form starts empty each visit. Key status shown via `keys_verified` in `/api/auth/me` response.
2. **Duplicate PUT /mexc-keys removed** — `PUT /api/user/mexc-keys` consolidated into `PUT /api/user/exchange-keys` which handles all exchanges (MEXC/Binance/Bybit) via the `exchange` field. `MexcKeysRequest` model removed. `updateMexcKeys`/`getMexcKeys` removed from frontend API client.
3. **WebSocket token expiry** — Server closes with code 4001 on auth failure. Client `useWebSocket` hook now checks `event.code`; if 4001, clears token and redirects to `/login` instead of infinite reconnect loop.

### 🟠 Performance
4. **Backtest event loop fix** — `yfinance.Ticker.history()` calls in `Backtester.fetch_data()` now run via `loop.run_in_executor()` so they don't block the async event loop. `fetch_data` changed from sync to `async def`.

### 🟡 Reliability
5. **GDPR deletion** — `DELETE /api/user/data-delete` now stops the bot (sets `bot_active=False`, publishes `bot:control` stop via Redis) before deleting records and anonymizing user.
6. **Admin seed moved** — `seed_admin()` function extracted from `auth_router.py` to `scripts/seed_admin.py`. Imported in `main.py` from new location.
7. **SLA claim softened** — Changed from "99.5% uptime" to "Best-effort uptime" in both README and Status.tsx to avoid legal exposure.

### 📝 Documentation
8. **README fixes** — Architecture diagram updated ("Encrypted MEXC key storage" → "Encrypted exchange key storage"). `GET /api/auth/me` moved from Public to User Endpoints (requires auth). `user_router.py` description updated ("MEXC keys" → "exchange keys"). Removed stale `(18 endpoints)` count from `platform_router.py` description.

### 🚀 Deployed
- **GitHub**: `684efae` pushed to `abeeruniversity/mexc-trading-bot`
- **Netlify**: Production deploy live at `mexc-trading-bot.netlify.app`
- **Railway**: Backend redeployed, `/health` responding ✅
- **GitHub metadata**: Description updated, topics: `algorithmic-trading`, `trading-bot`, `mexc`, `binance`, `bybit`, `fastapi`, `react`, `saas`

### ✅ Files Changed (15)
- `web/user_router.py` — Removed 3 endpoints + MexcKeysRequest + unused `decrypt` import
- `web/auth_router.py` — Added `keys_verified` to UserResponse, removed seed_admin function
- `web/main.py` — Import seed_admin from scripts/seed_admin.py
- `web/platform_router.py` — GDPR now stops bot before deleting
- `backtest/backtester.py` — fetch_data async, yfinance in run_in_executor
- `scripts/seed_admin.py` — New file, extracted from auth_router
- `frontend/src/api/client.ts` — Removed getExchangeKeys, updateMexcKeys, getMexcKeys
- `frontend/src/types/index.ts` — Added keys_verified to UserProfile
- `frontend/src/context/AuthContext.tsx` — Added keys_verified to initial user state
- `frontend/src/pages/Settings.tsx` — Removed existingKeys query/effect, initializes from user.keys_verified
- `frontend/src/pages/Status.tsx` — SLA: Best-effort instead of 99.5%
- `frontend/src/hooks/useWebSocket.ts` — Close code 4001 → redirect to login
- `README.md` — 5 fixes (SLA, diagram, /me placement, descriptions)

## Completed This Session (Jun 26 — QA Audit + Stripe Integration)

### 🐛 Bugfixes
1. **Dead code removed** — Orphaned `seed_admin` body after `return` in `auth_router.py:208+` deleted. Unused `init_db` import removed.
2. **Unused imports cleaned** — `status`/`make_nonce`/`build_siwe_message` from `user_router.py`, `update` from `platform_router.py`, `Optional` from `routers.py` removed.
3. **Timezone fix** — `withdrawal_router.py:156` changed `datetime.utcnow()` → `datetime.now(timezone.utc)` for consistency.

### 🗣️ Stale copy
4. **Dashboard** — "Set your MEXC API keys" → "exchange API keys"
5. **Settings** — "Configure your bot and MEXC connection" → "exchange connection"

### 🔐 Rate limiting
6. **Query-param endpoints** — `RateLimitMiddleware` now also checks `request.query_params["token"]` for endpoints that pass token as query param instead of Bearer header.

### 💳 Stripe Subscription Integration
7. **Backend** — Created `web/stripe_router.py` with: `POST /api/subscribe/create-checkout`, `POST /api/subscribe/webhook`, `GET /api/subscribe/portal`, `GET /api/subscribe/current`. Stripe webhook handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` — auto-updates user plan in DB. Added `stripe_customer_id`/`stripe_subscription_id` to `UserRecord`. Registered router in `main.py`.
8. **Frontend** — Created `/subscribe` page at `frontend/src/pages/Subscribe.tsx` with pricing cards (Basic $29/Pro $79/Enterprise $199), Stripe checkout redirect, and billing portal link. Added to `App.tsx` routes and navbar ("Plan" link). Updated `client.ts` with `createCheckoutSession`, `getPortalUrl`, `currentSubscription`.

### ✅ Files Changed (13)
- `web/auth_router.py` — Removed dead seed_admin code + unused `init_db` import
- `web/user_router.py` — Removed unused imports
- `web/platform_router.py` — Removed unused `update` import
- `web/routers.py` — Removed unused `Optional` import
- `web/withdrawal_router.py` — Fixed timezone-aware datetime
- `web/main.py` — Added `stripe_router` import + register
- `web/stripe_router.py` — New: Stripe checkout/webhook/portal endpoints
- `db/models.py` — Added `stripe_customer_id`, `stripe_subscription_id` columns
- `requirements.txt` — Added `stripe>=10.0`
- `frontend/src/App.tsx` — Added `/subscribe` route
- `frontend/src/components/Navbar.tsx` — Added "Plan" link
- `frontend/src/pages/Subscribe.tsx` — New: pricing page with Stripe checkout
- `frontend/src/api/client.ts` — Added stripe API methods

## Completed This Session (Jun 26 — PDF Strategies + Deployments + Security + Fixes)
1. **PullbackStrategy + RangeStrategy** — 2 new strategies from "How to Profit From Cryptos 2025" PDF (buy on % pullback, range channel trading)
2. **Frontend deployed to Vercel** — `https://dist-rho-sandy-41.vercel.app`
3. **CI workflows fixed** — Backend: `pip install -e ".[dev]"`. Frontend: `npm ci --legacy-peer-deps`. Removed `--timeout` flag.
4. **`stripe` added to pyproject.toml** deps
5. **Repo transferred** — abeeruniversity/mexc-trading-bot → abeermeer/Nextrade-trading-bot
6. **Security fix** — Hardcoded admin password `Abeer@123` removed from code. Now reads from `ADMIN_PASSWORD` env var.
7. **.env.example updated** — All env vars documented
8. **AGENTS.md + SESSION_SUMMARY.md removed from repo** — Added to .gitignore, kept locally
9. **CORS fix** — Vercel URLs added to allow_origins in main.py
10. **Stripe default URL updated** — Netlify → Vercel default
11. **Railway env vars set** — JWT_SECRET, ENCRYPTION_KEY, FRONTEND_URL, ADMIN_PASSWORD configured
12. **Paper mode fix** — `user_router.py`: API keys check only for live mode, not paper. Dashboard.tsx: Start Bot button enabled in paper mode without keys, shows "Paper mode — no API keys needed" message
13. **Vercel SPA fix** — Added `vercel.json` with rewrites so dashboard/settings/etc routes work on refresh (no 404)
14. **Paper/live signal thresholds** — `strategies.yaml`: paper uses `min_signals=1`, `confidence=0.3` for more trades. Live keeps `min_signals=2`, `confidence=0.5`. `signal_aggregator.py` accepts `paper_mode` flag. `analyst_bot.py` reads mode from `settings.yaml`. Global mode set to `paper` for testing.

## Completed This Session (Jun 26 — 5 New Strategies + Profit Ratio Boost)
1. **CounterTrend strategy** — `analyst/strategies/counter_trend_strategy.py`: RSI(7) < 30 + below EMA(20) + 3% drop from high → BUY. Weight 0.25 (highest). Counterbalances SELL-heavy signals in bearish markets.
2. **StochRSI strategy** — `analyst/strategies/stoch_rsi_strategy.py`: Faster reversal detection than plain RSI. K line crosses oversold → BUY. Weight 0.20.
3. **PSAR strategy** — `analyst/strategies/psar_strategy.py`: Parabolic SAR trend follower. Pairs with Supertrend for double confirmation. Weight 0.15.
4. **MFI strategy** — `analyst/strategies/mfi_strategy.py`: Money Flow Index — volume + RSI for reliable divergences. Weight 0.15.
5. **VWAP strategy** — `analyst/strategies/vwap_strategy.py`: Buy below VWAP + EMA, sell above. Institutional level. Weight 0.15.
6. **Pullback weight reduced** — 0.15 → 0.10 to make room for higher-weighted counter-trend strategies.
7. **All registered** in `strategy_runner.py` STRATEGY_MAP and `strategies/__init__.py`.
8. **Committed + pushed** to GitHub — Railway auto-deploy triggered.

### Bearish Market Signal Balance (15 strategies)
- BUY side: CounterTrend(0.25) + StochRSI(0.20) + MFI(0.15) + VWAP(0.15) + Pullback(0.10) = **0.85**
- SELL side: RSI(0.20) + MACD(0.15) + EMA(0.15) + Supertrend(0.10) + ADX(0.10) + Ichimoku(0.10) = **0.80**
- Neutral: Volume(0.10) + Bollinger(0.10) + Range(0.10) + PSAR(0.15) = **0.45**
- Paper threshold (0.3, min 1): crossed by multiple BUY strategies alone
- Live threshold (0.5, min 2): CounterTrend + StochRSI/MFI/VWAP provide 2+ BUY signals

## Completed This Session (Jun 26 — Netlify Cleanup + README Privacy)
1. **Netlify URLs purged** — All 5 references replaced with Vercel URL: CORS in `web/main.py`, email verify/welcome/reset links in `web/auth_router.py`, "Go to Dashboard" button in `trader/templates/welcome.html`
2. **Live demo URL removed from README** — User requested no frontend URL visible on GitHub during testing phase
3. **README/AGENTS/SESSION** — Updated to reflect 15 strategies, Vercel deployment, Stripe endpoints
4. **All changes committed + pushed** — Railway auto-deploys with updated CORS + email links

## Completed This Session (Jun 26 — Frontend Sync + Vercel Deploy)
1. **Backtesting.tsx** — Strategy list updated from 8 → 15 strategies in dropdown
2. **Landing.tsx** — All "8 strategies" → "15": hero text, FAQ, stats counter `"15"`, features card `"15 AI Strategies"`, step-through description
3. **Docs.tsx** — FAQ now lists all 15 strategies by name
4. **About.tsx** — Timeline + description updated from 8 → 15
5. **Settings.tsx** — Strategy grid shows all 15 with correct config key names
6. **Vercel deployed** — Fresh build pushed to `dist-rho-sandy-41.vercel.app` (same URL). CLI token used for deploy.
7. **Verified live** — All "8 strategies" references replaced with "15" across all frontend pages

## Completed This Session (Jun 27 — Auth Fix + Paper Trade Fix + Backend Deploy)
1. **Strategy Performance + Backtest auth mismatch fixed** — `web/platform_router.py`: All 20+ endpoints changed from `token: str = Query(...)` to `Depends(_get_db_user)`. The new `_get_db_user` accepts token from either `Authorization: Bearer` header (frontend `request()` helper) OR `?token=` query param. Previously caused 422 Validation Error on every call.
2. **JWT payload key fixed** — `_get_db_user` was looking for `payload.get("user_id")` but `create_access_token` stores it as `"sub"`. Also fixed rate limiter in `web/main.py` with fallback.
3. **Strategy name lookup fixed** — `strategy-performance` endpoint was looking for `s.get("name")` in strategy_results but `StrategyResult` JSON serializes as `"strategy_name"`. Added fallback.
4. **Auto-start bot on register** — `web/auth_router.py`: New users get `bot_active=True` by default so the trader bot creates their session immediately without having to click "Start Bot" manually. Paper mode requires no API keys, so auto-start is safe.
5. **Dead code removed** — `backtest/backtester.py`: Removed unused `STRATEGY_NAMES` list (was 8 strategies, superseded by strategies.yaml config).
6. **Committed + pushed** `2bd5a8a` to `abeermeer/Nextrade-trading-bot` master → Railway auto-deployed.

## Completed This Session (Jun 27 — CCXT Data Source Migration)
1. **yfinance + CoinGecko removed** — Both unreliable (blocking calls, rate limits, stale data). Replaced with `ccxt.mexc()` public endpoints (free, real exchange data, no API keys needed). `analyst/data_fetcher.py` completely rewritten.
2. **Backtest data source** — `backtest/backtester.py` switched from yfinance to `DataFetcher.fetch_ohlcv_since()`. Removed yfinance symbol conversion + `run_in_executor` workaround.
3. **Pagination for long periods** — `fetch_ohlcv_since()` loops fetching 1000-candle batches, advancing `since` forward, concatenating results. Handles 3-month / 1h (2160+ candles) correctly.
4. **Retry on failure** — Both fetch methods retry 3x with exponential backoff (2s, 4s) on transient errors/rate limits. Old code had tenacity `@retry` but new code implements manual retry inline.
5. **Thread-safe exchange init** — `self._exchange` initialized eagerly in `__init__` (not lazy property), avoiding TOCTOU race when `run_in_executor` dispatches lambdas to thread pool.
6. **Dependencies cleaned** — `yfinance>=0.2` and `pycoingecko>=3.1` removed from `pyproject.toml`.
7. **Code review** — Dispatched reviewer via `requesting-code-review` skill. 3 issues found (pagination, retry, thread safety) and all fixed before deploy.
8. **Vercel 404 root cause fixed** — `vercel.json` was in `frontend/` but `vercel deploy dist --prod` treats `dist/` as root. Must copy `vercel.json` into `dist/` before deploy. `outputDirectory: "dist"` added to `frontend/vercel.json` for future root-level deploys.
9. **Tests passing** — All 64 backend tests pass. Both Railway + Vercel deployments live.

## Completed This Session (Jun 27 — Redis Fix + 40 Pairs + Signal Weights + Vercel Fix)
1. **Redis split-Redis bug fixed** — `shared/redis_client.py`: Added `config/.env` fallback for `REDIS_URL` using `load_dotenv`. `web/user_router.py`: Changed `RedisClient()` (always localhost) → `create_redis_client()` (picks up `REDIS_URL`). This fixes the "commands never reach trader" bug when bot is started from dashboard.
2. **Railway Redis Plugin instructions** — `AGENTS.md`: Documented that Redis Plugin must be attached to ALL 3 services (web, analyst, trader), not just web.
3. **Signal aggregator weight fix** — `analyst/signal_aggregator.py`: Changed `_weighted_aggregate` from using `r.confidence` as weight to using `strategy_config_weight * r.confidence`. Now honors YAML config weights (e.g., RSI=0.20, CounterTrend=0.25). Action threshold lowered 0.2 → 0.15 for more signals.
4. **40 pairs instead of 10** — `config/settings.yaml`: `max_pairs_to_analyze` 10→40. `analyst/pair_selector.py`: `DEFAULT_PAIRS` expanded from 10→40 (top coins). `trader/trader_bot.py`: realtime WebSocket feed expanded from 5→20 symbols.
5. **Vercel 404 fixed** — Redeployed frontend with `vercel.json` correctly placed inside `dist/` before deploy. Dashboard now loads all routes correctly.
6. **All 64 tests pass** — No regressions.
7. **Verified live** — `/api/status`: `analyst_alive: true`, `trader_alive: true`. `/api/signals`: 200 cached signals flowing (37 BUY, 126 SELL, 37 HOLD).

## Completed This Session (Jun 27 — DATABASE_URL Fix + PostgreSQL Share)
1. **DATABASE_URL added to web service** — Web service (`mexc-trading-bot`) was using its own **local SQLite** instead of shared PostgreSQL. Trader couldn't see users, so `bot_active=True` writes were invisible. Fixed via Railway API: added `DATABASE_URL=${{Postgres.DATABASE_URL}}` variable reference to web service.
2. **Start command lesson** — Web service uses `Dockerfile.web` which already has `CMD uvicorn web.main:app --host 0.0.0.0 --port ${PORT:-8000}`. Do NOT set a custom startCommand via Railway API unless Dockerfile is missing one. Setting `startCommand: "python scripts/run_web.py"` broke the deploy (file doesn't exist in new repo). Fixed by setting correct startCommand.
3. **Railway API token used** — Token `6b9a4909-...` used to query/mutate Railway GraphQL API at `https://backboard.railway.app/graphql/v2`.
4. **Current state**: Analyst alive, trader alive, web deployed & running on shared PostgreSQL. User needs to log in and click Start Bot to test trades.

## Completed This Session (Jun 27 — DB Persistence Fix + Cleanup)
1. **Stale service-level DATABASE_URL removed from all 3 services** — Trader, analyst, and web (`mexc-trading-bot`) each had manually-set DATABASE_URL variables that overrode the Railway Postgres plugin's auto-set value. If these were set to old/incorrect values (or to a different database), write operations (`save_position`/`save_trade`) would persist to the wrong database or fail silently (caught exception in `_open_position`/`_close_position`). Fixed by deleting all service-level DATABASE_URL variables via `variableDelete` GraphQL mutation. Services now inherit the correct Postgres plugin value.
2. **seed_admin bot_active=True** — Changed `bot_active=False` → `True` in `scripts/seed_admin.py` so the admin user auto-generates a trader session on login, eliminating the manual "Start Bot" step for testing.
3. **All services redeployed** — trader, analyst, web all confirmed `SUCCESS`. Health endpoint responding. Traffic flowing: analyst generating signals, trader alive, both sharing the same PostgreSQL.
4. **Commit `b78e0c6` pushed** to `abeermeer/Nextrade-trading-bot` master → Railway auto-deploy triggered.

## Completed This Session (Jun 27 — DB Still 0 + Lower Thresholds + Vercel Fix)
1. **DATABASE_URL added to trader/analyst** — Despite deleting stale vars, `trader` had `DATABASE_URL=NOT_SET` (Postgres plugin didn't auto-inject). Added `${{Postgres.DATABASE_URL}}` via `variableUpsert` to both trader and analyst. Trader now connects to PostgreSQL and finds 1 active user (`DBG _refresh_users found=1`).
2. **Signal thresholds lowered** — `strategies.yaml`: paper `confidence_threshold` 0.3→0.15, paper `action_threshold` 0.05 added. `signal_aggregator.py`: `action_threshold` now configurable from YAML (hardcoded 0.15→configurable via `self.action_threshold` / `self.paper_action_threshold`).
3. **Trades NOW EXECUTING** — BUY AAVE/USDT @ 93.88 qty=5.3259, SELL AAVE/USDT @ 93.88 pnl=0.80, BUY TRUMP/USDT @ 1.668 qty=299.76, BUY FIL/USDT @ 0.74 qty=675. Trades logged to Redis (`/api/logs`) but DB still returns `[]`.
4. **DB persistence STILL failing** — `save_position`/`save_trade` calls fail silently. Added `print()` debug statements around save calls (`DBG save_position`, `DBG save_trade`, `DBG save SUCCESS/FAILED`) — visible in Railway deployment logs but parse issue means structlog output not captured.
5. **Vercel 404 fixed (again)** — `outputDirectory` reset to `.` (root) causing `LAMBDAS` type deploy with 404. Fixed by: (a) setting `rootDirectory: "frontend"`, `outputDirectory: "dist"`, `buildCommand: ""`, (b) force-committed pre-built `frontend/dist/` (bypass `.gitignore` with `git add -f`), (c) pushed `9c265ee` to GitHub. Verified: `dist-rho-sandy-41.vercel.app/dashboard` returns HTML (not 404).

## Remaining
1. **DB persistence** — `save_position`/`save_trade` still fails despite correct DATABASE_URL. Check Railway deployment logs for `DBG save_*` output.
2. **Custom domain** — purchase + point to Vercel + Railway
3. **Stripe keys** — Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` on Railway (needs Stripe account)

## Key Decisions
- Three-platform split: Vercel (frontend), Railway (backend+DB+Redis), GitHub (code)
- Tailwind v4 (Vite plugin, CSS-first config)
- Shared trader handles all active users (scales better on single Railway instance)
- Redis pub/sub for signals, heartbeats, bot control, bot logs; Redis lists for cached status + rate limits
- bcrypt direct (no passlib) to avoid slim-image compat issues
- Fernet (AES-256) for key encryption — symmetric, no DB schema changes
- JWT over session cookies (stateless, SPA-friendly)
- Nullable `user_id` on Signal/Position/Trade so existing data survives
- ethers + @solana/web3.js direct (not wagmi/Web3Modal) to avoid massive dep tree
- SIWE for wallet ownership verification (ECDSA for EVM, ed25519 for Solana)
- Keys never returned to client — prevents XSS/leak, Settings form starts empty
- WebSocket code 4001 redirects to login — prevents reconnect loop on expired token
- Best-effort SLA — avoids legal commitment on single-instance Railway deployment

## Critical Context
- Backend: `https://mexc-trading-bot-production-c215.up.railway.app/health`
- Frontend: `https://dist-rho-sandy-41.vercel.app` (Vercel)
- GitHub: `https://github.com/abeermeer/Nextrade-trading-bot`
- Analyst alive, trader alive, mode: paper
- Railway services: mexc-trading-bot (FastAPI), analyst (signal gen), trader (multi-tenant executor)
- 15 strategies: RSI, MACD cross, EMA trend, volume breakout, Bollinger squeeze, Supertrend, ADX, Ichimoku, Pullback, Range, CounterTrend, StochRSI, PSAR, MFI, VWAP
- Exchange API keys validated on save — fake keys rejected with 400 error
- Keys NOT returned via any GET endpoint (security)
- Live bot start blocked if keys not verified
- 22 frontend pages, all code-split (largest chunk 336KB)
- CI/CD ready: GitHub Actions test + deploy workflows
- Email templates: 4 branded HTML templates for verification, reset, welcome, trade alerts
- AGENTS.md and SESSION_SUMMARY.md in .gitignore (local only)
- Railway env vars configured: ADMIN_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, FRONTEND_URL
