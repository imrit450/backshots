import { spawn } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Re-encodes a raw WebM/MP4 buffer to a clean MP4 via FFmpeg.
 * - libx264 video at 30 fps, CRF 23 (good quality / reasonable size)
 * - AAC audio at 192 kbps
 * - loudnorm filter: normalises audio to -16 LUFS so volume is consistent
 * - faststart: moves moov atom to front for instant browser playback
 *
 * Returns the processed MP4 buffer, or null if FFmpeg fails.
 */
export async function transcodeVideo(inputBuffer: Buffer, inputMime: string): Promise<Buffer | null> {
  const ext = inputMime.includes('mp4') ? 'mp4' : 'webm';
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const inputPath  = join(tmpdir(), `lmr-in-${id}.${ext}`);
  const outputPath = join(tmpdir(), `lmr-out-${id}.mp4`);

  try {
    await writeFile(inputPath, inputBuffer);

    await runFfmpeg([
      '-y',
      '-i', inputPath,
      '-vf', 'fps=30',                      // smooth 30 fps
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', // consistent audio level
      '-movflags', '+faststart',             // progressive browser playback
      outputPath,
    ]);

    return await readFile(outputPath);
  } catch (err) {
    console.error('[videoProcessor] transcode failed:', err);
    return null;
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const stderr: Buffer[] = [];
    proc.stderr.on('data', (d: Buffer) => stderr.push(d));
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(stderr).toString().slice(-500)}`));
      }
    });
    proc.on('error', reject);
  });
}
