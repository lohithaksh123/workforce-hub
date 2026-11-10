import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Helper to check user access via email parameter
async function checkAccess(ctx: any, email?: string) {
  if (!email) return { isAdmin: false, userId: null, user: null };

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .unique();
  
  if (!user || user.status === "inactive") return { isAdmin: false, userId: null, user: null };

  const permissions = (user.permissions || []) as any[];
  const hasManagePermission = permissions.some((p: any) => 
    (p.key === 'manage_user_documents' && p.allowed === true) ||
    (p.name === 'Manage User Documents' && p.allowed === true)
  );

  const isAdmin = user.role === 'Owner' || hasManagePermission;

  return { isAdmin, userId: user._id, user };
}

// Helper to write audit logs
const logDocumentAction = async (
  ctx: any,
  documentId: Id<"userDocuments">,
  action: string,
  performer: any,
  targetUserId: Id<"users">
) => {
  await ctx.db.insert("documentAuditLogs", {
    documentId,
    action,
    performedBy: performer.email,
    performedByName: performer.name,
    targetUserId,
    createdAt: Date.now(),
  });
};

// Queries

// Get documents uploaded by the current logged-in user
export const getMyDocuments = query({
  args: { requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) return [];
    
    return await ctx.db
      .query("userDocuments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .order("desc")
      .collect();
  },
});

// Get documents for a specific user ID (restricted to owners, managers, or the user themselves)
export const getUserDocuments = query({
  args: { userId: v.id("users"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin, userId: currentUserId } = await checkAccess(ctx, args.requestorEmail);
    if (!currentUserId) {
      throw new ConvexError("Not authenticated");
    }
    const isSelf = currentUserId === args.userId;
    const isAuthorized = isSelf || isAdmin;

    if (!isAuthorized) {
      throw new ConvexError("You do not have permission to access these documents.");
    }

    return await ctx.db
      .query("userDocuments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .order("desc")
      .collect();
  },
});

// Get all documents across all users (restricted to owners or managers with permission)
export const getAllUserDocumentsForManager = query({
  args: { requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin) {
      throw new ConvexError("You do not have permission to view team documents.");
    }

    return await ctx.db
      .query("userDocuments")
      .filter((q) => q.eq(q.field("status"), "active"))
      .order("desc")
      .collect();
  },
});

// Get a single document details
export const getDocumentById = query({
  args: { id: v.id("userDocuments"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) throw new ConvexError("Not authenticated");

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError("Document not found.");

    const isSelf = userId === doc.userId;
    const isAuthorized = isSelf || isAdmin;

    if (!isAuthorized) {
      throw new ConvexError("You do not have permission to access this document.");
    }

    return doc;
  },
});

// Mutations

// Generate download URL for a document (checks access and writes audit log entry)
export const getDocumentDownloadUrl = mutation({
  args: { 
    id: v.id("userDocuments"), 
    action: v.union(v.literal("viewed"), v.literal("downloaded")),
    requestorEmail: v.string()
  },
  handler: async (ctx, args) => {
    const { isAdmin, userId, user } = await checkAccess(ctx, args.requestorEmail);
    if (!userId || !user) throw new ConvexError("Not authenticated");

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError("Document not found.");

    const isSelf = userId === doc.userId;
    const isAuthorized = isSelf || isAdmin;

    if (!isAuthorized) {
      throw new ConvexError("You do not have permission to access this document.");
    }

    const downloadUrl = await ctx.storage.getUrl(doc.storageId);
    if (!downloadUrl) throw new ConvexError("Failed to resolve file storage location.");

    // Write audit log
    await logDocumentAction(ctx, args.id, args.action, user, doc.userId);

    return downloadUrl;
  },
});

// Generate upload URL for files
export const generateUploadUrl = mutation({
  args: { requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) throw new ConvexError("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

// Save document metadata after successful storage upload
export const saveUserDocument = mutation({
  args: {
    userId: v.id("users"),
    userName: v.string(),
    documentTitle: v.string(),
    documentType: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    storageId: v.id("_storage"),
    notes: v.optional(v.string()),
    visibility: v.union(v.literal("private"), v.literal("owner_visible"), v.literal("manager_visible")),
    requestorEmail: v.string()
  },
  handler: async (ctx, args) => {
    const { isAdmin, userId: currentUserId, user } = await checkAccess(ctx, args.requestorEmail);
    if (!currentUserId || !user) throw new ConvexError("Not authenticated");

    const isSelf = currentUserId === args.userId;
    const isAuthorized = isSelf || isAdmin;

    if (!isAuthorized) {
      throw new ConvexError("You do not have permission to save documents for this user.");
    }

    const { requestorEmail, ...insertArgs } = args;

    const documentId = await ctx.db.insert("userDocuments", {
      ...insertArgs,
      uploadedBy: user.email,
      uploadedByName: user.name,
      uploadedAt: Date.now(),
      status: "active",
      updatedAt: Date.now(),
    });

    // Write audit log
    await logDocumentAction(ctx, documentId, "uploaded", user, args.userId);

    return documentId;
  },
});

// Update user document details
export const updateUserDocument = mutation({
  args: {
    id: v.id("userDocuments"),
    documentTitle: v.string(),
    documentType: v.string(),
    notes: v.optional(v.string()),
    visibility: v.union(v.literal("private"), v.literal("owner_visible"), v.literal("manager_visible")),
    requestorEmail: v.string()
  },
  handler: async (ctx, args) => {
    const { isAdmin, userId, user } = await checkAccess(ctx, args.requestorEmail);
    if (!userId || !user) throw new ConvexError("Not authenticated");

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError("Document not found.");

    const isSelf = userId === doc.userId;
    const isAuthorized = isSelf || isAdmin;

    if (!isAuthorized) {
      throw new ConvexError("You do not have permission to edit this document.");
    }

    const { id, requestorEmail: _, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    // Write audit log
    await logDocumentAction(ctx, id, "edited", user, doc.userId);

    return { success: true };
  },
});

// Archive a user document
export const archiveUserDocument = mutation({
  args: { id: v.id("userDocuments"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin, userId, user } = await checkAccess(ctx, args.requestorEmail);
    if (!userId || !user) throw new ConvexError("Not authenticated");

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError("Document not found.");

    const isSelf = userId === doc.userId;
    const isAuthorized = isSelf || isAdmin;

    if (!isAuthorized) {
      throw new ConvexError("You do not have permission to archive this document.");
    }

    await ctx.db.patch(args.id, {
      status: "archived",
      updatedAt: Date.now(),
    });

    // Write audit log
    await logDocumentAction(ctx, args.id, "archived", user, doc.userId);

    return { success: true };
  },
});

// Delete user document permanently from DB and file storage
export const deleteUserDocument = mutation({
  args: { id: v.id("userDocuments"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin, userId, user } = await checkAccess(ctx, args.requestorEmail);
    if (!userId || !user) throw new ConvexError("Not authenticated");

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError("Document not found.");

    const isSelf = userId === doc.userId;
    const isAuthorized = isSelf || isAdmin;

    if (!isAuthorized) {
      throw new ConvexError("You do not have permission to delete this document.");
    }

    // Delete actual file from storage
    try {
      await ctx.storage.delete(doc.storageId);
    } catch (e) {
      console.error("Failed to delete file from Convex storage", e);
    }

    // Write audit log prior to DB record deletion
    await logDocumentAction(ctx, args.id, "deleted", user, doc.userId);

    // Delete record from DB
    await ctx.db.delete(args.id);

    return { success: true };
  },
});
