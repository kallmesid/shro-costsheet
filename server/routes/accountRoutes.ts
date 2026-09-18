import { Router } from 'express';
import { body } from 'express-validator';
import {
  getAllAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
  batchCreateAccounts,
} from '../controllers/accountController.ts';
import { verifyJWT } from '../middleware/auth.ts';

const router = Router();

router.use(verifyJWT);

router.get('/', getAllAccounts);
router.post('/batch', batchCreateAccounts);
router.get('/:id', getAccountById);

router.post(
  '/',
  [body('name').trim().notEmpty().withMessage('Account name is required')],
  createAccount
);

router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);

export default router;
