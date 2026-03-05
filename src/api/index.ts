import express from 'express';
import cors from 'cors';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from '../config/settings';
import { appLogger } from '../logger';
import { setupAuthRoutes, initAdminPassword, requireAuth } from './middleware/auth';
import dashboardRouter from './routes/dashboard';
import queueRouter from './routes/queue';
import scheduleRouter from './routes/schedule';
import moderationRouter from './routes/moderation';
import minecraftRouter from './routes/minecraft';
import settingsRouter from './routes/settings';
import logsRouter from './routes/logs';

export async function createApp(): Promise<express.Express> {
  const app = express();

  app.use(cors({
    origin: true,
    credentials: true,
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(session({
    secret: config.admin.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,        // set to true when behind HTTPS proxy
      httpOnly: true,
      sameSite: 'strict',   // CSRF protection
      maxAge: 24 * 60 * 60 * 1000,
    },
  }));

  // Rate-limit the login endpoint to prevent brute-force attacks
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { error: 'Too many login attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // General API rate limiter
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/', apiLimiter);
  app.use('/api/auth/login', loginLimiter);

  await initAdminPassword();
  setupAuthRoutes(app);

  app.use('/api/dashboard', requireAuth, dashboardRouter);
  app.use('/api/queue', queueRouter);
  app.use('/api/schedule', scheduleRouter);
  app.use('/api/moderation', moderationRouter);
  app.use('/api/minecraft', minecraftRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/logs', logsRouter);

  const adminDir = path.join(__dirname, '../../admin');
  app.use(express.static(adminDir));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(adminDir, 'index.html'));
  });

  return app;
}

export async function startApiServer(): Promise<void> {
  const app = await createApp();
  const port = config.admin.port;

  app.listen(port, () => {
    appLogger.info(`Admin API server started on http://localhost:${port}`);
  });
}

if (require.main === module) {
  startApiServer().catch(err => {
    console.error('Failed to start API server:', err);
    process.exit(1);
  });
}
