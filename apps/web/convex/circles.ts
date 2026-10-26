import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createCircle = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    createdById: v.id("users"),
    maxMembers: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cleanName = args.name.trim();
    if (!cleanName) throw new Error("Circle name cannot be empty");

    // Intimate group rule: max 25 members
    const maxMembers = Math.min(25, Math.max(2, args.maxMembers || 25));

    const circleId = await ctx.db.insert("circles", {
      name: cleanName,
      description: args.description?.trim(),
      avatarUrl: args.avatarUrl,
      createdById: args.createdById,
      maxMembers,
      lastMessageAt: Date.now(),
      createdAt: Date.now(),
    });

    // Add creator as ADMIN
    await ctx.db.insert("circleMembers", {
      circleId,
      userId: args.createdById,
      role: "ADMIN",
      joinedAt: Date.now(),
    });

    return await ctx.db.get(circleId);
  },
});

export const listMyCircles = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.userId) return [];

    const memberships = await ctx.db
      .query("circleMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId!))
      .collect();

    const circles = [];
    for (const m of memberships) {
      const circle = await ctx.db.get(m.circleId);
      if (circle) {
        // Count current members
        const memberCount = (
          await ctx.db
            .query("circleMembers")
            .withIndex("by_circle", (q) => q.eq("circleId", circle._id))
            .collect()
        ).length;

        // Fetch last message
        const lastMsg = await ctx.db
          .query("circleMessages")
          .withIndex("by_circle", (q) => q.eq("circleId", circle._id))
          .order("desc")
          .first();

        circles.push({
          ...circle,
          role: m.role,
          memberCount,
          lastMessage: lastMsg
            ? {
                content: lastMsg.content,
                createdAt: lastMsg.createdAt,
                senderId: lastMsg.senderId,
              }
            : null,
        });
      }
    }

    circles.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    return circles;
  },
});

export const getCircleDetails = query({
  args: {
    circleId: v.optional(v.id("circles")),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.circleId) return null;
    const circle = await ctx.db.get(args.circleId);
    if (!circle) return null;

    const memberDocs = await ctx.db
      .query("circleMembers")
      .withIndex("by_circle", (q) => q.eq("circleId", args.circleId!))
      .collect();

    const members = [];
    let isMember = false;
    let isAdmin = false;

    for (const m of memberDocs) {
      const u = await ctx.db.get(m.userId);
      if (u) {
        if (args.currentUserId && u._id === args.currentUserId) {
          isMember = true;
          if (m.role === "ADMIN") isAdmin = true;
        }
        members.push({
          id: u._id,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          status: u.status,
          role: m.role,
          joinedAt: m.joinedAt,
        });
      }
    }

    return {
      ...circle,
      members,
      memberCount: members.length,
      isMember,
      isAdmin,
    };
  },
});

export const updateCircleTopic = mutation({
  args: {
    circleId: v.id("circles"),
    userId: v.id("users"),
    pinnedTopic: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify membership
    const member = await ctx.db
      .query("circleMembers")
      .withIndex("by_circle_user", (q) =>
        q.eq("circleId", args.circleId).eq("userId", args.userId)
      )
      .first();

    if (!member) throw new Error("Must be a circle member to update the topic");

    await ctx.db.patch(args.circleId, {
      pinnedTopic: args.pinnedTopic.trim(),
    });

    return await ctx.db.get(args.circleId);
  },
});

