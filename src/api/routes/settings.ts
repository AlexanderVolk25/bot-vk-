import { Router, Request, Response } from 'express';
import { getAllSettings, setSetting } from '../../config/settings';
import { requireAuth } from '../middleware/auth';
import { auditLogger } from '../../logger';
import { getDb } from '../../db';

const router = Router();

router.get('/', requireAuth, (_req: Request, res: Response) => {
  try {
    const settings = getAllSettings();
    // Remove sensitive entries
    delete settings['admin_password_hash'];
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

router.put('/:key', requireAuth, (req: Request, res: Response) => {
  const { key } = req.params;
  const { value } = req.body as { value?: string };

  const sensitiveKeys = ['admin_password_hash'];
  if (sensitiveKeys.includes(key)) {
    res.status(403).json({ error: 'Cannot update this setting via API' });
    return;
  }

  if (value === undefined || value === null) {
    res.status(400).json({ error: 'value is required' });
    return;
  }

  try {
    setSetting(key, String(value));

    const db = getDb();
    db.prepare(`
      INSERT INTO audit_log (actor, action, details, ip) VALUES (?, ?, ?, ?)
    `).run('admin', 'setting_update', `${key}=${value}`, req.ip || 'unknown');

    auditLogger.info('Setting updated', { key, value, ip: req.ip });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

export default router;
