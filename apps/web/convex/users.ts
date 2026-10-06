import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
      lastSeenAt: Date.now(),
      sessionToken,
    });

    const user = await ctx.db.get(userId);
    return { user, sessionToken };
  },
});

export const login = mutation({
  args: {
    usernameOrEmail: v.string(),
    password: v.string(),
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
    const user = await ctx.db
      .query("users")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .first();
    return user;
  },
});

export const listUsers = query({
  args: { currentUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").collect();
    if (!args.currentUserId) return users;
    return users.filter((u) => u._id !== args.currentUserId);
  },
});

export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    status: v.optional(v.union(v.literal("ONLINE"), v.literal("BUSY"), v.literal("OFFLINE"))),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const patch: any = { lastSeenAt: Date.now() };
    if (args.displayName !== undefined) patch.displayName = args.displayName;
    if (args.avatarUrl !== undefined) patch.avatarUrl = args.avatarUrl;
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(args.userId, patch);
    return await ctx.db.get(args.userId);
  },
});

export const setPresence = mutation({
  args: {
    userId: v.id("users"),
    status: v.union(v.literal("ONLINE"), v.literal("BUSY"), v.literal("OFFLINE")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      status: args.status,
      lastSeenAt: Date.now(),
    });
  },
});
