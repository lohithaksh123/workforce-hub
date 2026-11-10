import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getNotifications = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const createNotification = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    description: v.string(),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("notifications", {
      userId: args.userId,
      title: args.title,
      description: args.description,
      type: args.type,
      read: false,
      created_at: Date.now(),
    });
  },
});

export const markAsRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { read: true });
  },
});

export const markAllAsRead = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("read"), false))
      .collect();

    for (const notification of notifications) {
      await ctx.db.patch(notification._id, { read: true });
    }
  },
});

export const deleteNotification = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
