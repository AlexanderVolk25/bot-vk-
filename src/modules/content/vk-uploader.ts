import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { contentLogger } from '../../logger';
import { config } from '../../config/settings';

export interface UploadResult {
  videoId: number;
  ownerId: number;
}

export async function uploadVideo(
  filePath: string,
  title: string,
  description: string
): Promise<UploadResult> {
  const token = config.vk.userToken || config.vk.groupToken;
  const groupId = config.vk.groupId;

  if (!token || !groupId) {
    throw new Error('VK token and group ID are required for video upload');
  }

  contentLogger.info(`Starting VK video upload: ${title}`);

  // Step 1: Get upload server URL
  const saveResp = await axios.post('https://api.vk.com/method/video.save', null, {
    params: {
      access_token: token,
      v: '5.199',
      name: title,
      description,
      group_id: groupId,
      no_comments: 0,
      privacy_view: 'all',
      privacy_comment: 'all',
    },
    timeout: 30000,
  });

  if (saveResp.data.error) {
    throw new Error(`video.save error: ${saveResp.data.error.error_msg}`);
  }

  const { upload_url, video_id, owner_id } = saveResp.data.response;
  contentLogger.info(`Got upload URL, video_id=${video_id}, owner_id=${owner_id}`);

  // Step 2: Upload the file
  const formData = new FormData();
  formData.append('video_file', fs.createReadStream(filePath));

  const uploadResp = await axios.post(upload_url, formData, {
    headers: formData.getHeaders(),
    timeout: 300000, // 5 min for large files
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  if (uploadResp.data.error) {
    throw new Error(`Video upload error: ${uploadResp.data.error}`);
  }

  contentLogger.info(`Video uploaded successfully: video_id=${video_id}`);

  return {
    videoId: Math.abs(video_id),
    ownerId: owner_id,
  };
}

export async function schedulePost(
  videoId: number,
  ownerId: number,
  publishAt: number
): Promise<number> {
  const token = config.vk.userToken || config.vk.groupToken;
  const groupId = config.vk.groupId;

  const attachment = `video${ownerId}_${videoId}`;

  const resp = await axios.post('https://api.vk.com/method/wall.post', null, {
    params: {
      access_token: token,
      v: '5.199',
      owner_id: -groupId,
      from_group: 1,
      attachments: attachment,
      publish_date: publishAt,
    },
    timeout: 30000,
  });

  if (resp.data.error) {
    throw new Error(`wall.post error: ${resp.data.error.error_msg}`);
  }

  const postId: number = resp.data.response.post_id;
  contentLogger.info(`Post scheduled: post_id=${postId}, publish_at=${new Date(publishAt * 1000).toISOString()}`);
  return postId;
}

export async function postImmediately(
  videoId: number,
  ownerId: number,
  message = ''
): Promise<number> {
  const token = config.vk.userToken || config.vk.groupToken;
  const groupId = config.vk.groupId;

  const attachment = `video${ownerId}_${videoId}`;

  const resp = await axios.post('https://api.vk.com/method/wall.post', null, {
    params: {
      access_token: token,
      v: '5.199',
      owner_id: -groupId,
      from_group: 1,
      message,
      attachments: attachment,
    },
    timeout: 30000,
  });

  if (resp.data.error) {
    throw new Error(`wall.post error: ${resp.data.error.error_msg}`);
  }

  return resp.data.response.post_id;
}

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
