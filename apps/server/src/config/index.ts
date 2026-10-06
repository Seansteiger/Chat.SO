import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from apps/server root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'chatso-super-secret-jwt-key-2026',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  gcsBucketName: process.env.GCS_BUCKET_NAME || '',
  gcsProjectId: process.env.GCS_PROJECT_ID || '',
  turnSecret: process.env.TURN_SECRET || '',
  turnServerUrl: process.env.TURN_SERVER_URL || '',
};
