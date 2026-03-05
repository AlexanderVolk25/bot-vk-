import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb } from '../../db';
import { contentLogger } from '../../logger';
import { extractFrame } from './video-processor';

export interface VideoRecord {
  id: number;
  youtubeId: string;
  title: string;
  duration: number;
  fileHash: string;
  phash: string;
  status: string;
  vkPostId: string | null;
  scheduledAt: number | null;
  postedAt: number | null;
  createdAt: number;
  error: string | null;
}

function hammingDistance(a: string, b: string): number {
  let dist = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist + Math.abs(a.length - b.length);
}

export async function isYoutubeIdDuplicate(videoId: string): Promise<boolean> {
  try {
    const db = getDb();
    const row = db.prepare("SELECT id FROM videos WHERE youtube_id = ? AND status != 'failed'").get(videoId);
    return !!row;
  } catch (err) {
    contentLogger.error('Error checking YouTube ID duplicate', { videoId, error: err });
    return false;
  }
}

export async function isHashDuplicate(filePath: string): Promise<{ isDuplicate: boolean; hash: string }> {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const db = getDb();
    const row = db.prepare("SELECT id FROM videos WHERE file_hash = ? AND status != 'failed'").get(hash);

    return { isDuplicate: !!row, hash };
  } catch (err) {
    contentLogger.error('Error checking file hash duplicate', { filePath, error: err });
    return { isDuplicate: false, hash: '' };
  }
}

export async function isPHashDuplicate(filePath: string): Promise<{ isDuplicate: boolean; pHash: string }> {
  const tmpFramePath = path.join(path.dirname(filePath), `frame_${Date.now()}.png`);

  try {
    await extractFrame(filePath, tmpFramePath, '50%');

    if (!fs.existsSync(tmpFramePath)) {
      contentLogger.warn('Frame extraction produced no output file');
      return { isDuplicate: false, pHash: '' };
    }

    // Compute a simple perceptual hash using sharp + manual DCT
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sharp = require('sharp');
    const { data } = await sharp(tmpFramePath)
      .resize(8, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = Array.from(data as Buffer);
    const avg = pixels.reduce((a: number, b: number) => a + b, 0) / pixels.length;
    const pHash = pixels.map((p: number) => (p >= avg ? '1' : '0')).join('');

    const db = getDb();
    const existingRows = db.prepare("SELECT phash FROM videos WHERE phash IS NOT NULL AND status != 'failed'").all() as Array<{ phash: string }>;

    for (const row of existingRows) {
      if (hammingDistance(pHash, row.phash) <= 10) {
        return { isDuplicate: true, pHash };
      }
    }

    return { isDuplicate: false, pHash };
  } catch (err) {
    contentLogger.error('Error checking pHash duplicate', { filePath, error: err });
    return { isDuplicate: false, pHash: '' };
  } finally {
    if (fs.existsSync(tmpFramePath)) {
      try { fs.unlinkSync(tmpFramePath); } catch { /* ignore */ }
    }
  }
}

export async function recordVideo(
  youtubeId: string,
  title: string,
  duration: number,
  hash: string,
  pHash: string,
  status: string,
): Promise<void> {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO videos (youtube_id, title, duration, file_hash, phash, status)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(youtube_id) DO UPDATE SET
        title = excluded.title,
        duration = excluded.duration,
        file_hash = excluded.file_hash,
        phash = excluded.phash,
        status = excluded.status
    `).run(youtubeId, title, duration, hash, pHash, status);
  } catch (err) {
    contentLogger.error('Error recording video', { youtubeId, error: err });
  }
}

export async function getVideoHistory(limit = 50): Promise<VideoRecord[]> {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM videos ORDER BY created_at DESC LIMIT ?').all(limit) as Array<Record<string, unknown>>;
    return rows.map(r => ({
      id: r.id as number,
      youtubeId: r.youtube_id as string,
      title: r.title as string,
      duration: r.duration as number,
      fileHash: r.file_hash as string,
      phash: r.phash as string,
      status: r.status as string,
      vkPostId: r.vk_post_id as string | null,
      scheduledAt: r.scheduled_at as number | null,
      postedAt: r.posted_at as number | null,
      createdAt: r.created_at as number,
      error: r.error as string | null,
    }));
  } catch (err) {
    contentLogger.error('Error getting video history', { error: err });
    return [];
  }
}
