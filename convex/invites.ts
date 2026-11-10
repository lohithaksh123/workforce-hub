import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";

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

// Generate alphanumeric secure code
function generateCode(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Write onboarding audit log helper
export async function logOnboardingAction(
  ctx: any,
  action: string,
  performerEmail: string,
  performerName: string,
  details: string,
  targetRequestId?: Id<"userJoinRequests">,
  targetUserId?: Id<"users">,
  inviteId?: Id<"userInvites">
) {
  await ctx.db.insert("onboarding_audit_logs", {
    action,
    performedBy: performerEmail,
    performedByName: performerName,
    targetRequestId,
    targetUserId,
    inviteId,
    createdAt: Date.now(),
    details,
  });
}

// Create invite link
export const createInviteLink = mutation({
  args: {
    inviteTitle: v.optional(v.string()),
    intendedRoleId: v.optional(v.string()),
    intendedRoleName: v.optional(v.string()),
    intendedSiteId: v.optional(v.id("sites")),
    intendedSiteName: v.optional(v.string()),
    expiryDays: v.number(),
    maxUses: v.number(),
    notes: v.optional(v.string()),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAuthorized, user } = await checkInviteAccess(ctx, args.requestorEmail);
    if (!isAuthorized || !user) {
      throw new ConvexError("You do not have permission to manage invitations.");
    }

    // Generate code and check uniqueness
    let inviteCode = generateCode(12);
    let attempts = 0;
    while (attempts < 5) {
      const existing = await ctx.db
        .query("userInvites")
        .withIndex("by_code", (q) => q.eq("inviteCode", inviteCode))
        .unique();
      if (!existing) break;
      inviteCode = generateCode(12);
      attempts++;
    }

    const expiresAt = Date.now() + args.expiryDays * 24 * 60 * 60 * 1000;

    const inviteId = await ctx.db.insert("userInvites", {
      inviteCode,
      inviteTitle: args.inviteTitle,
      intendedRoleId: args.intendedRoleId,
      intendedRoleName: args.intendedRoleName,
      intendedSiteId: args.intendedSiteId,
      intendedSiteName: args.intendedSiteName,
      status: "active",
      maxUses: args.maxUses,
      usedCount: 0,
      expiresAt,
      createdBy: user.email,
      createdByName: user.name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      notes: args.notes,
    });

    await logOnboardingAction(
      ctx,
      "invite_created",
      user.email,
      user.name,
      `Created invite code ${inviteCode} targeting role: ${args.intendedRoleName || "None"}, site: ${args.intendedSiteName || "None"}`,
      undefined,
      undefined,
      inviteId
    );

    return { inviteId, inviteCode };
  },
});

// Get all invites (for management view)
export const getInvites = query({
  args: { requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAuthorized } = await checkInviteAccess(ctx, args.requestorEmail);
    if (!isAuthorized) {
      throw new ConvexError("You do not have permission to view invitations.");
    }

    return await ctx.db.query("userInvites").order("desc").collect();
  },
});

// Revoke an invite link
export const revokeInvite = mutation({
  args: {
    inviteId: v.id("userInvites"),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAuthorized, user } = await checkInviteAccess(ctx, args.requestorEmail);
    if (!isAuthorized || !user) {
      throw new ConvexError("You do not have permission to revoke invitations.");
    }

    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new ConvexError("Invitation link not found.");
    }

    await ctx.db.patch(args.inviteId, {
      status: "revoked",
      updatedAt: Date.now(),
    });

    await logOnboardingAction(
      ctx,
      "invite_revoked",
      user.email,
      user.name,
      `Revoked invite code ${invite.inviteCode}`,
      undefined,
      undefined,
      args.inviteId
    );

    return { success: true };
  },
});

// Validate invite code (Public view)
export const validateInviteCode = query({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("userInvites")
      .withIndex("by_code", (q) => q.eq("inviteCode", args.inviteCode))
      .unique();

    if (!invite) {
      return { valid: false, error: "This invite link is invalid. Please contact the owner." };
    }

    if (invite.status === "revoked") {
      return { valid: false, error: "This invite link has been revoked." };
    }

    if (invite.status === "used" || invite.usedCount >= invite.maxUses) {
      return { valid: false, error: "This invite link has already been used and is no longer active." };
    }

    if (Date.now() > invite.expiresAt || invite.status === "expired") {
      return { valid: false, error: "This invite link has expired." };
    }

    // Return safe public details
    return {
      valid: true,
      invite: {
        _id: invite._id,
        inviteCode: invite.inviteCode,
        inviteTitle: invite.inviteTitle,
        intendedRoleId: invite.intendedRoleId,
        intendedRoleName: invite.intendedRoleName,
        intendedSiteId: invite.intendedSiteId,
        intendedSiteName: invite.intendedSiteName,
      },
    };
  },
});
