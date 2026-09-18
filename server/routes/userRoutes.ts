import { Router } from 'express';
import { body } from 'express-validator';
import {
  getAllUsers,
  createUser,
  updateUser,
  getApproverCandidates,
  getTeams,
  createTeam,
  bulkUpdateUsers,
  bulkDeleteUsers,
  importUsersFromExcel,
} from '../controllers/userController.ts';
import { verifyJWT, requireAdmin } from '../middleware/auth.ts';

const router = Router();

router.use(verifyJWT);

// Available to all authenticated users for assigning approvers and seeing teams
router.get('/approvers', getApproverCandidates);
router.get('/teams', getTeams);

// Admin-only user management
router.get('/', requireAdmin, getAllUsers);
router.post('/bulk-update', requireAdmin, bulkUpdateUsers);
router.post('/bulk-delete', requireAdmin, bulkDeleteUsers);
router.post('/import-excel', requireAdmin, importUsersFromExcel);
router.post(
  '/',
  requireAdmin,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').notEmpty().withMessage('Role/Department is required'),
    body('access_level').isIn(['Admin', 'Management', 'TeamLead', 'User']).withMessage('Valid access level is required'),
  ],
  createUser
);

router.put('/:id', requireAdmin, updateUser);
router.post('/teams', requireAdmin, createTeam);

export default router;
