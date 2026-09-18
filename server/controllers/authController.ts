import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.ts';
import { AuthRequest } from '../middleware/auth.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'shro_cost_sheet_jwt_secret_key_2026';

export async function login(req: AuthRequest, res: Response) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const result = await query(`
      SELECT id, name, username, email, password_hash, role, access_level, status, report_to_id
      FROM users
      WHERE username = $1 OR email = $1
    `, [username.trim()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = result.rows[0];

    if (user.status !== 'Active') {
      return res.status(403).json({ error: `Account is currently ${user.status}. Please contact the administrator.` });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        access_level: user.access_level,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    const { password_hash, ...userProfile } = user;
    return res.json({
      message: 'Login successful',
      token,
      user: userProfile
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}

export async function logout(req: AuthRequest, res: Response) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  });
  return res.json({ message: 'Logged out successfully' });
}

export async function getCurrentUser(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Count pending approvals assigned to this user
  const pendingCountRes = await query(`
    SELECT COUNT(*) as pending_count
    FROM cost_sheets
    WHERE status = 'Pending'
      AND (
        (assigned_approvers->>current_stage::text)::int = $1
        OR ($2 = 'Admin')
      )
  `, [req.user.id, req.user.access_level]);

  const pendingCount = parseInt(pendingCountRes.rows[0]?.pending_count || '0', 10);

  return res.json({
    user: req.user,
    pending_approvals_count: pendingCount
  });
}

// "Login As" (Sudo) mode for Admins to troubleshoot user issues
export async function sudoLogin(req: AuthRequest, res: Response) {
  try {
    if (!req.user || req.user.access_level !== 'Admin') {
      return res.status(403).json({ error: 'Only administrators can use Sudo mode.' });
    }

    const target_user_id = req.body.target_user_id || req.body.targetUserId;
    if (!target_user_id) {
      return res.status(400).json({ error: 'target_user_id is required' });
    }

    const targetUserRes = await query(`
      SELECT id, name, username, email, role, access_level, status, report_to_id
      FROM users WHERE id = $1
    `, [target_user_id]);

    if (targetUserRes.rows.length === 0) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    const targetUser = targetUserRes.rows[0];

    const token = jwt.sign(
      {
        id: targetUser.id,
        username: targetUser.username,
        access_level: targetUser.access_level,
        role: targetUser.role,
        is_sudo: true,
        original_admin_id: req.user.original_admin_id || req.user.id
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 2 * 60 * 60 * 1000
    });

    return res.json({
      message: `Now acting as ${targetUser.name} (${targetUser.role})`,
      token,
      user: {
        ...targetUser,
        is_sudo: true,
        original_admin_id: req.user.original_admin_id || req.user.id
      }
    });
  } catch (error) {
    console.error('Sudo error:', error);
    return res.status(500).json({ error: 'Failed to switch user' });
  }
}

export async function exitSudo(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.is_sudo || !req.user?.original_admin_id) {
      return res.status(400).json({ error: 'Not currently in sudo session' });
    }

    const adminRes = await query(`
      SELECT id, name, username, email, role, access_level, status, report_to_id
      FROM users WHERE id = $1
    `, [req.user.original_admin_id]);

    if (adminRes.rows.length === 0) {
      return res.status(404).json({ error: 'Original admin account not found' });
    }

    const admin = adminRes.rows[0];

    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        access_level: admin.access_level,
        role: admin.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.json({
      message: 'Returned to Admin profile',
      token,
      user: admin
    });
  } catch (error) {
    console.error('Exit sudo error:', error);
    return res.status(500).json({ error: 'Failed to exit sudo' });
  }
}
