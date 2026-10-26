import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createPoll = mutation({
  args: {
    question: v.string(),
    options: v.array(v.string()),
    createdById: v.id("users"),
    circleId: v.optional(v.id("circles")),
    conversationId: v.optional(v.id("conversations")),
  },
  handler: async (ctx, args) => {
    const cleanQuestion = args.question.trim();
    if (!cleanQuestion) throw new Error("Poll question cannot be empty");

    const validOptions = args.options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (validOptions.length < 2) {
      throw new Error("Poll must have at least 2 options");
    }

    const pollId = await ctx.db.insert("polls", {
      question: cleanQuestion,
      options: validOptions,
      createdById: args.createdById,
      circleId: args.circleId,
      conversationId: args.conversationId,
      isClosed: false,
      createdAt: Date.now(),
    });

    // Automatically send an inline message into conversation or circle referencing the poll
    if (args.conversationId) {
      await ctx.db.insert("messages", {
        conversationId: args.conversationId,
        senderId: args.createdById,
        clientMessageId: crypto.randomUUID(),
        content: `📊 Poll: ${cleanQuestion}`,
        pollId,
        status: "DELIVERED",
        createdAt: Date.now(),
      });
      await ctx.db.patch(args.conversationId, { lastMessageAt: Date.now() });
    } else if (args.circleId) {
      await ctx.db.insert("circleMessages", {
        circleId: args.circleId,
        senderId: args.createdById,
        clientMessageId: crypto.randomUUID(),
        content: `📊 Poll: ${cleanQuestion}`,
        pollId,
        createdAt: Date.now(),
      });
      await ctx.db.patch(args.circleId, { lastMessageAt: Date.now() });
    }

    return await ctx.db.get(pollId);
  },
});

export const votePoll = mutation({
  args: {
    pollId: v.id("polls"),
    userId: v.id("users"),
    optionIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const poll = await ctx.db.get(args.pollId);
    if (!poll) throw new Error("Poll not found");
    if (poll.isClosed) throw new Error("This poll is closed");

    const existingVote = await ctx.db
      .query("pollVotes")
      .withIndex("by_poll_user", (q) =>
        q.eq("pollId", args.pollId).eq("userId", args.userId)
      )
      .first();

    if (existingVote) {
      if (existingVote.optionIndex === args.optionIndex) {
        // Toggle off
        await ctx.db.delete(existingVote._id);
        return { action: "removed" };
      } else {
        // Change vote
        await ctx.db.patch(existingVote._id, {
          optionIndex: args.optionIndex,
          createdAt: Date.now(),
        });
        return { action: "changed", optionIndex: args.optionIndex };
      }
    } else {
      await ctx.db.insert("pollVotes", {
        pollId: args.pollId,
        userId: args.userId,
        optionIndex: args.optionIndex,
        createdAt: Date.now(),
      });
      return { action: "voted", optionIndex: args.optionIndex };
    }
  },
});

export const getPoll = query({
  args: {
    pollId: v.optional(v.id("polls")),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.pollId) return null;
    const poll = await ctx.db.get(args.pollId);
    if (!poll) return null;

    const votes = await ctx.db
      .query("pollVotes")
      .withIndex("by_poll", (q) => q.eq("pollId", args.pollId!))
      .collect();

    const counts = new Array(poll.options.length).fill(0);
    let userVotedOptionIndex: number | null = null;

    for (const v of votes) {
      if (v.optionIndex >= 0 && v.optionIndex < poll.options.length) {
        counts[v.optionIndex]++;
      }
      if (args.currentUserId && v.userId === args.currentUserId) {
        userVotedOptionIndex = v.optionIndex;
      }
    }

    const totalVotes = votes.length;
    const optionsWithStats = poll.options.map((text, idx) => ({
      text,
      votes: counts[idx],
      percent: totalVotes > 0 ? Math.round((counts[idx] / totalVotes) * 100) : 0,
    }));

    return {
      ...poll,
      options: optionsWithStats,
      totalVotes,
      userVotedOptionIndex,
      hasVoted: userVotedOptionIndex !== null,
    };
  },
});

export const closePoll = mutation({
  args: {
    pollId: v.id("polls"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const poll = await ctx.db.get(args.pollId);
    if (!poll) throw new Error("Poll not found");
    if (poll.createdById !== args.userId) {
      throw new Error("Only the poll creator can close the poll");
    }

    await ctx.db.patch(args.pollId, { isClosed: true });
    return await ctx.db.get(args.pollId);
  },
});
