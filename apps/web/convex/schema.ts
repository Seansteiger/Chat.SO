import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    username: v.string(),
    email: v.string(),
    phoneNumber: v.optional(v.string()),
    displayName: v.string(),
    passwordHash: v.string(),
    avatarUrl: v.optional(v.string()),
    status: v.union(
      v.literal("ONLINE"),
      v.literal("BUSY"),
      v.literal("OFFLINE"),
      v.literal("LOW_BATTERY"),
      v.literal("DEEP_FOCUS")
    ),
    bio: v.optional(v.string()),
    sendReadReceipts: v.optional(v.boolean()),
    sendTypingIndicators: v.optional(v.boolean()),
    allowCalls: v.optional(v.boolean()),
    lastSeenAt: v.number(),
    sessionToken: v.optional(v.string()),
    isEmailVerified: v.optional(v.boolean()),
  })
    .index("by_username", ["username"])
    .index("by_email", ["email"])
    .index("by_phoneNumber", ["phoneNumber"])
    .index("by_sessionToken", ["sessionToken"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    deviceName: v.optional(v.string()),
    createdAt: v.number(),
    lastActiveAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

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
    isSelfVault: v.optional(v.boolean()),
    status: v.optional(v.union(v.literal("ACCEPTED"), v.literal("PENDING"), v.literal("DECLINED"))),
    initiatorId: v.optional(v.id("users")),
    pinnedMessageId: v.optional(v.id("messages")),
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
    replyToId: v.optional(v.id("messages")),
    isEdited: v.optional(v.boolean()),
    editedAt: v.optional(v.number()),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
    isSilent: v.optional(v.boolean()),
    isPinned: v.optional(v.boolean()),
    pinnedAt: v.optional(v.number()),
    voiceDuration: v.optional(v.number()),
    pollId: v.optional(v.id("polls")),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId", "createdAt"])
    .index("by_client_id", ["clientMessageId"]),

  reactions: defineTable({
    messageId: v.id("messages"),
    conversationId: v.optional(v.id("conversations")),
    userId: v.id("users"),
    emoji: v.string(),
    createdAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_message_user_emoji", ["messageId", "userId", "emoji"])
    .index("by_user", ["userId"]),

  savedMessages: defineTable({
    userId: v.id("users"),
    messageId: v.id("messages"),
    conversationId: v.id("conversations"),
    content: v.string(),
    attachmentUrl: v.optional(v.string()),
    attachmentName: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    attachmentMime: v.optional(v.string()),
    senderName: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_message", ["userId", "messageId"]),

  circles: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    createdById: v.id("users"),
    maxMembers: v.number(),
    pinnedTopic: v.optional(v.string()),
    lastMessageAt: v.number(),
    createdAt: v.number(),
  }).index("by_created_by", ["createdById"]),

  circleMembers: defineTable({
    circleId: v.id("circles"),
    userId: v.id("users"),
    role: v.union(v.literal("ADMIN"), v.literal("MEMBER")),
    joinedAt: v.number(),
  })
    .index("by_circle", ["circleId"])
    .index("by_user", ["userId"])
    .index("by_circle_user", ["circleId", "userId"]),

  circleMessages: defineTable({
    circleId: v.id("circles"),
    senderId: v.id("users"),
    clientMessageId: v.string(),
    content: v.string(),
    attachmentUrl: v.optional(v.string()),
    attachmentName: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    attachmentMime: v.optional(v.string()),
    replyToId: v.optional(v.id("circleMessages")),
    isEdited: v.optional(v.boolean()),
    editedAt: v.optional(v.number()),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
    isSilent: v.optional(v.boolean()),
    isPinned: v.optional(v.boolean()),
    voiceDuration: v.optional(v.number()),
    pollId: v.optional(v.id("polls")),
    createdAt: v.number(),
  })
    .index("by_circle", ["circleId", "createdAt"])
    .index("by_client_id", ["clientMessageId"]),

  circleReactions: defineTable({
    messageId: v.id("circleMessages"),
    circleId: v.id("circles"),
    userId: v.id("users"),
    emoji: v.string(),
    createdAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_message_user_emoji", ["messageId", "userId", "emoji"]),

  polls: defineTable({
    circleId: v.optional(v.id("circles")),
    conversationId: v.optional(v.id("conversations")),
    question: v.string(),
    options: v.array(v.string()),
    createdById: v.id("users"),
    isClosed: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_circle", ["circleId"])
    .index("by_conversation", ["conversationId"]),

  pollVotes: defineTable({
    pollId: v.id("polls"),
    userId: v.id("users"),
    optionIndex: v.number(),
    createdAt: v.number(),
  })
    .index("by_poll", ["pollId"])
    .index("by_poll_user", ["pollId", "userId"]),

  typing: defineTable({
    conversationId: v.optional(v.id("conversations")),
    circleId: v.optional(v.id("circles")),
    userId: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_user", ["conversationId", "userId"])
    .index("by_circle", ["circleId"])
    .index("by_circle_user", ["circleId", "userId"]),

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
    connectedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
    endedReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_receiver_state", ["receiverId", "state"])
    .index("by_caller_state", ["callerId", "state"])
    .index("by_caller", ["callerId", "createdAt"])
    .index("by_receiver", ["receiverId", "createdAt"]),

  callSignals: defineTable({
    callId: v.id("calls"),
    senderId: v.id("users"),
    receiverId: v.id("users"),
    type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice_candidate")),
    data: v.string(),
    createdAt: v.number(),
  }).index("by_call_receiver", ["callId", "receiverId"]),

  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    keys: v.object({
      p256dh: v.string(),
      auth: v.string(),
    }),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_endpoint", ["endpoint"]),
});
