import os
from decimal import Decimal
from datetime import date
from sqlalchemy.orm import Session
from .database import engine, SessionLocal, Base
from .models import (
    User, FeeHead, StudentFeeHead, Student, Fine, 
    Payment, PaymentItem, EmailTemplate,
    FeeConcessionType, FeeTypeHeadRule
)
from .auth import get_password_hash
from .services.fee_engine import initialize_student_fees, quantize_amount
from .services.email_service import DEFAULT_TEMPLATE_SUBJECT, DEFAULT_TEMPLATE_BODY

def seed_database():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # 1. Seed Users (Admin, Accountant, Clerk)
        if db.query(User).count() == 0:
            print("Seeding default users...")
            users = [
                User(
                    username="admin",
                    password_hash=get_password_hash("admin123"),
                    full_name="Mr. Shrikant (Fee Administrator)",
                    role="admin",
                    is_active=True
                ),
                User(
                    username="accountant",
                    password_hash=get_password_hash("account123"),
                    full_name="College Accountant",
                    role="accountant",
                    is_active=True
                ),
                User(
                    username="clerk",
                    password_hash=get_password_hash("clerk123"),
                    full_name="Fee Collection Clerk",
                    role="clerk",
                    is_active=True
                )
            ]
            db.add_all(users)
            db.commit()
            print("Default users seeded: admin/admin123, accountant/account123, clerk/clerk123")

        # 2. Seed Fee Heads
        if db.query(FeeHead).count() == 0:
            print("Seeding standard fee heads...")
            fee_heads = [
                FeeHead(
                    name="Tuition Fee",
                    code="TUITION",
                    base_amount=Decimal("40000.00"),
                    academic_year="2026-2027",
                    is_compulsory=True,
                    allows_waiver=True
                ),
                FeeHead(
                    name="Development Fee",
                    code="DEVELOPMENT",
                    base_amount=Decimal("15000.00"),
                    academic_year="2026-2027",
                    is_compulsory=True,
                    allows_waiver=True
                ),
                FeeHead(
                    name="Dress Code Fee",
                    code="DRESS_CODE",
                    base_amount=Decimal("3000.00"),
                    academic_year="2026-2027",
                    is_compulsory=True,
                    allows_waiver=False
                ),
                FeeHead(
                    name="University Examination Fee",
                    code="EXAM",
                    base_amount=Decimal("2000.00"),
                    academic_year="2026-2027",
                    is_compulsory=True,
                    allows_waiver=False
                ),
                FeeHead(
                    name="Other Charges (Send-off, Welcome, Party)",
                    code="OTHER",
                    base_amount=Decimal("1000.00"),
                    academic_year="2026-2027",
                    is_compulsory=True,
                    allows_waiver=False
                )
            ]
            db.add_all(fee_heads)
            db.commit()
            print("Standard fee heads seeded.")

        # Safe SQLite column check for concession_type_id on students table
        try:
            raw_conn = db.connection().connection
            cursor = raw_conn.cursor()
            cursor.execute("PRAGMA table_info(students)")
            cols = [row[1] for row in cursor.fetchall()]
            if cols and "concession_type_id" not in cols:
                print("Adding concession_type_id column to students table...")
                cursor.execute("ALTER TABLE students ADD COLUMN concession_type_id INTEGER REFERENCES fee_concession_types(id)")
                db.commit()
        except Exception as e:
            print("Column migration notice:", e)

        # 3. Seed Fee Concession Types & Head Rules
        if db.query(FeeConcessionType).count() == 0:
            print("Seeding standard fee concession types and head waiver rules...")
            heads = {h.code: h.id for h in db.query(FeeHead).filter(FeeHead.academic_year == "2026-2027").all()}
            if not heads:
                heads = {h.code: h.id for h in db.query(FeeHead).all()}

            def create_type_with_rules(name, code, group, desc, rules_dict):
                ctype = FeeConcessionType(
                    name=name,
                    code=code,
                    type_group=group,
                    academic_year="2026-2027",
                    description=desc,
                    is_active=True
                )
                db.add(ctype)
                db.flush()
                for h_code, (pct, reason) in rules_dict.items():
                    if h_code in heads:
                        rule = FeeTypeHeadRule(
                            concession_type_id=ctype.id,
                            fee_head_id=heads[h_code],
                            waiver_percent=Decimal(str(pct)),
                            waiver_amount=Decimal("0.00"),
                            reason=reason
                        )
                        db.add(rule)

            # 1. Gender Types
            create_type_with_rules(
                "Female / Girl Student", "FEMALE", "GENDER",
                "Girl Student Scheme (100% Tuition Waiver)",
                {
                    "TUITION": (100.0, "100% Waived (Girl Student Scheme)"),
                    "DEVELOPMENT": (0.0, "Applicable Development Fee"),
                    "DRESS_CODE": (0.0, "Compulsory Fee (Applicable to all)"),
                    "EXAM": (0.0, "Compulsory Fee (Applicable to all)"),
                    "OTHER": (0.0, "Compulsory Fee (Applicable to all)")
                }
            )
            create_type_with_rules(
                "Male / General", "MALE", "GENDER",
                "General Male Student (Standard Fees)",
                {
                    "TUITION": (0.0, "Standard Tuition Fee"),
                    "DEVELOPMENT": (0.0, "Applicable Development Fee"),
                    "DRESS_CODE": (0.0, "Compulsory Fee (Applicable to all)"),
                    "EXAM": (0.0, "Compulsory Fee (Applicable to all)"),
                    "OTHER": (0.0, "Compulsory Fee (Applicable to all)")
                }
            )

            # 2. Caste / Category Types
            create_type_with_rules(
                "OPEN (General Category)", "OPEN", "CASTE",
                "Open Category (Standard Fees)",
                {
                    "TUITION": (0.0, "Standard Tuition Fee"),
                    "DEVELOPMENT": (0.0, "Applicable Development Fee"),
                    "DRESS_CODE": (0.0, "Compulsory Fee (Applicable to all)"),
                    "EXAM": (0.0, "Compulsory Fee (Applicable to all)"),
                    "OTHER": (0.0, "Compulsory Fee (Applicable to all)")
                }
            )
            create_type_with_rules(
                "EBC (Economically Backward Class)", "EBC", "CASTE",
                "EBC Scheme (50% Tuition Discount)",
                {
                    "TUITION": (50.0, "50% Discount (EBC Scheme)"),
                    "DEVELOPMENT": (0.0, "Applicable Development Fee"),
                    "DRESS_CODE": (0.0, "Compulsory Fee (Applicable to all)"),
                    "EXAM": (0.0, "Compulsory Fee (Applicable to all)"),
                    "OTHER": (0.0, "Compulsory Fee (Applicable to all)")
                }
            )
            create_type_with_rules(
                "SC (Scheduled Caste)", "SC", "CASTE",
                "SC Category Scheme (100% Tuition & Development Waived)",
                {
                    "TUITION": (100.0, "100% Waived (SC Category Scheme)"),
                    "DEVELOPMENT": (100.0, "100% Waived (SC Category Scheme)"),
                    "DRESS_CODE": (0.0, "Compulsory Fee (Applicable to all)"),
                    "EXAM": (0.0, "Compulsory Fee (Applicable to all)"),
                    "OTHER": (0.0, "Compulsory Fee (Applicable to all)")
                }
            )
            create_type_with_rules(
                "ST (Scheduled Tribe)", "ST", "CASTE",
                "ST Category Scheme (100% Tuition & Development Waived)",
                {
                    "TUITION": (100.0, "100% Waived (ST Category Scheme)"),
                    "DEVELOPMENT": (100.0, "100% Waived (ST Category Scheme)"),
                    "DRESS_CODE": (0.0, "Compulsory Fee (Applicable to all)"),
                    "EXAM": (0.0, "Compulsory Fee (Applicable to all)"),
                    "OTHER": (0.0, "Compulsory Fee (Applicable to all)")
                }
            )
            create_type_with_rules(
                "OBC (Other Backward Class)", "OBC", "CASTE",
                "OBC Category",
                {
                    "TUITION": (0.0, "Standard Tuition Fee"),
                    "DEVELOPMENT": (0.0, "Applicable Development Fee"),
                    "DRESS_CODE": (0.0, "Compulsory Fee (Applicable to all)"),
                    "EXAM": (0.0, "Compulsory Fee (Applicable to all)"),
                    "OTHER": (0.0, "Compulsory Fee (Applicable to all)")
                }
            )
            create_type_with_rules(
                "VJNT (Vimukta Jati & Nomadic Tribes)", "VJNT", "CASTE",
                "VJNT Category",
                {
                    "TUITION": (0.0, "Standard Tuition Fee"),
                    "DEVELOPMENT": (0.0, "Applicable Development Fee"),
                    "DRESS_CODE": (0.0, "Compulsory Fee (Applicable to all)"),
                    "EXAM": (0.0, "Compulsory Fee (Applicable to all)"),
                    "OTHER": (0.0, "Compulsory Fee (Applicable to all)")
                }
            )

            # 3. Custom / Special Types
            create_type_with_rules(
                "TFWS (Tuition Fee Waiver Scheme)", "TFWS", "CUSTOM",
                "State TFWS Allotment (100% Tuition Waived)",
                {
                    "TUITION": (100.0, "100% Waived (TFWS Scheme)"),
                    "DEVELOPMENT": (0.0, "Applicable Development Fee"),
                    "DRESS_CODE": (0.0, "Compulsory Fee (Applicable to all)"),
                    "EXAM": (0.0, "Compulsory Fee (Applicable to all)"),
                    "OTHER": (0.0, "Compulsory Fee (Applicable to all)")
                }
            )
            db.commit()
            print("Standard fee concession types and head waiver rules seeded.")

        # 3. Seed Default Email Template
        if db.query(EmailTemplate).count() == 0:
            print("Seeding default email template...")
            template = EmailTemplate(
                name="Default Outstanding Fee Reminder",
                subject=DEFAULT_TEMPLATE_SUBJECT,
                body_template=DEFAULT_TEMPLATE_BODY,
                is_default=True
            )
            db.add(template)
            db.commit()

        # 4. Seed Sample Students with Waiver Scenarios
        if db.query(Student).count() == 0:
            print("Seeding representative student profiles...")
            sample_students = [
                Student(
                    student_code="STU-2026-001",
                    full_name="Aarav Sharma",
                    dob=date(2005, 4, 15),
                    gender="MALE",
                    category="OPEN",
                    mobile_number="9876543210",
                    email_address="aarav.sharma@example.com",
                    address="102 Saraswati Nagar, Pune",
                    academic_year="2026-2027",
                    course_branch="B.Tech Computer Science",
                    current_year=1
                ),
                Student(
                    student_code="STU-2026-002",
                    full_name="Pooja Kulkarni",
                    dob=date(2005, 8, 22),
                    gender="FEMALE",
                    category="OPEN",
                    mobile_number="9876543211",
                    email_address="pooja.kulkarni@example.com",
                    address="45 Shivaji Chowk, Kolhapur",
                    academic_year="2026-2027",
                    course_branch="B.Tech Computer Science",
                    current_year=1
                ),
                Student(
                    student_code="STU-2026-003",
                    full_name="Rohan Patil",
                    dob=date(2004, 11, 10),
                    gender="MALE",
                    category="EBC",
                    mobile_number="9876543212",
                    email_address="rohan.patil@example.com",
                    address="Lane 3, Deccan Gymkhana, Pune",
                    academic_year="2026-2027",
                    course_branch="B.Tech Mechanical",
                    current_year=2
                ),
                Student(
                    student_code="STU-2026-004",
                    full_name="Vikas Kamble",
                    dob=date(2005, 1, 5),
                    gender="MALE",
                    category="SC",
                    mobile_number="9876543213",
                    email_address="vikas.kamble@example.com",
                    address="Ambedkar Nagar, Solapur",
                    academic_year="2026-2027",
                    course_branch="B.Tech Civil",
                    current_year=1
                ),
                Student(
                    student_code="STU-2026-005",
                    full_name="Anjali Gaikwad",
                    dob=date(2005, 9, 14),
                    gender="FEMALE",
                    category="ST",
                    mobile_number="9876543214",
                    email_address="anjali.gaikwad@example.com",
                    address="Tribal Hostel, Nashik",
                    academic_year="2026-2027",
                    course_branch="B.Tech Electronics",
                    current_year=1
                ),
                Student(
                    student_code="STU-2026-006",
                    full_name="Snehal Deshmukh",
                    dob=date(2005, 3, 19),
                    gender="FEMALE",
                    category="EBC",
                    mobile_number="9876543215",
                    email_address="snehal.deshmukh@example.com",
                    address="CIDCO, Aurangabad",
                    academic_year="2026-2027",
                    course_branch="B.Tech IT",
                    current_year=1
                )
            ]

            db.add_all(sample_students)
            db.commit()

            # Initialize fee heads for each student
            for s in sample_students:
                initialize_student_fees(s, db)

            # Add an event fine to student 1 (Aarav Sharma) for missing Krishna Utsav
            fine = Fine(
                student_id=sample_students[0].id,
                event_name="Krishna Utsav Absence",
                amount=Decimal("500.00"),
                fine_date=date(2026, 9, 10),
                status="UNPAID",
                paid_amount=Decimal("0.00"),
                balance=Decimal("500.00"),
                remarks="Unexcused absence during college Krishna Utsav celebration"
            )
            db.add(fine)
            db.commit()
            print("Sample students and event fine initialized.")

        print("Database seed completed successfully.")

    finally:
        db.close()

if __name__ == "__main__":
    seed_database()

