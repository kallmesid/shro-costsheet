import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { query } from '../config/db.ts';
import { AuthRequest } from '../middleware/auth.ts';

const uploadDir = path.join(process.cwd(), 'uploads');
const tempBackupDir = path.join(uploadDir, '.temp');

if (!fs.existsSync(tempBackupDir)) {
  fs.mkdirSync(tempBackupDir, { recursive: true });
}

// Multer storage for backup zip upload (up to 250MB)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempBackupDir);
  },
  filename: (req, file, cb) => {
    cb(null, `backup-upload-${Date.now()}.zip`);
  }
});

export const backupUpload = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 }, // 250MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || 
        file.mimetype === 'application/x-zip-compressed' || 
        file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only .zip backup archives are allowed'));
    }
  }
});

// Helper: Safely reset PostgreSQL sequences after inserting specific IDs
async function resetSequence(tableName: string, idColumn = 'id') {
  try {
    const seqRes = await query(`SELECT pg_get_serial_sequence($1, $2) as seq`, [tableName, idColumn]);
    const seqName = seqRes.rows[0]?.seq;
    if (seqName) {
      await query(`SELECT setval($1, GREATEST(COALESCE((SELECT MAX(${idColumn}) FROM ${tableName}), 1), 1))`, [seqName]);
    }
  } catch (err) {
    console.warn(`Could not reset sequence for table ${tableName}:`, err);
  }
}

/**
 * EXPORT FULL SYSTEM BACKUP (.ZIP)
 * Packages:
 * - database-backup.json (all 10 tables)
 * - backup-metadata.json (system stats, creation time, user info)
 * - uploads/ (all physical cost sheet folders, documents, and manifests)
 */
