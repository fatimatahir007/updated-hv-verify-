import asyncio
from sqlalchemy import text
from app.database import engine

async def run_otp_migration():
    async with engine.begin() as conn:
        print("Adding otp_code and otp_expires_at columns to voters table...")
        
        try:
            # Add otp_code column
            await conn.execute(text("ALTER TABLE voters ADD COLUMN otp_code VARCHAR(10)"))
            print("Successfully added otp_code column.")
        except Exception as e:
            if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                print(f"Warning/Error adding otp_code: {e}")
            else:
                print("otp_code column already exists.")
                
        try:
            # Add otp_expires_at column
            await conn.execute(text("ALTER TABLE voters ADD COLUMN otp_expires_at TIMESTAMP WITH TIME ZONE"))
            print("Successfully added otp_expires_at column.")
        except Exception as e:
            if "duplicate column" not in str(e).lower() and "already exists" not in str(e).lower():
                print(f"Warning/Error adding otp_expires_at: {e}")
            else:
                print("otp_expires_at column already exists.")
                
    print("Voter OTP columns migration complete.")

if __name__ == "__main__":
    asyncio.run(run_otp_migration())
