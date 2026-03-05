import { Router, Request, Response } from 'express';
import { getDb } from '../../db';
import { getUserRole, setUserRole, Role } from '../../modules/moderation/roles';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/events', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const limit = parseInt((_req.query.limit as string) || '50', 10);
    const events = db.prepare(
      'SELECT * FROM moderation_events ORDER BY created_at DESC LIMIT ?'
    ).all(limit);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get moderation events' });
  }
});

router.get('/users/:userId/stats', async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);

  try {
    const db = getDb();
    const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId);
    const role = await getUserRole(userId);
    const warns = db.prepare('SELECT * FROM user_warnings WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(userId);
    const events = db.prepare('SELECT * FROM moderation_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(userId);

    res.json({ stats, role, warns, events });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user stats' });
  }
});

router.post('/users/:userId/warn', requireAuth, async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  const { reason } = req.body as { reason?: string };

  try {
    const db = getDb();
    db.prepare('INSERT INTO user_warnings (user_id, reason, moderator_id) VALUES (?, ?, ?)').run(userId, reason || 'Admin action', 0);
    db.prepare(`
      INSERT INTO moderation_events (user_id, action, reason, moderator_id) VALUES (?, 'warn', ?, 0)
    `).run(userId, reason || 'Admin action');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to warn user' });
  }
});

router.post('/users/:userId/mute', requireAuth, async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  const { duration, reason } = req.body as { duration?: number; reason?: string };

  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO moderation_events (user_id, action, reason, duration, moderator_id) VALUES (?, 'mute', ?, ?, 0)
    `).run(userId, reason || 'Admin action', duration || 10);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mute user' });
  }
});

router.delete('/users/:userId/mute', requireAuth, async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);

  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO moderation_events (user_id, action, reason, moderator_id) VALUES (?, 'unmute', 'Admin action', 0)
    `).run(userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unmute user' });
  }
});

router.post('/users/:userId/ban', requireAuth, async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);
  const { duration, reason } = req.body as { duration?: number; reason?: string };

  try {
    await setUserRole(userId, Role.Banned, 0);
    const db = getDb();
    db.prepare(`
      INSERT INTO moderation_events (user_id, action, reason, duration, moderator_id) VALUES (?, 'ban', ?, ?, 0)
    `).run(userId, reason || 'Admin action', (duration || 1) * 24 * 60);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

router.delete('/users/:userId/ban', requireAuth, async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId, 10);

  try {
    await setUserRole(userId, Role.User, 0);
    const db = getDb();
    db.prepare(`
      INSERT INTO moderation_events (user_id, action, reason, moderator_id) VALUES (?, 'unban', 'Admin action', 0)
    `).run(userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

export default router;
