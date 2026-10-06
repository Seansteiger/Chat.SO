import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Password hashing helper
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "_chatso_salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Internal query to verify availability before sending email
export const checkUserAvailable = internalQuery({
  args: {
    username: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username.trim().toLowerCase()))
      .first();

    if (existingUser) return { available: false, error: "Username is already taken" };

    const existingEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.trim().toLowerCase()))
      .first();

    if (existingEmail) return { available: false, error: "Email is already registered" };

    return { available: true };
  },
});

// Internal query to verify user exists for password reset
export const checkUserExistsByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.trim().toLowerCase()))
      .first();
    return !!user;
  },
});

// Internal mutation to save a generated OTP code and optional pending registration
export const saveVerificationCode = internalMutation({
  args: {
    email: v.string(),
    code: v.string(),
    type: v.union(v.literal("SIGNUP_VERIFICATION"), v.literal("PASSWORD_RESET")),
    expiresAt: v.number(),
    pendingData: v.optional(
      v.object({
        username: v.string(),
        displayName: v.string(),
        passwordHash: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Invalidate existing unused codes for this email and type
    const existing = await ctx.db
      .query("verificationCodes")
      .withIndex("by_email_type", (q) => q.eq("email", args.email).eq("type", args.type))
      .filter((q) => q.eq(q.field("used"), false))
      .collect();

    for (const c of existing) {
      await ctx.db.patch(c._id, { used: true });
    }

    await ctx.db.insert("verificationCodes", {
      email: args.email,
      code: args.code,
      type: args.type,
      expiresAt: args.expiresAt,
      used: false,
      pendingData: args.pendingData,
    });
  },
});

// Public Action: Start signup verification & send Resend email with OTP & one-click verification link
export const requestSignupVerification = action({
  args: {
    username: v.string(),
    email: v.string(),
    displayName: v.optional(v.string()),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();
    const cleanUsername = args.username.trim().toLowerCase();

    // 1. Verify availability
    const check: any = await ctx.runQuery(internal.auth_email.checkUserAvailable, {
      username: cleanUsername,
      email: cleanEmail,
    });

    if (!check.available) {
      throw new Error(check.error);
    }

    // 2. Generate 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // 3. Prepare pending credentials if password provided
    let pendingData = undefined;
    if (args.password) {
      const passwordHash = await hashPassword(args.password);
      pendingData = {
        username: cleanUsername,
        displayName: args.displayName?.trim() || cleanUsername,
        passwordHash,
      };
    }

    // 4. Save to database
    await ctx.runMutation(internal.auth_email.saveVerificationCode, {
      email: cleanEmail,
      code,
      type: "SIGNUP_VERIFICATION",
      expiresAt,
      pendingData,
    });

    // 5. Send email via Resend API
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      throw new Error("Resend API key is not configured on Convex");
    }

    const verifyLink = `https://chat.steigeronline.co.za/?action=verify&email=${encodeURIComponent(cleanEmail)}&code=${code}`;

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #0b0f19; color: #f1f5f9; padding: 32px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 800; letter-spacing: -0.5px;">Chat.SO</h1>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 6px;">Secure Real-Time Communication</p>
        </div>
        <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); padding: 24px; border-radius: 12px; text-align: center;">
          <h2 style="font-size: 20px; color: #ffffff; margin-top: 0; font-weight: 700;">Verify Your Email Address</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
            Thank you for creating an account on Chat.SO. Click the button below to instantly verify your email and sign in:
          </p>
          <div style="margin: 24px 0 28px 0;">
            <a href="${verifyLink}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(37,99,235,0.35);">
              Verify Email &amp; Launch Chat.SO
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 10px 0;">Or enter this 6-digit code manually in the app:</p>
          <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #60a5fa; padding: 16px; background: rgba(15, 23, 42, 0.9); border-radius: 10px; margin: 0 0 16px 0; font-family: monospace;">
            ${code}
          </div>
          <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">This verification link and code expire in 15 minutes. If you did not create a Chat.SO account, you can safely ignore this email.</p>
        </div>
      </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Chat.SO <no-reply@steigeronline.co.za>",
        to: cleanEmail,
        subject: `Verify your Chat.SO account (${code})`,
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[Resend Error]", err);
      throw new Error(`Failed to send verification email: ${response.statusText}`);
    }

    return { success: true, email: cleanEmail };
  },
});

// Public Mutation: Complete registration with verified code (manual input)
export const verifyAndRegister = mutation({
  args: {
    username: v.string(),
    email: v.string(),
    password: v.string(),
    displayName: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();
    const cleanUsername = args.username.trim().toLowerCase();

    // Verify OTP code
    const record = await ctx.db
      .query("verificationCodes")
      .withIndex("by_email_code", (q) => q.eq("email", cleanEmail).eq("code", args.code.trim()))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "SIGNUP_VERIFICATION"),
          q.eq(q.field("used"), false),
          q.gt(q.field("expiresAt"), Date.now())
        )
      )
      .first();

    if (!record) {
      throw new Error("Invalid or expired verification code");
    }

    // Mark code as used
    await ctx.db.patch(record._id, { used: true });

    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .first();
    if (existing) throw new Error("Username is already taken");

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
      isEmailVerified: true,
    });

    const user = await ctx.db.get(userId);
    return { user, sessionToken };
  },
});

