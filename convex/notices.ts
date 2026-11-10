import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// Helper to check permissions
async function checkAccess(ctx: any, email: string) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .unique();

  if (!user) return { isAdmin: false, userId: null, user: null };

  const isAdmin = user.role === "Owner" || 
                  user.permissions?.some((p: any) => p.key === "manage_notices" && p.allowed);

  return { isAdmin, userId: user.name, user };
}

export const createNotice = mutation({
  args: {
    title: v.string(),
    message: v.string(),
    priority: v.union(v.literal("normal"), v.literal("important"), v.literal("urgent")),
    audience: v.union(v.literal("all"), v.literal("roles"), v.literal("sites"), v.literal("users")),
    roleIds: v.optional(v.array(v.string())),
    siteIds: v.optional(v.array(v.id("sites"))),
    userIds: v.optional(v.array(v.string())),
    isPinned: v.boolean(),
    isActive: v.boolean(),
    expiresAt: v.optional(v.number()),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, userId, user } = await checkAccess(ctx, args.requestorEmail);
    if (!userId || !user) throw new Error("Not authenticated");

    const now = Date.now();
    return await ctx.db.insert("notices", {
      title: args.title,
      message: args.message,
      priority: args.priority,
      audience: args.audience,
      roleIds: args.roleIds,
      siteIds: args.siteIds,
      userIds: args.userIds,
      isPinned: isAdmin ? args.isPinned : false,
      isActive: isAdmin ? args.isActive : false,
      approvalStatus: isAdmin ? "approved" : "pending",
      createdBy: userId!,
      createdByName: user!.name,
      createdAt: now,
      updatedAt: now,
      expiresAt: args.expiresAt,
    });
  },
});

export const updateNotice = mutation({
  args: {
    id: v.id("notices"),
    title: v.string(),
    message: v.string(),
    priority: v.union(v.literal("normal"), v.literal("important"), v.literal("urgent")),
    audience: v.union(v.literal("all"), v.literal("roles"), v.literal("sites"), v.literal("users")),
    roleIds: v.optional(v.array(v.string())),
    siteIds: v.optional(v.array(v.id("sites"))),
    userIds: v.optional(v.array(v.string())),
    isPinned: v.boolean(),
    isActive: v.boolean(),
    expiresAt: v.optional(v.number()),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) throw new Error("Not authenticated");

    const { id, requestorEmail, ...updateData } = args;
    const notice = await ctx.db.get(id);
    if (!notice) throw new Error("Notice not found");

    const isCreator = notice.createdBy === userId;
    if (!isAdmin && !isCreator) throw new Error("Unauthorized");

    // If edited by a non-admin, it must go back to pending and inactive
    const nextApprovalStatus = isAdmin ? (notice.approvalStatus || "approved") : "pending";
    const nextIsActive = isAdmin ? updateData.isActive : false;

    await ctx.db.patch(id, {
      ...updateData,
      isPinned: isAdmin ? updateData.isPinned : false,
      isActive: nextIsActive,
      approvalStatus: nextApprovalStatus,
      updatedAt: Date.now(),
    });
  },
});

export const deleteNotice = mutation({
  args: { id: v.id("notices"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) throw new Error("Not authenticated");

    const notice = await ctx.db.get(args.id);
    if (!notice) throw new Error("Notice not found");

    const isCreator = notice.createdBy === userId;
    if (!isAdmin && !isCreator) throw new Error("Unauthorized");

    await ctx.db.delete(args.id);
  },
});

export const toggleNoticeActive = mutation({
  args: { id: v.id("notices"), isActive: v.boolean(), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin) throw new Error("Unauthorized");
    await ctx.db.patch(args.id, { isActive: args.isActive, updatedAt: Date.now() });
  },
});

export const toggleNoticePinned = mutation({
  args: { id: v.id("notices"), isPinned: v.boolean(), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin) throw new Error("Unauthorized");
    await ctx.db.patch(args.id, { isPinned: args.isPinned, updatedAt: Date.now() });
  },
});

export const approveNotice = mutation({
  args: { id: v.id("notices"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin) throw new Error("Unauthorized: Notice board management access required");

    await ctx.db.patch(args.id, {
      approvalStatus: "approved",
      isActive: true,
      updatedAt: Date.now(),
    });
  },
});

export const rejectNotice = mutation({
  args: { id: v.id("notices"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin) throw new Error("Unauthorized: Notice board management access required");

    await ctx.db.patch(args.id, {
      approvalStatus: "rejected",
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});

export const markAsRead = mutation({
  args: { noticeId: v.id("notices"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) return;

    const existing = await ctx.db
      .query("notice_reads")
      .withIndex("by_notice_user", (q) => q.eq("noticeId", args.noticeId).eq("userId", userId))
      .unique();

    if (!existing) {
      await ctx.db.insert("notice_reads", {
        noticeId: args.noticeId,
        userId: userId,
        readAt: Date.now(),
      });
    }
  },
});

// Helper to filter and sort notices
async function getVisibleNoticesHelper(ctx: any, email: string) {
  const { isAdmin, userId, user } = await checkAccess(ctx, email);
  if (!userId) return [];

  const now = Date.now();
  const notices = await ctx.db.query("notices").collect();

  // Visibility filtering
  const visibleNotices = notices.filter((notice: Doc<"notices">) => {
    // Admins see everything
    if (isAdmin) return true;

    // Creator can see their own notice submission at any status
    if (notice.createdBy === userId) return true;

    // Others can only see active, approved, and unexpired notices
    const isApproved = notice.approvalStatus === "approved" || notice.approvalStatus === undefined;
    if (!isApproved) return false;
    if (!notice.isActive) return false;
    if (notice.expiresAt && notice.expiresAt < now) return false;

    // Audience check
    if (notice.audience === "all") return true;
    if (notice.audience === "roles" && notice.roleIds?.includes(user!.role)) return true;
    if (notice.audience === "sites" && user!.siteId && notice.siteIds?.includes(user!.siteId)) return true;
    if (notice.audience === "users" && notice.userIds?.includes(user!.name)) return true;

    return false;
  });

  // Sort: Pinned first, then by createdAt desc
  return visibleNotices.sort((a: Doc<"notices">, b: Doc<"notices">) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.createdAt - a.createdAt;
  });
}

export const getVisibleNotices = query({
  args: { requestorEmail: v.string() },
  handler: async (ctx, args) => {
    return await getVisibleNoticesHelper(ctx, args.requestorEmail);
  },
});

export const getLatestVisibleNotices = query({
  args: { requestorEmail: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    const visible = await getVisibleNoticesHelper(ctx, args.requestorEmail);
    return visible.slice(0, args.limit);
  },
});

export const getNoticeReadStatus = query({
  args: { requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) return [];
    return await ctx.db
      .query("notice_reads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});
