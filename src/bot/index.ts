import { VK } from 'vk-io';
import { config } from '../config/settings';
import { appLogger } from '../logger';
import { handleCommand } from './handlers/commands';
import { handleModerationCheck } from './handlers/moderation';
import { parseCommand, executeCommand } from '../modules/moderation/commands';

let vkInstance: VK | null = null;

export function getVkInstance(): VK {
  if (!vkInstance) {
    throw new Error('VK bot not initialized');
  }
  return vkInstance;
}

export async function startBot(): Promise<void> {
  if (!config.vk.groupToken) {
    appLogger.warn('VK_GROUP_TOKEN not set, bot will not start');
    return;
  }

  vkInstance = new VK({
    token: config.vk.groupToken,
  });

  const { updates } = vkInstance;

  updates.on('message_new', async (ctx, next) => {
    const userId = ctx.senderId;
    const text = ctx.text || '';
    const isChat = ctx.isChat;

    appLogger.debug('Message received', {
      userId,
      peerId: ctx.peerId,
      text: text.slice(0, 100),
      isChat,
    });

    try {
      if (isChat) {
        const modCmd = parseCommand(text);
        if (modCmd) {
          const response = await executeCommand(modCmd, userId, ctx.peerId);
          if (response) {
            await ctx.send(response);
          }
          return;
        }

        const shouldBlock = await handleModerationCheck(ctx);
        if (shouldBlock) return;
      }

      if (text.startsWith('/')) {
        await handleCommand(ctx);
      }
    } catch (err) {
      appLogger.error('Message handler error', { userId, error: err });
    }

    await next();
  });

  try {
    await updates.startPolling();
    appLogger.info('VK bot started (long polling)');
  } catch (err) {
    appLogger.error('Failed to start VK bot', { error: err });
    throw err;
  }
}

export async function stopBot(): Promise<void> {
  if (vkInstance) {
    try {
      await (vkInstance.updates as unknown as { stop(): Promise<void> }).stop();
      appLogger.info('VK bot stopped');
    } catch (err) {
      appLogger.error('Error stopping VK bot', { error: err });
    }
    vkInstance = null;
  }
}
