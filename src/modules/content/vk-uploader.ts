import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { contentLogger } from '../../logger';
import { config } from '../../config/settings';

export interface UploadResult {
  videoId: number;
  ownerId: number;
}

/**
 * Upload a video as a VK Clip (Клип) to the group's Clips section.
 * Uses video.save with is_short_video=1 so the video appears in VK Clips,
 * NOT on the group wall.
 */
export async function uploadVideoAsClip(
  filePath: string,
  title: string,
  description: string
): Promise<UploadResult> {
  const token = config.vk.userToken || config.vk.groupToken;
  const groupId = config.vk.groupId;

  if (!token || !groupId) {
    throw new Error('VK token and group ID are required for clip upload');
  }

  contentLogger.info(`Starting VK Clip upload: ${title}`);

  // Step 1: Get upload server URL for a Clip (is_short_video=1)
  const saveResp = await axios.post('https://api.vk.com/method/video.save', null, {
    params: {
      access_token: token,
      v: '5.199',
      name: title,
      description,
      group_id: groupId,
      wallpost: 0,          // do NOT post to the group wall
      is_short_video: 1,    // publish as VK Clip (Клип)
      privacy_view: 'all',
      privacy_comment: 'all',
    },
    timeout: 30000,
  });

  if (saveResp.data.error) {
    throw new Error(`video.save error: ${saveResp.data.error.error_msg}`);
  }

  const { upload_url, video_id, owner_id } = saveResp.data.response;
  contentLogger.info(`Got Clip upload URL, video_id=${video_id}, owner_id=${owner_id}`);

  // Step 2: Upload the file to the provided upload server
  const formData = new FormData();
  formData.append('video_file', fs.createReadStream(filePath));

  const uploadResp = await axios.post(upload_url, formData, {
    headers: formData.getHeaders(),
    timeout: 300000, // 5 min for large files
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  if (uploadResp.data.error) {
    throw new Error(`Clip upload error: ${uploadResp.data.error}`);
  }

  contentLogger.info(`VK Clip uploaded successfully: video_id=${video_id}`);

  return {
    videoId: Math.abs(video_id),
    ownerId: owner_id,
  };
}

/** @deprecated Use uploadVideoAsClip instead (posts to Clips, not wall). */
export const uploadVideo = uploadVideoAsClip;

export async function deleteLocalFile(filePath: string): Promise<void> {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      contentLogger.info(`Deleted local file: ${filePath}`);
    }
  } catch (err) {
    contentLogger.error(`Failed to delete file: ${filePath}`, { error: err });
  }
}
