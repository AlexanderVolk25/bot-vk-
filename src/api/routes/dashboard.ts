import { Router, Request, Response } from 'express';
import { taskQueue } from '../../queue/queue';
import { getDb } from '../../db';
import { getServerStatus } from '../../modules/minecraft/status';
import { config } from '../../config/settings';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const queueStats = taskQueue.getStats();

    const startOfDay = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    const todayPosts = (db.prepare(
      "SELECT COUNT(*) as cnt FROM videos WHERE posted_at >= ? AND status = 'posted'"
    ).get(startOfDay) as { cnt: number }).cnt;

    const activeMutes = (db.prepare(
      "SELECT COUNT(*) as cnt FROM moderation_events WHERE action = 'mute' AND created_at >= ?"
    ).get(startOfDay) as { cnt: number }).cnt;

    const activeBans = (db.prepare(
      "SELECT COUNT(*) as cnt FROM user_roles WHERE role = '0'"
    ).get() as { cnt: number }).cnt;

    const recentAudit = db.prepare(
      'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10'
    ).all();

    const mcStatus = await getServerStatus(config.minecraft.host, config.minecraft.port);

    res.json({
      queue: queueStats,
      content: {
        todayPosts,
        dailyLimit: config.content.dailyPostLimit,
      },
      moderation: {
        activeMutes,
        activeBans,
      },
      minecraft: mcStatus,
      recentAudit,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

export default router;
