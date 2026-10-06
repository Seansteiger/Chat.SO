import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { SignUploadUrlInput } from '@chatso/shared';
import { StorageService } from '../services/storage.service.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../uploads');

// Ensure local uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export class FileController {
  static async signUploadUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { fileName, mimeType, fileSize } = req.body as SignUploadUrlInput;
      const baseUrl = `${req.protocol}://${req.get('host')}`;

      const response = await StorageService.generateSignedUploadUrl({
        userId: req.user.userId,
        fileName,
        mimeType,
        fileSize,
        baseUrl,
      });

      res.json(response);
    } catch (err: any) {
      console.error('[File.signUploadUrl] Error:', err);
      res.status(400).json({ error: err.message || 'Failed to generate signed URL' });
    }
  }

  /**
   * Direct PUT handler for local development (mimics GCS direct PUT).
   * Streams raw incoming request body directly into uploads/ directory without caching.
   */
  static async devUpload(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const rawParam = req.params[0] || req.params.filename;
      const sanitizedKey = (Array.isArray(rawParam) ? rawParam[0] : rawParam) as string | undefined;
      if (!sanitizedKey) {
        res.status(400).json({ error: 'Missing file key' });
        return;
      }

      const targetPath = path.join(uploadsDir, sanitizedKey);
      const parentDir = path.dirname(targetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      const writeStream = fs.createWriteStream(targetPath);
      req.pipe(writeStream);

      writeStream.on('finish', () => {
        res.status(200).send('OK');
      });

      writeStream.on('error', (err) => {
        console.error('[File.devUpload] Write error:', err);
        res.status(500).json({ error: 'Failed to write file' });
      });
    } catch (err) {
      console.error('[File.devUpload] Error:', err);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
}
