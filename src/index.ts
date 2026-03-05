import dotenv from 'dotenv';
dotenv.config();

import { initDb } from './db';
import { validateConfig, config } from './config/settings';
import { appLogger } from './logger';
import { startBot, stopBot } from './bot';
import { startApiServer } from './api';
import { startScheduler, stopScheduler } from './modules/scheduler/scheduler';

async function main(): Promise<void> {
  appLogger.info('Starting GoldMine VK Bot...');

  initDb();
  validateConfig();

  await startApiServer();
  startScheduler();

  if (config.vk.groupToken) {
    try {
      await startBot();
    } catch (err) {
      appLogger.error('VK bot failed to start', { error: err });
      appLogger.warn('Running without VK bot (admin panel only)');
    }
  } else {
    appLogger.warn('VK_GROUP_TOKEN not configured. Running admin panel only.');
  }

  appLogger.info('GoldMine Bot is running!');
  appLogger.info(`Admin panel: http://localhost:${config.admin.port}`);
}

async function shutdown(): Promise<void> {
  appLogger.info('Shutting down...');
  stopScheduler();
  await stopBot();
  appLogger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('uncaughtException', (err) => {
  appLogger.error('Uncaught exception', { error: err });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  appLogger.error('Unhandled rejection', { reason });
});

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
