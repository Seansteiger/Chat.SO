import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    username: v.string(),
    email: v.string(),
    displayName: v.string(),
    passwordHash: v.string(),
    avatarUrl: v.optional(v.string()),
    status: v.union(v.literal("ONLINE"), v.literal("BUSY"), v.literal("OFFLINE")),
    lastSeenAt: v.number(),
    sessionToken: v.optional(v.string()),
    isEmailVerified: v.optional(v.boolean()),
  })
    .index("by_username", ["username"])
    .index("by_email", ["email"])
    .index("by_sessionToken", ["sessionToken"]),

  verificationCodes: defineTable({
    email: v.string(),
    code: v.string(),
    type: v.union(v.literal("SIGNUP_VERIFICATION"), v.literal("PASSWORD_RESET")),
    expiresAt: v.number(),
    used: v.boolean(),
    pendingData: v.optional(
      v.object({
        username: v.string(),
        displayName: v.string(),
        passwordHash: v.string(),
      })
    ),
  })
    .index("by_email_type", ["email", "type"])
    .index("by_email_code", ["email", "code"]),

  conversations: defineTable({
    participant1: v.id("users"),
    participant2: v.id("users"),
    lastMessageAt: v.number(),
  })
    .index("by_participants", ["participant1", "participant2"])
    .index("by_p1", ["participant1"])
    .index("by_p2", ["participant2"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    clientMessageId: v.string(),
    content: v.string(),
    attachmentUrl: v.optional(v.string()),
    attachmentName: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    attachmentMime: v.optional(v.string()),
    status: v.union(v.literal("SENT"), v.literal("DELIVERED"), v.literal("READ")),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId", "createdAt"])
    .index("by_client_id", ["clientMessageId"]),

  typing: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_user", ["conversationId", "userId"]),

  calls: defineTable({
    callerId: v.id("users"),
    receiverId: v.id("users"),
    callerName: v.string(),
    callerAvatar: v.optional(v.string()),
    isVideo: v.boolean(),
    state: v.union(
      v.literal("CALLING"),
      v.literal("RINGING"),
      v.literal("NEGOTIATING"),
      v.literal("CONNECTED"),
      v.literal("REJECTED"),
      v.literal("TERMINATED")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_receiver_state", ["receiverId", "state"])
    .index("by_caller_state", ["callerId", "state"]),

  callSignals: defineTable({
    callId: v.id("calls"),
    senderId: v.id("users"),
    receiverId: v.id("users"),
    type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice_candidate")),
    data: v.string(),
    createdAt: v.number(),
  }).index("by_call_receiver", ["callId", "receiverId"]),
});
