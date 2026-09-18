import { Router } from 'express';
import { 
  getDropdowns, 
  addDropdownItem, 
  deleteDropdownItem,
  getBranding,
  updateBranding,
  getEmailConfig,
  updateEmailConfig,
  testEmailConfig
} from '../controllers/configController.ts';
import { verifyJWT, requireAdmin } from '../middleware/auth.ts';

const router = Router();

router.use(verifyJWT);

router.get('/dropdowns', getDropdowns);
router.post('/dropdowns', requireAdmin, addDropdownItem);
router.delete('/dropdowns/:id', requireAdmin, deleteDropdownItem);

router.get('/branding', getBranding);
router.post('/branding', requireAdmin, updateBranding);

router.get('/email', requireAdmin, getEmailConfig);
router.post('/email', requireAdmin, updateEmailConfig);
router.post('/email/test', requireAdmin, testEmailConfig);

export default router;
