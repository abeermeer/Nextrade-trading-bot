# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (master) | ✅ |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, send an email to **abeermeer7979@gmail.com** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

You should receive an acknowledgment within 48 hours. We will investigate and
release a fix as soon as possible, and will notify you when it is deployed.

## What We Protect

- User exchange API keys (encrypted at rest with Fernet AES-256)
- User passwords (hashed with bcrypt)
- JWT tokens (signed, 24h expiry)
- Session authentication tokens
- Database connection strings and secrets

## Best Practices for Contributors

- Never commit secrets, API keys, or tokens to the repository
- Never return exchange keys to the client
- Run `git diff` before committing to check for accidental secrets
- Use environment variables for all configuration
- Report any `except: pass` — prefer `logger.warning` with context
