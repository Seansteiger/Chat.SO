import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getOrCreateConversation = mutation({
  args: {
    userId1: v.id("users"),
    userId2: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check both directions
    const conv1 = await ctx.db
      .query("conversations")
      .withIndex("by_participants", (q) =>
        q.eq("participant1", args.userId1).eq("participant2", args.userId2)
      )
      .first();

    if (conv1) return conv1;

    const conv2 = await ctx.db
      .query("conversations")
      .withIndex("by_participants", (q) =>
        q.eq("participant1", args.userId2).eq("participant2", args.userId1)
      )
      .first();

    if (conv2) return conv2;

    // Create new conversation
    const convId = await ctx.db.insert("conversations", {
      participant1: args.userId1,
      participant2: args.userId2,
      lastMessageAt: Date.now(),
    });

    return await ctx.db.get(convId);
  },
});

export const listMessages = query({
  args: {
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    if (!args.conversationId) return [];
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId!))
      .order("asc")
      .collect();
  },
});

export const getMessagesForUserConversations = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.userId) return [];

    const p1 = await ctx.db
      .query("conversations")
      .withIndex("by_p1", (q) => q.eq("participant1", args.userId!))
      .collect();

    const p2 = await ctx.db
      .query("conversations")
      .withIndex("by_p2", (q) => q.eq("participant2", args.userId!))
      .collect();

    const allConvs = [...p1, ...p2];
    if (allConvs.length === 0) return [];

    allConvs.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

    const msgsList = [];
    for (const c of allConvs.slice(0, 15)) {
      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
        .order("desc")
        .take(30);
      msgsList.push(...msgs);
    }

    return msgsList;
  },
});

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    clientMessageId: v.string(),
    content: v.string(),
    attachmentUrl: v.optional(v.string()),
    attachmentName: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    attachmentMime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Strict 50MB check if attachment is provided
    if (args.attachmentSize && args.attachmentSize > 52428800) {
      throw new Error("File attachment exceeds the strict 50MB limit");
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: args.senderId,
      clientMessageId: args.clientMessageId,
      content: args.content,
      attachmentUrl: args.attachmentUrl,
      attachmentName: args.attachmentName,
      attachmentSize: args.attachmentSize,
      attachmentMime: args.attachmentMime,
      status: "DELIVERED",
      createdAt: Date.now(),
    });

    // Update conversation timestamp
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: Date.now(),
    });

    // Clear typing indicator for this sender
    const existingTyping = await ctx.db
      .query("typing")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", args.senderId)
      )
      .first();

    if (existingTyping) {
      await ctx.db.delete(existingTyping._id);
    }

    return await ctx.db.get(messageId);
  },
});

export const markAsRead = mutation({
  args: {
    conversationId: v.id("conversations"),
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Find unread messages not sent by current user
    const unreadMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) =>
        q.and(
          q.neq(q.field("senderId"), args.currentUserId),
          q.neq(q.field("status"), "READ")
        )
      )
      .collect();

    for (const msg of unreadMessages) {
      await ctx.db.patch(msg._id, { status: "READ" });
    }
  },
});

export const setTyping = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("typing")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", args.userId)
      )
      .first();

    if (args.isTyping) {
      if (existing) {
        await ctx.db.patch(existing._id, { updatedAt: Date.now() });
      } else {
        await ctx.db.insert("typing", {
          conversationId: args.conversationId,
          userId: args.userId,
          updatedAt: Date.now(),
        });
      }
    } else {
      if (existing) {
        await ctx.db.delete(existing._id);
      }
    }
  },
});

export const getTypingUsers = query({
  args: {
    conversationId: v.optional(v.id("conversations")),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.conversationId) return [];
    const twoSecondsAgo = Date.now() - 2500;
    const typingRows = await ctx.db
      .query("typing")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId!))
      .filter((q) => q.gt(q.field("updatedAt"), twoSecondsAgo))
      .collect();

    return typingRows
      .filter((r) => r.userId !== args.currentUserId)
      .map((r) => r.userId);
  },
});
