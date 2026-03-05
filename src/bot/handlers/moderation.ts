import { MessageContext } from 'vk-io';
import { checkMessage } from '../../modules/moderation/anti-spam';
import { updateRiskScore, getAutoAction, RISK_DELTAS } from '../../modules/moderation/risk-score';
import { moderationLogger } from '../../logger';
import { getDb } from '../../db';

export async function handleModerationCheck(ctx: MessageContext): Promise<boolean> {
  const userId = ctx.senderId;
  const peerId = ctx.peerId;
  const text = ctx.text || '';

  try {
    const now = Math.floor(Date.now() / 1000);
    const db = getDb();

    db.prepare(`
      INSERT INTO user_stats (user_id, message_count, last_message_at)
      VALUES (?, 1, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        message_count = message_count + 1,
        last_message_at = ?
    `).run(userId, now, now);

    const spamResult = await checkMessage(text, userId, peerId);

    if (spamResult.flagged) {
      moderationLogger.info('Spam detected', {
        userId,
        peerId,
        reasons: spamResult.reasons,
        action: spamResult.action,
        text: text.slice(0, 100),
      });

      let riskDelta = 0;
      for (const reason of spamResult.reasons) {
        if (reason.includes('flood')) riskDelta += RISK_DELTAS.flood;
        else if (reason.includes('profanity')) riskDelta += RISK_DELTAS.profanity;
        else if (reason.includes('advertisement') || reason.includes('link')) riskDelta += RISK_DELTAS.link;
        else riskDelta += RISK_DELTAS.spam;
      }

      const newScore = await updateRiskScore(userId, riskDelta, spamResult.reasons.join(', '));
      const autoAction = getAutoAction(newScore);

      db.prepare(`
        INSERT INTO moderation_events (peer_id, user_id, action, reason, moderator_id)
        VALUES (?, ?, ?, ?, 0)
      `).run(peerId, userId, spamResult.action, spamResult.reasons.join(', '));

      if (spamResult.action === 'delete') {
        return true;
      }

      if (autoAction !== 'none' && autoAction !== spamResult.action) {
        moderationLogger.warn(`Auto-action triggered: ${autoAction} for user ${userId} (score=${newScore})`);
        db.prepare(`
          INSERT INTO moderation_events (peer_id, user_id, action, reason, moderator_id)
          VALUES (?, ?, ?, ?, 0)
        `).run(peerId, userId, autoAction, `Auto: risk score ${Math.round(newScore)}`);
      }

      return spamResult.action === 'kick';
    } else {
      await updateRiskScore(userId, RISK_DELTAS.normalMessage, 'normal message');
    }

    return false;
  } catch (err) {
    moderationLogger.error('Moderation check error', { userId, peerId, error: err });
    return false;
  }
}
