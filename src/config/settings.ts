import dotenv from 'dotenv';
import { getDb } from '../db';
import { appLogger } from '../logger';

dotenv.config();

export interface AppConfig {
  vk: {
    groupToken: string;
    userToken: string;
    groupId: number;
    ownerIds: number[];
  };
  admin: {
    password: string;
    port: number;
    sessionSecret: string;
  };
  youtube: {
    apiKey: string;
    topics: string[];
    minDuration: number;
    maxDuration: number;
  };
  content: {
    outroDuration: number;
    dailyPostLimit: number;
    scheduleHours: number[];
    quietHoursStart: number;
    quietHoursEnd: number;
  };
  minecraft: {
    host: string;
    port: number;
  };
  db: {
    path: string;
  };
  logging: {
    level: string;
    dir: string;
  };
}

export const config: AppConfig = {
  vk: {
    groupToken: process.env.VK_GROUP_TOKEN || '',
    userToken: process.env.VK_USER_TOKEN || '',
    groupId: parseInt(process.env.VK_GROUP_ID || '0', 10),
    ownerIds: (process.env.VK_BOT_OWNER_ID || '').split(',').map(Number).filter(Boolean),
  },
  admin: {
    password: process.env.ADMIN_PASSWORD || 'changeme',
    port: parseInt(process.env.ADMIN_PORT || '3000', 10),
    sessionSecret: process.env.SESSION_SECRET || 'change_this_secret',
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
    topics: (process.env.CONTENT_TOPICS || 'Minecraft').split(',').map(s => s.trim()),
    minDuration: parseInt(process.env.CONTENT_MIN_DURATION || '120', 10),
    maxDuration: parseInt(process.env.CONTENT_MAX_DURATION || '300', 10),
  },
  content: {
    outroDuration: parseInt(process.env.OUTRO_DURATION || '3', 10),
    dailyPostLimit: parseInt(process.env.DAILY_POST_LIMIT || '3', 10),
    scheduleHours: (process.env.POST_SCHEDULE_HOURS || '10,14,18').split(',').map(Number),
    quietHoursStart: parseInt(process.env.QUIET_HOURS_START || '23', 10),
    quietHoursEnd: parseInt(process.env.QUIET_HOURS_END || '9', 10),
  },
  minecraft: {
    host: process.env.MINECRAFT_HOST || 'play.goldmine.ru',
    port: parseInt(process.env.MINECRAFT_PORT || '25565', 10),
  },
  db: {
    path: process.env.DB_PATH || './data/goldmine.db',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },
};

export function validateConfig(): void {
  const warnings: string[] = [];

  if (!config.vk.groupToken) warnings.push('VK_GROUP_TOKEN is not set');
  if (!config.vk.groupId) warnings.push('VK_GROUP_ID is not set');
  if (!config.youtube.apiKey) warnings.push('YOUTUBE_API_KEY is not set - content fetching will be disabled');
  if (config.admin.password === 'changeme') warnings.push('ADMIN_PASSWORD is using default value - please change it');
  if (config.admin.sessionSecret === 'change_this_secret') warnings.push('SESSION_SECRET is using default value - please change it');

  warnings.forEach(w => appLogger.warn(`Config warning: ${w}`));
}

export function getSetting(key: string, defaultValue = ''): string {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setSetting(key: string, value: string): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, strftime('%s','now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value);
  } catch (err) {
    appLogger.error('Failed to set setting', { key, error: err });
  }
}

export function getAllSettings(): Record<string, string> {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  } catch {
    return {};
  }
}

export default config;
