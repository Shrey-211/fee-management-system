# Student Fee Management System — Offline Edition

An internal, air-gapped, offline-first desktop application designed for single-PC deployment (designated for Mr. Shrikant's office workstation). The software handles student fee structures, configurable waiver rules, manual receipt book logging, event fines, and automated Excel reporting with zero internet or cloud subscription dependencies.

---

## 1. Quick Start & Execution

### Option A: Run via Desktop Launcher (Direct)
Double-click:
```bat
start_system.bat
```
This boots the local offline server and automatically opens your browser at `http://127.0.0.1:8000`.

### Option B: Run Standalone Executable (.exe)
Navigate to:
```
dist\FeeManagementSystem\FeeManagementSystem.exe
```
Double-click `FeeManagementSystem.exe` to run the self-contained package.

---

## 2. Default Staff Accounts & Credentials

The system comes pre-seeded with three role-based accounts:

| Role | Username | Initial Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Fee Administrator** (Mr. Shrikant) | `admin` | `admin123` | Full administrative control: fee structures, user management, offline database backups, SMTP config, waiver overrides |
| **Accountant** | `accountant` | `account123` | Event fine tracking, fee collection tracking, Excel reports export, email reminders dispatch |
| **Clerk** | `clerk` | `clerk123` | Student directory lookups, payment entry with manual receipt book numbers, viewing balances |

> [!NOTE]
> All passwords are cryptographically hashed using **bcrypt**. Staff can change their password at any time via the key icon in the top navigation bar.

---

## 3. Fee Structure & Rule Engine

The system supports configurable fee heads and fully customizable **Fee Concession Types** configured per academic year:
- **Base Fee Heads**:
  - **Tuition Fee**: Standard ₹40,000.00
  - **Development Fee**: Standard ₹15,000.00
  - **Dress Code Fee**: ₹3,000.00
  - **University Examination Fee**: ₹2,000.00
  - **Other Charges (Send-off, Welcome, Party contributions)**: ₹1,000.00

### Dynamic Fee Concession Types & Waiver Matrix
Administrators can configure or add custom fee types in **Settings**:
- **Caste / Social Categories (`CASTE`)**:
  - `OPEN`: Standard 0% waiver across all fee heads.
  - `EBC`: Configurable (defaults to 50% Tuition discount, ₹20,000.00 payable).
  - `SC` & `ST`: Configurable (defaults to 100% Tuition & Development waiver).
  - `OBC`, `VJNT`, `NT`, `SBC`, etc.: Fully customizable.
- **Gender-Based Rules (`GENDER`)**:
  - `FEMALE`: Configurable (defaults to 100% Tuition waiver under the Girl Student Scheme).
  - `MALE`: Standard applicable fees.
- **Special / Custom Quotas (`CUSTOM`)**:
  - Create custom quotas such as `TFWS` (Tuition Fee Waiver Scheme), `SPORTS` (Sports Quota), `STAFF_WARD`, or `HANDICAPPED`.
- **Waiver Precedence & Overlapping Resolution**:
  - The fee engine automatically resolves overlapping rules by awarding the **highest applicable waiver** per fee head (e.g. an EBC Girl student receives 100% girl student tuition waiver instead of 50%).
  - Non-applicable and waived charges explicitly display `₹0.00` alongside their scheme reason on student ledger statements.
  - One-click **"Recalculate All Student Fees"** allows administrators to re-evaluate all enrolled students whenever fee rules are updated.

---

## 4. Cashier Workflow & Physical Receipt Cross-Referencing

1. **Manual Physical Receipt Book Entry**:
   - The cashier issues the paper receipt to the student from the physical booklet.
   - On the system's **"Enter Physical Receipt"** screen, staff select the student, enter the **Manual Receipt Number** (e.g. `BOOK-12/0459`), and allocate the payment across applicable fee heads or fines.
2. **Instant Receipt Recognition**:
   - Once a payment is recorded and marked received, it is immediately credited to the student's ledger and daily collections. No secondary bank deposit or batching status is required.
   - Shows real-time payment history and remaining due by fee head and in total.

---

## 5. Event Fines & Decimal Precision

- **Fines**: Staff can levy fines for college events (e.g., *Krishna Utsav Absence*, *Freshers Absence*, *Send-off Absence*).
- Fines are dynamically reflected in student ledger balances and can be paid or waived.
- **Precision Arithmetic**: All financial calculations use exact 2-decimal arithmetic (`Decimal`), preventing floating-point artifacts and accurately maintaining residual balances (such as **₹1.00** remaining when ₹59,999.00 of ₹60,000.00 is paid).

---

## 6. Reports & Excel Export

- **Daily Fee Collection Report**: Filter by today or any custom period (e.g., July 1 to October 31). Provides fee-head breakdown, cash vs digital split, and 1-click formatted Excel workbook download (`.xlsx`).
- **Student-Wise Outstanding Balances**: Complete list of students with applicable fees, amounts paid, active event fines, and net balances due with 1-click Excel download (`.xlsx`).
- **Scholarship Disbursement Tracking**: Records government scholarship receipts (e.g. MahaDBT, Post-Matric) and attributes credits to student ledgers.

---

## 7. Email Reminders (SMTP)

- Configurable reminder template with placeholder variables:
  - `{student_name}`, `{student_code}`, `{total_due}`, `{fee_breakdown}`, `{due_date}`
- Send single reminders or bulk reminders to students with dues.
- Works offline gracefully without crashing if no network is available.

---

## 8. Offline Database Backups

- SQLite engine configured with Write-Ahead Logging (`WAL`) mode for crash resiliency.
- **Automatic Daily Backups**: Timestamped snapshots saved to `backend/backups/`.
- **One-Click USB Backup**: Click **"Backup Database Now"** in Settings to generate a fresh snapshot and download the `.db` file for safekeeping on an external USB pen drive.

