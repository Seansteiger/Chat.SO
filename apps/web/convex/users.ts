import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";

// Simple portable hash helper for browser/convex runtime
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "_chatso_salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const register = mutation({
  args: {
    username: v.string(),
    email: v.string(),
    password: v.string(),
    displayName: v.string(),
    deviceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanUsername = args.username.trim().toLowerCase();
    const cleanEmail = args.email.trim().toLowerCase();

    // Check existing username
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .first();

    if (existingUser) {
      throw new Error("Username is already taken");
    }

    // Check existing email
    const existingEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();

    if (existingEmail) {
      throw new Error("Email is already registered");
    }

    const passwordHash = await hashPassword(args.password);
    const sessionToken = "tok_" + crypto.randomUUID();

    const userId = await ctx.db.insert("users", {
      username: cleanUsername,
      email: cleanEmail,
      displayName: args.displayName.trim() || cleanUsername,
      passwordHash,
      status: "ONLINE",
      sendReadReceipts: true,
      sendTypingIndicators: true,
      allowCalls: true,
      lastSeenAt: Date.now(),
      sessionToken,
    });

    // Multi-device session support: record this active session
    await ctx.db.insert("sessions", {
      userId,
      token: sessionToken,
      deviceName: args.deviceName || "Desktop / Browser",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    const user = await ctx.db.get(userId);
    return { user, sessionToken };
  },
});

export const login = mutation({
  args: {
    usernameOrEmail: v.string(),
    password: v.string(),
    deviceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const queryStr = args.usernameOrEmail.trim().toLowerCase();
    const passwordHash = await hashPassword(args.password);

    // Try username first
    let user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", queryStr))
      .first();

    // Try email if not found
    if (!user) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", queryStr))
        .first();
    }

    if (!user || user.passwordHash !== passwordHash) {
      throw new Error("Invalid username/email or password");
    }

    const sessionToken = "tok_" + crypto.randomUUID();

    // Multi-device session support: do NOT invalidate other devices!
    await ctx.db.insert("sessions", {
      userId: user._id,
      token: sessionToken,
      deviceName: args.deviceName || "Web Client",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    // Also update legacy user pointer
    await ctx.db.patch(user._id, {
      status: "ONLINE",
      lastSeenAt: Date.now(),
      sessionToken,
    });

    const updatedUser = await ctx.db.get(user._id);
    return { user: updatedUser, sessionToken };
  },
});

export const getMe = query({
  args: { sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.sessionToken) return null;

    // 1. Try sessions table first (multi-device)
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken!))
      .first();

    if (session) {
      return await ctx.db.get(session.userId);
    }

    // If token starts with "tok_", it corresponds to a modern session that was revoked
    if (args.sessionToken.startsWith("tok_")) {
      return null;
    }

    // 2. Fallback to user by sessionToken (legacy single-device)
    const user = await ctx.db
      .query("users")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .first();
    return user;
  },
});

export const logout = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
      .first();

    if (session) {
      await ctx.db.delete(session._id);
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .first();
    if (user) {
      await ctx.db.patch(user._id, { sessionToken: undefined });
    }
  },
});

export const listActiveSessions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const revokeSession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (session) {
      const user = await ctx.db.get(session.userId);
      if (user && user.sessionToken === session.token) {
        await ctx.db.patch(user._id, { sessionToken: undefined });
      }
      await ctx.db.delete(args.sessionId);
    }
  },
});

// Helper: resolve effective presence dynamically
const PRESENCE_TTL_MS = 60 * 1000; // 60 seconds without heartbeat marks status as OFFLINE

function resolveUserPresence(user: any): any {
  if (!user) return user;
  const now = Date.now();
  const lastSeen = user.lastSeenAt || 0;
  if (user.status !== "OFFLINE" && now - lastSeen > PRESENCE_TTL_MS) {
    return { ...user, status: "OFFLINE" };
  }
  return user;
}

export const listUsers = query({
  args: { currentUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").collect();
    const resolved = users.map(resolveUserPresence);
    if (!args.currentUserId) return resolved;
    return resolved.filter((u) => u._id !== args.currentUserId);
  },
});

export const listContactedUsers = query({
  args: { currentUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (!args.currentUserId) return [];

    // 1. Get conversations where current user is participant1 or participant2
    const p1 = await ctx.db
      .query("conversations")
      .withIndex("by_p1", (q) => q.eq("participant1", args.currentUserId!))
      .collect();

    const p2 = await ctx.db
      .query("conversations")
      .withIndex("by_p2", (q) => q.eq("participant2", args.currentUserId!))
      .collect();

    // 2. Get calls where current user is caller or receiver
    const c1 = await ctx.db
      .query("calls")
      .withIndex("by_caller", (q) => q.eq("callerId", args.currentUserId!))
      .collect();

    const c2 = await ctx.db
      .query("calls")
      .withIndex("by_receiver", (q) => q.eq("receiverId", args.currentUserId!))
      .collect();

    const contactMap = new Map<string, number>();

    const convMap = new Map<string, any>();
    for (const conv of [...p1, ...p2]) {
      const otherId = conv.participant1 === args.currentUserId ? conv.participant2 : conv.participant1;
      const prev = contactMap.get(otherId) || 0;
      contactMap.set(otherId, Math.max(prev, conv.lastMessageAt || 0));
      convMap.set(otherId, conv);
    }

    for (const call of [...c1, ...c2]) {
      const otherId = call.callerId === args.currentUserId ? call.receiverId : call.callerId;
      const prev = contactMap.get(otherId) || 0;
      contactMap.set(otherId, Math.max(prev, call.createdAt || 0));
    }

    const contactedUserIds = Array.from(contactMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id as any);

    const users = [];
    for (const id of contactedUserIds) {
      if (args.currentUserId && id === args.currentUserId) continue;
      const u = await ctx.db.get(id);
      if (u) {
        const resolved = resolveUserPresence(u);
        users.push(resolved);
      }
    }

    return users;
  },
});

