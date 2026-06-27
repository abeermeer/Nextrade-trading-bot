import os
from sqlalchemy import select
from db.database import init_db, async_session_factory
from db.models import UserRecord
from web.auth import hash_password


async def seed_admin():
    await init_db()
    admin_password = os.getenv("ADMIN_PASSWORD", "")
    if not admin_password:
        print("ADMIN_PASSWORD env var not set — skipping admin seed")
        return
    async with async_session_factory() as session:
        result = await session.execute(select(UserRecord).where(UserRecord.email == "abeermeer7979@gmail.com"))
        if not result.scalar_one_or_none():
            admin = UserRecord(
                email="abeermeer7979@gmail.com",
                password_hash=hash_password(admin_password),
                plan="enterprise",
                is_admin=True,
                bot_active=True,
                max_position_usdt=999999.0,
            )
            session.add(admin)
            await session.commit()
            print("Admin user seeded: abeermeer7979@gmail.com")
        else:
            print("Admin user already exists")
