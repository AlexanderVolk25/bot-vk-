import { moderationLogger } from '../../logger';
import { getUserRole, Role } from './roles';

export interface SpamResult {
  flagged: boolean;
  reasons: string[];
  action: 'none' | 'warn' | 'mute' | 'kick' | 'delete';
}

const PROFANITY_LIST = [
  'хуй', 'пизда', 'блядь', 'ебать', 'ёбаный', 'сука', 'пиздец', 'хуёв',
  'fuck', 'shit', 'bitch', 'asshole', 'nigger', 'cunt',
];

const AD_PATTERNS = [
  /https?:\/\/(?!vk\.com\/goldmine)/i,
  /t\.me\//i,
  /telegram\./i,
  /discord\.gg\//i,
  /vk\.com\/(?!goldmine)/i,
];

interface UserFloodData {
  timestamps: number[];
  lastMessage: number;
}

interface UserJoinData {
  joinTime: number;
  lastMessage: number;
}

const floodMap = new Map<string, UserFloodData>();
const joinTracker = new Map<number, UserJoinData>();
const recentJoins: number[] = [];

let quarantineMode = false;
let quarantineExpiry = 0;

const FLOOD_WINDOW_MS = 10000;
const FLOOD_THRESHOLD = 5;
const RAID_THRESHOLD = 10;
const RAID_WINDOW_MS = 60000;
const QUARANTINE_DURATION_MS = 10 * 60 * 1000;
const QUARANTINE_MSG_INTERVAL_MS = 30000;
const NEW_USER_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export function trackUserJoin(userId: number): void {
  const now = Date.now();
  joinTracker.set(userId, { joinTime: now, lastMessage: 0 });
  recentJoins.push(now);

  const cutoff = now - RAID_WINDOW_MS;
  const recentCount = recentJoins.filter(t => t > cutoff).length;

  if (recentCount >= RAID_THRESHOLD) {
    quarantineMode = true;
    quarantineExpiry = now + QUARANTINE_DURATION_MS;
    moderationLogger.warn(`RAID ALERT: ${recentCount} joins in ${RAID_WINDOW_MS / 1000}s - quarantine activated`);
  }
}

export async function checkMessage(
  message: string,
  userId: number,
  peerId: number
): Promise<SpamResult> {
  const result: SpamResult = { flagged: false, reasons: [], action: 'none' };

  try {
    const role = await getUserRole(userId);
    if (role >= Role.Moderator) return result;

    // Check quarantine
    const now = Date.now();
    if (quarantineMode && now < quarantineExpiry) {
      const joinData = joinTracker.get(userId);
      if (joinData && (now - joinData.joinTime) < NEW_USER_THRESHOLD_MS) {
        if (joinData.lastMessage > 0 && (now - joinData.lastMessage) < QUARANTINE_MSG_INTERVAL_MS) {
          result.flagged = true;
          result.reasons.push('quarantine: too frequent');
          result.action = 'delete';
          return result;
        }
        joinData.lastMessage = now;
      }
    } else if (quarantineMode && now >= quarantineExpiry) {
      quarantineMode = false;
    }

    const lower = message.toLowerCase();

    // Profanity check
    for (const word of PROFANITY_LIST) {
      if (lower.includes(word)) {
        result.flagged = true;
        result.reasons.push('profanity');
        result.action = 'warn';
        break;
      }
    }

    // Ad check
    for (const pattern of AD_PATTERNS) {
      if (pattern.test(message)) {
        result.flagged = true;
        result.reasons.push('advertisement/external link');
        if (result.action === 'none' || result.action === 'warn') {
          result.action = 'mute';
        }
        break;
      }
    }

    // Flood check
    const floodKey = `${userId}:${peerId}`;
    const floodData = floodMap.get(floodKey) || { timestamps: [], lastMessage: 0 };
    const cutoff = now - FLOOD_WINDOW_MS;
    floodData.timestamps = floodData.timestamps.filter(t => t > cutoff);
    floodData.timestamps.push(now);
    floodData.lastMessage = now;
    floodMap.set(floodKey, floodData);

    if (floodData.timestamps.length > FLOOD_THRESHOLD) {
      result.flagged = true;
      result.reasons.push('flood');
      if (result.action === 'none' || result.action === 'warn') {
        result.action = 'mute';
      }
    }
  } catch (err) {
    moderationLogger.error('Error in checkMessage', { userId, error: err });
  }

  return result;
}

export function isQuarantineActive(): boolean {
  return quarantineMode && Date.now() < quarantineExpiry;
}
