import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getOrCreateConversation = mutation({
  args: {
    userId1: v.id("users"),
    userId2: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if this is a personal self-vault conversation
    const isSelfVault = args.userId1 === args.userId2;

    if (isSelfVault) {
      const existingVault = await ctx.db
        .query("conversations")
        .withIndex("by_participants", (q) =>
          q.eq("participant1", args.userId1).eq("participant2", args.userId1)
        )
        .first();

      if (existingVault) return existingVault;

      const vaultId = await ctx.db.insert("conversations", {
        participant1: args.userId1,
        participant2: args.userId1,
        isSelfVault: true,
        status: "ACCEPTED",
        lastMessageAt: Date.now(),
      });
      return await ctx.db.get(vaultId);
    }

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

    // Create new conversation with ACCEPTED status for immediate direct messaging
    const convId = await ctx.db.insert("conversations", {
      participant1: args.userId1,
      participant2: args.userId2,
      initiatorId: args.userId1,
      status: "ACCEPTED",
      lastMessageAt: Date.now(),
    });

    return await ctx.db.get(convId);
  },
});

export const getOrCreatePersonalVault = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existingVault = await ctx.db
      .query("conversations")
      .withIndex("by_participants", (q) =>
        q.eq("participant1", args.userId).eq("participant2", args.userId)
      )
      .first();

    if (existingVault) return existingVault;

    const vaultId = await ctx.db.insert("conversations", {
      participant1: args.userId,
      participant2: args.userId,
      isSelfVault: true,
      status: "ACCEPTED",
      lastMessageAt: Date.now(),
    });
    return await ctx.db.get(vaultId);
  },
});

export const listMessages = query({
  args: {
    conversationId: v.optional(v.id("conversations")),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.conversationId) return [];

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId!))
      .order("asc")
      .collect();

    // Map each message with its reply snippet & reactions
    const enrichedMessages = [];
    for (const msg of messages) {
      // 1. Reply snippet
      let replySnippet = null;
      if (msg.replyToId) {
        const repliedMsg = await ctx.db.get(msg.replyToId);
        if (repliedMsg) {
          const sender = await ctx.db.get(repliedMsg.senderId);
          replySnippet = {
            senderName: sender?.displayName || "User",
            content: repliedMsg.isDeleted
              ? "Deleted message"
              : repliedMsg.content || repliedMsg.attachmentName || "Attachment",
          };
        }
      }

      // 2. Reactions
      const reactionDocs = await ctx.db
        .query("reactions")
        .withIndex("by_message", (q) => q.eq("messageId", msg._id))
        .collect();

      const reactionMap = new Map<string, { count: number; users: string[]; hasReacted: boolean }>();
      for (const r of reactionDocs) {
        const current = reactionMap.get(r.emoji) || { count: 0, users: [], hasReacted: false };
        current.count += 1;
        current.users.push(r.userId);
        if (args.currentUserId && r.userId === args.currentUserId) {
          current.hasReacted = true;
        }
        reactionMap.set(r.emoji, current);
      }

      const reactions = Array.from(reactionMap.entries()).map(([emoji, data]) => ({
        emoji,
        count: data.count,
        users: data.users,
        hasReacted: data.hasReacted,
      }));

      enrichedMessages.push({
        ...msg,
        replySnippet,
        reactions,
      });
    }

    return enrichedMessages;
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
    replyToId: v.optional(v.id("messages")),
    isSilent: v.optional(v.boolean()),
    voiceDuration: v.optional(v.number()),
    pollId: v.optional(v.id("polls")),
  },
  handler: async (ctx, args) => {
    // 1. Strict 50MB check if attachment is provided
    if (args.attachmentSize && args.attachmentSize > 52428800) {
      throw new Error("File attachment exceeds the strict 50MB limit");
    }

    // 2. Strict deduplication: if message with this clientMessageId already exists, return existing record
    if (args.clientMessageId) {
      const existing = await ctx.db
        .query("messages")
        .withIndex("by_client_id", (q) => q.eq("clientMessageId", args.clientMessageId))
        .first();

      if (existing) {
        return existing;
      }
    }

    // 3. Determine real delivery status:
    // If recipient is active (online within 60s), status = "DELIVERED"; otherwise "SENT"
    const conv = await ctx.db.get(args.conversationId);
    let initialStatus: "SENT" | "DELIVERED" = "SENT";
    if (conv) {
      const recipientId = conv.participant1 === args.senderId ? conv.participant2 : conv.participant1;
      if (recipientId === args.senderId) {
        // Self-vault
        initialStatus = "DELIVERED";
      } else {
        const recipient = await ctx.db.get(recipientId);
        const now = Date.now();
        const isOnline = recipient && recipient.status !== "OFFLINE" && (now - (recipient.lastSeenAt || 0) <= 60000);
        initialStatus = isOnline ? "DELIVERED" : "SENT";
      }
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
      replyToId: args.replyToId,
      isSilent: args.isSilent || false,
      voiceDuration: args.voiceDuration,
      pollId: args.pollId,
      status: initialStatus,
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

export const editMessage = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
    newContent: v.string(),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");
    if (msg.senderId !== args.userId) {
      throw new Error("You can only edit your own messages");
    }
    if (msg.isDeleted) {
      throw new Error("Cannot edit a deleted message");
    }

    await ctx.db.patch(args.messageId, {
      content: args.newContent.trim(),
      isEdited: true,
      editedAt: Date.now(),
    });

    return await ctx.db.get(args.messageId);
  },
});

