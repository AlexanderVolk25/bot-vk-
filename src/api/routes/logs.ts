import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '../middleware/auth';
import { config } from '../../config/settings';

const router = Router();

const ALLOWED_LOG_TYPES: Record<string, string> = {
  app: 'app.log',
  error: 'error.log',
  audit: 'audit.log',
  moderation: 'moderation.log',
  content: 'content.log',
};

router.get('/', requireAuth, (req: Request, res: Response) => {
  const logType = (req.query.type as string) || 'app';
  const lines = Math.min(parseInt((req.query.lines as string) || '100', 10), 1000);

  const filename = ALLOWED_LOG_TYPES[logType];
  if (!filename) {
    res.status(400).json({ error: 'Invalid log type. Allowed: ' + Object.keys(ALLOWED_LOG_TYPES).join(', ') });
    return;
  }

  const logPath = path.join(config.logging.dir, filename);

  if (!fs.existsSync(logPath)) {
    res.json({ lines: [], type: logType });
    return;
  }

  try {
    const content = fs.readFileSync(logPath, 'utf8');
    const allLines = content.split('\n').filter(Boolean);
    const lastLines = allLines.slice(-lines);

    res.json({ lines: lastLines, type: logType, total: allLines.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read log file' });
  }
});

export default router;
