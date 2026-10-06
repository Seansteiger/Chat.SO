import { z } from 'zod';

export const CallStateEnum = z.enum([
  'IDLE',
  'CALLING',
  'RINGING',
  'NEGOTIATING',
  'CONNECTED',
  'TERMINATED',
]);

export type CallState = z.infer<typeof CallStateEnum>;

export const CallInitiatePayloadSchema = z.object({
  recipientId: z.string().uuid(),
  isVideo: z.boolean().default(true),
});

export type CallInitiatePayload = z.infer<typeof CallInitiatePayloadSchema>;

export const CallIncomingPayloadSchema = z.object({
  callerId: z.string().uuid(),
  callerName: z.string(),
  callerAvatar: z.string().nullable().optional(),
  isVideo: z.boolean(),
});

export type CallIncomingPayload = z.infer<typeof CallIncomingPayloadSchema>;

export const CallAcceptPayloadSchema = z.object({
  callerId: z.string().uuid(),
});

export type CallAcceptPayload = z.infer<typeof CallAcceptPayloadSchema>;

export const CallRejectPayloadSchema = z.object({
  callerId: z.string().uuid(),
  reason: z.string().optional(),
});

export type CallRejectPayload = z.infer<typeof CallRejectPayloadSchema>;

export const CallEndPayloadSchema = z.object({
  peerId: z.string().uuid(),
});

export type CallEndPayload = z.infer<typeof CallEndPayloadSchema>;

export const CallOfferPayloadSchema = z.object({
  recipientId: z.string().uuid(),
  sdp: z.object({
    type: z.literal('offer'),
    sdp: z.string(),
  }),
});

export type CallOfferPayload = z.infer<typeof CallOfferPayloadSchema>;

export const CallAnswerPayloadSchema = z.object({
  callerId: z.string().uuid(),
  sdp: z.object({
    type: z.literal('answer'),
    sdp: z.string(),
  }),
});

export type CallAnswerPayload = z.infer<typeof CallAnswerPayloadSchema>;

export const CallIceCandidatePayloadSchema = z.object({
  targetId: z.string().uuid(),
  candidate: z.object({
    candidate: z.string(),
    sdpMid: z.string().nullable().optional(),
    sdpMLineIndex: z.number().nullable().optional(),
    usernameFragment: z.string().nullable().optional(),
  }),
});

export type CallIceCandidatePayload = z.infer<typeof CallIceCandidatePayloadSchema>;
