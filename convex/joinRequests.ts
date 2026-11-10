import { mutation, query, action, internalMutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";
import * as bcrypt from "bcryptjs";
import { logOnboardingAction } from "./invites";

// Helper to check invite management access
async function checkInviteAccess(ctx: any, email?: string) {
  if (!email) return { isAuthorized: false, user: null };

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .unique();

  if (!user || user.status === "inactive") return { isAuthorized: false, user: null };

  const permissions = (user.permissions || []) as any[];
  const hasInvitePermission = permissions.some((p: any) => 
    (p.key === 'manage_invites' && p.allowed === true) ||
    (p.name === 'Manage Invites' && p.allowed === true)
  );

  const isAuthorized = user.role === 'Owner' || hasInvitePermission;
  return { isAuthorized, user };
}

// 1. Submit Join Request Action
export const submitJoinRequest = action({
  args: {
    inviteCode: v.string(),
    fullName: v.string(),
    email: v.string(),
    phone: v.string(),
    password: v.string(),
    designation: v.optional(v.string()),
    requestedRoleId: v.optional(v.string()),
    requestedRoleName: v.optional(v.string()),
    siteId: v.optional(v.id("sites")),
    siteName: v.optional(v.string()),
    joiningDate: v.optional(v.string()),
    bloodGroup: v.optional(v.string()),
    address: v.optional(v.string()),
    emergencyContactName: v.optional(v.string()),
    emergencyContactPhone: v.optional(v.string()),
    emergencyContactRelationship: v.optional(v.string()),
    gender: v.optional(v.string()),
    dob: v.optional(v.string()),
    profilePhotoStorageId: v.optional(v.string()),
    resumeStorageId: v.optional(v.string()),
    documents: v.array(v.object({
      documentTitle: v.string(),
      documentType: v.string(),
      fileName: v.string(),
      fileType: v.string(),
      fileSize: v.number(),
      storageId: v.string(),
    })),
  },
  handler: async (ctx, args): Promise<{ success: boolean; joinRequestId?: Id<"userJoinRequests">; error?: string }> => {
    // 1. Pre-validation duplicate checks in mutation (atomic)
    const checkResult: any = await ctx.runMutation(internal.joinRequests.preValidateAndCheckCode, {
      inviteCode: args.inviteCode,
      email: args.email,
      phone: args.phone,
    });

    if (!checkResult.success) {
      return { success: false, error: checkResult.error };
    }

    // 2. Hash Password (Securely in Action node environment)
    const passwordHash = await bcrypt.hash(args.password, 10);

    // 3. Save Join Request in mutation
    const saveResult = await ctx.runMutation(internal.joinRequests.internalSubmitJoinRequest, {
      inviteId: checkResult.inviteId!,
      inviteCode: args.inviteCode,
      fullName: args.fullName,
      email: args.email,
      phone: args.phone,
      passwordHash: passwordHash,
      designation: args.designation,
      requestedRoleId: args.requestedRoleId,
      requestedRoleName: args.requestedRoleName,
      siteId: args.siteId,
      siteName: args.siteName,
      joiningDate: args.joiningDate,
      bloodGroup: args.bloodGroup,
      address: args.address,
      emergencyContactName: args.emergencyContactName,
      emergencyContactPhone: args.emergencyContactPhone,
      emergencyContactRelationship: args.emergencyContactRelationship,
      gender: args.gender,
      dob: args.dob,
      profilePhotoStorageId: args.profilePhotoStorageId,
      resumeStorageId: args.resumeStorageId,
      documents: args.documents,
    });

    return saveResult;
  },
});

// 2. Pre-validate invite code and duplicate checks
export const preValidateAndCheckCode = internalMutation({
  args: {
    inviteCode: v.string(),
    email: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; inviteId?: Id<"userInvites">; error?: string }> => {
    // A. Validate Invite
    const invite = await ctx.db
      .query("userInvites")
      .withIndex("by_code", (q) => q.eq("inviteCode", args.inviteCode))
      .unique();

    if (!invite) {
      return { success: false, error: "This invite link is invalid. Please contact the owner." };
    }
    if (invite.status === "revoked") {
      return { success: false, error: "This invite link has been revoked." };
    }
    if (invite.status === "used" || invite.usedCount >= invite.maxUses) {
      return { success: false, error: "This invite link has already been used." };
    }
    if (Date.now() > invite.expiresAt || invite.status === "expired") {
      return { success: false, error: "This invite link has expired." };
    }

    // B. Check user email/phone duplicates
    const existingUserEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (existingUserEmail) {
      return { success: false, error: "A user is already registered with this email address." };
    }

    const existingUserPhone = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("phone"), args.phone))
      .first();
    if (existingUserPhone) {
      return { success: false, error: "A user is already registered with this phone number." };
    }

    // C. Check pending join requests duplicates
    const pendingRequestEmail = await ctx.db
      .query("userJoinRequests")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "changes_requested")))
      .first();
    if (pendingRequestEmail) {
      return { success: false, error: "An onboarding request for this email address is already pending owner review." };
    }

    const pendingRequestPhone = await ctx.db
      .query("userJoinRequests")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .filter((q) => q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "changes_requested")))
      .first();
    if (pendingRequestPhone) {
      return { success: false, error: "An onboarding request for this phone number is already pending owner review." };
    }

    return { success: true, inviteId: invite._id };
  },
});