export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");
    if (msg.senderId !== args.userId) {
      throw new Error("You can only delete your own messages");
    }

    await ctx.db.patch(args.messageId, {
      isDeleted: true,
      deletedAt: Date.now(),
      content: "🚫 This message was deleted",
      attachmentUrl: undefined,
      attachmentName: undefined,
      attachmentSize: undefined,
      attachmentMime: undefined,
    });

    return await ctx.db.get(args.messageId);
  },
});

export const toggleReaction = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_message_user_emoji", (q) =>
        q
          .eq("messageId", args.messageId)
          .eq("userId", args.userId)
          .eq("emoji", args.emoji)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { action: "removed", emoji: args.emoji };
    } else {
      const msg = await ctx.db.get(args.messageId);
      await ctx.db.insert("reactions", {
        messageId: args.messageId,
        conversationId: msg?.conversationId,
        userId: args.userId,
        emoji: args.emoji,
        createdAt: Date.now(),
      });
      return { action: "added", emoji: args.emoji };
    }
  },
});

export const togglePinMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");

    const newPinned = !msg.isPinned;
    await ctx.db.patch(args.messageId, {
      isPinned: newPinned,
      pinnedAt: newPinned ? Date.now() : undefined,
    });

    await ctx.db.patch(args.conversationId, {
      pinnedMessageId: newPinned ? args.messageId : undefined,
    });

    return { isPinned: newPinned };
  },
});

export const getPinnedMessage = query({
  args: {
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    if (!args.conversationId) return null;
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || !conv.pinnedMessageId) return null;

    const msg = await ctx.db.get(conv.pinnedMessageId);
    if (!msg || !msg.isPinned) return null;

    const sender = await ctx.db.get(msg.senderId);
    return {
      ...msg,
      senderDisplayName: sender?.displayName || "User",
    };
  },
});

export const saveMessage = mutation({
  args: {
    userId: v.id("users"),
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("savedMessages")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", args.userId).eq("messageId", args.messageId)
      )
      .first();

    if (existing) return existing;

    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");

    const sender = await ctx.db.get(msg.senderId);

    const savedId = await ctx.db.insert("savedMessages", {
      userId: args.userId,
      messageId: args.messageId,
      conversationId: msg.conversationId,
      content: msg.content,
      attachmentUrl: msg.attachmentUrl,
      attachmentName: msg.attachmentName,
      attachmentSize: msg.attachmentSize,
      attachmentMime: msg.attachmentMime,
      senderName: sender?.displayName || "User",
      createdAt: Date.now(),
    });

    return await ctx.db.get(savedId);
  },
});

export const unsaveMessage = mutation({
  args: {
    userId: v.id("users"),
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("savedMessages")
      .withIndex("by_user_message", (q) =>
        q.eq("userId", args.userId).eq("messageId", args.messageId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { success: true };
    }
    return { success: false };
  },
});

export const listSavedMessages = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.userId) return [];
    return await ctx.db
      .query("savedMessages")
      .withIndex("by_user", (q) => q.eq("userId", args.userId!))
      .order("desc")
      .collect();
  },
});

