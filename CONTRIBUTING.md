# Contributing to NexTrade AI

Thank you for your interest in contributing! This document covers the process for submitting changes.

## Table of Contents

- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Testing](#testing)
- [Branching](#branching)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Issue Reporting](#issue-reporting)

## Development Setup

```bash
git clone https://github.com/abeermeer/Nextrade-trading-bot.git
cd mexc-trading-bot
uv venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt && pip install -e .
cd frontend && npm install --legacy-peer-deps && cd ..
```

## Code Style

- **Python**: Follow PEP 8. Use type hints on all function signatures.
- **TypeScript/React**: Use strict TypeScript mode. Prefer functional components with hooks.
- **Imports**: Group standard lib → third-party → local, separated by blank lines.
- **Naming**: `snake_case` for Python, `camelCase` for JS/TS, `PascalCase` for classes/components.
- **No comments in implementation code** unless explaining a non-obvious trade-off. Let the code speak.

## Testing

- All new features must include tests.
- Run the full suite before pushing:

```bash
uv run python -m pytest tests/ -v
# Or from root:
pytest tests/ -v --cov=. --cov-report=term
```

- Backend tests: `pytest tests/ -v` (64+ tests)
- Frontend tests: `cd frontend && npm run test`

## Branching

- `master` — production. Always deployable.
- Create feature branches from `master`:
  - `feature/short-description`
  - `fix/short-description`
  - `audit/short-description`

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description>

- Bullet points for details if needed
```

Types: `feat`, `fix`, `audit`, `refactor`, `docs`, `test`, `chore`, `style`.

## Pull Requests

1. Keep PRs focused — one concern per PR.
2. Reference the issue number if applicable.
3. Ensure all tests pass and the frontend builds cleanly.
4. Update the README if changing functionality or adding features.

## Issue Reporting

Use the provided issue templates. Include:

- A clear, descriptive title
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Screenshots or logs if applicable
- Environment details (OS, Python version, browser)
