import { getDb } from '../../db';
import { moderationLogger } from '../../logger';

export interface RiskEvent {
  userId: number;
  delta: number;
  reason: string;
  timestamp: number;
}

const AUTO_ACTION_THRESHOLDS = {
  warn: 50,
  mute: 75,
  kick: 90,
};

const DECAY_RATE = 0.10;

export async function getRiskScore(userId: number): Promise<number> {
  try {
    const db = getDb();
    const row = db.prepare('SELECT risk_score, last_message_at FROM user_stats WHERE user_id = ?').get(userId) as
      | { risk_score: number; last_message_at: number | null }
      | undefined;

    if (!row) return 0;

    const score = row.risk_score || 0;
    if (!row.last_message_at) return score;

    const hoursSince = (Date.now() / 1000 - row.last_message_at) / 3600;
    const daysSince = hoursSince / 24;
    const decayedScore = score * Math.pow(1 - DECAY_RATE, daysSince);

    return Math.max(0, decayedScore);
  } catch (err) {
    moderationLogger.error('Error getting risk score', { userId, error: err });
    return 0;
  }
}

export async function updateRiskScore(userId: number, delta: number, reason: string): Promise<number> {
  try {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    const current = await getRiskScore(userId);
    const newScore = Math.min(100, Math.max(0, current + delta));

    db.prepare(`
      INSERT INTO user_stats (user_id, risk_score, last_message_at, message_count)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(user_id) DO UPDATE SET
        risk_score = ?,
        last_message_at = ?,
        message_count = message_count + 1
    `).run(userId, newScore, now, newScore, now);

    moderationLogger.info(`Risk score updated: user=${userId}, delta=${delta}, new=${newScore}, reason=${reason}`);

    return newScore;
  } catch (err) {
    moderationLogger.error('Error updating risk score', { userId, delta, error: err });
    return 0;
  }
}

export function getAutoAction(score: number): 'none' | 'warn' | 'mute' | 'kick' {
  if (score >= AUTO_ACTION_THRESHOLDS.kick) return 'kick';
  if (score >= AUTO_ACTION_THRESHOLDS.mute) return 'mute';
  if (score >= AUTO_ACTION_THRESHOLDS.warn) return 'warn';
  return 'none';
}

export const RISK_DELTAS = {
  link: 10,
  profanity: 5,
  flood: 20,
  repeatedJoin: 15,
  spam: 15,
  normalMessage: -1,
};
