import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveAsset = mutation({
  args: {
    siteId: v.id("sites"),
    title: v.string(),
    type: v.union(v.literal("Photo"), v.literal("Drawing"), v.literal("Measurement"), v.literal("Other")),
    storageId: v.id("_storage"),
    format: v.string(),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("site_assets", {
      ...args,
      created_at: Date.now(),
    });
  },
});

export const getAssetsBySite = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const assets = await ctx.db
      .query("site_assets")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .order("desc")
      .collect();

    return await Promise.all(
      assets.map(async (asset) => ({
        ...asset,
        url: await ctx.storage.getUrl(asset.storageId),
      }))
    );
  },
});

export const deleteAsset = mutation({
  args: { id: v.id("site_assets") },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.id);
    if (asset) {
      await ctx.storage.delete(asset.storageId);
      await ctx.db.delete(args.id);
    }
  },
});
