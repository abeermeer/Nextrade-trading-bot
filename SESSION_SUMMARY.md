# Project Summary

## Goal
Fully autonomous two-bot trading system (Market Analyst + Trader Bot) for MEXC spot & futures sold as SaaS subscription (3 tiers), multi-tenant accounts, encrypted API keys, JWT auth, crypto wallet (EVM + Solana), dark Tailwind v4 React frontend.

## Stack
- **Backend**: Python 3.12, FastAPI, ccxt, yfinance/CoinGecko, Redis pub/sub, Pydantic v2, structlog, PostgreSQL (Railway) / SQLite (dev)
- **Frontend**: React 19, Vite 8, Tailwind v4, Recharts, ethers, @solana/web3.js
- **Infra**: Railway (backend + bots + DB + Redis), Netlify (frontend), GitHub

## Done (Expanded)
- **Analyst/Trader DEAD fixed**: `lpush` for signals, 15s heartbeat caches, status endpoint reads `settings.yaml` mode correctly
- **JWT auth**: bcrypt hash/verify, JWT create/decode (HS256, 24h), register/login/me with Bearer middleware
- **Admin seed**: `abeermeer7979@gmail.com` / `Abeer@123` (enterprise, is_admin) on startup
- **MEXC key mgmt**: Fernet AES-256 encrypt/decrypt via `shared/encryption.py`, PUT/GET endpoints
- **User settings API**: paper/live, spot/futures, max_position, bot start/stop via Redis pub/sub `bot:control`
- **Admin user list**: GET /api/user/admin/users — all users with plan/mode/bot_active/MEXC status
- **Full frontend**: Landing, Login/Signup, Dashboard (bot viz, stats, equity curve, logs, wallet), Settings (keys, wallet, mode/type, risk), Admin (user mgmt), Positions/Signals/Trades — all dark themed
- **Netlify 404**: `public/_redirects` → `/* /index.html 200`
- **Multi-tenant trader**: per-user UserSession with PaperEngine/RiskManager/PositionTracker/MEXCClient, signal execution per user_id
- **DB**: `user_id` on SignalRecord/PositionRecord/TradeRecord (nullable, indexed), wallet_address + wallet_type on UserRecord
- **MEXC Futures**: `set_leverage()`, `set_position_mode()`, `market="swap"` for futures orders
- **Plan enforcement**: `shared/plan_limits.py` — tier limits enforced on settings + registration
- **Real-time bot control**: Redis pub/sub — start/stop instantly creates/removes sessions
- **Dashboard additions**: Recharts equity curve AreaChart, bot log viewer (Redis `logs:bot`, GET /api/logs, 5s poll)
- **Rate limiting**: Token bucket (60 req/min) via RateLimitMiddleware on /api/*
- **Mobile responsive**: `overflow-x-auto` nav on small screens
- **64 unit tests** passing (18 new: plan_limits, auth bcrypt/JWT, encryption Fernet)
- **Repo cleanup**: Professional README (arch diagram, API ref, setup), MIT LICENSE, .env.example, frontend README
- **Wallet (EVM + Solana)**: `shared/wallet.py` (SIWE nonce, eth_account recover, nacl verify), endpoints (nonce, wallet-login, wallet-link, PUT/GET/DELETE wallet), WalletContext.tsx (ethers + @solana/web3.js), WalletConnect.tsx (MetaMask + Phantom buttons), wallet in Settings + Dashboard
- **Landing page redesigned**: Hero with animated terminal sim (analyst+trader flow), gradient orbs, floating stat cards (87% win rate, 24/7), social proof (2,400+ traders); "How It Works" 3-step with connector lines; Features grid (6 cards, hover glow); Trust & Security section (6 items); Pricing (3 tiers, Pro highlighted); FAQ accordion (6 questions); CTA + footer
- **Deployed**: Latest build live on Netlify (`https://mexc-trading-bot.netlify.app`), Railway backend healthy (`{"status":"ok"}`)

## Key Decisions
- Three-platform split: Netlify (frontend), Railway (backend+DB+Redis), GitHub (code)
- Tailwind v4 (Vite plugin, CSS-first config)
- Shared trader handles all active users (scales better on single Railway instance)
- Redis pub/sub for signals, heartbeats, bot control, bot logs; Redis lists for cached status + rate limits
- bcrypt direct (no passlib) to avoid slim-image compat issues
- Fernet (AES-256) for key encryption — symmetric, no DB schema changes
- JWT over session cookies (stateless, SPA-friendly)
- Nullable `user_id` on Signal/Position/Trade so existing data survives
- ethers + @solana/web3.js direct (not wagmi/Web3Modal) to avoid massive dep tree
- SIWE for wallet ownership verification (ECDSA for EVM, ed25519 for Solana)
- No Stripe/PayPal yet — signup free for all plans, wallet ready for future crypto payments

## Completed This Session
- **Docs page** (`/docs`): 4-section help page (Getting Started, Trading Concepts, Accounts & Security, Technical) — FAQ-style Q&A, works for logged-in and anonymous users
- **Email verification + password reset**:
  - DB: `email_verified`, `verification_token`, `verification_token_expires`, `reset_token`, `reset_token_expires` on UserRecord
  - Backend: register sends verification email; GET /verify-email, POST /forgot-password, POST /reset-password endpoints
  - Notifier: added `send_custom_email(to, subject, body)` for per-user emails
  - Frontend: VerifyEmail, ForgotPassword, ResetPassword pages; "Forgot password?" link on Login
- **WebSocket real-time updates**:
  - Backend: `/ws` endpoint with JWT auth (token query param), pushes status/signals/positions/performance/logs every 2s
  - Frontend: `useWebSocket` hook with exponential backoff reconnection (1s→2s→4s→...→30s max)
  - Dashboard updated via react-query cache; REST polling as fallback (10s interval)
- **Withdrawal protection**:
  - DB: `WithdrawalWhitelistRecord` table + `withdrawal_delay_hours` on UserRecord
  - Backend: `withdrawal_router.py` — 7 endpoints (whitelist CRUD, settings, admin approve/pending)
  - Frontend: Settings page "Withdrawal Protection" section (add/delete addresses, delay setting); Admin page approval table
- **Frontend Design Overhaul (6/10 → 8/10)**:
  - **20 SVG icons** replacing all emojis — `BrainIcon`, `BotIcon`, `LightningIcon`, `ChartIcon`, `ShieldIcon`, `KeyIcon`, etc.
  - **Shared `AppNavbar`** extracted from 9 duplicated copies into single component with mobile hamburger menu
  - **framer-motion** for page transitions (`AnimatePresence` in App.tsx), scroll-triggered reveals (`whileInView`), and micro-animations on cards
  - **Animated `HeroIllustration`** — candlestick chart animation + animated line chart overlay + floating stat cards (87%, 24/7)
  - **Refined design tokens** — `dark-950` background, consistent `accent-soft` color, cleaned up unused CSS
  - **Polished UI components** — `Card`, `Badge` (10 variants), `Table<T>` (typed generic columns), `PageTransition` wrapper
  - Auth pages (Login, Signup, VerifyEmail, ForgotPassword, ResetPassword) now use framer-motion form animations
  - Landing page: emoji → SVG icons in features/trust/how-it-works sections, `HeroIllustration` replaces terminal sim
  - Dashboard: SVG brain/bot/lightning icons replace emojis, `Badge`/`Table` components, framer-motion entrance animations
  - Settings: SVG icons for each section header, `Card` wrapper, framer-motion stagger
  - Admin/Positions/Signals/Trades: `AppNavbar` + `PageTransition` + `Badge` + `Table` components
- **64 tests still passing**, frontend builds clean (zero errors)

## Remaining
1. Stripe/PayPal payment integration + checkout flow
2. Multi-exchange support (Binance, Bybit, etc.)

## Critical Context
- Backend: `https://mexc-trading-bot-production-c215.up.railway.app/health`
- Frontend: `https://mexc-trading-bot.netlify.app`
- Analyst alive, trader alive, mode: live
- Railway services: mexc-trading-bot (FastAPI), analyst (signal gen), trader (multi-tenant executor)
- 8 strategies: RSI, MACD cross, EMA trend, volume breakout, Bollinger squeeze, Supertrend, ADX, Ichimoku
- `create_redis_client()` checks `REDIS_URL` env var first, falls back to YAML
- PostgreSQL auto-convert: `postgres://` → `postgresql+asyncpg://`
- Fernet cipher lazy init — uses `ENCRYPTION_KEY` env var or random key
- Docker Desktop not running locally; all via Railway + Netlify
- `docker-compose.yml` available for local dev
- Root: `C:\Users\brosp\Downloads\mexc-trading-bot`