export async function exportBackup(req: AuthRequest, res: Response) {
  try {
    const user = req.user;
    if (!user || user.access_level !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required to export system backups.' });
    }

    const scope = (req.query.scope || req.query.type || 'both').toString().toLowerCase(); // 'both' | 'db' | 'files'
    console.log(`[Backup] Admin ${user.username} initiated system backup export (Scope: ${scope})...`);

    // Fetch all database tables if needed
    let databaseData: any = null;
    let costSheetsRowsCount = 0;
    let lineItemsRowsCount = 0;
    let accountsRowsCount = 0;
    let usersRowsCount = 0;
    let teamsRowsCount = 0;
    let dropdownsRowsCount = 0;
    let approvalLogsRowsCount = 0;
    let uploadedFilesRowsCount = 0;
    let notificationsRowsCount = 0;

    if (scope === 'both' || scope === 'db') {
      const [
        usersRes,
        teamsRes,
        teamMembersRes,
        accountsRes,
        dropdownsRes,
        costSheetsRes,
        lineItemsRes,
        approvalLogsRes,
        uploadedFilesRes,
        notificationsRes,
        portalSettingsRes
      ] = await Promise.all([
        query('SELECT * FROM users ORDER BY id ASC'),
        query('SELECT * FROM teams ORDER BY id ASC'),
        query('SELECT * FROM team_members ORDER BY team_id, user_id ASC'),
        query('SELECT * FROM accounts ORDER BY id ASC'),
        query('SELECT * FROM dropdown_options ORDER BY id ASC'),
        query('SELECT * FROM cost_sheets ORDER BY id ASC'),
        query('SELECT * FROM line_items ORDER BY id ASC'),
        query('SELECT * FROM approval_logs ORDER BY id ASC'),
        query('SELECT * FROM uploaded_files ORDER BY id ASC'),
        query('SELECT * FROM notifications ORDER BY id ASC'),
        query('SELECT * FROM portal_settings ORDER BY key ASC').catch(() => ({ rows: [] }))
      ]);

      costSheetsRowsCount = costSheetsRes.rows.length;
      lineItemsRowsCount = lineItemsRes.rows.length;
      accountsRowsCount = accountsRes.rows.length;
      usersRowsCount = usersRes.rows.length;
      teamsRowsCount = teamsRes.rows.length;
      dropdownsRowsCount = dropdownsRes.rows.length;
      approvalLogsRowsCount = approvalLogsRes.rows.length;
      uploadedFilesRowsCount = uploadedFilesRes.rows.length;
      notificationsRowsCount = notificationsRes.rows.length;

      databaseData = {
        users: usersRes.rows,
        teams: teamsRes.rows,
        team_members: teamMembersRes.rows,
        accounts: accountsRes.rows,
        dropdown_options: dropdownsRes.rows,
        cost_sheets: costSheetsRes.rows,
        line_items: lineItemsRes.rows,
        approval_logs: approvalLogsRes.rows,
        uploaded_files: uploadedFilesRes.rows,
        notifications: notificationsRes.rows,
        portal_settings: portalSettingsRes.rows,
      };
    }

    // Calculate file stats from physical uploads folder if needed
    let totalFilesOnDisk = 0;
    let totalDiskBytes = 0;

    function scanFolder(dir: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue; // skip .temp
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanFolder(fullPath);
        } else if (entry.isFile()) {
          totalFilesOnDisk++;
          totalDiskBytes += fs.statSync(fullPath).size;
        }
      }
    }

    if (scope === 'both' || scope === 'files') {
      scanFolder(uploadDir);
    }

    const metadata = {
      format_version: '1.0',
      scope, // 'both' | 'db' | 'files'
      exported_at: new Date().toISOString(),
      exported_by: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        access_level: user.access_level
      },
      system: 'SHRO Systems - Cost Sheet Management Portal',
      stats: {
        scope,
        cost_sheets: costSheetsRowsCount,
        line_items: lineItemsRowsCount,
        accounts: accountsRowsCount,
        users: usersRowsCount,
        teams: teamsRowsCount,
        dropdown_options: dropdownsRowsCount,
        approval_logs: approvalLogsRowsCount,
        uploaded_files_records: uploadedFilesRowsCount,
        notifications: notificationsRowsCount,
        physical_files_count: totalFilesOnDisk,
        physical_files_bytes: totalDiskBytes,
        physical_files_formatted: `${(totalDiskBytes / (1024 * 1024)).toFixed(2)} MB`
      }
    };

    const zip = new AdmZip();

    // 1. Add metadata
    zip.addFile('backup-metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf8'));

    // 2. Add database dump if requested
    if (databaseData) {
      zip.addFile('database-backup.json', Buffer.from(JSON.stringify(databaseData, null, 2), 'utf8'));
    }

    // 3. Recursively add physical files from uploads/ if requested
    if (scope === 'both' || scope === 'files') {
      if (fs.existsSync(uploadDir)) {
        const entries = fs.readdirSync(uploadDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const itemPath = path.join(uploadDir, entry.name);
          if (entry.isDirectory()) {
            zip.addLocalFolder(itemPath, `uploads/${entry.name}`);
          } else if (entry.isFile()) {
            zip.addLocalFile(itemPath, 'uploads');
          }
        }
      }
    }

    const zipBuffer = zip.toBuffer();
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `shro-portal-backup-${scope}-${timestampStr}.zip`;

    console.log(`[Backup] Export archive built successfully: ${fileName} (${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB, scope=${scope})`);

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': zipBuffer.length.toString(),
      'X-Backup-Scope': scope,
      'X-Backup-Cost-Sheets': metadata.stats.cost_sheets.toString(),
      'X-Backup-Files': metadata.stats.physical_files_count.toString()
    });

    return res.send(zipBuffer);
  } catch (error: any) {
    console.error('[Backup] Export failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate backup archive' });
  }
}

/**
 * INSPECT BACKUP PACKAGE
 * Inspects an uploaded .zip archive without applying changes.
 * Returns metadata, table row counts, and file list so the admin can verify.
 */
