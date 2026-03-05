import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs';
import { contentLogger } from '../../logger';

ffmpeg.setFfmpegPath(ffmpegPath.path);

export interface OutroOptions {
  duration?: number;
  text?: string;
  fontSize?: number;
  bgColor?: string;
  fadeIn?: number;
  fadeOut?: number;
}

export async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`ffprobe error: ${err.message}`));
        return;
      }
      resolve(metadata.format.duration || 0);
    });
  });
}

export async function extractFrame(videoPath: string, outputPath: string, timeOffset = '50%'): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: [timeOffset],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '320x180',
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`Frame extraction error: ${err.message}`)));
  });
}

export async function addOutro(
  inputPath: string,
  outputPath: string,
  options: OutroOptions = {}
): Promise<void> {
  const {
    duration = 3,
    text = 'Группа GoldMine',
    fontSize = 48,
    bgColor = 'black',
    fadeIn = 0.5,
    fadeOut = 0.5,
  } = options;

  const tmpDir = path.dirname(outputPath);
  const tmpOutroPath = path.join(tmpDir, `outro_${Date.now()}.mp4`);
  const concatListPath = path.join(tmpDir, `concat_${Date.now()}.txt`);

  try {
    const mainDuration = await getVideoDuration(inputPath);
    contentLogger.info(`Main video duration: ${mainDuration}s, adding outro of ${duration}s`);

    await new Promise<void>((resolve, reject) => {
      const escapedText = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:');

      ffmpeg()
        .input(`color=c=${bgColor}:size=1920x1080:duration=${duration}:rate=30`)
        .inputOptions(['-f', 'lavfi'])
        .input('anullsrc=r=44100:cl=stereo')
        .inputOptions(['-f', 'lavfi'])
        .complexFilter([
          `[0:v]drawtext=text='${escapedText}':fontcolor=white:fontsize=${fontSize}:x=(w-tw)/2:y=(h-th)/2:alpha='if(lt(t,${fadeIn}),t/${fadeIn},if(lt(t,${duration - fadeOut}),1,(${duration}-t)/${fadeOut}))':enable='between(t,0,${duration})'[vout]`,
        ])
        .outputOptions([
          '-map', '[vout]',
          '-map', '1:a',
          '-t', String(duration),
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-ar', '44100',
          '-shortest',
          '-y',
        ])
        .output(tmpOutroPath)
        .on('start', cmd => contentLogger.debug(`ffmpeg outro cmd: ${cmd}`))
        .on('end', () => resolve())
        .on('error', (err) => reject(new Error(`Outro creation error: ${err.message}`)))
        .run();
    });

    fs.writeFileSync(concatListPath, `file '${inputPath}'\nfile '${tmpOutroPath}'\n`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(concatListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-movflags', '+faststart',
          '-y',
        ])
        .output(outputPath)
        .on('start', cmd => contentLogger.debug(`ffmpeg concat cmd: ${cmd}`))
        .on('end', () => resolve())
        .on('error', (err) => reject(new Error(`Concat error: ${err.message}`)))
        .run();
    });

    contentLogger.info(`Video with outro saved to ${outputPath}`);
  } finally {
    if (fs.existsSync(tmpOutroPath)) fs.unlinkSync(tmpOutroPath);
    if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);
  }
}