export const respondToHandshake = mutation({
  args: {
    conversationId: v.id("conversations"),
    currentUserId: v.id("users"),
    action: v.union(v.literal("ACCEPT"), v.literal("DECLINE")),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) throw new Error("Conversation not found");

    const isParticipant =
      conv.participant1 === args.currentUserId || conv.participant2 === args.currentUserId;
    if (!isParticipant) throw new Error("Unauthorized");

    await ctx.db.patch(args.conversationId, {
      status: args.action === "ACCEPT" ? "ACCEPTED" : "DECLINED",
    });

    return await ctx.db.get(args.conversationId);
  },
});

export const listPendingRequests = query({
  args: {
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.currentUserId) return [];

    const p1 = await ctx.db
      .query("conversations")
      .withIndex("by_p1", (q) => q.eq("participant1", args.currentUserId!))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "PENDING"),
          q.neq(q.field("initiatorId"), args.currentUserId!)
        )
      )
      .collect();

    const p2 = await ctx.db
      .query("conversations")
      .withIndex("by_p2", (q) => q.eq("participant2", args.currentUserId!))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "PENDING"),
          q.neq(q.field("initiatorId"), args.currentUserId!)
        )
      )
      .collect();

    const allRequests = [...p1, ...p2];
    const results = [];
    for (const req of allRequests) {
      const otherUserId = req.participant1 === args.currentUserId ? req.participant2 : req.participant1;
      const otherUser = await ctx.db.get(otherUserId);
      const lastMsg = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", req._id))
        .order("desc")
        .first();

      if (otherUser) {
        results.push({
          conversationId: req._id,
          user: otherUser,
          lastMessage: lastMsg,
          createdAt: req.lastMessageAt,
        });
      }
    }

    return results;
  },
});

export const getConversationContext = query({
  args: {
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    if (!args.conversationId) {
      return { media: [], files: [], voice: [], links: [], pinned: [] };
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId!))
      .order("desc")
      .take(200);

    const media: any[] = [];
    const files: any[] = [];
    const voice: any[] = [];
    const links: any[] = [];
    const pinned: any[] = [];

    const urlRegex = /(https?:\/\/[^\s]+)/g;

    for (const m of messages) {
      if (m.isPinned && !m.isDeleted) {
        pinned.push(m);
      }

      if (m.attachmentUrl && !m.isDeleted) {
        const mime = m.attachmentMime || "";
        if (mime.startsWith("image/") || mime.startsWith("video/")) {
          media.push(m);
        } else if (mime.startsWith("audio/") || (m.voiceDuration && m.voiceDuration > 0)) {
          voice.push(m);
        } else if (!mime.startsWith("call/")) {
          files.push(m);
        }
      }

      if (m.content && !m.isDeleted) {
        const matches = m.content.match(urlRegex);
        if (matches) {
          for (const url of matches) {
            links.push({
              messageId: m._id,
              url,
              createdAt: m.createdAt,
            });
          }
        }
      }
    }

    const conv = await ctx.db.get(args.conversationId!);
    if (conv?.pinnedMessageId) {
      const pm = await ctx.db.get(conv.pinnedMessageId);
      if (pm && pm.isPinned && !pm.isDeleted && !pinned.some((p) => p._id === pm._id)) {
        pinned.unshift(pm);
      }
    }

    return { media, files, voice, links, pinned };
  },
});

export const searchMessagesInConversation = query({
  args: {
    conversationId: v.optional(v.id("conversations")),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.conversationId || !args.query.trim()) return [];

    const qLower = args.query.toLowerCase().trim();
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId!))
      .order("asc")
      .collect();

    return messages
      .filter(
        (m) =>
          !m.isDeleted &&
          ((m.content && m.content.toLowerCase().includes(qLower)) ||
            (m.attachmentName && m.attachmentName.toLowerCase().includes(qLower)))
      )
      .map((m) => m._id);
  },
});

