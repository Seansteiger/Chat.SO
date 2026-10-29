import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";

// VAPID Configuration for Chat.SO Background Web Push
export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BPVUCC1-OhzZdFB0je_WHEhPmH49QMzWvrwTyQMxZt3GGCdhdPcgrGm82jMwg91OEjlI3YQpPYzC0t44Cb9dZ3k";

/**
 * Returns the VAPID Public Key so browsers can create PushSubscriptions
 */
export const getVapidPublicKey = query({
  args: {},
  handler: async () => {
    return VAPID_PUBLIC_KEY;
  },
});

/**
 * Saves or updates a browser PushSubscription for a user
 */
export const saveSubscription = mutation({
  args: {
    userId: v.id("users"),
    endpoint: v.string(),
    keys: v.object({
      p256dh: v.string(),
      auth: v.string(),
    }),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: args.userId,
        keys: args.keys,
        userAgent: args.userAgent,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("pushSubscriptions", {
      userId: args.userId,
      endpoint: args.endpoint,
      keys: args.keys,
      userAgent: args.userAgent,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Removes a push subscription (e.g. on logout or when notifications are revoked)
 */
export const removeSubscription = mutation({
  args: {
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Internal query to fetch active subscriptions for a target user
 */
export const getSubscriptionsForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/**
 * Internal mutation to clean up expired/unregistered endpoints (HTTP 410 / 404)
 */
export const deleteStaleSubscription = internalMutation({
  args: {
    subscriptionId: v.id("pushSubscriptions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.subscriptionId);
  },
});
