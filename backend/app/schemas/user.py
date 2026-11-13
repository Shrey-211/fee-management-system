from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, field_validator

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)

    @field_validator("username", mode="before")
    @classmethod
    def trim_username(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4)
    full_name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(default="clerk")  # admin, accountant, clerk

    @field_validator("username", "full_name", mode="before")
    @classmethod
    def trim_strings(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

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

