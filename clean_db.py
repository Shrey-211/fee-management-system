import sqlite3
from pathlib import Path

db_path = Path("backend/data/fees.db")
if not db_path.exists():
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Get all tables
tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("Current row counts before cleaning:")
for t in tables:
    cnt = cur.execute(f"SELECT count(*) FROM [{t}]").fetchone()[0]
    print(f"  {t}: {cnt} rows")

# Tables to clean (all transactional and student data)
tables_to_clear = [
    "scholarship_disbursements",
    "scholarship_credits",
    "payment_items",
    "payments",
    "fines",
    "student_fee_heads",
    "students",
    "audit_logs",
    "email_logs"
]

print("\nCleaning student and transactional tables...")
cur.execute("PRAGMA foreign_keys = OFF;")
for t in tables_to_clear:
    if t in tables:
        cur.execute(f"DELETE FROM [{t}];")
        # Reset autoincrement sequence if sqlite_sequence exists
        try:
            cur.execute(f"DELETE FROM sqlite_sequence WHERE name='{t}';")
        except Exception:
            pass
        print(f"  Cleared {t}")

cur.execute("PRAGMA foreign_keys = ON;")
conn.commit()

# VACUUM to reclaim space and compact the database
cur.execute("VACUUM;")
conn.commit()

print("\nRow counts after cleaning:")
for t in tables:
    cnt = cur.execute(f"SELECT count(*) FROM [{t}]").fetchone()[0]
    print(f"  {t}: {cnt} rows")

conn.close()
print("\nDatabase cleaned successfully! Ready for fresh student testing.")

