import { Response } from 'express';
import { query } from '../config/db.ts';
import { AuthRequest } from '../middleware/auth.ts';

export async function getAllAccounts(req: AuthRequest, res: Response) {
  try {
    const result = await query('SELECT * FROM accounts ORDER BY name ASC');
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return res.status(500).json({ error: 'Failed to fetch accounts' });
  }
}

export async function getAccountById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM accounts WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching account:', error);
    return res.status(500).json({ error: 'Failed to fetch account' });
  }
}

export async function createAccount(req: AuthRequest, res: Response) {
  try {
    const { name, industry, phone, email, comments, contacts = [] } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Account name is required' });
    }

    const result = await query(`
      INSERT INTO accounts (name, industry, phone, email, comments, contacts)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      name.trim(),
      industry || '',
      phone || '',
      email || '',
      comments || '',
      JSON.stringify(contacts)
    ]);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating account:', error);
    return res.status(500).json({ error: 'Failed to create account' });
  }
}

export async function updateAccount(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, industry, phone, email, comments, contacts } = req.body;

    const existing = await query('SELECT * FROM accounts WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const current = existing.rows[0];

    const result = await query(`
      UPDATE accounts
      SET name = $1, industry = $2, phone = $3, email = $4, comments = $5, contacts = $6
      WHERE id = $7
      RETURNING *
    `, [
      name ?? current.name,
      industry ?? current.industry,
      phone ?? current.phone,
      email ?? current.email,
      comments ?? current.comments,
      contacts ? JSON.stringify(contacts) : current.contacts,
      id
    ]);

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating account:', error);
    return res.status(500).json({ error: 'Failed to update account' });
  }
}

export async function deleteAccount(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    await query('DELETE FROM accounts WHERE id = $1', [id]);
    return res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
}

export async function batchCreateAccounts(req: AuthRequest, res: Response) {
  try {
    const { accounts } = req.body;
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({ error: 'No accounts provided' });
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const acc of accounts) {
      if (!acc.name || typeof acc.name !== 'string' || acc.name.trim() === '') {
        continue;
      }
      const trimmedName = acc.name.trim();

      const existing = await query('SELECT id FROM accounts WHERE LOWER(name) = LOWER($1)', [trimmedName]);
      if (existing.rows.length > 0) {
        await query(`
          UPDATE accounts
          SET industry = COALESCE(NULLIF($1, ''), industry),
              phone = COALESCE(NULLIF($2, ''), phone),
              email = COALESCE(NULLIF($3, ''), email),
              comments = COALESCE(NULLIF($4, ''), comments)
          WHERE id = $5
        `, [acc.industry || '', acc.phone || '', acc.email || '', acc.comments || '', existing.rows[0].id]);
        updatedCount++;
      } else {
        await query(`
          INSERT INTO accounts (name, industry, phone, email, comments, contacts)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          trimmedName,
          acc.industry || 'IT & ITES',
          acc.phone || '',
          acc.email || '',
          acc.comments || '',
          JSON.stringify(acc.contacts || [])
        ]);
        createdCount++;
      }
    }

    return res.json({
      message: `Processed ${createdCount + updatedCount} accounts (${createdCount} new, ${updatedCount} updated).`,
      createdCount,
      updatedCount
    });
  } catch (error) {
    console.error('Error in batchCreateAccounts:', error);
    return res.status(500).json({ error: 'Failed to batch import accounts' });
  }
}

