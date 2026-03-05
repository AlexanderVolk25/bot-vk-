import { Router, Request, Response } from 'express';
import { getScheduledVideos, scheduleVideo, cancelScheduledVideo } from '../../modules/scheduler/scheduler';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const videos = await getScheduledVideos();
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get scheduled videos' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { videoId, publishAt } = req.body as { videoId?: number; publishAt?: string };

  if (!videoId || !publishAt) {
    res.status(400).json({ error: 'videoId and publishAt are required' });
    return;
  }

  try {
    const publishDate = new Date(publishAt);
    if (isNaN(publishDate.getTime())) {
      res.status(400).json({ error: 'Invalid publishAt date' });
      return;
    }

    await scheduleVideo(videoId, publishDate);
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid ID' });
    return;
  }

  try {
    await cancelScheduledVideo(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel scheduled video' });
  }
});

export default router;