export const getUserChatSummaries = query({
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

    // Deduplicate conversations (e.g. self-vault where participant1 == participant2 == userId)
    const seenConvIds = new Set<string>();
    const allConvs = [];
    for (const c of [...p1, ...p2]) {
      if (!seenConvIds.has(c._id)) {
        seenConvIds.add(c._id);
        allConvs.push(c);
      }
    }
    if (allConvs.length === 0) return [];

    allConvs.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

    const summaries = [];
    for (const c of allConvs) {
      const otherUserId = c.participant1 === args.userId ? c.participant2 : c.participant1;

      // Last message
      const lastMsg = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
        .order("desc")
        .first();

      // Count unread messages where sender is not current user and status != 'READ'
      const unreadCount = (
        await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
          .filter((q) =>
            q.and(
              q.neq(q.field("senderId"), args.userId!),
              q.neq(q.field("status"), "READ")
            )
          )
          .collect()
      ).length;

      summaries.push({
        conversationId: c._id,
        isSelfVault: !!c.isSelfVault,
        status: c.status || "ACCEPTED",
        initiatorId: c.initiatorId,
        otherUserId,
        lastMessage: lastMsg
          ? {
              id: lastMsg._id,
              content: lastMsg.content,
              attachmentName: lastMsg.attachmentName,
              createdAt: lastMsg.createdAt,
              senderId: lastMsg.senderId,
              status: lastMsg.status,
            }
          : null,
        unreadCount,
      });
    }

    return summaries;
  },
});

export const markConversationAsRead = mutation({
  args: {
    currentUserId: v.id("users"),
    peerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    // Respect user privacy: if user turned off sendReadReceipts, do not mark as READ
    if (user && user.sendReadReceipts === false) {
      return;
    }

    const conv1 = await ctx.db
      .query("conversations")
      .withIndex("by_participants", (q) =>
        q.eq("participant1", args.currentUserId).eq("participant2", args.peerId)
      )
      .first();

    const conv2 = !conv1
      ? await ctx.db
          .query("conversations")
          .withIndex("by_participants", (q) =>
            q.eq("participant1", args.peerId).eq("participant2", args.currentUserId)
          )
          .first()
      : null;

    const conv = conv1 || conv2;
    if (!conv) return;

    const unreadMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
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
    const user = await ctx.db.get(args.userId);
    // Respect user privacy toggle
    if (user && user.sendTypingIndicators === false) {
      return;
    }

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

export const markAsRead = mutation({
  args: {
    conversationId: v.id("conversations"),
    currentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.currentUserId);
    if (user && user.sendReadReceipts === false) {
      return;
    }

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

export const getMessagesForUserConversations = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const convs1 = await ctx.db
      .query("conversations")
      .withIndex("by_p1", (q) => q.eq("participant1", args.userId))
      .collect();

    const convs2 = await ctx.db
      .query("conversations")
      .withIndex("by_p2", (q) => q.eq("participant2", args.userId))
      .collect();

    const allConvs = [...convs1, ...convs2];
    const uniqueConvIds = Array.from(new Set(allConvs.map((c) => c._id)));

    const messages = [];
    for (const cid of uniqueConvIds) {
      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", cid))
        .order("desc")
        .take(20);
      messages.push(...msgs);
    }

    return messages.sort((a, b) => a.createdAt - b.createdAt);
  },
});

export const markMessagesDelivered = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // When recipient opens app or comes online, update any pending "SENT" messages to "DELIVERED"
    const p1 = await ctx.db
      .query("conversations")
      .withIndex("by_p1", (q) => q.eq("participant1", args.userId))
      .collect();

    const p2 = await ctx.db
      .query("conversations")
      .withIndex("by_p2", (q) => q.eq("participant2", args.userId))
      .collect();

    const seenConvIds = new Set<string>();
    const convIds: any[] = [];
    for (const c of [...p1, ...p2]) {
      if (!seenConvIds.has(c._id)) {
        seenConvIds.add(c._id);
        convIds.push(c._id);
      }
    }

    let updatedCount = 0;
    for (const cid of convIds) {
      const pendingMsgs = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", cid))
        .filter((q) =>
          q.and(
            q.neq(q.field("senderId"), args.userId),
            q.eq(q.field("status"), "SENT")
          )
        )
        .collect();

      for (const m of pendingMsgs) {
        await ctx.db.patch(m._id, { status: "DELIVERED" });
        updatedCount++;
      }
    }

    return { updatedCount };
  },
});