// 3. Internal Submit mutation (creates request, logs, increments usedCount)
export const internalSubmitJoinRequest = internalMutation({
  args: {
    inviteId: v.id("userInvites"),
    inviteCode: v.string(),
    fullName: v.string(),
    email: v.string(),
    phone: v.string(),
    passwordHash: v.string(),
    designation: v.optional(v.string()),
    requestedRoleId: v.optional(v.string()),
    requestedRoleName: v.optional(v.string()),
    siteId: v.optional(v.id("sites")),
    siteName: v.optional(v.string()),
    joiningDate: v.optional(v.string()),
    bloodGroup: v.optional(v.string()),
    address: v.optional(v.string()),
    emergencyContactName: v.optional(v.string()),
    emergencyContactPhone: v.optional(v.string()),
    emergencyContactRelationship: v.optional(v.string()),
    gender: v.optional(v.string()),
    dob: v.optional(v.string()),
    profilePhotoStorageId: v.optional(v.string()),
    resumeStorageId: v.optional(v.string()),
    documents: v.array(v.object({
      documentTitle: v.string(),
      documentType: v.string(),
      fileName: v.string(),
      fileType: v.string(),
      fileSize: v.number(),
      storageId: v.string(),
    })),
  },
  handler: async (ctx, args): Promise<{ success: boolean; joinRequestId?: Id<"userJoinRequests">; error?: string }> => {
    // 1. Insert join request
    const joinRequestId = await ctx.db.insert("userJoinRequests", {
      inviteId: args.inviteId,
      inviteCode: args.inviteCode,
      fullName: args.fullName,
      email: args.email,
      phone: args.phone,
      passwordHash: args.passwordHash,
      designation: args.designation,
      requestedRoleId: args.requestedRoleId,
      requestedRoleName: args.requestedRoleName,
      siteId: args.siteId,
      siteName: args.siteName,
      joiningDate: args.joiningDate,
      bloodGroup: args.bloodGroup,
      address: args.address,
      emergencyContactName: args.emergencyContactName,
      emergencyContactPhone: args.emergencyContactPhone,
      emergencyContactRelationship: args.emergencyContactRelationship,
      gender: args.gender,
      dob: args.dob,
      profilePhotoStorageId: args.profilePhotoStorageId as any,
      resumeStorageId: args.resumeStorageId as any,
      status: "pending",
      submittedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // 2. Insert documents metadata
    for (const doc of args.documents) {
      await ctx.db.insert("joinRequestDocuments", {
        joinRequestId,
        documentTitle: doc.documentTitle,
        documentType: doc.documentType,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        storageId: doc.storageId as any,
        uploadedAt: Date.now(),
      });
    }

    // 3. Update invite usage
    const invite = await ctx.db.get(args.inviteId);
    if (invite) {
      const newUsedCount = invite.usedCount + 1;
      const newStatus = newUsedCount >= invite.maxUses ? "used" : invite.status;
      await ctx.db.patch(args.inviteId, {
        usedCount: newUsedCount,
        status: newStatus,
        updatedAt: Date.now(),
      });
    }

    // 4. Log Action
    await logOnboardingAction(
      ctx,
      "join_request_submitted",
      args.email,
      args.fullName,
      `Submitted join request under invite code ${args.inviteCode}`,
      joinRequestId,
      undefined,
      args.inviteId
    );

    return { success: true, joinRequestId };
  },
});

// 4. Get Join Requests (grouped/sorted for management)
export const getJoinRequests = query({
  args: { requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAuthorized } = await checkInviteAccess(ctx, args.requestorEmail);
    if (!isAuthorized) {
      throw new ConvexError("You do not have permission to view onboarding requests.");
    }

    return await ctx.db.query("userJoinRequests").order("desc").collect();
  },
});

// 5. Get Single Request Details
export const getJoinRequestDetails = query({
  args: {
    requestId: v.id("userJoinRequests"),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAuthorized } = await checkInviteAccess(ctx, args.requestorEmail);
    if (!isAuthorized) {
      throw new ConvexError("You do not have permission to view onboarding details.");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new ConvexError("Join request not found.");
    }

    const documents = await ctx.db
      .query("joinRequestDocuments")
      .withIndex("by_request", (q) => q.eq("joinRequestId", args.requestId))
      .collect();

    return { request, documents };
  },
});

