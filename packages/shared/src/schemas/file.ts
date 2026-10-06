import { z } from 'zod';

export const MAX_FILE_SIZE_BYTES = 52_428_800; // 50MB exact

export const SignUploadUrlSchema = z.object({
  fileName: z
    .string()
    .min(1, 'File name is required')
    .max(255)
    .regex(/^[^<>:"/\\|?*\x00-\x1F]+$/, 'Invalid file name characters'),
  mimeType: z
    .string()
    .min(1, 'MIME type is required')
    .max(100)
    .regex(/^[-\w.+]+(\/[-\w.+]+)?$/, 'Invalid MIME type format'),
  fileSize: z
    .number()
    .int('File size must be an integer')
    .positive('File size must be positive')
    .max(MAX_FILE_SIZE_BYTES, 'File size cannot exceed 50MB (52,428,800 bytes)'),
});

export type SignUploadUrlInput = z.infer<typeof SignUploadUrlSchema>;

export const SignUploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  publicUrl: z.string().url(),
  expiresInSeconds: z.number(),
  fileName: z.string(),
  sanitizedKey: z.string(),
});

export type SignUploadUrlResponse = z.infer<typeof SignUploadUrlResponseSchema>;
