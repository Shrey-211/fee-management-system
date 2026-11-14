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
from .config import settings
from .services.fee_engine import initialize_student_fees, quantize_amount
from .services.email_service import DEFAULT_TEMPLATE_SUBJECT, DEFAULT_TEMPLATE_BODY

def seed_database(seed_samples: bool = False):
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # 1. Initialize Master Administrator if configured by installer setup
        admin_init_file = settings.DATA_DIR / "initial_admin.json"
        if admin_init_file.exists():
            try:
                import json
                with open(admin_init_file, "r", encoding="utf-8") as f:
                    admin_data = json.load(f)
                u_name = admin_data.get("username", "").strip()
                p_word = admin_data.get("password", "").strip()
                f_name = admin_data.get("full_name", "College Administrator").strip()
                if u_name and p_word:
                    # Clean up legacy default dummy accounts if present
                    db.query(User).filter(User.username.in_(["accountant", "clerk"])).delete(synchronize_session=False)
                    if u_name != "admin":
                        db.query(User).filter(User.username == "admin").delete(synchronize_session=False)

                    existing_user = db.query(User).filter(User.username == u_name).first()
                    if existing_user:
                        existing_user.password_hash = get_password_hash(p_word)
                        existing_user.full_name = f_name
                        existing_user.role = "admin"
                        existing_user.is_active = True
                    else:
                        admin_user = User(
                            username=u_name,
                            password_hash=get_password_hash(p_word),
                            full_name=f_name,
                            role="admin",
                            is_active=True
                        )
                        db.add(admin_user)
                    db.commit()
                    print(f"Master administrator account '{u_name}' configured successfully.")
            except Exception as e:
                print(f"Error configuring master administrator: {e}")
            finally:
                # Always remove initial_admin.json immediately so plaintext credentials never persist on disk
                try:
                    admin_init_file.unlink(missing_ok=True)
                except Exception:
                    pass

        # Clean up any legacy test sports categories if present in existing databases
        legacy_sports = db.query(FeeConcessionType).filter(
            (FeeConcessionType.code.like("SPORTS%")) | (FeeConcessionType.name.like("%Sports%"))
        ).all()
        if legacy_sports:
            for s in legacy_sports:
                db.query(FeeTypeHeadRule).filter(FeeTypeHeadRule.concession_type_id == s.id).delete(synchronize_session=False)
                db.delete(s)
            db.commit()

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

        # Safe SQLite column check for concession_type_id and scholarship fields
        try:
            from sqlalchemy import text
            res = db.execute(text("PRAGMA table_info(students)")).fetchall()
            cols = [row[1] for row in res]
            if cols and "concession_type_id" not in cols:
                print("Adding concession_type_id column to students table...")
                db.execute(text("ALTER TABLE students ADD COLUMN concession_type_id INTEGER REFERENCES fee_concession_types(id)"))
                db.commit()

            sc_res = db.execute(text("PRAGMA table_info(scholarship_credits)")).fetchall()
            sc_info = {row[1]: row[3] for row in sc_res}
            if sc_info and "status" not in sc_info:
                print("Adding status column to scholarship_credits table...")
                db.execute(text("ALTER TABLE scholarship_credits ADD COLUMN status VARCHAR(20) DEFAULT 'NOT_RECEIVED'"))
                db.commit()

            if sc_info and "received_amount" not in sc_info:
                print("Adding received_amount column to scholarship_credits table...")
                db.execute(text("ALTER TABLE scholarship_credits ADD COLUMN received_amount NUMERIC(10, 2) DEFAULT 0.00"))
                db.execute(text("UPDATE scholarship_credits SET received_amount = amount WHERE status = 'RECEIVED'"))
                db.commit()

            # Ensure scholarship_disbursements table exists and has payment_id
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS scholarship_disbursements (
                    id INTEGER PRIMARY KEY,
                    scholarship_id INTEGER NOT NULL,
                    payment_id INTEGER,
                    amount NUMERIC(10, 2) NOT NULL,
                    disbursement_date DATE NOT NULL,
                    sanction_order_no VARCHAR(100),
                    remarks VARCHAR(255),
                    created_at DATETIME,
                    FOREIGN KEY(scholarship_id) REFERENCES scholarship_credits (id) ON DELETE CASCADE,
                    FOREIGN KEY(payment_id) REFERENCES payments (id) ON DELETE SET NULL
                )
            """))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_scholarship_disbursements_sc_id ON scholarship_disbursements (scholarship_id)"))
            
            disb_cols = [r[1] for r in db.execute(text("PRAGMA table_info(scholarship_disbursements)")).fetchall()]
            if disb_cols and "payment_id" not in disb_cols:
                db.execute(text("ALTER TABLE scholarship_disbursements ADD COLUMN payment_id INTEGER REFERENCES payments(id)"))
            db.commit()

            # If credit_date has NOT NULL constraint (1), recreate table to make it nullable
            if sc_info.get("credit_date") == 1:
                print("Migrating scholarship_credits to make credit_date nullable...")
                db.execute(text("PRAGMA foreign_keys=off"))
                db.execute(text("""
                    CREATE TABLE scholarship_credits_new (
                        id INTEGER PRIMARY KEY,
                        student_id INTEGER NOT NULL,
                        fee_head_id INTEGER,
                        scholarship_name VARCHAR(100) NOT NULL,
                        sanction_order_no VARCHAR(100),
                        credit_date DATE,
                        amount NUMERIC(10, 2) NOT NULL,
                        received_amount NUMERIC(10, 2) DEFAULT 0.00,
                        status VARCHAR(20) DEFAULT 'NOT_RECEIVED',
                        remarks VARCHAR(255),
                        created_at DATETIME,
                        FOREIGN KEY(student_id) REFERENCES students (id) ON DELETE CASCADE,
                        FOREIGN KEY(fee_head_id) REFERENCES fee_heads (id) ON DELETE SET NULL
                    )
                """))
                db.execute(text("""
                    INSERT INTO scholarship_credits_new (id, student_id, fee_head_id, scholarship_name, sanction_order_no, credit_date, amount, received_amount, status, remarks, created_at)
                    SELECT id, student_id, fee_head_id, scholarship_name, sanction_order_no, credit_date, amount, COALESCE(received_amount, 0.00), COALESCE(status, 'NOT_RECEIVED'), remarks, created_at FROM scholarship_credits
                """))
                db.execute(text("DROP TABLE scholarship_credits"))
                db.execute(text("ALTER TABLE scholarship_credits_new RENAME TO scholarship_credits"))
                db.execute(text("CREATE INDEX IF NOT EXISTS ix_scholarship_credits_student_id ON scholarship_credits (student_id)"))
                db.execute(text("CREATE INDEX IF NOT EXISTS ix_scholarship_credits_id ON scholarship_credits (id)"))
                db.execute(text("PRAGMA foreign_keys=on"))
                db.commit()
                print("Migration of scholarship_credits completed.")
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

        # 4. Seed Sample Students with Waiver Scenarios (Disabled by default so database stays clean)
        if seed_samples and db.query(Student).count() == 0:
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
                    academic_year="25-26",
                    course_branch="MBA",
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
                    academic_year="25-26",
                    course_branch="MBA",
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
                    academic_year="25-26",
                    course_branch="MBA",
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
                    academic_year="25-26",
                    course_branch="MBA",
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
                    academic_year="25-26",
                    course_branch="MBA",
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
                    academic_year="25-26",
                    course_branch="MBA",
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
    import sys
    seed_database(seed_samples="--samples" in sys.argv)

