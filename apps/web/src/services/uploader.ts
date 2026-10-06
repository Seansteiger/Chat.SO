import { MAX_FILE_SIZE_BYTES } from '@chatso/shared';
import { api } from './api.js';
import { convex, api as convexApi } from '../convex.js';

export interface UploadProgressCallback {
  (percentage: number, loadedBytes: number, totalBytes: number): void;
}

export interface DirectUploadResult {
  publicUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export async function uploadFileDirectly(
  file: File,
  onProgress?: UploadProgressCallback,
  signal?: AbortSignal
): Promise<DirectUploadResult> {
  // 1. Strict Client-side 50MB check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File exceeds the 50MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB > 50MB).`
    );
  }

  // 2. Request pre-signed upload URL from backend (Convex or Cloud Storage)
  const signResponse = await api.signUploadUrl({
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
  });

  const isConvex =
    signResponse.uploadUrl.includes('.convex.cloud') ||
    signResponse.uploadUrl.includes('.convex.site');

  const httpMethod = isConvex ? 'POST' : 'PUT';

  // 3. Direct upload to cloud storage with live progress tracking (0 server proxying)
  return new Promise<DirectUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(httpMethod, signResponse.uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new Error('Upload cancelled'));
      });
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percentage = Math.round((event.loaded / event.total) * 100);
        onProgress(percentage, event.loaded, event.total);
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let finalPublicUrl = signResponse.publicUrl;

        if (isConvex) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.storageId) {
              const url = await convex.query(convexApi.files.getFileUrl, {
                storageId: data.storageId,
              });
              if (url) finalPublicUrl = url;
            }
          } catch (e) {
            console.warn('[Upload] Failed to parse Convex storageId:', e);
          }
        }

        resolve({
          publicUrl: finalPublicUrl,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
        });
      } else {
        reject(new Error(`Direct cloud upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during direct cloud upload. Check CORS settings.'));
    };

    xhr.send(file);
  });
}
