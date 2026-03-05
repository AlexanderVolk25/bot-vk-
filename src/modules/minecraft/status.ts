import { status as pingJava } from 'minecraft-server-util';
import { appLogger } from '../../logger';

export interface MinecraftStatus {
  online: boolean;
  players: {
    online: number;
    max: number;
  };
  motd: string;
  version: string;
  latency: number;
}

const CACHE_TTL = 30000; // 30 seconds
let cachedStatus: MinecraftStatus | null = null;
let cacheTimestamp = 0;

export async function getServerStatus(host: string, port = 25565): Promise<MinecraftStatus> {
  const now = Date.now();

  if (cachedStatus && now - cacheTimestamp < CACHE_TTL) {
    return cachedStatus;
  }

  try {
    const response = await pingJava(host, port, { timeout: 5000 });

    const result: MinecraftStatus = {
      online: true,
      players: {
        online: response.players.online,
        max: response.players.max,
      },
      motd: typeof response.motd === 'string'
        ? response.motd
        : (response.motd as { clean?: string; raw?: string })?.clean
          || (response.motd as { clean?: string; raw?: string })?.raw
          || 'GoldMine Server',
      version: response.version.name,
      latency: response.roundTripLatency,
    };

    cachedStatus = result;
    cacheTimestamp = now;
    return result;
  } catch (err) {
    appLogger.warn('Minecraft server unreachable', { host, port, error: String(err) });

    const offline: MinecraftStatus = {
      online: false,
      players: { online: 0, max: 0 },
      motd: '',
      version: '',
      latency: -1,
    };

    cachedStatus = offline;
    cacheTimestamp = now;
    return offline;
  }
}

export function clearStatusCache(): void {
  cachedStatus = null;
  cacheTimestamp = 0;
}
