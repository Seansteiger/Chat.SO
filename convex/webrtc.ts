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
        await ctx.db.patch(call._id, {
          state: "TERMINATED",
          endedReason: "missed",
          updatedAt: Date.now(),
        });
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
    const call = await ctx.db.get(args.callId);
    if (!call || call.state === "TERMINATED" || call.state === "REJECTED") return;

    await ctx.db.patch(args.callId, {
      state: "CONNECTED",
      connectedAt: call.connectedAt || Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const rejectCall = mutation({
  args: {
    callId: v.id("calls"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const call = await ctx.db.get(args.callId);
    if (!call || call.state === "TERMINATED" || call.state === "REJECTED") return;

    await ctx.db.patch(args.callId, {
      state: "REJECTED",
      duration: 0,
      endedReason: args.reason || "declined",
      updatedAt: Date.now(),
    });
  },
});

export const endCall = mutation({
  args: {
    callId: v.id("calls"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const call = await ctx.db.get(args.callId);
    if (!call || call.state === "TERMINATED" || call.state === "REJECTED") return;

    const now = Date.now();
    let duration = 0;
    if (call.connectedAt) {
      duration = Math.max(1, Math.round((now - call.connectedAt) / 1000));
    }

    await ctx.db.patch(args.callId, {
      state: "TERMINATED",
      duration,
      endedReason: args.reason || (call.connectedAt ? "completed" : "missed"),
      updatedAt: now,
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

    const now = Date.now();
    // Filter active calls, discarding timed-out calls
    const activeCalls = calls
      .filter((c) => {
        if (c.state === "TERMINATED" || c.state === "REJECTED") return false;
        // Expire ringing calls after 45 seconds
        if (c.state === "RINGING" && now - c.createdAt > 45 * 1000) return false;
        // Expire stuck negotiating calls after 30 seconds
        if (c.state === "NEGOTIATING" && now - c.updatedAt > 30 * 1000) return false;
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    return activeCalls[0] || null;
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

export const getCallLogs = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.userId) return [];

    const callerCalls = await ctx.db
      .query("calls")
      .withIndex("by_caller", (q) => q.eq("callerId", args.userId!))
      .order("desc")
      .take(40);

    const receiverCalls = await ctx.db
      .query("calls")
      .withIndex("by_receiver", (q) => q.eq("receiverId", args.userId!))
      .order("desc")
      .take(40);

    const merged = [...callerCalls, ...receiverCalls]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 40);

    return await Promise.all(
      merged.map(async (call) => {
        const isCaller = call.callerId === args.userId;
        const peerId = isCaller ? call.receiverId : call.callerId;
        const peer = await ctx.db.get(peerId);

        let status: "completed" | "missed" | "declined" | "ongoing" = "completed";
        if (call.state === "CONNECTED" || call.state === "NEGOTIATING" || call.state === "RINGING") {
          status = "ongoing";
        } else if (call.state === "REJECTED") {
          status = "declined";
        } else if (!call.connectedAt && (!call.duration || call.duration === 0)) {
          status = "missed";
        }

        return {
          id: call._id,
          direction: isCaller ? ("outgoing" as const) : ("incoming" as const),
          isVideo: call.isVideo,
          status,
          duration: call.duration || 0,
          createdAt: call.createdAt,
          peer: peer
            ? {
                id: peer._id,
                username: peer.username,
                displayName: peer.displayName,
                avatarUrl: peer.avatarUrl || null,
                status: peer.status,
              }
            : {
                id: peerId,
                username: "user",
                displayName: isCaller ? "User" : call.callerName,
                avatarUrl: call.callerAvatar || null,
                status: "OFFLINE" as const,
              },
        };
      })
    );
  },
});
