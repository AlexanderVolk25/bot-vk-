import cron from 'node-cron';
import { getDb } from '../../db';
import { config } from '../../config/settings';
import { contentLogger } from '../../logger';

export interface ScheduledVideo {
  id: number;
  youtubeId: string;
  title: string;
  scheduledAt: number;
  status: string;
}

let schedulerTask: cron.ScheduledTask | null = null;

function isInQuietHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const { quietHoursStart, quietHoursEnd } = config.content;

  if (quietHoursStart > quietHoursEnd) {
    return hour >= quietHoursStart || hour < quietHoursEnd;
  }
  return hour >= quietHoursStart && hour < quietHoursEnd;
}

async function getTodayPostCount(): Promise<number> {
  const db = getDb();
  const startOfDay = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  const result = db.prepare(
    "SELECT COUNT(*) as cnt FROM videos WHERE posted_at >= ? AND status = 'posted'"
  ).get(startOfDay) as { cnt: number };
  return result.cnt;
}

export async function processDueVideos(): Promise<void> {
  if (isInQuietHours()) {
    contentLogger.debug('Scheduler: quiet hours, skipping');
    return;
  }

  const todayCount = await getTodayPostCount();
  if (todayCount >= config.content.dailyPostLimit) {
    contentLogger.debug(`Scheduler: daily limit reached (${todayCount}/${config.content.dailyPostLimit})`);
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const db = getDb();

  const dueVideos = db.prepare(`
    SELECT * FROM videos
    WHERE status = 'scheduled' AND scheduled_at <= ?
    ORDER BY scheduled_at ASC
    LIMIT 1
  `).all(now) as Array<{
    id: number; youtube_id: string; title: string; scheduled_at: number;
    vk_post_id: string | null;
  }>;

  for (const video of dueVideos) {
    try {
      contentLogger.info(`Processing due video: ${video.title} (id=${video.id})`);

      db.prepare(`
        UPDATE videos SET status = 'posted', posted_at = ? WHERE id = ?
      `).run(now, video.id);

      contentLogger.info(`Video posted: ${video.title}`);
    } catch (err) {
      contentLogger.error(`Failed to process due video ${video.id}`, { error: err });
      db.prepare("UPDATE videos SET status = 'failed', error = ? WHERE id = ?").run(String(err), video.id);
    }
  }
}

export async function scheduleVideo(videoDbId: number, publishAt: Date): Promise<void> {
  const db = getDb();
  const ts = Math.floor(publishAt.getTime() / 1000);

  db.prepare(`
    UPDATE videos SET status = 'scheduled', scheduled_at = ? WHERE id = ?
  `).run(ts, videoDbId);

  contentLogger.info(`Video ${videoDbId} scheduled for ${publishAt.toISOString()}`);
}

export async function cancelScheduledVideo(videoDbId: number): Promise<void> {
  const db = getDb();
  db.prepare("UPDATE videos SET status = 'pending', scheduled_at = NULL WHERE id = ? AND status = 'scheduled'").run(videoDbId);
  contentLogger.info(`Scheduled video ${videoDbId} cancelled`);
}

export async function getScheduledVideos(): Promise<ScheduledVideo[]> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, youtube_id, title, scheduled_at, status
    FROM videos WHERE status = 'scheduled'
    ORDER BY scheduled_at ASC
  `).all() as Array<{ id: number; youtube_id: string; title: string; scheduled_at: number; status: string }>;

  return rows.map(r => ({
    id: r.id,
    youtubeId: r.youtube_id,
    title: r.title,
    scheduledAt: r.scheduled_at,
    status: r.status,
  }));
}

export function startScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
  }

  schedulerTask = cron.schedule('* * * * *', async () => {
    try {
      await processDueVideos();
    } catch (err) {
      contentLogger.error('Scheduler error', { error: err });
    }
  });

  contentLogger.info('Scheduler started (runs every minute)');
}

export function stopScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    contentLogger.info('Scheduler stopped');
  }
}

export function getNextScheduleSlot(): Date {
  const now = new Date();
  const hours = config.content.scheduleHours;
  const { quietHoursStart, quietHoursEnd } = config.content;

  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    for (const hour of hours) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + dayOffset);
      candidate.setHours(hour, 0, 0, 0);

      if (candidate <= now) continue;

      const h = candidate.getHours();
      const inQuiet = quietHoursStart > quietHoursEnd
        ? h >= quietHoursStart || h < quietHoursEnd
        : h >= quietHoursStart && h < quietHoursEnd;

      if (!inQuiet) return candidate;
    }
  }

  const fallback = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  fallback.setHours(12, 0, 0, 0);
  return fallback;
}