// Public Mutation: One-click verify by link (from email button)
export const verifySignupByLink = mutation({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();
    const cleanCode = args.code.trim();

    // 1. Verify OTP code
    const record = await ctx.db
      .query("verificationCodes")
      .withIndex("by_email_code", (q) => q.eq("email", cleanEmail).eq("code", cleanCode))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "SIGNUP_VERIFICATION"),
          q.eq(q.field("used"), false),
          q.gt(q.field("expiresAt"), Date.now())
        )
      )
      .first();

    if (!record) {
      throw new Error("Verification link is invalid or has expired. Please sign in or request a new code.");
    }

    // Mark code used
    await ctx.db.patch(record._id, { used: true });

    // 2. Check if user already created
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();

    if (existingUser) {
      const sessionToken = "tok_" + crypto.randomUUID();
      await ctx.db.patch(existingUser._id, { sessionToken, isEmailVerified: true, status: "ONLINE" });
      const updated = await ctx.db.get(existingUser._id);
      return { user: updated, sessionToken };
    }

    // 3. User not created yet, retrieve pendingData
    const pending = (record as any).pendingData;
    if (!pending || !pending.passwordHash) {
      throw new Error("Registration details not found. Please complete signup manually in the app.");
    }

    const cleanUsername = pending.username.trim().toLowerCase();
    const userTaken = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", cleanUsername))
      .first();

    const finalUsername = userTaken ? `${cleanUsername}_${Math.floor(100 + Math.random() * 900)}` : cleanUsername;
    const sessionToken = "tok_" + crypto.randomUUID();

    const userId = await ctx.db.insert("users", {
      username: finalUsername,
      email: cleanEmail,
      displayName: pending.displayName || finalUsername,
      passwordHash: pending.passwordHash,
      status: "ONLINE",
      lastSeenAt: Date.now(),
      sessionToken,
      isEmailVerified: true,
    });

    const user = await ctx.db.get(userId);
    return { user, sessionToken };
  },
});

// Public Action: Request password reset & send Resend email with reset link + code
export const requestPasswordReset = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();

    // 1. Check user exists
    const exists = await ctx.runQuery(internal.auth_email.checkUserExistsByEmail, {
      email: cleanEmail,
    });

    if (!exists) {
      throw new Error("No account found with this email address");
    }

    // 2. Generate 6-digit OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // 3. Save to database
    await ctx.runMutation(internal.auth_email.saveVerificationCode, {
      email: cleanEmail,
      code,
      type: "PASSWORD_RESET",
      expiresAt,
    });

    // 4. Send email via Resend API
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      throw new Error("Resend API key is not configured on Convex");
    }

    const resetLink = `https://chat.steigeronline.co.za/?action=reset&email=${encodeURIComponent(cleanEmail)}&code=${code}`;

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #0b0f19; color: #f1f5f9; padding: 32px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 800; letter-spacing: -0.5px;">Chat.SO</h1>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 6px;">Password Reset Request</p>
        </div>
        <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); padding: 24px; border-radius: 12px; text-align: center;">
          <h2 style="font-size: 20px; color: #ffffff; margin-top: 0; font-weight: 700;">Reset Your Password</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
            We received a request to reset your password. Click the button below to proceed directly:
          </p>
          <div style="margin: 24px 0 28px 0;">
            <a href="${resetLink}" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(79,70,229,0.35);">
              Reset Password
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 10px 0;">Or enter this 6-digit recovery code manually:</p>
          <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; padding: 16px; background: rgba(15, 23, 42, 0.9); border-radius: 10px; margin: 0 0 16px 0; font-family: monospace;">
            ${code}
          </div>
          <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">This code and link are valid for 15 minutes. If you did not request a password reset, you can safely ignore this email.</p>
        </div>
      </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Chat.SO <no-reply@steigeronline.co.za>",
        to: cleanEmail,
        subject: `Reset your Chat.SO password (${code})`,
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[Resend Error]", err);
      throw new Error(`Failed to send password reset email: ${response.statusText}`);
    }

    return { success: true, email: cleanEmail };
  },
});

// Public Mutation: Complete password reset with code
export const resetPasswordWithCode = mutation({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();

    // Verify OTP code
    const record = await ctx.db
      .query("verificationCodes")
      .withIndex("by_email_code", (q) => q.eq("email", cleanEmail).eq("code", args.code.trim()))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "PASSWORD_RESET"),
          q.eq(q.field("used"), false),
          q.gt(q.field("expiresAt"), Date.now())
        )
      )
      .first();

    if (!record) {
      throw new Error("Invalid or expired password reset code");
    }

    // Mark code as used
    await ctx.db.patch(record._id, { used: true });

    // Find user
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();

    if (!user) {
      throw new Error("User account not found");
    }

    const passwordHash = await hashPassword(args.newPassword);
    const sessionToken = "tok_" + crypto.randomUUID();

    await ctx.db.patch(user._id, {
      passwordHash,
      sessionToken,
      lastSeenAt: Date.now(),
    });

    const updatedUser = await ctx.db.get(user._id);
    return { user: updatedUser, sessionToken };
  },
});
