# ENCRYPTION_KEY Rotation Runbook

NexTrade encrypts every user's exchange API key/secret at rest with a Fernet key held
in the `ENCRYPTION_KEY` environment variable (see `shared/encryption.py`). If that key
is ever exposed (leaked env var, compromised host, ex-employee access), every stored
credential must be treated as compromised and re-encrypted under a new key.

## When to rotate
- `ENCRYPTION_KEY` was printed to logs, committed, or shared insecurely.
- A host or Railway service with the key was compromised.
- Routine rotation (recommended: every 6–12 months).

## What is encrypted
- `UserRecord.mexc_api_key`
- `UserRecord.mexc_api_secret`

(Field names are historical — they hold the key/secret for whichever exchange the user
selected.)

## Rotation procedure

1. **Freeze writes.** Put the app in maintenance or stop the `web` service so no new
   keys are saved mid-rotation. Trading bots can keep running (they hold decrypted keys
   in memory), but do not restart them until step 5.

2. **Generate a new key.**
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

3. **Re-encrypt all stored credentials** with a one-off script that decrypts each row
   with the OLD key and re-encrypts with the NEW key. Run it with BOTH keys available:
   ```python
   # rotate_keys.py  — run once, then delete
   import asyncio, os
   from cryptography.fernet import Fernet
   from sqlalchemy import select
   from db.database import async_session_factory
   from db.models import UserRecord

   OLD = Fernet(os.environ["ENCRYPTION_KEY_OLD"].encode())
   NEW = Fernet(os.environ["ENCRYPTION_KEY_NEW"].encode())

   async def main():
       async with async_session_factory() as s:
           rows = (await s.execute(select(UserRecord))).scalars().all()
           for u in rows:
               for field in ("mexc_api_key", "mexc_api_secret"):
                   val = getattr(u, field)
                   if val:
                       setattr(u, field, NEW.encrypt(OLD.decrypt(val.encode())).decode())
           await s.commit()
       print(f"rotated {len(rows)} users")

   asyncio.run(main())
   ```
   ```bash
   ENCRYPTION_KEY_OLD=<old> ENCRYPTION_KEY_NEW=<new> python rotate_keys.py
   ```

4. **Swap the env var.** Set `ENCRYPTION_KEY=<new>` on ALL services that decrypt
   (Railway: `web`, `trader`, `analyst` if applicable). Remove the old key everywhere.

5. **Restart services** so every process picks up the new key. Restart the trader bots
   last (they held old decrypted keys in memory — after restart they re-read from DB).

6. **Verify.** Have one user re-open Settings → keys should still show verified; place a
   paper trade or run `validate_credentials`. Confirm no `decrypt` errors in logs.

7. **Delete** `rotate_keys.py` and scrub the old key from any shell history / secret store.

## If credentials may have been used maliciously
Because NexTrade stores **trade-only** keys (withdrawals disabled — enforced by user
onboarding, not by us), the blast radius is limited to unwanted trades, not fund theft.
Still: instruct affected users to **revoke and re-create their exchange API keys** on the
exchange side. Rotating `ENCRYPTION_KEY` protects the database at rest; it does not undo
exposure of a key that already left our system.

## Related
- `shared/encryption.py` — `encrypt()` / `decrypt()` (Fernet).
- Onboarding copy instructs users to disable withdrawal permission (`frontend/src/pages/Settings.tsx`).
- No code path logs a decrypted key (verified); keep it that way.