export const searchUsers = query({
  args: {
    query: v.string(),
    currentUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const raw = args.query.trim();
    if (!raw || raw.length < 2) return [];

    const lower = raw.toLowerCase();
    const cleanUsername = lower.startsWith("@") ? lower.slice(1) : lower;
    const cleanDigits = raw.replace(/\D/g, "");

    const allUsers = await ctx.db.query("users").take(200);
    const matches: Array<{ user: any; score: number }> = [];

    for (const rawUser of allUsers) {
      if (args.currentUserId && rawUser._id === args.currentUserId) continue;
      const user = resolveUserPresence(rawUser);

      let matched = false;
      let score = 0;

      const uName = (user.username || "").toLowerCase();
      const dName = (user.displayName || "").toLowerCase();
      const email = (user.email || "").toLowerCase();
      const phone = user.phoneNumber || "";
      const phoneDigits = phone.replace(/\D/g, "");

      // 1. Phone number match
      if (phone && cleanDigits.length >= 4) {
        if (phoneDigits === cleanDigits) {
          matched = true;
          score = Math.max(score, 100);
        } else if (phoneDigits.includes(cleanDigits) || cleanDigits.includes(phoneDigits)) {
          matched = true;
          score = Math.max(score, 80);
        }
      }
      if (phone && phone.toLowerCase().includes(lower)) {
        matched = true;
        score = Math.max(score, 70);
      }

      // 2. Email match
      if (email === lower) {
        matched = true;
        score = Math.max(score, 100);
      } else if (email.startsWith(lower)) {
        matched = true;
        score = Math.max(score, 90);
      } else if (email.includes(lower)) {
        matched = true;
        score = Math.max(score, 60);
      }

      // 3. Username match
      if (uName === cleanUsername) {
        matched = true;
        score = Math.max(score, 100);
      } else if (uName.startsWith(cleanUsername)) {
        matched = true;
        score = Math.max(score, 85);
      } else if (uName.includes(cleanUsername)) {
        matched = true;
        score = Math.max(score, 50);
      }

      // 4. Display name match
      if (dName === lower) {
        matched = true;
        score = Math.max(score, 75);
      } else if (dName.includes(lower)) {
        matched = true;
        score = Math.max(score, 40);
      }

      if (matched) {
        matches.push({ user, score });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, 15).map((m) => m.user);
  },
});

export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("ONLINE"),
        v.literal("BUSY"),
        v.literal("OFFLINE"),
        v.literal("LOW_BATTERY"),
        v.literal("DEEP_FOCUS")
      )
    ),
    phoneNumber: v.optional(v.string()),
    bio: v.optional(v.string()),
    sendReadReceipts: v.optional(v.boolean()),
    sendTypingIndicators: v.optional(v.boolean()),
    allowCalls: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const patch: any = { lastSeenAt: Date.now() };
    if (args.displayName !== undefined) patch.displayName = args.displayName;
    if (args.avatarUrl !== undefined) patch.avatarUrl = args.avatarUrl;
    if (args.status !== undefined) patch.status = args.status;
    if (args.phoneNumber !== undefined) {
      patch.phoneNumber = args.phoneNumber ? args.phoneNumber.trim() : undefined;
    }
    if (args.bio !== undefined) patch.bio = args.bio;
    if (args.sendReadReceipts !== undefined) patch.sendReadReceipts = args.sendReadReceipts;
    if (args.sendTypingIndicators !== undefined) patch.sendTypingIndicators = args.sendTypingIndicators;
    if (args.allowCalls !== undefined) patch.allowCalls = args.allowCalls;

    await ctx.db.patch(args.userId, patch);
    return await ctx.db.get(args.userId);
  },
});

export const setPresence = mutation({
  args: {
    userId: v.id("users"),
    status: v.union(
      v.literal("ONLINE"),
      v.literal("BUSY"),
      v.literal("OFFLINE"),
      v.literal("LOW_BATTERY"),
      v.literal("DEEP_FOCUS")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      status: args.status,
      lastSeenAt: Date.now(),
    });
  },
});

export const heartbeat = mutation({
  args: {
    userId: v.id("users"),
    status: v.optional(
      v.union(
        v.literal("ONLINE"),
        v.literal("BUSY"),
        v.literal("OFFLINE"),
        v.literal("LOW_BATTERY"),
        v.literal("DEEP_FOCUS")
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return;
    const patch: any = { lastSeenAt: Date.now() };
    if (args.status && args.status !== "OFFLINE") {
      patch.status = args.status;
    } else if (user.status === "OFFLINE") {
      patch.status = "ONLINE";
    }
    await ctx.db.patch(args.userId, patch);
  },
});

export const getUserInternal = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});
