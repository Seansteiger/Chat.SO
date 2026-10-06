import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const generateUploadUrl = mutation({
  args: {
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    // Strict 50MB limit
    if (args.fileSize > 52428800) {
      throw new Error(`File size ${args.fileSize} exceeds the 50MB ceiling.`);
    }

    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