// 6. Update status (rejections, request changes)
export const updateRequestStatus = mutation({
  args: {
    requestId: v.id("userJoinRequests"),
    status: v.union(v.literal("rejected"), v.literal("changes_requested")),
    ownerNote: v.optional(v.string()),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAuthorized, user } = await checkInviteAccess(ctx, args.requestorEmail);
    if (!isAuthorized || !user) {
      throw new ConvexError("You do not have permission to review requests.");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new ConvexError("Onboarding request not found.");
    }

    const updates: any = {
      status: args.status,
      ownerNote: args.ownerNote,
      updatedAt: Date.now(),
    };

    if (args.status === "rejected") {
      updates.rejectedBy = user.email;
      updates.rejectedByName = user.name;
      updates.rejectedAt = Date.now();
    }

    await ctx.db.patch(args.requestId, updates);

    await logOnboardingAction(
      ctx,
      args.status === "rejected" ? "join_request_rejected" : "join_request_changes_requested",
      user.email,
      user.name,
      `Updated request for ${request.fullName} status to: ${args.status}. Notes: ${args.ownerNote || "None"}`,
      args.requestId,
      undefined,
      request.inviteId
    );

    return { success: true };
  },
});

// 7. Approve request and create user/wallet/documents
export const approveJoinRequest = mutation({
  args: {
    requestId: v.id("userJoinRequests"),
    role: v.string(),
    siteId: v.optional(v.id("sites")),
    designation: v.optional(v.string()),
    initialBalance: v.number(),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAuthorized, user: performer } = await checkInviteAccess(ctx, args.requestorEmail);
    if (!isAuthorized || !performer) {
      throw new ConvexError("You do not have permission to approve onboarding requests.");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new ConvexError("Onboarding request not found.");
    }
    if (request.status === "approved") {
      throw new ConvexError("This onboarding request has already been approved.");
    }

    // 1. Double check duplicates just before inserting
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", request.email))
      .unique();
    if (existingUser) {
      throw new ConvexError("A user account with this email address already exists.");
    }

    // 2. Fetch role template permissions
    let roleTemplate = await ctx.db
      .query("roles")
      .filter((q) => q.eq(q.field("name"), args.role))
      .first();
    
    if (!roleTemplate) {
      roleTemplate = await ctx.db
        .query("roles")
        .filter((q) => q.eq(q.field("name"), "Staff"))
        .first();
    }
    const permissions = roleTemplate?.permissions || [];

    // 3. Fetch intended Site name if siteId provided
    let siteName = undefined;
    if (args.siteId) {
      const site = await ctx.db.get(args.siteId);
      if (site) {
        siteName = site.name;
      }
    }

    // 4. Create User
    const userId = await ctx.db.insert("users", {
      name: request.fullName,
      email: request.email,
      password: request.passwordHash, // pre-hashed in form submission
      role: args.role,
      designation: args.designation || request.designation,
      status: "active",
      permissions: permissions,
      phone: request.phone,
      image: request.profilePhotoStorageId,
      siteId: args.siteId,
      joiningDate: request.joiningDate || new Date().toISOString().split('T')[0],
      bloodGroup: request.bloodGroup,
      emergencyContact: request.emergencyContactPhone 
        ? `${request.emergencyContactName || "Emergency"}${request.emergencyContactRelationship ? ` (${request.emergencyContactRelationship})` : ""}: ${request.emergencyContactPhone}`
        : undefined,
      gender: request.gender,
      dob: request.dob,
      updatedAt: Date.now(),
    });

    // 5. Create Wallet
    const walletId = await ctx.db.insert("user_wallets", {
      userId: request.fullName, // userName is the ID in user_wallets!
      siteId: args.siteId,
      balance: 0, // initialized at 0, top-up will update this atomically
      total_credited: 0,
      total_debited: 0,
      totalReturned: 0,
      status: "Active",
      created_at: Date.now(),
    });

    // 6. Handle Initial Balance allocation (if > 0, deduct from company vault and top up staff wallet)
    if (args.initialBalance > 0) {
      const companyWallet = await ctx.db
        .query("company_wallet")
        .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
        .first();
      
      if (!companyWallet) {
        throw new ConvexError("Company vault not found for allocating initial balance.");
      }
      if (companyWallet.balance < args.initialBalance) {
        throw new ConvexError(`Insufficient company vault balance. Available: ₹${companyWallet.balance.toLocaleString()}.`);
      }

      // Deduct from Vault
      await ctx.db.patch(companyWallet._id, {
        balance: companyWallet.balance - args.initialBalance,
        total_debited: (companyWallet.total_debited ?? 0) + args.initialBalance,
      });

      // Top up User Wallet
      await ctx.db.patch(walletId, {
        balance: args.initialBalance,
        total_credited: args.initialBalance,
        lastTopUpDate: new Date().toISOString().split("T")[0],
      });

      // Log transaction
      await ctx.db.insert("transactions", {
        type: "CREDIT",
        transactionType: "top_up",
        amount: args.initialBalance,
        before_balance: 0,
        after_balance: args.initialBalance,
        sourceType: "Company Vault",
        sourceName: "Company Vault",
        destinationType: "Staff Wallet",
        destinationId: walletId,
        destinationName: request.fullName,
        source_or_vendor: "Company Vault",
        purpose: "Initial Onboarding Balance Allocation",
        used_by: request.fullName,
        performed_by: performer.name,
        approved_by: performer.name,
        createdBy: performer.name,
        approvedBy: performer.name,
        date: new Date().toISOString().split("T")[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: "COMPLETED",
        payment_method: "internal transfer",
        walletId: walletId,
        fromWalletId: companyWallet._id,
        toWalletId: walletId,
        isInternalTransfer: true,
        created_at: Date.now(),
      });
    }

    // 7. Copy joinRequestDocuments to userDocuments
    const requestDocs = await ctx.db
      .query("joinRequestDocuments")
      .withIndex("by_request", (q) => q.eq("joinRequestId", args.requestId))
      .collect();

    for (const doc of requestDocs) {
      await ctx.db.insert("userDocuments", {
        userId,
        userName: request.fullName,
        documentTitle: doc.documentTitle,
        documentType: doc.documentType,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        storageId: doc.storageId,
        uploadedBy: "Onboarding System",
        uploadedByName: request.fullName,
        uploadedAt: doc.uploadedAt,
        notes: "Uploaded during candidate onboarding",
        visibility: "owner_visible",
        status: "active",
        updatedAt: Date.now(),
      });
    }

    // 8. Update request status
    await ctx.db.patch(args.requestId, {
      status: "approved",
      approvedBy: performer.email,
      approvedByName: performer.name,
      approvedAt: Date.now(),
      createdUserId: userId,
      updatedAt: Date.now(),
    });

    // 9. Log Onboarding Action
    await logOnboardingAction(
      ctx,
      "join_request_approved",
      performer.email,
      performer.name,
      `Approved join request for ${request.fullName} and created user account. Assigned role: ${args.role}. Initial wallet balance: ₹${args.initialBalance}`,
      args.requestId,
      userId,
      request.inviteId
    );

    return { success: true, userId };
  },
});

export const getJoinRequestByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userJoinRequests")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.or(
        q.eq(q.field("status"), "pending"),
        q.eq(q.field("status"), "changes_requested"),
        q.eq(q.field("status"), "rejected")
      ))
      .first();
  },
});

