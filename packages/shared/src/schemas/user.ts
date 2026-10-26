import { z } from 'zod';

export const UserStatusEnum = z.enum([
  'ONLINE',
  'BUSY',
  'OFFLINE',
  'LOW_BATTERY',
  'DEEP_FOCUS',
]);
export type UserStatus = z.infer<typeof UserStatusEnum>;

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().max(1000).nullable().optional(),
  status: UserStatusEnum.optional(),
  phoneNumber: z.string().max(30).nullable().optional(),
  bio: z.string().max(250).optional(),
  sendReadReceipts: z.boolean().optional(),
  sendTypingIndicators: z.boolean().optional(),
  allowCalls: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const UserProfileSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().email(),
  phoneNumber: z.string().nullable().optional(),
  displayName: z.string(),
  avatarUrl: z.string().nullable().optional(),
  status: UserStatusEnum,
  bio: z.string().nullable().optional(),
  sendReadReceipts: z.boolean().optional(),
  sendTypingIndicators: z.boolean().optional(),
  allowCalls: z.boolean().optional(),
  lastSeenAt: z.string().or(z.date()),
  createdAt: z.string().or(z.date()),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
