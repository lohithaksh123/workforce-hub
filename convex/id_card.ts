import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Helper to check administrative access (Owner or manage_user_documents)
async function checkAdminAccess(ctx: any, email?: string) {
  if (!email) return false;

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .unique();

  if (!user || user.status === "inactive") return false;

  const permissions = (user.permissions || []) as any[];
  const hasManagePermission = permissions.some((p: any) => 
    (p.key === 'manage_user_documents' && p.allowed === true) ||
    (p.name === 'Manage User Documents' && p.allowed === true)
  );

  return user.role === 'Owner' || hasManagePermission;
}

// Queries

// Get the system ID card template background storage IDs
export const getTemplate = query({
  handler: async (ctx) => {
    return await ctx.db.query("idCardTemplates").first();
  },
});

// Get the generated ID card document for a specific employee
export const getEmployeeIdCard = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userDocuments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("documentTitle"), "Office ID Card"))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
  },
});

// Mutations

// Generate upload URL for template background images
export const generateUploadUrl = mutation({
  args: { requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const isAuthorized = await checkAdminAccess(ctx, args.requestorEmail);
    if (!isAuthorized) {
      throw new ConvexError("You do not have permission to manage ID card templates.");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// Save or replace the ID card background templates
export const saveTemplate = mutation({
  args: {
    frontStorageId: v.optional(v.id("_storage")),
    backStorageId: v.optional(v.id("_storage")),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const isAuthorized = await checkAdminAccess(ctx, args.requestorEmail);
    if (!isAuthorized) {
      throw new ConvexError("You do not have permission to manage ID card templates.");
    }

    const existing = await ctx.db.query("idCardTemplates").first();

    if (existing) {
      const updates: any = { updatedAt: Date.now(), updatedBy: args.requestorEmail };
      if (args.frontStorageId) {
        // Clean up old front template
        if (existing.frontStorageId) {
          try { await ctx.storage.delete(existing.frontStorageId); } catch(e) {}
        }
        updates.frontStorageId = args.frontStorageId;
      }
      if (args.backStorageId) {
        // Clean up old back template
        if (existing.backStorageId) {
          try { await ctx.storage.delete(existing.backStorageId); } catch(e) {}
        }
        updates.backStorageId = args.backStorageId;
      }
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    } else {
      return await ctx.db.insert("idCardTemplates", {
        frontStorageId: args.frontStorageId,
        backStorageId: args.backStorageId,
        updatedAt: Date.now(),
        updatedBy: args.requestorEmail,
      });
    }
  },
});

// Save or update an employee's "Office ID Card" PDF file
export const saveOfficeIdCard = mutation({
  args: {
    userId: v.id("users"),
    userName: v.string(),
    storageId: v.id("_storage"),
    fileSize: v.number(),
    fileName: v.string(),
    fileType: v.string(),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // Lookup requestor
    const requestor = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", args.requestorEmail))
      .unique();
    if (!requestor) throw new ConvexError("Not authenticated");

    const isSelf = requestor._id === args.userId;
    const isAdmin = requestor.role === 'Owner' || (requestor.permissions || []).some((p: any) => 
      (p.key === 'manage_user_documents' && p.allowed === true) || (p.name === 'Manage User Documents' && p.allowed === true)
    );

    if (!isSelf && !isAdmin) {
      throw new ConvexError("You do not have permission to save ID cards for this user.");
    }

    // Check if there is an existing ID card
    const existing = await ctx.db
      .query("userDocuments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("documentTitle"), "Office ID Card"))
      .first();

    if (existing) {
      // Clean up previous storage file
      try {
        await ctx.storage.delete(existing.storageId);
      } catch (e) {
        console.error("Failed to delete old ID card from storage", e);
      }

      await ctx.db.patch(existing._id, {
        storageId: args.storageId,
        fileSize: args.fileSize,
        fileName: args.fileName,
        fileType: args.fileType,
        updatedAt: Date.now(),
      });

      // Write audit log
      await ctx.db.insert("documentAuditLogs", {
        documentId: existing._id,
        action: "edited",
        performedBy: requestor.email,
        performedByName: requestor.name,
        targetUserId: args.userId,
        createdAt: Date.now(),
      });

      return existing._id;
    } else {
      const documentId = await ctx.db.insert("userDocuments", {
        userId: args.userId,
        userName: args.userName,
        documentTitle: "Office ID Card",
        documentType: "Other",
        fileName: args.fileName,
        fileType: args.fileType,
        fileSize: args.fileSize,
        storageId: args.storageId,
        uploadedBy: requestor.email,
        uploadedByName: requestor.name,
        uploadedAt: Date.now(),
        visibility: "manager_visible",
        status: "active",
        updatedAt: Date.now(),
      });

      // Write audit log
      await ctx.db.insert("documentAuditLogs", {
        documentId,
        action: "uploaded",
        performedBy: requestor.email,
        performedByName: requestor.name,
        targetUserId: args.userId,
        createdAt: Date.now(),
      });

      return documentId;
    }
  },
});
