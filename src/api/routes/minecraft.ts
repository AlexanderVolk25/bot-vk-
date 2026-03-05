import { Router, Request, Response } from 'express';
import { getServerStatus } from '../../modules/minecraft/status';
import { config } from '../../config/settings';

const router = Router();

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await getServerStatus(config.minecraft.host, config.minecraft.port);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get Minecraft status' });
  }
});

export default router;
