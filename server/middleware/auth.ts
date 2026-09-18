import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'shro_cost_sheet_jwt_secret_key_2026';

export interface AuthenticatedUser {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  access_level: 'Admin' | 'Management' | 'TeamLead' | 'User';
  status: 'Active' | 'Suspended' | 'Hold';
  report_to_id?: number | null;
  is_sudo?: boolean;
  original_admin_id?: number;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export async function verifyJWT(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Fetch user from DB to verify status
    const result = await query('SELECT id, name, username, email, role, access_level, status, report_to_id FROM users WHERE id = $1', [decoded.id]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User account no longer exists.' });
    }

    const user = result.rows[0];

    if (user.status !== 'Active') {
      return res.status(403).json({ error: `Account is currently ${user.status}. Contact administrator.` });
    }

    req.user = {
      ...user,
      is_sudo: !!decoded.is_sudo,
      original_admin_id: decoded.original_admin_id
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired session token. Please sign in again.' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.access_level !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Administrative privileges required.' });
  }
  next();
}

export function requireManagementOrAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.access_level !== 'Admin' && req.user.access_level !== 'Management')) {
    return res.status(403).json({ error: 'Access denied. Management or Admin authorization required.' });
  }
  next();
}
