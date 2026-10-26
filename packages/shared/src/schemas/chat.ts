import { z } from 'zod';
import { MAX_FILE_SIZE_BYTES } from './file.js';

export const MessageStatusEnum = z.enum(['SENT', 'DELIVERED', 'READ']);
export type MessageStatus = z.infer<typeof MessageStatusEnum>;

export const SendMessageSchema = z.object({
  clientMessageId: z.string().uuid('clientMessageId must be a valid UUID'),
  recipientId: z.string().optional(),
  circleId: z.string().optional(),
  content: z.string().max(5000, 'Message cannot exceed 5000 characters'),
  attachmentUrl: z.string().url().max(1000).optional(),
  attachmentName: z.string().max(255).optional(),
  attachmentSize: z.number().int().nonnegative().max(MAX_FILE_SIZE_BYTES).optional(),
  attachmentMime: z.string().max(100).optional(),
  replyToId: z.string().optional(),
  isSilent: z.boolean().optional(),
  voiceDuration: z.number().optional(),
  pollId: z.string().optional(),
}).refine((data) => data.content.trim().length > 0 || !!data.attachmentUrl || !!data.pollId, {
  message: 'Message must contain either text content, an attachment, or a poll',
  path: ['content'],
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export const ReactionSummarySchema = z.object({
  emoji: z.string(),
  count: z.number(),
  users: z.array(z.string()),
  hasReacted: z.boolean().optional(),
});
export type ReactionSummary = z.infer<typeof ReactionSummarySchema>;

export const MessageDtoSchema = z.object({
  id: z.string(),
  conversationId: z.string().optional(),
  circleId: z.string().optional(),
  senderId: z.string(),
  clientMessageId: z.string(),
  content: z.string(),
  attachmentUrl: z.string().nullable().optional(),
  attachmentName: z.string().nullable().optional(),
  attachmentSize: z.number().nullable().optional(),
  attachmentMime: z.string().nullable().optional(),
  status: MessageStatusEnum,
  replyToId: z.string().nullable().optional(),
  replySnippet: z.object({
    senderName: z.string(),
    content: z.string(),
  }).nullable().optional(),
  isEdited: z.boolean().nullable().optional(),
  editedAt: z.number().nullable().optional(),
  isDeleted: z.boolean().nullable().optional(),
  deletedAt: z.number().nullable().optional(),
  isSilent: z.boolean().nullable().optional(),
  isPinned: z.boolean().nullable().optional(),
  voiceDuration: z.number().nullable().optional(),
  pollId: z.string().nullable().optional(),
  reactions: z.array(ReactionSummarySchema).optional(),
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

export const QUIET_EMOJIS = ['👍', '❤️', '🙏', '💡', '✅'] as const;
export const QuietEmojiEnum = z.enum(['👍', '❤️', '🙏', '💡', '✅']);
export type QuietEmoji = z.infer<typeof QuietEmojiEnum>;

export const CreateCircleSchema = z.object({
  name: z.string().trim().min(1, 'Circle name cannot be empty').max(50, 'Circle name cannot exceed 50 characters'),
  description: z.string().max(200).optional(),
  avatarUrl: z.string().url().optional(),
  maxMembers: z.number().int().min(2, 'Circle must have at least 2 members').max(25, 'Circle cannot exceed 25 members').default(25),
});
export type CreateCircleInput = z.infer<typeof CreateCircleSchema>;

export const CreatePollSchema = z.object({
  question: z.string().trim().min(1, 'Poll question cannot be empty').max(200),
  options: z.array(z.string().trim().min(1, 'Option cannot be empty')).min(2, 'Poll must have at least 2 options').max(10, 'Poll can have at most 10 options'),
});
export type CreatePollInput = z.infer<typeof CreatePollSchema>;

export const CastVoteSchema = z.object({
  pollId: z.string().min(1),
  optionIndex: z.number().int().nonnegative(),
});
export type CastVoteInput = z.infer<typeof CastVoteSchema>;
