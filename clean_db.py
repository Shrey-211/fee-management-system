import sqlite3
from pathlib import Path

def clean_database(db_path: Path):
    if not db_path.exists():
        print(f"Database not found at {db_path}")
        return

    print(f"\n==========================================")
    print(f"Cleaning database: {db_path}")
    print(f"==========================================")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Tables to completely clear (all transactional and student data)
    tables_to_clear = [
        "scholarship_disbursements",
        "scholarship_credits",
        "payment_items",
        "payments",
        "fines",
        "student_fee_heads",
        "students",
        "audit_logs",
        "email_logs",
        "reminder_logs"
    ]

    cur.execute("PRAGMA foreign_keys = OFF;")
    for t in tables_to_clear:
        try:
            cur.execute(f"DELETE FROM [{t}];")
            cur.execute(f"DELETE FROM sqlite_sequence WHERE name='{t}';")
            print(f"  Cleared {t}")
        except Exception as e:
            pass

    # Remove all Sports categories and any custom categories created during tests
    # First find their IDs
    sports_rows = cur.execute(
        "SELECT id, name, code FROM fee_concession_types "
        "WHERE name LIKE '%Sports%' OR code LIKE 'SPORTS%'"
    ).fetchall()

    if sports_rows:
        print(f"\n  Found {len(sports_rows)} sports categories to delete:")
        for r in sports_rows:
            print(f"    - ID {r[0]}: {r[1]} ({r[2]})")
            # Delete associated head rules
            cur.execute("DELETE FROM fee_type_head_rules WHERE concession_type_id = ?", (r[0],))
            # Delete the concession type
            cur.execute("DELETE FROM fee_concession_types WHERE id = ?", (r[0],))
        print("  All sports categories and associated rules deleted successfully.")
    else:
        print("  No sports categories found.")

    cur.execute("PRAGMA foreign_keys = ON;")
    conn.commit()

    # Compact database
    cur.execute("VACUUM;")
    conn.commit()

    # Print remaining concession types
    remaining_types = cur.execute("SELECT id, name, code, type_group FROM fee_concession_types").fetchall()
    print(f"\n  Remaining Fee Concession Types ({len(remaining_types)} total):")
    for rt in remaining_types:
        print(f"    [{rt[0]}] {rt[1]} ({rt[2]}) - {rt[3]}")

    conn.close()

if __name__ == "__main__":
    for path in [Path("backend/data/fees.db"), Path("dist/FeeManagementSystem/data/fees.db")]:
        if path.exists():
            clean_database(path)
