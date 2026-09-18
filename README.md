# SHRO SYSTEMS — Sales Cost Sheet & 6-Stage Approval Workflow System

![SHRO Systems Logo](./public/shro_logo.svg)

> **Enterprise Digital Transformation Specialists — Est. 1988**  
> Production-ready, secure internal web application for drafting sales quotations, computing line-item deal margins, and enforcing a strict 6-stage sequential sign-off workflow.

---

## 📋 Table of Contents

1. [System Architecture](#-system-architecture)
2. [6-Stage Sequential Approval Workflow](#-6-stage-sequential-approval-workflow)
3. [Financial Engine & Profitability Formula](#-financial-engine--profitability-formula)
4. [Docker Deployment Guide (Production)](#-docker-deployment-guide-production)
   - [Option A: Docker Compose with PostgreSQL 16 (Recommended)](#option-a-docker-compose-with-postgresql-16-recommended)
   - [Option B: Standalone Docker Container (Embedded Database)](#option-b-standalone-docker-container-embedded-database)
5. [Local Development (Without Docker)](#-local-development-without-docker)
6. [Database Engine (PostgreSQL & Dual-Mode Support)](#-database-engine-postgresql--dual-mode-support)
7. [Email Notification System & SMTP Configuration](#-email-notification-system--smtp-configuration)
8. [Default Seed Credentials & Role Matrix](#-default-seed-credentials--role-matrix)
9. [Security, File Storage & Audit Trails](#-security-file-storage--audit-trails)
10. [Admin Tools, Excel Export & PDF Quotation Generator](#-admin-tools-excel-export--pdf-quotation-generator)

---

## 🏛 System Architecture

The application is built on a full-stack, modular architecture:

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, and Socket.io client.
- **Backend API**: Node.js (v20+), Express.js with ES Module / CommonJS bundling via `esbuild`.
- **Database**: Dual-engine PostgreSQL abstraction:
  - **External Production**: Standard PostgreSQL 14/15/16 via connection pooling (`pg.Pool`).
  - **Zero-Config Embedded**: Embedded PostgreSQL on disk via `@electric-sql/pglite` when `DATABASE_URL` is omitted.
- **Real-Time Push**: Socket.io server broadcasting live stage advances, rejection notifications, and reviewer queue badges.
- **Security**: JWT tokens in `HttpOnly`, `SameSite` cookies, `bcryptjs` (12 rounds), `helmet` security headers, and `express-rate-limit`.

---

## 🔄 6-Stage Sequential Approval Workflow

Every quotation routed for approval strictly progresses through a fixed 6-stage sequence. A stage can only be approved by the assigned reviewer (or a System Administrator):

```
[Draft Quote] 
      ↓ (Submit)
1. Finance 1   (Credit check, payment terms, distributor margin)
      ↓ (Approved)
2. Presales    (Technical sizing, bill of materials, OEM compatibility)
      ↓ (Approved)
3. Management  (Commercial margin approval, strategic discount clearance)
      ↓ (Approved)
4. Operations  (Order processing viability, procurement contracts)
      ↓ (Approved)
5. Logistics   (Dispatch feasibility, warehouse staging, transit insurance)
      ↓ (Approved)
6. Finance 2   (Final invoice verification, purchase order booking)
      ↓
[Quotation Approved & Locked]
```

### Workflow Rules:
- **Sequential Gatekeeping**: A stage cannot be evaluated or approved until the preceding stage has passed.
- **Rejection Circuit Breaker**: If any reviewer rejects a quote, the status is immediately marked **`Rejected`**, halted from advancing, and the initiator is notified with the reviewer's remarks.
- **Audit Logging**: Every action (Submitted, Approved, Rejected, Edited) records the actor ID, department, decision, timestamp, and optional remarks into the immutable `approval_logs` table.

---

## 💰 Financial Engine & Profitability Formula

The quotation calculator computes line items and deal-level profitability in real time:

### 1. Line Item Calculation
$$\text{Line Purchase} = \text{Unit Purchase} \times \text{Quantity}$$
$$\text{Line Sale} = \text{Unit Sale} \times \text{Quantity}$$
$$\text{Line Margin \%} = \frac{\text{Line Sale} - \text{Line Purchase}}{\text{Line Sale}} \times 100$$

### 2. Deal Summary Calculation
$$\text{Total Purchase} = \sum \text{Line Purchases}$$
$$\text{Total Sale} = \sum \text{Line Sales}$$

$$\text{Discount Amount} = 
\begin{cases} 
\text{Total Purchase} \times \left(\frac{\text{Discount Value}}{100}\right) & \text{if Percentage} \\
\text{Discount Value} & \text{if Flat Value}
\end{cases}$$

$$\text{Net Purchase} = (\text{Total Purchase} - \text{Discount Amount}) + \text{Consultation Charges} + \text{Freight Charges}$$
$$\text{Net Profit} = \text{Total Sale} - \text{Net Purchase}$$
$$\text{Overall Margin \%} = \left(\frac{\text{Net Profit}}{\text{Total Sale}}\right) \times 100$$

---

## 🐳 Docker Deployment Guide (Production)

### Option A: Docker Compose with PostgreSQL 16 (Recommended)

This orchestrates both the application and a dedicated PostgreSQL database container with automatic healthchecks and persistent storage volumes.

#### 1. Clone or copy the project repository
```bash
git clone <your-repository-url>
cd shro-cost-sheets
```

#### 2. Configure Environment Variables
Copy `.env.example` to `.env` or adjust `docker-compose.yml`:
```bash
cp .env.example .env
```

Review key values:
```env
PORT=3000
NODE_ENV=production
JWT_SECRET=generate_a_random_32_char_secret_string
DATABASE_URL=postgresql://postgres:shro_secure_db_pass@db:5432/shro_cost_sheets?sslmode=disable

# Optional SMTP settings (leave blank if not using email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@yourdomain.com
SMTP_PASS=your-google-app-password
SMTP_SECURE=false
```

#### 3. Build & Run
```bash
docker compose up -d --build
```

#### 4. Verification
- The app will be available at **`http://<SERVER_IP>:3000`**.
- Database healthcheck will confirm database readiness before booting the application.
- Check logs:
```bash
docker compose logs -f app
```

#### 5. Stopping or Restarting
```bash
# Stop containers without losing data
docker compose down

# Restart containers
docker compose restart
```

---

### Option B: Demo / Standalone Mode with Embedded Database (Docker Compose)

If you are running a demo or proof-of-concept, you do not need an external PostgreSQL database. You can run the entire application using the provided `docker-compose.demo.yml`:

```bash
# Start demo mode with Docker Compose (auto-builds and boots embedded PGlite):
docker compose -f docker-compose.demo.yml up -d --build
```

#### What happens:
- **Instant Boot**: Starts only the application container with no extra database dependencies.
- **Embedded Database**: Because `DATABASE_URL` is omitted, the app automatically initializes the embedded PostgreSQL engine (**PGlite**).
- **Persistence**: All data is saved directly to `./data` and uploaded documents to `./uploads` on your host machine.
- **Seed Data**: Pre-populates all departmental users, customer accounts, and sample quotations.

#### Access & Demo Credentials:
Open your browser at **`http://localhost:3000`**. All demo accounts use the password: **`Shro@2026`**

| Role | Username | Password | Purpose in Demo |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin` | `Shro@2026` | Full system control, Sudo 'Login As' mode, Master dropdowns |
| **Sales Rep** | `vaibhav.g` | `Shro@2026` | Create draft cost sheets, configure line items, submit for review |
| **Stage 1: Finance 1** | `rajesh.k` | `Shro@2026` | Reviewer for Stage 1 (Initial credit & payment terms) |
| **Stage 2: Presales** | `amit.s` | `Shro@2026` | Reviewer for Stage 2 (Technical BOM & OEM sizing) |
| **Stage 3: Management** | `priya.m` | `Shro@2026` | Reviewer for Stage 3 (Commercial margin clearance) |
| **Stage 4: Operations** | `suresh.p` | `Shro@2026` | Reviewer for Stage 4 (Order viability & PO validation) |
| **Stage 5: Logistics** | `deepak.v` | `Shro@2026` | Reviewer for Stage 5 (Transit & delivery scheduling) |
| **Stage 6: Finance 2** | `anita.r` | `Shro@2026` | Reviewer for Stage 6 (Final invoicing sign-off) |

> 💡 **Demo Pro-Tip (Admin Sudo Mode)**: Log in as `admin`. In the top-right user menu, click **"Sudo / Login As"** to switch directly into any reviewer's persona (Finance, Presales, Operations, etc.) in real time. This lets you showcase the full 6-stage sequential sign-off and rejection workflow in minutes without logging out and back in.

#### Handy Demo Commands:
```bash
# View live application logs:
docker compose -f docker-compose.demo.yml logs -f

# Stop the demo containers:
docker compose -f docker-compose.demo.yml down

# Reset the database to a fresh seed state:
docker compose -f docker-compose.demo.yml down
rm -rf ./data/postgres
docker compose -f docker-compose.demo.yml up -d
```

---

### Option C: Podman Deployment (Demo & Production)

The project includes first-class support for **Podman** (both rootless and rootful), supporting:
1. Native `podman compose` (Podman v4.7+ / v5+)
2. Standalone `podman-compose` (Python CLI tool)
3. Direct `podman run` commands

All volume mounts include SELinux labels (`:Z`) so that permission errors are prevented on RHEL, CentOS, Fedora, Rocky, and AlmaLinux.

#### 1. Running DEMO Mode with Podman (Embedded Database)

No external database required — runs in a single lightweight rootless container:

```bash
# Using native podman compose:
podman compose -f podman-compose.demo.yml up -d --build

# OR using python podman-compose:
podman-compose -f podman-compose.demo.yml up -d

# View logs:
podman compose -f podman-compose.demo.yml logs -f

# Stop demo:
podman compose -f podman-compose.demo.yml down
```

Access the demo at **`http://localhost:3000`** with username `admin` and password `Shro@2026`.

#### 2. Running PRODUCTION Mode with Podman (App + Dedicated PostgreSQL)

Runs full production architecture with dedicated PostgreSQL 16 on an isolated bridge network:

```bash
# Using native podman compose:
podman compose -f podman-compose.yml up -d --build

# OR using python podman-compose:
podman-compose -f podman-compose.yml up -d

# View logs:
podman compose -f podman-compose.yml logs -f

# Stop stack:
podman compose -f podman-compose.yml down
```

#### 3. Podman Single-Container Run (Without Compose)
```bash
# 1. Build image with Podman
podman build -t shro-cost-sheets:latest .

# 2. Run container (note the ':Z' flag for SELinux volume permission mapping)
podman run -d \
  -p 3000:3000 \
  --name shro-app \
  --restart unless-stopped \
  -v $(pwd)/data:/app/data:Z \
  -v $(pwd)/uploads:/app/uploads:Z \
  -e JWT_SECRET="your_demo_secret_key" \
  shro-cost-sheets:latest
```

---

#### Alternative: Direct `docker run` (Single Container)
```bash
# 1. Build Docker image
docker build -t shro-cost-sheets:latest .

# 2. Run container with mounted persistence volumes (embedded DB active)
docker run -d \
  -p 3000:3000 \
  --name shro-app \
  --restart unless-stopped \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/uploads:/app/uploads \
  -e JWT_SECRET="your_demo_secret_key" \
  shro-cost-sheets:latest
```

---

## 💻 Local Development (Without Docker)

### Prerequisites:
- **Node.js**: v20.x or v22.x LTS
- **npm** or **bun**

### Steps:
```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Start development server with hot-reloading (Express + Vite)
npm run dev
```

Visit `http://localhost:3000`.

### Production Build Locally:
```bash
# Compile client Vite assets and bundle server into dist/server.cjs
npm run build

# Start the compiled production server
npm start
```

---

## 🗄 Database Engine (PostgreSQL & Dual-Mode Support)

The database manager (`server/config/db.ts`) automatically adapts:

| Mode | Trigger | Behavior | Storage Path |
| :--- | :--- | :--- | :--- |
| **External PostgreSQL** | `DATABASE_URL` is set | Connects to PostgreSQL server via connection pool | PostgreSQL cluster |
| **Embedded PGlite** | `DATABASE_URL` is omitted | Runs embedded WASM PostgreSQL on disk | `./data/postgres` |

### Database Schemas Initialized Automatically:
1. `users`: Credentials, department roles (`Sales`, `Finance`, `Presales`, etc.), access levels, status.
2. `teams` & `team_members`: Sales pods, regional teams, and lead assignments.
3. `accounts`: Customers, industry segments, billing email, and multiple stakeholder contacts (`JSONB`).
4. `cost_sheets`: Quotations, commercial metrics, financial year, and sequential approver map.
5. `line_items`: Bill of Materials line items, unit costs, quantities, and profit margins.
6. `approval_logs`: Immutable audit trail of approvals, rejections, remarks, and timestamps.
7. `uploaded_files`: Vendor quotes, BOM specs, and PO document metadata.
8. `dropdown_options`: Real-time options for Business Units, OEMs, and Distributors.
9. `notifications`: In-app notification queues and status badges.

---

## 📧 Email Notification System & SMTP Configuration

The email notification service (`server/services/emailService.ts`) triggers notifications at critical milestones:
- **Reviewer Notification**: Alerts the next stage's reviewer as soon as a quote enters their stage.
- **Approval / Rejection Notification**: Alerts the quotation initiator and sales rep when a decision is reached, attaching reviewer remarks.

### Do you need to run your own SMTP server?
**No.** You can choose any of the following:

1. **Zero-Config (No Email Server)**:
   - Leave `SMTP_HOST` empty in `.env`.
   - The app continues operating normally. In-app real-time WebSocket notifications will fire, and outbound email contents will log to the server console.

2. **Google Workspace / Gmail**:
   - Create a 16-character [Google App Password](https://myaccount.google.com/apppasswords).
   ```env
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=587
   SMTP_USER="billing@yourdomain.com"
   SMTP_PASS="xxxx xxxx xxxx xxxx"
   SMTP_SECURE=false
   ```

3. **Microsoft 365 / Exchange Online**:
   ```env
   SMTP_HOST="smtp.office365.com"
   SMTP_PORT=587
   SMTP_USER="quotations@company.com"
   SMTP_PASS="password"
   SMTP_SECURE=false
   ```

4. **Transactional Relays (SendGrid / Amazon SES / Resend / Mailgun)**:
   - Provide standard SMTP host, port 587, and API key as password.

---

## 📁 File Organization & Disaster Recovery Backups

Uploaded documents (vendor quotes, BOM spec sheets, customer purchase orders, technical diagrams) are organized on disk by **Cost Sheet**:

```text
uploads/
├── .temp/                           # Temporary buffer during active upload streams
├── SHRO_2026-27_001/                # Cost sheet specific directory
│   ├── Cisco_Catalyst_Quote.pdf     # Clean, human-readable document names
│   ├── Switch_BOM_Specs.xlsx
│   ├── deal-info.txt                # Plaintext manifest with deal metadata & document list
│   └── deal-metadata.json           # Machine-readable JSON backup for automated pipelines
├── SHRO_2026-27_002/
│   ├── Fortinet_Security_Appliance.pdf
│   ├── deal-info.txt
│   └── deal-metadata.json
```

### Key Advantages for IT & System Administrators:
1. **Instant Offline Disaster Recovery**: In backup or audit scenarios, you do not need the database or web application to find quotes. Simply browse into `uploads/<Cost_Sheet_Number>/` to retrieve any file directly.
2. **Plaintext Archive Manifest (`deal-info.txt`)**: Each cost sheet folder contains a manifest generated at upload time showing:
   - Cost Sheet Number & Database ID
   - Deal Subject, Customer Name, OEM, Distributor, and Business Unit
   - Salesperson & Initiator contact details
   - Commercial totals (Total Sale, Total Purchase, Net Profit, Margin %)
   - List of all physically attached documents with file sizes and upload timestamps
3. **Machine-Readable Metadata (`deal-metadata.json`)**: Ideal for cold-storage scripts, S3 / rsync sync tasks, or compliance indexing.
4. **Clean File Naming**: Files preserve their readable original filenames with safe sanitization (no random gibberish collision hashes). Duplicate filenames are incremented safely (e.g., `Quote_(1).pdf`).
5. **Lifecycle Management**: Deleting an attachment removes the file from disk and updates the manifest. Deleting a draft cost sheet cleanly purges its directory.

---

## 📦 Full System Backup & Disaster Recovery (.zip Import / Export)

The portal includes an enterprise-grade, one-click Backup & Disaster Recovery system accessible under **Admin Tools → Backup & Disaster Recovery**:

### What's Inside an Exported Backup Archive:
- **`backup-metadata.json`**: System version, export timestamp, admin identity, and full count of entities.
- **`database-backup.json`**: Complete JSON dump of all 10 PostgreSQL database tables:
  - Users, roles, credentials, and organizational teams
  - Customer accounts & contact details
  - Master dropdown configurations (OEMs, Distributors, Business Units)
  - Cost Sheets with all commercial fields, currencies, and discounts
  - Line Items with cost, selling price, quantities, and margins
  - 6-Stage Approval histories and comments
  - Document attachment catalog & audit logs
- **`uploads/` Folder Tree**: Every uploaded vendor quotation, BOM spreadsheet, customer PO, and generated `deal-info.txt` manifest, organized by Cost Sheet number.

### Import & Restoration Features:
1. **Pre-Restore Inspection**: Uploading a `.zip` immediately inspects and validates the archive without modifying the system. It displays exact counts of cost sheets, line items, accounts, users, and physical attachments.
2. **Restore Modes**:
   - **Clean Replacement (Disaster Recovery)**: Cleans the existing database and uploads directory, restoring the exact state from the snapshot. Safely resets all auto-increment sequences.
   - **Safe Merge / Append**: Preserves existing data and appends missing cost sheets, accounts, and master dropdowns.
3. **Safety Protection**: Requires explicit checkbox confirmation and safety prompt before executing destructive operations.

### API Endpoints for Automated Backups:
- `GET /api/backup/export` (Bearer JWT, Admin only) → Returns streaming `.zip` file.
- `POST /api/backup/inspect` (multipart `file`) → Returns inspection metadata and counts.
- `POST /api/backup/restore` (multipart `file`, `mode=replace|merge`) → Restores database and physical files.

---

## 👥 Default Seed Credentials & Role Matrix

On initial boot, the application seeds pre-configured departmental users. All accounts use password: **`Shro@2026`**

| Username | Full Name | Department Role | Access Level | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`admin`** | System Administrator | Administration | **Admin** | Full system rights, Sudo mode, Dropdown editor |
| **`vaibhav.g`** | Vaibhav G. (Sales Rep) | Sales | User | Deals initiator & line-item creator |
| **`rajesh.k`** | Rajesh Kumar | Finance | TeamLead | Stage 1 Approver (Initial credit & margin check) |
| **`amit.s`** | Amit Sharma | Presales | Management | Stage 2 Approver (Technical BoM sizing) |
| **`priya.m`** | Priya Mehta | Management | Management | Stage 3 Approver (Margin & strategic clearance) |
| **`suresh.p`** | Suresh Patel | Operations | TeamLead | Stage 4 Approver (Order processing viability) |
| **`deepak.v`** | Deepak Verma | Logistics | User | Stage 5 Approver (Transit & delivery scheduling) |
| **`anita.r`** | Anita Roy | Finance | Management | Stage 6 Approver (Final billing verification) |

---

## 🔒 Security, File Storage & Audit Trails

- **HttpOnly JWT Authentication**: Tokens cannot be accessed by client-side scripts, mitigating XSS risks.
- **Bcrypt Password Hashing**: Passwords are saved with 12 salt rounds.
- **Document Vault**: Uploaded PDFs and Excel files are stored on disk in `./uploads/` with sanitized, collision-resistant filenames. The database stores only metadata and secure paths.
- **Brute Force Rate Limiting**: Express rate limiting restricts repetitive failed login attempts.
- **Audit Logging**: Every approval, revision, rejection, and Sudo switch is permanently logged with actor details and timestamps.

---

## 🛠 Admin Tools, Excel Export & PDF Quotation Generator

1. **Admin 'Login As' (Sudo) Mode**:
   - Administrators can simulate any user's view to troubleshoot review queues or stage blocks with a one-click return to Admin mode.
2. **Master Dropdown Editor**:
   - Add and update Business Units (e.g., Enterprise Solutions, Cloud & Data Center), OEMs (Cisco, Fortinet, Dell, HP), and Distributors (Ingram Micro, Redington, Savex) on the fly.
3. **Landscape Branded PDF Quotation Generator**:
   - One-click export of an official landscape quotation featuring the SHRO Systems company header, customer details, equipment line table, commercial breakdown, and the 6-stage sign-off block.
4. **Excel Reporting**:
   - Filter quotes by status, business unit, salesperson, and financial year, then export to native `.xlsx` with calculated totals and margins.

---

### Developed for SHRO SYSTEMS PRIVATE LIMITED
*Est. 1988 — Digital Transformation Specialists*
