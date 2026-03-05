import { MessageContext } from 'vk-io';
import { config } from '../../config/settings';
import { getUserRole, Role, getRoleName } from '../../modules/moderation/roles';
import { taskQueue } from '../../queue/queue';
import { getScheduledVideos } from '../../modules/scheduler/scheduler';
import { getServerStatus } from '../../modules/minecraft/status';
import { appLogger } from '../../logger';
import { searchVideos } from '../../modules/content/youtube';

async function isAuthorized(userId: number, minRole: Role): Promise<boolean> {
  if (config.vk.ownerIds.includes(userId)) return true;
  const role = await getUserRole(userId);
  return role >= minRole;
}

export async function handleCommand(ctx: MessageContext): Promise<void> {
  const text = (ctx.text || '').trim();
  const userId = ctx.senderId;

  if (!text.startsWith('/')) return;

  const parts = text.slice(1).split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  try {
    switch (command) {
      case 'status': {
        const stats = taskQueue.getStats();
        const mcStatus = await getServerStatus(config.minecraft.host, config.minecraft.port);
        const mcText = mcStatus.online
          ? `🟢 Онлайн: ${mcStatus.players.online}/${mcStatus.players.max} (${mcStatus.version})`
          : '🔴 Офлайн';

        await ctx.send(
          `🤖 GoldMine Bot\n\n` +
          `📋 Очередь: pending=${stats.pending}, process=${stats.processing}, done=${stats.posted}\n` +
          `⛏ Minecraft ${config.minecraft.host}: ${mcText}`
        );
        break;
      }

      case 'queue': {
        if (!await isAuthorized(userId, Role.Moderator)) {
          await ctx.send('❌ Нет прав.');
          return;
        }
        const tasks = taskQueue.getTasks({ type: 'content' });
        if (!tasks.length) {
          await ctx.send('📭 Очередь пуста');
          return;
        }
        const lines = tasks.slice(0, 10).map(t =>
          `${t.id.slice(0, 8)} | ${t.status} | ${t.progress}% | ${JSON.stringify(t.payload).slice(0, 50)}`
        );
        await ctx.send(`📋 Очередь:\n${lines.join('\n')}`);
        break;
      }

      case 'cancel': {
        if (!await isAuthorized(userId, Role.Admin)) {
          await ctx.send('❌ Нет прав.');
          return;
        }
        const taskId = args[0];
        if (!taskId) {
          await ctx.send('❌ Укажите ID задачи.');
          return;
        }
        const cancelled = taskQueue.cancelTask(taskId);
        await ctx.send(cancelled ? `✅ Задача ${taskId} отменена` : `❌ Задача ${taskId} не найдена`);
        break;
      }

      case 'fetch': {
        if (!await isAuthorized(userId, Role.Admin)) {
          await ctx.send('❌ Нет прав.');
          return;
        }
        const query = args.join(' ') || config.youtube.topics[0];
        await ctx.send(`🔍 Ищу видео по запросу: "${query}"...`);
        const videos = await searchVideos(query, config.youtube.minDuration, config.youtube.maxDuration);
        if (!videos.length) {
          await ctx.send('😔 Видео не найдены.');
          return;
        }
        const task = taskQueue.addTask('content', {
          query,
          videoId: videos[0].videoId,
          title: videos[0].title,
        });
        await ctx.send(`✅ Задача создана: ${task.id.slice(0, 8)}\nВидео: ${videos[0].title}`);
        break;
      }

      case 'schedule': {
        if (!await isAuthorized(userId, Role.Moderator)) {
          await ctx.send('❌ Нет прав.');
          return;
        }
        const scheduled = await getScheduledVideos();
        if (!scheduled.length) {
          await ctx.send('📅 Нет запланированных публикаций.');
          return;
        }
        const lines = scheduled.map(v => {
          const date = new Date(v.scheduledAt * 1000).toLocaleString('ru-RU');
          return `📹 ${v.title}\n🕐 ${date}`;
        });
        await ctx.send(`📅 Расписание:\n\n${lines.join('\n\n')}`);
        break;
      }

      case 'settings': {
        if (!await isAuthorized(userId, Role.Admin)) {
          await ctx.send('❌ Нет прав.');
          return;
        }
        const key = args[0];
        const value = args.slice(1).join(' ');
        if (!key || !value) {
          await ctx.send('❌ Использование: /settings <ключ> <значение>');
          return;
        }
        const { setSetting } = await import('../../config/settings');
        setSetting(key, value);
        await ctx.send(`✅ Настройка сохранена: ${key} = ${value}`);
        break;
      }

      case 'role': {
        if (!await isAuthorized(userId, Role.Admin)) {
          await ctx.send('❌ Нет прав.');
          return;
        }
        const role = await getUserRole(userId);
        await ctx.send(`👤 Ваша роль: ${getRoleName(role)}`);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    appLogger.error('Command handler error', { command, userId, error: err });
    await ctx.send('❌ Произошла ошибка при выполнении команды.');
  }
}
