import { Router, Request, Response } from 'express';
import { taskQueue } from '../../queue/queue';
import { searchVideos } from '../../modules/content/youtube';
import { config } from '../../config/settings';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const tasks = taskQueue.getTasks();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get queue' });
  }
});

router.post('/fetch', requireAuth, async (req: Request, res: Response) => {
  const { query } = req.body as { query?: string };
  const searchQuery = query || config.youtube.topics[Math.floor(Math.random() * config.youtube.topics.length)];

  try {
    const videos = await searchVideos(searchQuery, config.youtube.minDuration, config.youtube.maxDuration);

    if (!videos.length) {
      res.status(404).json({ error: 'No videos found' });
      return;
    }

    const task = taskQueue.addTask('content', {
      query: searchQuery,
      videoId: videos[0].videoId,
      title: videos[0].title,
    });

    res.json({ task, video: videos[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const cancelled = taskQueue.cancelTask(id);

  if (!cancelled) {
    res.status(404).json({ error: 'Task not found or cannot be cancelled' });
    return;
  }

  res.json({ success: true });
});

export default router;
