import { getDb } from '../../db';
import { moderationLogger } from '../../logger';
import { getUserRole, setUserRole, canPerformAction, Role, getRoleName, parseRole } from './roles';

export interface ModerationCommand {
  command: string;
  targetId: number | null;
  targetMention: string | null;
  args: string[];
  rawText: string;
}

const CMD_REGEX = /^\/(\w+)(?:\s+\[id(\d+)\|[^\]]+\]|\s+@(\w+))?(.*)$/i;

export function parseCommand(text: string): ModerationCommand | null {
  const match = text.match(CMD_REGEX);
  if (!match) return null;

  const command = match[1].toLowerCase();
  const validCommands = ['warn', 'mute', 'kick', 'ban', 'unwarn', 'unmute', 'unban', 'stats', 'role'];
  if (!validCommands.includes(command)) return null;

  const targetIdFromMention = match[2] ? parseInt(match[2], 10) : null;
  const targetMention = match[3] || null;
  const rest = (match[4] || '').trim();
  const args = rest ? rest.split(/\s+/) : [];

  return {
    command,
    targetId: targetIdFromMention,
    targetMention,
    args,
    rawText: text,
  };
}

async function logModerationEvent(
  peerId: number,
  userId: number,
  action: string,
  reason: string | null,
  duration: number | null,
  moderatorId: number
): Promise<void> {
  const db = getDb();
  db.prepare(`
    INSERT INTO moderation_events (peer_id, user_id, action, reason, duration, moderator_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(peerId, userId, action, reason, duration, moderatorId);
}

export async function executeCommand(
  cmd: ModerationCommand,
  actorId: number,
  peerId: number
): Promise<string> {
  if (!cmd.targetId && !cmd.targetMention) {
    return '❌ Укажите пользователя (через mention или @id).';
  }

  const targetId = cmd.targetId || 0;
  if (!targetId) {
    return '❌ Не удалось определить пользователя.';
  }

  const actorRole = await getUserRole(actorId);
  const targetRole = await getUserRole(targetId);

  switch (cmd.command) {
    case 'warn': {
      const reason = cmd.args.join(' ') || 'Нарушение правил';
      if (!canPerformAction(actorRole, targetRole, 'warn')) {
        return '❌ Недостаточно прав.';
      }
      const db = getDb();
      db.prepare('INSERT INTO user_warnings (user_id, peer_id, reason, moderator_id) VALUES (?, ?, ?, ?)').run(targetId, peerId, reason, actorId);
      db.prepare('UPDATE user_stats SET warn_count = warn_count + 1 WHERE user_id = ?').run(targetId);
      await logModerationEvent(peerId, targetId, 'warn', reason, null, actorId);
      moderationLogger.info(`WARN: target=${targetId}, by=${actorId}, reason=${reason}`);
      return `⚠️ Пользователь [id${targetId}|...] предупреждён. Причина: ${reason}`;
    }

    case 'mute': {
      const duration = parseInt(cmd.args[0] || '10', 10);
      const reason = cmd.args.slice(1).join(' ') || 'Нарушение правил';
      if (!canPerformAction(actorRole, targetRole, 'mute')) {
        return '❌ Недостаточно прав.';
      }
      await logModerationEvent(peerId, targetId, 'mute', reason, duration, actorId);
      moderationLogger.info(`MUTE: target=${targetId}, duration=${duration}m, by=${actorId}, reason=${reason}`);
      return `🔇 Пользователь [id${targetId}|...] замучен на ${duration} мин. Причина: ${reason}`;
    }

    case 'kick': {
      const reason = cmd.args.join(' ') || 'Нарушение правил';
      if (!canPerformAction(actorRole, targetRole, 'kick')) {
        return '❌ Недостаточно прав.';
      }
      await logModerationEvent(peerId, targetId, 'kick', reason, null, actorId);
      moderationLogger.info(`KICK: target=${targetId}, by=${actorId}, reason=${reason}`);
      return `👢 Пользователь [id${targetId}|...] выгнан. Причина: ${reason}`;
    }

    case 'ban': {
      const days = parseInt(cmd.args[0] || '1', 10);
      const reason = cmd.args.slice(1).join(' ') || 'Нарушение правил';
      if (!canPerformAction(actorRole, targetRole, 'ban')) {
        return '❌ Недостаточно прав.';
      }
      await setUserRole(targetId, Role.Banned, actorId);
      await logModerationEvent(peerId, targetId, 'ban', reason, days * 24 * 60, actorId);
      moderationLogger.info(`BAN: target=${targetId}, days=${days}, by=${actorId}, reason=${reason}`);
      return `🚫 Пользователь [id${targetId}|...] заблокирован на ${days} дн. Причина: ${reason}`;
    }

    case 'unban':
    case 'unmute': {
      if (actorRole < Role.Moderator) return '❌ Недостаточно прав.';
      if (cmd.command === 'unban') {
        await setUserRole(targetId, Role.User, actorId);
      }
      await logModerationEvent(peerId, targetId, cmd.command, null, null, actorId);
      moderationLogger.info(`${cmd.command.toUpperCase()}: target=${targetId}, by=${actorId}`);
      return `✅ Пользователь [id${targetId}|...] разблокирован.`;
    }

    case 'unwarn': {
      if (!canPerformAction(actorRole, targetRole, 'warn')) return '❌ Недостаточно прав.';
      const db = getDb();
      const last = db.prepare('SELECT id FROM user_warnings WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(targetId) as { id: number } | undefined;
      if (last) {
        db.prepare('DELETE FROM user_warnings WHERE id = ?').run(last.id);
        db.prepare('UPDATE user_stats SET warn_count = MAX(0, warn_count - 1) WHERE user_id = ?').run(targetId);
      }
      return `✅ Последнее предупреждение [id${targetId}|...] снято.`;
    }

    case 'stats': {
      const db = getDb();
      const stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(targetId) as Record<string, number> | undefined;
      const warns = (db.prepare('SELECT COUNT(*) as cnt FROM user_warnings WHERE user_id = ?').get(targetId) as { cnt: number }).cnt;
      const roleName = getRoleName(targetRole);
      if (!stats) return `📊 Пользователь [id${targetId}|...]: роль ${roleName}, нет данных`;
      return `📊 [id${targetId}|...]: роль ${roleName}, сообщений: ${stats.message_count || 0}, предупреждений: ${warns}, risk: ${Math.round(stats.risk_score || 0)}`;
    }

    case 'role': {
      const roleName = cmd.args[0];
      if (!roleName) return '❌ Укажите роль.';
      const newRole = parseRole(roleName);
      if (newRole === null) return `❌ Неизвестная роль: ${roleName}`;
      if (!canPerformAction(actorRole, targetRole, 'setRole')) return '❌ Недостаточно прав.';
      if (newRole >= actorRole) return '❌ Нельзя назначить роль выше своей.';
      await setUserRole(targetId, newRole, actorId);
      return `✅ Роль [id${targetId}|...] изменена на ${getRoleName(newRole)}.`;
    }

    default:
      return '❌ Неизвестная команда.';
  }
}
