import { z } from 'zod';

export const UserStatusEnum = z.enum(['ONLINE', 'BUSY', 'OFFLINE']);
export type UserStatus = z.infer<typeof UserStatusEnum>;

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().max(1000).nullable().optional(),
  status: UserStatusEnum.optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  avatarUrl: z.string().nullable().optional(),
  status: UserStatusEnum,
  lastSeenAt: z.string().or(z.date()),
  createdAt: z.string().or(z.date()),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
