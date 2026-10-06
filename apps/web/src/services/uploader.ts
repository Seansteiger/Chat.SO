import { MAX_FILE_SIZE_BYTES } from '@chatso/shared';
import { api } from './api.js';

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

  // 2. Request pre-signed V4 PUT URL from backend
  const signResponse = await api.signUploadUrl({
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
  });

  // 3. Perform direct PUT to Google Cloud Storage (or local dev handler) with progress tracking
  return new Promise<DirectUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signResponse.uploadUrl, true);
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

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          publicUrl: signResponse.publicUrl,
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
