import express from 'express';
import { 
  exportBackup, 
  inspectBackup, 
  restoreBackup, 
  backupUpload 
} from '../controllers/backupController.ts';
import { verifyJWT } from '../middleware/auth.ts';

const router = express.Router();

// Require authenticated user for all backup endpoints
router.use(verifyJWT);

// Export full backup as .zip archive
router.get('/export', exportBackup);

// Inspect an uploaded .zip archive (dry run inspection)
router.post('/inspect', backupUpload.single('file') as unknown as express.RequestHandler, inspectBackup);

// Restore database and files from an uploaded .zip archive
router.post('/restore', backupUpload.single('file') as unknown as express.RequestHandler, restoreBackup);

export default router;
