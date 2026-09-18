import path from 'path';
import fs from 'fs';
import { PGlite } from '@electric-sql/pglite';
import pgPackage from 'pg';

const { Pool } = pgPackage;

let pgPool: any = null;
let pgliteInstance: PGlite | null = null;

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  console.log('Connecting to external PostgreSQL database via DATABASE_URL...');
  pgPool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
} else {
  console.log('Using embedded PostgreSQL (PGlite) on local disk...');
  const dbDir = path.join(process.cwd(), 'data', 'postgres');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  pgliteInstance = new PGlite(dbDir);
}

export async function query(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
  try {
    if (pgPool) {
      const res = await pgPool.query(sql, params);
      return {
        rows: res.rows || [],
        rowCount: res.rowCount || 0,
      };
    } else if (pgliteInstance) {
      const res = await pgliteInstance.query(sql, params);
      return {
        rows: res.rows || [],
        rowCount: (res.rows || []).length,
      };
    } else {
      throw new Error('No database client initialized');
    }
  } catch (error) {
    console.error('Database query error:', error, 'SQL:', sql, 'Params:', params);
    throw error;
  }
}

export async function initDb() {
  console.log('Initializing PostgreSQL database schemas...');
  
  if (pgPool) {
    let connected = false;
    let attempts = 0;
    while (!connected && attempts < 15) {
      try {
        attempts++;
        await pgPool.query('SELECT 1');
        connected = true;
      } catch (err: any) {
        if (attempts >= 15) {
          throw new Error(`Failed to connect to PostgreSQL database after 15 attempts: ${err.message}`);
        }
        console.log(`Waiting for PostgreSQL database to be ready (attempt ${attempts}/15)...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(100) NOT NULL,
      access_level VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'Active',
      report_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      lead_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS team_members (
      team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (team_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      industry VARCHAR(100),
      phone VARCHAR(50),
      email VARCHAR(255),
      comments TEXT,
      contacts JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cost_sheets (
      id SERIAL PRIMARY KEY,
      cs_number VARCHAR(255) UNIQUE NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'Draft',
      subject TEXT NOT NULL,
      initiator_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      salesperson_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      distributor TEXT,
      business_unit TEXT,
      oem TEXT,
      currency VARCHAR(20) DEFAULT 'INR',
      discount_type VARCHAR(50) DEFAULT 'Percentage',
      discount_value NUMERIC(15,2) DEFAULT 0.00,
      consultation_charges NUMERIC(15,2) DEFAULT 0.00,
      freight_charges NUMERIC(15,2) DEFAULT 0.00,
      total_purchase NUMERIC(15,2) DEFAULT 0.00,
      total_sale NUMERIC(15,2) DEFAULT 0.00,
      net_purchase NUMERIC(15,2) DEFAULT 0.00,
      net_profit NUMERIC(15,2) DEFAULT 0.00,
      margin_percentage NUMERIC(8,2) DEFAULT 0.00,
      current_stage INTEGER DEFAULT 1,
      assigned_approvers JSONB DEFAULT '{}'::jsonb,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS line_items (
      id SERIAL PRIMARY KEY,
      cost_sheet_id INTEGER REFERENCES cost_sheets(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      unit_purchase NUMERIC(15,2) NOT NULL DEFAULT 0.00,
      unit_sale NUMERIC(15,2) NOT NULL DEFAULT 0.00,
      quantity NUMERIC(15,2) NOT NULL DEFAULT 1.00,
      total_purchase NUMERIC(15,2) NOT NULL DEFAULT 0.00,
      total_sale NUMERIC(15,2) NOT NULL DEFAULT 0.00,
      margin_percentage NUMERIC(8,2) NOT NULL DEFAULT 0.00
    );

    CREATE TABLE IF NOT EXISTS approval_logs (
      id SERIAL PRIMARY KEY,
      cost_sheet_id INTEGER REFERENCES cost_sheets(id) ON DELETE CASCADE,
      stage_name VARCHAR(100) NOT NULL,
      stage_number INTEGER NOT NULL,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      decision VARCHAR(50) NOT NULL,
      comment TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS uploaded_files (
      id SERIAL PRIMARY KEY,
      cost_sheet_id INTEGER REFERENCES cost_sheets(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_size BIGINT NOT NULL,
      mime_type VARCHAR(100),
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dropdown_options (
      id SERIAL PRIMARY KEY,
      category VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      is_active BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      cost_sheet_id INTEGER REFERENCES cost_sheets(id) ON DELETE CASCADE,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS portal_settings (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  if (pgPool) {
    await pgPool.query(schemaSql);
  } else if (pgliteInstance) {
    await pgliteInstance.exec(schemaSql);
  }

  // Schema migrations for existing databases to prevent VARCHAR length errors
  const columnMigrations = [
    'ALTER TABLE cost_sheets ALTER COLUMN distributor TYPE TEXT',
    'ALTER TABLE cost_sheets ALTER COLUMN business_unit TYPE TEXT',
    'ALTER TABLE cost_sheets ALTER COLUMN oem TYPE TEXT',
    'ALTER TABLE cost_sheets ALTER COLUMN subject TYPE TEXT',
    'ALTER TABLE cost_sheets ALTER COLUMN cs_number TYPE TEXT',
    'ALTER TABLE cost_sheets ALTER COLUMN discount_type TYPE TEXT',
    'ALTER TABLE cost_sheets ALTER COLUMN currency TYPE TEXT',
    'ALTER TABLE cost_sheets ALTER COLUMN status TYPE TEXT',
    'ALTER TABLE accounts ALTER COLUMN industry TYPE TEXT',
    'ALTER TABLE accounts ALTER COLUMN phone TYPE TEXT',
    'ALTER TABLE accounts ALTER COLUMN name TYPE TEXT',
    'ALTER TABLE accounts ALTER COLUMN email TYPE TEXT',
    'ALTER TABLE dropdown_options ALTER COLUMN name TYPE TEXT',
    'ALTER TABLE approval_logs ALTER COLUMN stage_name TYPE TEXT',
  ];

  for (const alterSql of columnMigrations) {
    try {
      if (pgPool) {
        await pgPool.query(alterSql);
      } else if (pgliteInstance) {
        await pgliteInstance.exec(alterSql);
      }
    } catch (e) {
      // Ignore if table/column already altered or doesn't support
    }
  }

  // Seed default branding if not present
  const brandingCheck = await query("SELECT key FROM portal_settings WHERE key = 'branding'");
  if (brandingCheck.rows.length === 0) {
    const defaultBranding = {
      company_name: 'SHRO Systems Pvt. Ltd.',
      tagline: 'Digital Transformation Specialists',
      est_year: 'Est. 1988',
      office_address: 'Office No.1403, 14th Floor DNK Square, Airport Road, Viman Nagar, Pune, Maharashtra, India, 411014',
      registered_office: '1184/4, Shreenath, Dnyaneshwar Paduka Chowk, FC Road, Shivaji Nagar, Pune - 411005',
      phone: '(020) 25532244, 25531863, 25530708, 30225051',
      website: 'www.shrosystems.com',
      email: 'contact@shrosystems.com',
      gstin: '27AAGCS0761F1ZG',
      pan: 'AAGCS0761F',
      default_terms: 'Payment Term: As Per Agreed Terms 30 Days\nTaxes: Extra at Actual\nDelivery Period: 4-6 weeks from date of receipt of PO\nFreight Charges: Extra as applicable if delivery Outside Pune\nOrder to be Placed on: Shro Systems Pvt. Ltd. 1184/4, Shreenath, Dnyaneshwar Paduka Chowk, FC Road, Shivaji Nagar, Pune - 411005',
      primary_color: '#0052cc',
    };
    await query("INSERT INTO portal_settings (key, value) VALUES ('branding', $1)", [JSON.stringify(defaultBranding)]);
  }

  // Seed default email settings if not present
  const emailCheck = await query("SELECT key FROM portal_settings WHERE key = 'email'");
  if (emailCheck.rows.length === 0) {
    const defaultEmail = {
      smtp_host: 'smtp.office365.com',
      smtp_port: 587,
      smtp_secure: false,
      smtp_user: 'approvals@shrosystems.com',
      smtp_password: '',
      from_name: 'SHRO Systems Approvals',
      from_email: 'approvals@shrosystems.com',
      enable_notifications: true,
      notify_submission: true,
      notify_approval: true,
      notify_rejection: true,
    };
    await query("INSERT INTO portal_settings (key, value) VALUES ('email', $1)", [JSON.stringify(defaultEmail)]);
  }

  console.log('PostgreSQL database schemas created successfully.');
}