export async function inspectBackup(req: AuthRequest, res: Response) {
  const file = req.file;
  try {
    const user = req.user;
    if (!user || user.access_level !== 'Admin') {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    if (!file) {
      return res.status(400).json({ error: 'No backup zip file provided' });
    }

    const zip = new AdmZip(file.path);
    const entries = zip.getEntries();

    const metaEntry = entries.find(e => e.entryName === 'backup-metadata.json');
    const dbEntry = entries.find(e => e.entryName === 'database-backup.json');

    const filesInZip: { name: string; size: number }[] = [];
    let totalFilesBytes = 0;
    for (const entry of entries) {
      if (entry.entryName.startsWith('uploads/') && !entry.isDirectory) {
        filesInZip.push({
          name: entry.entryName.replace(/^uploads\//, ''),
          size: entry.header.size
        });
        totalFilesBytes += entry.header.size;
      }
    }

    if (!dbEntry && filesInZip.length === 0) {
      fs.unlinkSync(file.path);
      return res.status(400).json({
        error: 'Invalid backup archive: neither "database-backup.json" nor any uploaded files were found in this zip package.'
      });
    }

    let metadata: any = null;
    if (metaEntry) {
      try {
        metadata = JSON.parse(zip.readAsText(metaEntry));
      } catch (e) {
        console.warn('Could not parse backup-metadata.json:', e);
      }
    }

    const tableCounts: { [key: string]: number } = {};
    if (dbEntry) {
      try {
        const databaseData = JSON.parse(zip.readAsText(dbEntry));
        for (const [table, rows] of Object.entries(databaseData)) {
          tableCounts[table] = Array.isArray(rows) ? rows.length : 0;
        }
      } catch (e: any) {
        console.warn('Could not parse database-backup.json:', e.message);
      }
    }

    // Clean up uploaded zip file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return res.json({
      valid: true,
      hasDatabase: !!dbEntry,
      hasFiles: filesInZip.length > 0,
      metadata: metadata || { exported_at: 'Unknown', system: 'Generic SHRO Backup' },
      tableCounts,
      filesCount: filesInZip.length,
      filesTotalBytes: totalFilesBytes,
      filesFormatted: `${(totalFilesBytes / (1024 * 1024)).toFixed(2)} MB`,
      sampleFiles: filesInZip.slice(0, 15)
    });
  } catch (error: any) {
    if (file && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
    console.error('[Backup] Inspection failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to inspect backup archive' });
  }
}

/**
 * RESTORE SYSTEM BACKUP (.ZIP)
 * Restores database records and/or physical uploaded files based on restoreScope.
 */
