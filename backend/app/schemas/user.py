from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4)
    full_name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(default="clerk")  # admin, accountant, clerk

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=4)

class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

TokenResponse.model_rebuild()

