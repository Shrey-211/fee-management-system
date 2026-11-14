import pytest
from backend.app.database import engine, SessionLocal, Base
from backend.app.models.user import User
from backend.app.auth import get_password_hash

@pytest.fixture(autouse=True, scope="session")
def setup_test_users():
    """Ensure standard test users exist during automated test execution."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    test_users = [
        ("admin", "admin123", "Test Admin", "admin"),
        ("accountant", "account123", "Test Accountant", "accountant"),
        ("clerk", "clerk123", "Test Clerk", "clerk"),
    ]
    for username, password, full_name, role in test_users:
        if not db.query(User).filter(User.username == username).first():
            db.add(User(
                username=username,
                password_hash=get_password_hash(password),
                full_name=full_name,
                role=role,
                is_active=True
            ))
    db.commit()
    db.close()

