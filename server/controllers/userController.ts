import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.ts';
import { AuthRequest } from '../middleware/auth.ts';

export async function getAllUsers(req: AuthRequest, res: Response) {
  try {
    const result = await query(`
      SELECT u.id, u.name, u.username, u.email, u.role, u.access_level, u.status, u.report_to_id, u.created_at,
             mgr.name as report_to_name
      FROM users u
      LEFT JOIN users mgr ON u.report_to_id = mgr.id
      ORDER BY u.name ASC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function createUser(req: AuthRequest, res: Response) {
  try {
    const { name, username, email, password, role, access_level, status = 'Active', report_to_id } = req.body;

    if (!name || !username || !email || !password || !role || !access_level) {
      return res.status(400).json({ error: 'All fields (name, username, email, password, role, access_level) are required.' });
    }

    // Check unique username & email
    const existing = await query('SELECT id FROM users WHERE username = $1 OR email = $2', [username.trim(), email.trim()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username or Email is already in use.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query(`
      INSERT INTO users (name, username, email, password_hash, role, access_level, status, report_to_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, username, email, role, access_level, status, report_to_id, created_at
    `, [
      name.trim(),
      username.trim(),
      email.trim(),
      passwordHash,
      role,
      access_level,
      status,
      report_to_id || null
    ]);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
}

export async function updateUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, email, password, role, access_level, status, report_to_id } = req.body;

    const userRes = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const current = userRes.rows[0];
    let passwordHash = current.password_hash;

    if (password && password.trim() !== '') {
      passwordHash = await bcrypt.hash(password.trim(), 12);
    }

    const result = await query(`
      UPDATE users
      SET name = $1, email = $2, password_hash = $3, role = $4, access_level = $5, status = $6, report_to_id = $7
      WHERE id = $8
      RETURNING id, name, username, email, role, access_level, status, report_to_id
    `, [
      name ?? current.name,
      email ?? current.email,
      passwordHash,
      role ?? current.role,
      access_level ?? current.access_level,
      status ?? current.status,
      report_to_id !== undefined ? (report_to_id || null) : current.report_to_id,
      id
    ]);

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
}

// Returns potential approvers for each stage (Finance, Presales, Management, Operations, Logistics)
export async function getApproverCandidates(req: AuthRequest, res: Response) {
  try {
    const usersRes = await query(`
      SELECT id, name, username, email, role, access_level, status
      FROM users
      WHERE status = 'Active'
      ORDER BY name ASC
    `);

    const users = usersRes.rows;

    // Filter candidates for each stage:
    // Stage 1: Finance
    // Stage 2: Presales
    // Stage 3: Management
    // Stage 4: Operations
    // Stage 5: Logistics
    // Stage 6: Finance
    const candidates = {
      1: users.filter(u => u.role === 'Finance' || u.access_level === 'Admin'),
      2: users.filter(u => u.role === 'Presales' || u.access_level === 'Admin'),
      3: users.filter(u => u.role === 'Management' || u.access_level === 'Admin' || u.access_level === 'Management'),
      4: users.filter(u => u.role === 'Operations' || u.access_level === 'Admin'),
      5: users.filter(u => u.role === 'Logistics' || u.access_level === 'Admin'),
      6: users.filter(u => u.role === 'Finance' || u.access_level === 'Admin' || u.access_level === 'Management'),
      sales: users.filter(u => u.role === 'Sales' || u.access_level === 'User' || u.access_level === 'Admin'),
      all: users
    };

    return res.json(candidates);
  } catch (error) {
    console.error('Error fetching approver candidates:', error);
    return res.status(500).json({ error: 'Failed to fetch approvers' });
  }
}

export async function getTeams(req: AuthRequest, res: Response) {
  try {
    const teamsRes = await query(`
      SELECT t.*, u.name as lead_name
      FROM teams t
      LEFT JOIN users u ON t.lead_id = u.id
      ORDER BY t.name ASC
    `);

    const membersRes = await query(`
      SELECT tm.team_id, u.id as user_id, u.name, u.role, u.access_level
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
    `);

    const teams = teamsRes.rows.map(t => ({
      ...t,
      members: membersRes.rows.filter(m => m.team_id === t.id)
    }));

    return res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    return res.status(500).json({ error: 'Failed to fetch teams' });
  }
}

export async function createTeam(req: AuthRequest, res: Response) {
  try {
    const { name, lead_id, member_ids = [] } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const teamRes = await query(`
      INSERT INTO teams (name, lead_id)
      VALUES ($1, $2)
      RETURNING *
    `, [name.trim(), lead_id || null]);

    const teamId = teamRes.rows[0].id;

    for (const userId of member_ids) {
      await query(`
        INSERT INTO team_members (team_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [teamId, userId]);
    }

    return res.status(201).json({ id: teamId, name: name.trim(), lead_id });
  } catch (error) {
    console.error('Error creating team:', error);
    return res.status(500).json({ error: 'Failed to create team' });
  }
}

export async function bulkUpdateUsers(req: AuthRequest, res: Response) {
  try {
    const { userIds, role, status, access_level } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'No users provided for bulk update.' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (role && role.trim()) {
      updates.push(`role = $${paramIdx++}`);
      values.push(role.trim());
    }
    if (status && status.trim()) {
      updates.push(`status = $${paramIdx++}`);
      values.push(status.trim());
    }
    if (access_level && access_level.trim()) {
      updates.push(`access_level = $${paramIdx++}`);
      values.push(access_level.trim());
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields provided to update.' });
    }

    values.push(userIds);
    const sql = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ANY($${paramIdx})
      RETURNING id, name, username, email, role, access_level, status
    `;

    const result = await query(sql, values);
    return res.json({
      message: `Successfully updated ${result.rows.length} user(s).`,
      users: result.rows
    });
  } catch (error) {
    console.error('Error in bulkUpdateUsers:', error);
    return res.status(500).json({ error: 'Failed to bulk update users.' });
  }
}

export async function bulkDeleteUsers(req: AuthRequest, res: Response) {
  try {
    const { userIds } = req.body;
    const currentAdminId = req.user?.id;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'No users provided for deletion.' });
    }

    // Never allow admin to delete their own account
    const targetIds = userIds.filter(id => Number(id) !== Number(currentAdminId));

    if (targetIds.length === 0) {
      return res.status(400).json({ error: 'Cannot delete the currently logged in administrator account.' });
    }

    let hardDeletedCount = 0;
    let softDeactivatedCount = 0;

    for (const id of targetIds) {
      // Check if user is linked to cost sheets
      const refRes = await query(
        'SELECT COUNT(*) as count FROM cost_sheets WHERE initiator_id = $1 OR salesperson_id = $1',
        [id]
      );
      const isReferenced = parseInt(refRes.rows[0]?.count || '0', 10) > 0;

      if (isReferenced) {
        // Soft delete / deactivate so historical financial records remain intact
        await query("UPDATE users SET status = 'Inactive' WHERE id = $1", [id]);
        await query("DELETE FROM team_members WHERE user_id = $1", [id]);
        softDeactivatedCount++;
      } else {
        // Safe to hard delete
        await query("DELETE FROM team_members WHERE user_id = $1", [id]);
        await query("DELETE FROM users WHERE id = $1", [id]);
        hardDeletedCount++;
      }
    }

    return res.json({
      message: `Deleted ${hardDeletedCount} user(s), deactivated ${softDeactivatedCount} user(s) with deal records.`,
      hardDeletedCount,
      softDeactivatedCount
    });
  } catch (error) {
    console.error('Error in bulkDeleteUsers:', error);
    return res.status(500).json({ error: 'Failed to delete users.' });
  }
}

export async function importUsersFromExcel(req: AuthRequest, res: Response) {
  try {
    const { users } = req.body;
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'No valid user records provided in request payload.' });
    }

    const defaultPasswordHash = await bcrypt.hash('Shro@2025', 12);
    const validRoles = ['Sales', 'Finance', 'Presales', 'Management', 'Operations', 'Logistics', 'Administration'];
    const validAccessLevels = ['User', 'TeamLead', 'Management', 'Admin'];

    const imported: any[] = [];
    const skipped: any[] = [];

    for (const raw of users) {
      const name = (raw.name || raw['Name'] || raw['Full Name'] || '').toString().trim();
      if (!name) {
        skipped.push({ raw, reason: 'Missing name' });
        continue;
      }

      // Generate or normalize username
      let username = (raw.username || raw['Username'] || '').toString().trim().toLowerCase();
      if (!username) {
        username = name.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
      }

      // Ensure email follows name.shrosystems.com / @shrosystems.com format
      let email = (raw.email || raw['Email'] || '').toString().trim().toLowerCase();
      if (!email || !email.includes('@')) {
        const cleanUser = username.replace(/@.*$/, '');
        email = `${cleanUser}@shrosystems.com`;
      } else if (!email.endsWith('@shrosystems.com')) {
        // If domain differs, format with @shrosystems.com
        const prefix = email.split('@')[0];
        email = `${prefix}@shrosystems.com`;
      }

      // Role and Access Level normalization
      let role = (raw.role || raw['Role'] || raw['Department'] || 'Sales').toString().trim();
      const matchedRole = validRoles.find(r => r.toLowerCase() === role.toLowerCase());
      role = matchedRole || 'Sales';

      let accessLevel = (raw.access_level || raw['Access Level'] || raw['Access'] || 'User').toString().trim();
      const matchedAccess = validAccessLevels.find(a => a.toLowerCase() === accessLevel.toLowerCase());
      accessLevel = matchedAccess || 'User';

      let status = (raw.status || raw['Status'] || 'Active').toString().trim();
      if (!['Active', 'Suspended', 'Inactive'].includes(status)) {
        status = 'Active';
      }

      let passwordHash = defaultPasswordHash;
      if (raw.password || raw['Password']) {
        passwordHash = await bcrypt.hash(String(raw.password || raw['Password']), 12);
      }

      try {
        const insertRes = await query(`
          INSERT INTO users (name, username, email, password_hash, role, access_level, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (username) DO UPDATE
          SET name = EXCLUDED.name,
              email = EXCLUDED.email,
              role = EXCLUDED.role,
              access_level = EXCLUDED.access_level,
              status = EXCLUDED.status
          RETURNING id, name, username, email, role, access_level, status
        `, [name, username, email, passwordHash, role, accessLevel, status]);

        imported.push(insertRes.rows[0]);
      } catch (err: any) {
        skipped.push({ name, username, email, reason: err.message });
      }
    }

    return res.json({
      message: `Successfully processed ${imported.length} user(s).`,
      importedCount: imported.length,
      skippedCount: skipped.length,
      imported,
      skipped
    });
  } catch (error) {
    console.error('Error in importUsersFromExcel:', error);
    return res.status(500).json({ error: 'Failed to import users from Excel.' });
  }
}