export async function restoreBackup(req: AuthRequest, res: Response) {
  const file = req.file;
  try {
    const user = req.user;
    if (!user || user.access_level !== 'Admin') {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(403).json({ error: 'Access denied. Admin privileges required to restore backups.' });
    }

    if (!file) {
      return res.status(400).json({ error: 'No backup zip file provided for restoration' });
    }

    const mode = (req.body.mode || 'replace').toLowerCase(); // 'replace' | 'merge'
    const restoreScope = (req.body.scope || req.body.restoreScope || 'both').toLowerCase(); // 'both' | 'db' | 'files'
    console.log(`[Backup] Admin ${user.username} starting system restore (Mode: ${mode}, Scope: ${restoreScope})...`);

    const zip = new AdmZip(file.path);
    const entries = zip.getEntries();

    const dbEntry = entries.find(e => e.entryName === 'database-backup.json');
    if ((restoreScope === 'both' || restoreScope === 'db') && !dbEntry) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Selected restore scope includes Database, but "database-backup.json" was not found inside the zip archive.' });
    }

    let databaseData: any = {};
    if (dbEntry && (restoreScope === 'both' || restoreScope === 'db')) {
      try {
        databaseData = JSON.parse(zip.readAsText(dbEntry));
      } catch (e: any) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'Corrupt database-backup.json: ' + e.message });
      }
    }

    const restoredStats: { [key: string]: number } = {};

    if ((restoreScope === 'both' || restoreScope === 'db') && mode === 'replace') {
      // In replace mode, purge existing records in reverse foreign key order
      console.log('[Backup] Purging existing database tables in reverse dependency order...');
      await query('DELETE FROM notifications');
      await query('DELETE FROM uploaded_files');
      await query('DELETE FROM approval_logs');
      await query('DELETE FROM line_items');
      await query('DELETE FROM cost_sheets');
      await query('DELETE FROM accounts');
      await query('DELETE FROM team_members');
      await query('DELETE FROM teams');
      await query('DELETE FROM dropdown_options');
      await query('DELETE FROM users');
    }


    // 1. Users
    if (Array.isArray(databaseData.users)) {
      let count = 0;
      for (const u of databaseData.users) {
        if (mode === 'replace') {
          await query(`
            INSERT INTO users (id, name, username, email, password_hash, role, access_level, status, report_to_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [u.id, u.name, u.username, u.email, u.password_hash, u.role, u.access_level, u.status, u.report_to_id || null, u.created_at || new Date()]);
          count++;
        } else {
          // Merge: insert if not exists
          const existing = await query('SELECT id FROM users WHERE username = $1 OR email = $2', [u.username, u.email]);
          if (existing.rows.length === 0) {
            await query(`
              INSERT INTO users (name, username, email, password_hash, role, access_level, status, report_to_id, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [u.name, u.username, u.email, u.password_hash, u.role, u.access_level, u.status, u.report_to_id || null, u.created_at || new Date()]);
            count++;
          }
        }
      }
      await resetSequence('users');
      restoredStats.users = count;
    }

    // 2. Teams
    if (Array.isArray(databaseData.teams)) {
      let count = 0;
      for (const t of databaseData.teams) {
        if (mode === 'replace') {
          await query(`
            INSERT INTO teams (id, name, lead_id, created_at)
            VALUES ($1, $2, $3, $4)
          `, [t.id, t.name, t.lead_id || null, t.created_at || new Date()]);
          count++;
        } else {
          const existing = await query('SELECT id FROM teams WHERE name = $1', [t.name]);
          if (existing.rows.length === 0) {
            await query(`
              INSERT INTO teams (name, lead_id, created_at)
              VALUES ($1, $2, $3)
            `, [t.name, t.lead_id || null, t.created_at || new Date()]);
            count++;
          }
        }
      }
      await resetSequence('teams');
      restoredStats.teams = count;
    }

    // 3. Team Members
    if (Array.isArray(databaseData.team_members)) {
      let count = 0;
      for (const tm of databaseData.team_members) {
        try {
          await query(`
            INSERT INTO team_members (team_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [tm.team_id, tm.user_id]);
          count++;
        } catch (e) {}
      }
      restoredStats.team_members = count;
    }

    // 4. Accounts
    if (Array.isArray(databaseData.accounts)) {
      let count = 0;
      for (const acc of databaseData.accounts) {
        const contactsJson = typeof acc.contacts === 'string' ? acc.contacts : JSON.stringify(acc.contacts || []);
        if (mode === 'replace') {
          await query(`
            INSERT INTO accounts (id, name, industry, phone, email, comments, contacts, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
          `, [acc.id, acc.name, acc.industry, acc.phone, acc.email, acc.comments, contactsJson, acc.created_at || new Date()]);
          count++;
        } else {
          const existing = await query('SELECT id FROM accounts WHERE name = $1', [acc.name]);
          if (existing.rows.length === 0) {
            await query(`
              INSERT INTO accounts (name, industry, phone, email, comments, contacts, created_at)
              VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
            `, [acc.name, acc.industry, acc.phone, acc.email, acc.comments, contactsJson, acc.created_at || new Date()]);
            count++;
          }
        }
      }
      await resetSequence('accounts');
      restoredStats.accounts = count;
    }

    // 5. Dropdown Options
    if (Array.isArray(databaseData.dropdown_options)) {
      let count = 0;
      for (const d of databaseData.dropdown_options) {
        if (mode === 'replace') {
          await query(`
            INSERT INTO dropdown_options (id, category, name, is_active)
            VALUES ($1, $2, $3, $4)
          `, [d.id, d.category, d.name, d.is_active ?? true]);
          count++;
        } else {
          const existing = await query('SELECT id FROM dropdown_options WHERE category = $1 AND name = $2', [d.category, d.name]);
          if (existing.rows.length === 0) {
            await query(`
              INSERT INTO dropdown_options (category, name, is_active)
              VALUES ($1, $2, $3)
            `, [d.category, d.name, d.is_active ?? true]);
            count++;
          }
        }
      }
      await resetSequence('dropdown_options');
      restoredStats.dropdown_options = count;
    }

    // 6. Cost Sheets
    if (Array.isArray(databaseData.cost_sheets)) {
      let count = 0;
      for (const cs of databaseData.cost_sheets) {
        const approversJson = typeof cs.assigned_approvers === 'string' ? cs.assigned_approvers : JSON.stringify(cs.assigned_approvers || {});
        if (mode === 'replace') {
          await query(`
            INSERT INTO cost_sheets (
              id, cs_number, status, subject, initiator_id, salesperson_id, account_id,
              distributor, business_unit, oem, currency, discount_type, discount_value,
              consultation_charges, freight_charges, total_purchase, total_sale,
              net_purchase, net_profit, margin_percentage, current_stage,
              assigned_approvers, notes, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
              $14, $15, $16, $17, $18, $19, $20, $21, $22::jsonb, $23, $24, $25
            )
          `, [
            cs.id, cs.cs_number, cs.status, cs.subject, cs.initiator_id, cs.salesperson_id, cs.account_id || null,
            cs.distributor, cs.business_unit, cs.oem, cs.currency || 'INR', cs.discount_type || 'Percentage', cs.discount_value || 0,
            cs.consultation_charges || 0, cs.freight_charges || 0, cs.total_purchase || 0, cs.total_sale || 0,
            cs.net_purchase || 0, cs.net_profit || 0, cs.margin_percentage || 0, cs.current_stage || 1,
            approversJson, cs.notes || '', cs.created_at || new Date(), cs.updated_at || new Date()
          ]);
          count++;
        } else {
          const existing = await query('SELECT id FROM cost_sheets WHERE cs_number = $1', [cs.cs_number]);
          if (existing.rows.length === 0) {
            await query(`
              INSERT INTO cost_sheets (
                cs_number, status, subject, initiator_id, salesperson_id, account_id,
                distributor, business_unit, oem, currency, discount_type, discount_value,
                consultation_charges, freight_charges, total_purchase, total_sale,
                net_purchase, net_profit, margin_percentage, current_stage,
                assigned_approvers, notes, created_at, updated_at
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb, $22, $23, $24
              )
            `, [
              cs.cs_number, cs.status, cs.subject, cs.initiator_id, cs.salesperson_id, cs.account_id || null,
              cs.distributor, cs.business_unit, cs.oem, cs.currency || 'INR', cs.discount_type || 'Percentage', cs.discount_value || 0,
              cs.consultation_charges || 0, cs.freight_charges || 0, cs.total_purchase || 0, cs.total_sale || 0,
              cs.net_purchase || 0, cs.net_profit || 0, cs.margin_percentage || 0, cs.current_stage || 1,
              approversJson, cs.notes || '', cs.created_at || new Date(), cs.updated_at || new Date()
            ]);
            count++;
          }
        }
      }
      await resetSequence('cost_sheets');
      restoredStats.cost_sheets = count;
    }

    // 7. Line Items
    if (Array.isArray(databaseData.line_items)) {
      let count = 0;
      for (const li of databaseData.line_items) {
        if (mode === 'replace') {
          await query(`
            INSERT INTO line_items (id, cost_sheet_id, description, unit_purchase, unit_sale, quantity, total_purchase, total_sale, margin_percentage)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [li.id, li.cost_sheet_id, li.description, li.unit_purchase, li.unit_sale, li.quantity, li.total_purchase, li.total_sale, li.margin_percentage]);
          count++;
        } else {
          await query(`
            INSERT INTO line_items (cost_sheet_id, description, unit_purchase, unit_sale, quantity, total_purchase, total_sale, margin_percentage)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [li.cost_sheet_id, li.description, li.unit_purchase, li.unit_sale, li.quantity, li.total_purchase, li.total_sale, li.margin_percentage]);
          count++;
        }
      }
      await resetSequence('line_items');
      restoredStats.line_items = count;
    }

    // 8. Approval Logs
    if (Array.isArray(databaseData.approval_logs)) {
      let count = 0;
      for (const log of databaseData.approval_logs) {
        if (mode === 'replace') {
          await query(`
            INSERT INTO approval_logs (id, cost_sheet_id, stage_name, stage_number, actor_id, decision, comment, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [log.id, log.cost_sheet_id, log.stage_name, log.stage_number, log.actor_id || null, log.decision, log.comment || '', log.timestamp || new Date()]);
          count++;
        } else {
          await query(`
            INSERT INTO approval_logs (cost_sheet_id, stage_name, stage_number, actor_id, decision, comment, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [log.cost_sheet_id, log.stage_name, log.stage_number, log.actor_id || null, log.decision, log.comment || '', log.timestamp || new Date()]);
          count++;
        }
      }
      await resetSequence('approval_logs');
      restoredStats.approval_logs = count;
    }

    // 9. Uploaded Files Records
    if (Array.isArray(databaseData.uploaded_files)) {
      let count = 0;
      for (const f of databaseData.uploaded_files) {
        if (mode === 'replace') {
          await query(`
            INSERT INTO uploaded_files (id, cost_sheet_id, filename, original_name, file_path, file_size, mime_type, uploaded_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [f.id, f.cost_sheet_id, f.filename, f.original_name, f.file_path, f.file_size, f.mime_type, f.uploaded_at || new Date()]);
          count++;
        } else {
          await query(`
            INSERT INTO uploaded_files (cost_sheet_id, filename, original_name, file_path, file_size, mime_type, uploaded_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [f.cost_sheet_id, f.filename, f.original_name, f.file_path, f.file_size, f.mime_type, f.uploaded_at || new Date()]);
          count++;
        }
      }
      await resetSequence('uploaded_files');
      restoredStats.uploaded_files = count;
    }

    // 10. Notifications
    if (Array.isArray(databaseData.notifications)) {
      let count = 0;
      for (const n of databaseData.notifications) {
        if (mode === 'replace') {
          await query(`
            INSERT INTO notifications (id, user_id, title, message, cost_sheet_id, is_read, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [n.id, n.user_id, n.title, n.message, n.cost_sheet_id || null, n.is_read ?? false, n.created_at || new Date()]);
          count++;
        }
      }
      await resetSequence('notifications');
      restoredStats.notifications = count;
    }

    // 11. Portal Settings (Branding, Email Configurations)
    if (Array.isArray(databaseData.portal_settings)) {
      let count = 0;
      for (const ps of databaseData.portal_settings) {
        try {
          const val = typeof ps.value === 'string' ? ps.value : JSON.stringify(ps.value || {});
          await query(`
            INSERT INTO portal_settings (key, value, updated_at)
            VALUES ($1, $2::jsonb, $3)
            ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
          `, [ps.key, val, ps.updated_at || new Date()]);
          count++;
        } catch (e) {
          console.warn('[Backup] Failed to restore portal setting:', ps.key, e);
        }
      }
      restoredStats.portal_settings = count;
    }

    // 12. Extract Physical Files from uploads/ into process.cwd()/uploads/
    let extractedFileCount = 0;
    if (restoreScope === 'both' || restoreScope === 'files') {
      if (mode === 'replace') {
        // Clean current uploads directory except .temp
        if (fs.existsSync(uploadDir)) {
          const currentItems = fs.readdirSync(uploadDir);
          for (const item of currentItems) {
            if (item === '.temp') continue;
            const p = path.join(uploadDir, item);
            try {
              fs.rmSync(p, { recursive: true, force: true });
            } catch (e) {}
          }
        }
      }

      for (const entry of entries) {
        if (entry.entryName.startsWith('uploads/') && !entry.isDirectory) {
          const relativePath = entry.entryName.substring('uploads/'.length);
          if (!relativePath || relativePath.startsWith('.')) continue;

          const targetPath = path.join(uploadDir, relativePath);
          const targetDir = path.dirname(targetPath);

          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          fs.writeFileSync(targetPath, entry.getData());
          extractedFileCount++;
        }
      }
    }

    restoredStats.physical_files_extracted = extractedFileCount;

    // Clean up temporary zip upload
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    console.log('[Backup] System restore completed successfully:', restoredStats);

    return res.json({
      message: 'System backup restored successfully',
      mode,
      stats: restoredStats
    });
  } catch (error: any) {
    if (file && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
    console.error('[Backup] Restore failed:', error);
    return res.status(500).json({ error: error.message || 'Failed to restore system backup' });
  }
}