export const addCircleMember = mutation({
  args: {
    circleId: v.id("circles"),
    adminId: v.id("users"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const circle = await ctx.db.get(args.circleId);
    if (!circle) throw new Error("Circle not found");

    // Verify admin privileges
    const adminMember = await ctx.db
      .query("circleMembers")
      .withIndex("by_circle_user", (q) =>
        q.eq("circleId", args.circleId).eq("userId", args.adminId)
      )
      .first();

    if (!adminMember || adminMember.role !== "ADMIN") {
      throw new Error("Only admins can add members to the circle");
    }

    // Check capacity
    const currentMembers = await ctx.db
      .query("circleMembers")
      .withIndex("by_circle", (q) => q.eq("circleId", args.circleId))
      .collect();

    if (currentMembers.length >= circle.maxMembers) {
      throw new Error(`This circle has reached its intimate limit of ${circle.maxMembers} members`);
    }

    const existing = await ctx.db
      .query("circleMembers")
      .withIndex("by_circle_user", (q) =>
        q.eq("circleId", args.circleId).eq("userId", args.targetUserId)
      )
      .first();

    if (existing) {
      throw new Error("User is already in this circle");
    }

    await ctx.db.insert("circleMembers", {
      circleId: args.circleId,
      userId: args.targetUserId,
      role: "MEMBER",
      joinedAt: Date.now(),
    });

    return { success: true };
  },
});

export const removeCircleMember = mutation({
  args: {
    circleId: v.id("circles"),
    adminId: v.id("users"),
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("circleMembers")
      .withIndex("by_circle_user", (q) =>
        q.eq("circleId", args.circleId).eq("userId", args.adminId)
      )
      .first();

    if (!admin || admin.role !== "ADMIN") {
      throw new Error("Only circle admins can remove members");
    }

    const target = await ctx.db
      .query("circleMembers")
      .withIndex("by_circle_user", (q) =>
        q.eq("circleId", args.circleId).eq("userId", args.targetUserId)
      )
      .first();

    if (target) {
      await ctx.db.delete(target._id);
    }

    return { success: true };
  },
});

export const leaveCircle = mutation({
  args: {
    circleId: v.id("circles"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("circleMembers")
      .withIndex("by_circle_user", (q) =>
        q.eq("circleId", args.circleId).eq("userId", args.userId)
      )
      .first();

    if (member) {
      await ctx.db.delete(member._id);

      // If leaving member was ADMIN, promote next member to ADMIN so circle is not orphaned
      if (member.role === "ADMIN") {
        const nextMember = await ctx.db
          .query("circleMembers")
          .withIndex("by_circle", (q) => q.eq("circleId", args.circleId))
          .first();
        if (nextMember) {
          await ctx.db.patch(nextMember._id, { role: "ADMIN" });
        }
      }
    }

    return { success: true };
  },
});

export const sendCircleMessage = mutation({
  args: {
    circleId: v.id("circles"),
    senderId: v.id("users"),
    clientMessageId: v.string(),
    content: v.string(),
    attachmentUrl: v.optional(v.string()),
    attachmentName: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    attachmentMime: v.optional(v.string()),
    replyToId: v.optional(v.id("circleMessages")),
    isSilent: v.optional(v.boolean()),
    voiceDuration: v.optional(v.number()),
    pollId: v.optional(v.id("polls")),
  },
  handler: async (ctx, args) => {
    // Verify membership
    const member = await ctx.db
      .query("circleMembers")
      .withIndex("by_circle_user", (q) =>
        q.eq("circleId", args.circleId).eq("userId", args.senderId)
      )
      .first();

    if (!member) throw new Error("You must be a circle member to send messages");

    const messageId = await ctx.db.insert("circleMessages", {
      circleId: args.circleId,
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
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.circleId, {
      lastMessageAt: Date.now(),
    });

    return await ctx.db.get(messageId);
  },
});

export const listCircleMessages = query({
  args: {
    circleId: v.optional(v.id("circles")),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.circleId) return [];

    const messages = await ctx.db
      .query("circleMessages")
      .withIndex("by_circle", (q) => q.eq("circleId", args.circleId!))
      .order("asc")
      .collect();

    const enriched = [];
    for (const m of messages) {
      // Sender info
      const sender = await ctx.db.get(m.senderId);

      // Reply snippet
      let replySnippet = null;
      if (m.replyToId) {
        const repliedMsg = await ctx.db.get(m.replyToId);
        if (repliedMsg) {
          const repliedSender = await ctx.db.get(repliedMsg.senderId);
          replySnippet = {
            senderName: repliedSender?.displayName || "User",
            content: repliedMsg.isDeleted
              ? "Deleted message"
              : repliedMsg.content || repliedMsg.attachmentName || "Attachment",
          };
        }
      }

      // Reactions
      const reactionDocs = await ctx.db
        .query("circleReactions")
        .withIndex("by_message", (q) => q.eq("messageId", m._id))
        .collect();

      const reactionMap = new Map<string, { count: number; users: string[]; hasReacted: boolean }>();
      for (const r of reactionDocs) {
        const cur = reactionMap.get(r.emoji) || { count: 0, users: [], hasReacted: false };
        cur.count += 1;
        cur.users.push(r.userId);
        if (args.currentUserId && r.userId === args.currentUserId) cur.hasReacted = true;
        reactionMap.set(r.emoji, cur);
      }

      const reactions = Array.from(reactionMap.entries()).map(([emoji, data]) => ({
        emoji,
        count: data.count,
        users: data.users,
        hasReacted: data.hasReacted,
      }));

      enriched.push({
        ...m,
        senderDisplayName: sender?.displayName || "User",
        senderAvatarUrl: sender?.avatarUrl,
        replySnippet,
        reactions,
      });
    }

    return enriched;
  },
});

export const toggleCircleReaction = mutation({
  args: {
    messageId: v.id("circleMessages"),
    circleId: v.id("circles"),
    userId: v.id("users"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("circleReactions")
      .withIndex("by_message_user_emoji", (q) =>
        q.eq("messageId", args.messageId).eq("userId", args.userId).eq("emoji", args.emoji)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { action: "removed", emoji: args.emoji };
    } else {
      await ctx.db.insert("circleReactions", {
        messageId: args.messageId,
        circleId: args.circleId,
        userId: args.userId,
        emoji: args.emoji,
        createdAt: Date.now(),
      });
      return { action: "added", emoji: args.emoji };
    }
  },
});

export const editCircleMessage = mutation({
  args: {
    messageId: v.id("circleMessages"),
    userId: v.id("users"),
    newContent: v.string(),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");
    if (msg.senderId !== args.userId) {
      throw new Error("You can only edit your own messages");
    }

    await ctx.db.patch(args.messageId, {
      content: args.newContent.trim(),
      isEdited: true,
      editedAt: Date.now(),
    });

    return await ctx.db.get(args.messageId);
  },
});

export const deleteCircleMessage = mutation({
  args: {
    messageId: v.id("circleMessages"),
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
    });

    return await ctx.db.get(args.messageId);
  },
});
