import { Router } from 'express';
import { getDashboardStats, getDrilldownInsights, exportReportsExcel } from '../controllers/reportController.ts';
import { verifyJWT } from '../middleware/auth.ts';

const router = Router();

router.use(verifyJWT);

router.get('/dashboard', getDashboardStats);
router.get('/drilldown', getDrilldownInsights);
router.get('/export-excel', exportReportsExcel);

export default router;
