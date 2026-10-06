import { z } from 'zod';
import { MAX_FILE_SIZE_BYTES } from './file.js';

export const MessageStatusEnum = z.enum(['SENT', 'DELIVERED', 'READ']);
export type MessageStatus = z.infer<typeof MessageStatusEnum>;

export const SendMessageSchema = z.object({
  clientMessageId: z.string().uuid('clientMessageId must be a valid UUID'),
  recipientId: z.string().uuid('recipientId must be a valid UUID'),
  content: z.string().max(5000, 'Message cannot exceed 5000 characters'),
  attachmentUrl: z.string().url().max(1000).optional(),
  attachmentName: z.string().max(255).optional(),
  attachmentSize: z.number().int().nonnegative().max(MAX_FILE_SIZE_BYTES).optional(),
  attachmentMime: z.string().max(100).optional(),
}).refine((data) => data.content.trim().length > 0 || !!data.attachmentUrl, {
  message: 'Message must contain either text content or an attachment',
  path: ['content'],
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export const MessageDtoSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().uuid(),
  clientMessageId: z.string().uuid(),
  content: z.string(),
  attachmentUrl: z.string().nullable().optional(),
  attachmentName: z.string().nullable().optional(),
  attachmentSize: z.number().nullable().optional(),
  attachmentMime: z.string().nullable().optional(),
  status: MessageStatusEnum,
  createdAt: z.string().or(z.date()),
});

export type MessageDto = z.infer<typeof MessageDtoSchema>;

export const ChatHistoryQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type ChatHistoryQuery = z.infer<typeof ChatHistoryQuerySchema>;

export const TypingPayloadSchema = z.object({
  recipientId: z.string().uuid(),
  isTyping: z.boolean(),
});

export type TypingPayload = z.infer<typeof TypingPayloadSchema>;

export const ReadReceiptPayloadSchema = z.object({
  peerId: z.string().uuid(),
  lastReadMessageId: z.string().uuid().optional(),
});

export type ReadReceiptPayload = z.infer<typeof ReadReceiptPayloadSchema>;
