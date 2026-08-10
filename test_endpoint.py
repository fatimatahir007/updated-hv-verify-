import asyncio
import uuid
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models import Voter
from app.utils.jwt_handler import create_access_token

async def main():
    async with AsyncSessionLocal() as db:
        # Get ali khan
        v_res = await db.execute(select(Voter).where(Voter.name_hash == "ali khan "))
        voter = v_res.scalars().first()
        
        # Generate token
        token = create_access_token(
            data={
                "sub": str(voter.id),
                "role": "voter",
                "email": voter.email,
                "cnic": voter.cnic,
            }
        )
        print(f"Token: {token}")
        
        # Call get_voter_me logic by importing the router function
        from app.routes.voter_auth_routes import get_voter_me
        res = await get_voter_me(voter=voter, db=db)
        print(f"Response from get_voter_me: {res}")

if __name__ == "__main__":
    asyncio.run(main())
