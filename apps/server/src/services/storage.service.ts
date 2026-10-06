import { Storage } from '@google-cloud/storage';
import { MAX_FILE_SIZE_BYTES, SignUploadUrlResponse } from '@chatso/shared';
import { config } from '../config/index.js';
import path from 'path';

let gcsClient: Storage | null = null;
if (config.gcsBucketName) {
  try {
    gcsClient = new Storage({
      projectId: config.gcsProjectId || undefined,
    });
  } catch (err) {
    console.warn('[Storage] GCS client initialization warning:', err);
  }
}

export class StorageService {
  /**
   * Generates a direct V4 Signed PUT URL for Google Cloud Storage.
   * If GCS is not configured in local development, returns a simulated direct-PUT endpoint.
   */
  static async generateSignedUploadUrl(params: {
    userId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    baseUrl: string;
  }): Promise<SignUploadUrlResponse> {
    const { userId, fileName, mimeType, fileSize, baseUrl } = params;

    // Strict 50MB hard ceiling verification
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size ${fileSize} exceeds the 50MB maximum ceiling.`);
    }

    // Sanitize file name
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedKey = `uploads/${userId}/${Date.now()}_${base}${ext}`;

    const expiresInSeconds = 15 * 60; // 15 minutes

    // If GCS is configured with a bucket
    if (gcsClient && config.gcsBucketName) {
      const bucket = gcsClient.bucket(config.gcsBucketName);
      const file = bucket.file(sanitizedKey);

      const [uploadUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + expiresInSeconds * 1000,
        contentType: mimeType,
      });

      const publicUrl = `https://storage.googleapis.com/${config.gcsBucketName}/${sanitizedKey}`;

      return {
        uploadUrl,
        publicUrl,
        expiresInSeconds,
        fileName,
        sanitizedKey,
      };
    }

    // Local Development Fallback: Direct PUT URL pointing to static upload handler
    const uploadUrl = `${baseUrl}/api/files/dev-upload/${encodeURIComponent(sanitizedKey)}?mime=${encodeURIComponent(mimeType)}`;
    const publicUrl = `${baseUrl}/uploads/${encodeURIComponent(sanitizedKey)}`;

    return {
      uploadUrl,
      publicUrl,
      expiresInSeconds,
      fileName,
      sanitizedKey,
    };
  }
}
