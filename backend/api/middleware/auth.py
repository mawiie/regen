"""
Authentication middleware for FastAPI.

Extracts and verifies the Supabase JWT from the Authorization header
and returns the authenticated user's ID.
"""

import os
from typing import Optional
from fastapi import HTTPException, Header, status
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

# Initialize Supabase client for auth verification
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None


async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """
    FastAPI dependency that extracts and verifies the user's JWT.

    Expects an Authorization header in the form: Bearer <token>

    Returns:
        str: The authenticated user's UUID

    Raises:
        HTTPException(401): If the token is missing, invalid, or expired
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract the token
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]

    # If token is empty, reject
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify Supabase client is configured
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase client not configured. Set SUPABASE_URL and SUPABASE_KEY in .env",
        )

    try:
        # Use Supabase SDK to verify the token
        # This automatically handles RS256 verification with the correct public key
        response = supabase.auth.get_user(token)
        
        if not response or not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: unable to verify user",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return response.user.id

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
