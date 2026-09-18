import { Router } from 'express';
import { body } from 'express-validator';
import {
  getAllCostSheets,
  getCostSheetById,
  createCostSheet,
  updateCostSheet,
  submitForApproval,
  approveStage,
  rejectStage,
  deleteCostSheet,
} from '../controllers/costSheetController.ts';
import { verifyJWT } from '../middleware/auth.ts';

const router = Router();

router.use(verifyJWT);

router.get('/', getAllCostSheets);
router.get('/:id', getCostSheetById);

router.post(
  '/',
  [
    body('subject').trim().notEmpty().withMessage('Deal subject is required'),
    body('line_items').isArray().withMessage('Line items must be an array'),
  ],
  createCostSheet
);

router.put('/:id', updateCostSheet);
router.delete('/:id', deleteCostSheet);

router.post('/:id/submit', submitForApproval);
router.post('/:id/approve', approveStage);
router.post('/:id/reject', rejectStage);

export default router;
