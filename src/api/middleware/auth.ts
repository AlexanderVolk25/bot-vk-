import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { getSetting, setSetting } from '../../config/settings';
import { auditLogger } from '../../logger';
import { getDb } from '../../db';

declare module 'express-session' {
  interface SessionData {
    authenticated: boolean;
    loginTime: number;
  }
}

export async function initAdminPassword(): Promise<void> {
  const existing = getSetting('admin_password_hash', '');
  if (!existing) {
    const rawPassword = process.env.ADMIN_PASSWORD || 'changeme';
    const hash = await bcrypt.hash(rawPassword, 12);
    setSetting('admin_password_hash', hash);
    auditLogger.info('Admin password hash initialized');
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.authenticated) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

export function setupAuthRoutes(app: import('express').Express): void {
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { password } = req.body as { password?: string };

    if (!password) {
      res.status(400).json({ error: 'Password required' });
      return;
    }

    try {
      const hash = getSetting('admin_password_hash', '');
      let valid = false;

      if (hash) {
        valid = await bcrypt.compare(password, hash);
      } else {
        valid = password === (process.env.ADMIN_PASSWORD || 'changeme');
      }

      if (!valid) {
        auditLogger.warn('Failed login attempt', { ip: req.ip });
        res.status(401).json({ error: 'Invalid password' });
        return;
      }

      req.session.authenticated = true;
      req.session.loginTime = Date.now();

      const db = getDb();
      db.prepare(`
        INSERT INTO audit_log (actor, action, details, ip) VALUES (?, ?, ?, ?)
      `).run('admin', 'login', 'Admin panel login', req.ip || 'unknown');

      auditLogger.info('Admin login successful', { ip: req.ip });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get('/api/auth/status', (req: Request, res: Response) => {
    res.json({ authenticated: !!req.session?.authenticated });
  });
}
