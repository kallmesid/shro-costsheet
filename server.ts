import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

import { initDb } from './server/config/db.ts';
import { runSeed } from './server/scripts/seed.ts';
import { initSocket } from './server/services/socketService.ts';

import authRoutes from './server/routes/authRoutes.ts';
import costSheetRoutes from './server/routes/costSheetRoutes.ts';
import accountRoutes from './server/routes/accountRoutes.ts';
import userRoutes from './server/routes/userRoutes.ts';
import reportRoutes from './server/routes/reportRoutes.ts';
import configRoutes from './server/routes/configRoutes.ts';
import uploadRoutes from './server/routes/uploadRoutes.ts';
import backupRoutes from './server/routes/backupRoutes.ts';

dotenv.config();

const PORT = 3000;
const app = express();
const server = http.createServer(app);

// Trust first proxy (Cloud Run, Nginx, Docker ingress)
app.set('trust proxy', 1);

// Security & Parsing Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Allow Vite and inline assets in dev/preview
  crossOriginEmbedderPolicy: false,
}));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure uploads folder exists and serve statically
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/cost-sheets', costSheetRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/config', configRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/backup', backupRoutes);

// Global Error Handler for API
app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// Initialize Socket.io
initSocket(server);

async function start() {
  try {
    // Initialize Database & Run Seed
    await initDb();
    await runSeed();

    // Vite Middleware or Production Static
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
