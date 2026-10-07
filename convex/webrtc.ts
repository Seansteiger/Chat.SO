import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const initiateCall = mutation({
  args: {
    callerId: v.id("users"),
    receiverId: v.id("users"),
    callerName: v.string(),
    callerAvatar: v.optional(v.union(v.string(), v.null())),
    isVideo: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (args.callerId === args.receiverId) {
      throw new Error("You cannot call yourself.");
    }

    // Terminate any existing active calls for caller or receiver
    const existingCalls = await ctx.db
      .query("calls")
      .filter((q) =>
        q.or(
          q.eq(q.field("callerId"), args.callerId),
          q.eq(q.field("receiverId"), args.callerId),
          q.eq(q.field("callerId"), args.receiverId),
          q.eq(q.field("receiverId"), args.receiverId)
        )
      )
      .collect();

    for (const call of existingCalls) {
      if (call.state !== "TERMINATED" && call.state !== "REJECTED") {
        await ctx.db.patch(call._id, { state: "TERMINATED", updatedAt: Date.now() });
      }
    }

    const callId = await ctx.db.insert("calls", {
      callerId: args.callerId,
      receiverId: args.receiverId,
      callerName: args.callerName,
      callerAvatar: args.callerAvatar || undefined,
      isVideo: args.isVideo,
      state: "RINGING",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return await ctx.db.get(callId);
  },
});

export const acceptCall = mutation({
  args: {
    callId: v.id("calls"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.callId, {
      state: "NEGOTIATING",
      updatedAt: Date.now(),
    });
    return await ctx.db.get(args.callId);
  },
});

export const setConnected = mutation({
  args: {
    callId: v.id("calls"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.callId, {
      state: "CONNECTED",
      updatedAt: Date.now(),
    });
  },
});

export const rejectCall = mutation({
  args: {
    callId: v.id("calls"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.callId, {
      state: "REJECTED",
      updatedAt: Date.now(),
    });
  },
});

export const endCall = mutation({
  args: {
    callId: v.id("calls"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.callId, {
      state: "TERMINATED",
      updatedAt: Date.now(),
    });
  },
});

export const sendSignal = mutation({
  args: {
    callId: v.id("calls"),
    senderId: v.id("users"),
    receiverId: v.id("users"),
    type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice_candidate")),
    data: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("callSignals", {
      callId: args.callId,
      senderId: args.senderId,
      receiverId: args.receiverId,
      type: args.type,
      data: args.data,
      createdAt: Date.now(),
    });
  },
});

export const getActiveCall = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.userId) return null;

    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const calls = await ctx.db
      .query("calls")
      .filter((q) =>
        q.and(
          q.gt(q.field("updatedAt"), fiveMinutesAgo),
          q.or(
            q.eq(q.field("callerId"), args.userId!),
            q.eq(q.field("receiverId"), args.userId!)
          )
        )
      )
      .collect();

    // Find first active call
    const active = calls.find(
      (c) => c.state !== "TERMINATED" && c.state !== "REJECTED"
    );
    return active || null;
  },
});

export const getCallSignals = query({
  args: {
    callId: v.optional(v.id("calls")),
    receiverId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.callId || !args.receiverId) return [];

    return await ctx.db
      .query("callSignals")
      .withIndex("by_call_receiver", (q) =>
        q.eq("callId", args.callId!).eq("receiverId", args.receiverId!)
      )
      .collect();
  },
});
