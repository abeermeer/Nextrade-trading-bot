# Project: mexc-trading-bot

## Stack
- Backend: Python 3.12, FastAPI, ccxt, SQLAlchemy async, Redis, PostgreSQL
- Frontend: React 19, Vite 8, Tailwind v4, Recharts
- Infra: Railway (backend + DB + Redis), Vercel (frontend), GitHub (code)

## URLs
- Backend: https://mexc-trading-bot-production-c215.up.railway.app
- Frontend: https://dist-rho-sandy-41.vercel.app
- Health: https://mexc-trading-bot-production-c215.up.railway.app/health

## Deploy
- Railway auto-deploys from GitHub master branch (linked via Railway dashboard)
- Vercel: deploy manually via `vercel deploy dist --prod` from frontend\dist
- Frontend build: `cd frontend && npm run build`

## Auth
- Admin: abeermeer7979@gmail.com / Abeer@123
- JWT Bearer tokens, bcrypt passwords, Fernet AES-256 key encryption

## Strategies (10)
RSI, MACD cross, EMA trend, Volume breakout, Bollinger squeeze, Supertrend, ADX, Ichimoku, Pullback, Range
All in `analyst/strategies/` — simple BaseStrategy subclass, uses pandas_ta

## Key Rules
- NEVER return exchange keys to client (PUT only, form starts empty)
- WebSocket 4001 close → redirect to /login (no reconnect loop)
- Stripe code written but blocked — needs STRIPE_SECRET_KEY etc on Railway
- Railway acc: abeeruniversity — NOT Hamza's account

## File Layout
- web/ — FastAPI routers (auth, user, platform, stripe, withdrawal)
- frontend/src/pages/ — 22 lazy-loaded pages
- analyst/strategies/ — trading strategies
- trader/ — multi-tenant paper/live executor
- shared/ — encryption, redis, models, logger, plan_limits
- db/ — SQLAlchemy models + async session
- tests/ — pytest backend tests (64 passing)
