import axios from 'axios';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { contentLogger } from '../../logger';
import { config } from '../../config/settings';

export interface VideoResult {
  videoId: string;
  title: string;
  duration: number;
  channelTitle: string;
  thumbnailUrl: string;
}

function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export async function searchVideos(
  query: string,
  minDuration: number,
  maxDuration: number
): Promise<VideoResult[]> {
  const apiKey = config.youtube.apiKey;

  if (!apiKey) {
    contentLogger.warn('YOUTUBE_API_KEY not set, skipping video search');
    return [];
  }

  try {
    const searchResp = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        key: apiKey,
        q: query,
        part: 'snippet',
        type: 'video',
        videoDuration: 'medium',
        maxResults: 25,
        order: 'relevance',
        safeSearch: 'moderate',
      },
      timeout: 15000,
    });

    const items: Array<{
      id: { videoId: string };
      snippet: { title: string; channelTitle: string; thumbnails: { medium: { url: string } } };
    }> = searchResp.data.items || [];

    if (!items.length) return [];

    const ids = items.map(i => i.id.videoId).join(',');
    const detailResp = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        key: apiKey,
        id: ids,
        part: 'contentDetails,snippet',
      },
      timeout: 15000,
    });

    const results: VideoResult[] = [];

    for (const item of detailResp.data.items || []) {
      const duration = parseDuration(item.contentDetails.duration);
      if (duration < minDuration || duration > maxDuration) continue;

      const snippet = items.find(i => i.id.videoId === item.id)?.snippet;
      if (!snippet) continue;

      results.push({
        videoId: item.id,
        title: item.snippet.title,
        duration,
        channelTitle: item.snippet.channelTitle,
        thumbnailUrl: item.snippet.thumbnails?.medium?.url || '',
      });
    }

    contentLogger.info(`Found ${results.length} videos for query: ${query}`);
    return results;
  } catch (err) {
    contentLogger.error('YouTube search failed', { query, error: err });
    return [];
  }
}

export async function downloadVideo(videoId: string, outputDir: string): Promise<string> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputTemplate = path.join(outputDir, `${videoId}.%(ext)s`);
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  return new Promise((resolve, reject) => {
    const args = [
      '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=720]',
      '--merge-output-format', 'mp4',
      '-o', outputTemplate,
      '--no-playlist',
      '--no-warnings',
      url,
    ];

    contentLogger.info(`Downloading video: ${videoId}`, { url });

    const proc = spawn('yt-dlp', args);

    proc.stdout.on('data', (data: Buffer) => {
      contentLogger.debug(`yt-dlp: ${data.toString().trim()}`);
    });

    proc.stderr.on('data', (data: Buffer) => {
      contentLogger.warn(`yt-dlp stderr: ${data.toString().trim()}`);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}`));
        return;
      }

      const expectedPath = path.join(outputDir, `${videoId}.mp4`);
      if (fs.existsSync(expectedPath)) {
        resolve(expectedPath);
        return;
      }

      const files = fs.readdirSync(outputDir).filter(f => f.startsWith(videoId));
      if (files.length > 0) {
        resolve(path.join(outputDir, files[0]));
      } else {
        reject(new Error(`Downloaded file not found for videoId: ${videoId}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`yt-dlp process error: ${err.message}`));
    });
  });
}
