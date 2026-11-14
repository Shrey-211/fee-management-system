from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..schemas.user import (
    LoginRequest, TokenResponse, UserResponse, UserCreate, 
    UserUpdate, PasswordChangeRequest
)
from ..auth import (
    verify_password, get_password_hash, create_access_token, 
    get_current_user, require_admin
)
from ..services.audit_service import log_audit


router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.get("/setup-status")
def get_setup_status(db: Session = Depends(get_db)):
    """Check if the system has been initialized with at least one administrator account."""
    user_count = db.query(User).count()
    return {"is_configured": user_count > 0}

@router.post("/setup-admin", response_model=TokenResponse)
def setup_first_time_admin(admin_data: UserCreate, db: Session = Depends(get_db)):
    """
    First-time administrator setup endpoint.
    Only allows creation of an initial Master Admin if NO users exist in the database.
    """
    if db.query(User).count() > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System is already configured with an administrator account. Please sign in."
        )
    
    admin_user = User(
        username=admin_data.username.strip(),
        password_hash=get_password_hash(admin_data.password),
        full_name=admin_data.full_name.strip(),
        role="admin",
        is_active=True
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    token = create_access_token(data={"sub": admin_user.username, "role": admin_user.role})
    log_audit(
        db,
        action="FIRST_TIME_ADMIN_SETUP",
        entity_name="users",
        entity_id=admin_user.id,
        user_id=admin_user.id,
        details={"username": admin_user.username, "role": admin_user.role}
    )
    db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": admin_user
    }

@router.post("/login", response_model=TokenResponse)
def login(login_req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_req.username.strip()).first()
    if not user or not verify_password(login_req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Please contact Fee Administrator."
        )

    token = create_access_token(data={"sub": user.username, "role": user.role})
    log_audit(
        db,
        action="USER_LOGIN",
        entity_name="users",
        entity_id=user.id,
        user_id=user.id,
        details={"username": user.username, "role": user.role}
    )
    db.commit()
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/change-password")
def change_password(
    pwd_req: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(pwd_req.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    current_user.password_hash = get_password_hash(pwd_req.new_password)
    log_audit(
        db,
        action="CHANGE_PASSWORD",
        entity_name="users",
        entity_id=current_user.id,
        user_id=current_user.id,
        details={"username": current_user.username}
    )
    db.commit()
    return {"message": "Password updated successfully"}


@router.get("/users", response_model=List[UserResponse])
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(User).all()

@router.post("/users", response_model=UserResponse)
def create_user(
    user_in: UserCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(User.username == user_in.username.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = User(
        username=user_in.username.strip(),
        password_hash=get_password_hash(user_in.password),
        full_name=user_in.full_name.strip(),
        role=user_in.role.lower().strip(),
        is_active=True
    )
    db.add(new_user)
    db.flush()
    log_audit(
        db,
        action="CREATE_USER",
        entity_name="users",
        entity_id=new_user.id,
        user_id=admin.id,
        details={"username": new_user.username, "role": new_user.role}
    )
    db.commit()
    db.refresh(new_user)
    return new_user

@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_in.full_name is not None:
        user.full_name = user_in.full_name.strip()
    if user_in.role is not None:
        user.role = user_in.role.lower().strip()
    if user_in.is_active is not None:
        user.is_active = user_in.is_active

    log_audit(
        db,
        action="UPDATE_USER",
        entity_name="users",
        entity_id=user.id,
        user_id=admin.id,
        details={"username": user.username, "role": user.role, "is_active": user.is_active}
    )
    db.commit()
    db.refresh(user)
    return user

