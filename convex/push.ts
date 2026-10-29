"use node";

import { v } from "convex/values";
import { mutation, query, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
// @ts-ignore
import webpush from "web-push";

// VAPID Configuration for Chat.SO Background Web Push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BPVUCC1-OhzZdFB0je_WHEhPmH49QMzWvrwTyQMxZt3GGCdhdPcgrGm82jMwg91OEjlI3YQpPYzC0t44Cb9dZ3k";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "afcm2fK-cb-VXa90gKDB5QeJdG8tiGCIAH9r05i354Y";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@steigeronline.co.za";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

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

/**
 * Action to dispatch Web Push alerts to a recipient's devices when the app is closed.
 * Respects user preferences:
 * - If status is DEEP_FOCUS, sound alerts are suppressed.
 * - If user disabled allowCalls, calls are not pushed.
 */
export const dispatchPush = internalAction({
  args: {
    targetUserId: v.id("users"),
    title: v.string(),
    body: v.string(),
    type: v.union(v.literal("MESSAGE"), v.literal("CALL")),
    tag: v.optional(v.string()),
    silent: v.optional(v.boolean()),
    callId: v.optional(v.string()),
    callerId: v.optional(v.string()),
    senderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Fetch user to check preferences
    const user: any = await ctx.runQuery(internal.users.getUserInternal, {
      userId: args.targetUserId,
    });

    if (!user) return { sent: 0, reason: "User not found" };

    // Introvert boundary: check allowCalls
    if (args.type === "CALL" && user.allowCalls === false) {
      return { sent: 0, reason: "User has disabled incoming calls" };
    }

    // Check battery / focus mode
    const isQuiet = args.silent || user.status === "DEEP_FOCUS" || user.status === "LOW_BATTERY";

    // 2. Fetch push subscriptions
    const subs: any[] = await ctx.runQuery(internal.push.getSubscriptionsForUser, {
      userId: args.targetUserId,
    });

    if (!subs || subs.length === 0) {
      return { sent: 0, reason: "No push subscriptions registered" };
    }

    const payload = JSON.stringify({
      title: args.title,
      body: args.body,
      type: args.type,
      tag: args.tag || (args.type === "CALL" ? "chatso-call" : `chat-${args.senderId || "general"}`),
      silent: isQuiet,
      callId: args.callId,
      callerId: args.callerId,
      senderId: args.senderId,
      timestamp: Date.now(),
    });

    let sentCount = 0;

    for (const sub of subs) {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSub, payload, {
          TTL: args.type === "CALL" ? 60 : 86400, // Calls expire fast; messages persist
          urgency: args.type === "CALL" ? "high" : "normal",
        });
        sentCount++;
      } catch (err: any) {
        // If subscription is expired or unsubscribed, remove from DB
        if (err.statusCode === 404 || err.statusCode === 410) {
          await ctx.runMutation(internal.push.deleteStaleSubscription, {
            subscriptionId: sub._id,
          });
        } else {
          console.warn("[WebPush] Notification delivery failed for endpoint:", sub.endpoint, err.message);
        }
      }
    }

    return { sent: sentCount };
  },
});
