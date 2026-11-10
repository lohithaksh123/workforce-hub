import { mutation, query, action, internalMutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import * as bcrypt from "bcryptjs";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const dummy = query({
  handler: async () => {
    return "ok";
  },
});

export const requireActiveUser = async (ctx: any, requestorEmail?: string) => {
  if (!requestorEmail) {
    // Fallback if an email isn't provided (e.g. some other backend flow)
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      requestorEmail = identity.email;
    }
  }
  
  if (!requestorEmail) throw new ConvexError("Not authenticated");
  
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", requestorEmail))
    .unique();
    
  if (!user) throw new ConvexError("User not found");
  
  if (user.status === "disabled") {
    throw new ConvexError("Your account is disabled. Please contact the owner.");
  }
  if (user.status === "deleted") {
    throw new ConvexError("Your account has been removed.");
  }
  
  return user;
};

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const getUserProfileImageUrl = query({
  args: { storageId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.storageId) return null;
    try {
      return await ctx.storage.getUrl(args.storageId);
    } catch (e) {
      return null;
    }
  },
});

export const getUsers = query({
  handler: async (ctx) => {
    return await ctx.db.query("users").order("desc").collect();
  },
});

// Triggering sync for permissions
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

export const getUserById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});


export const toggleStatus = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      const user = await ctx.db.get(args.userId);
      if (!user) return { success: false, error: "The specified team member could not be found in the directory." };
      const newStatus = user.status === "active" ? "inactive" : "active";
      await ctx.db.patch(args.userId, { status: newStatus });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.data || e.message || "Failed to update status" };
    }
  },
});


export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.optional(v.string()), // Hashed password
    role: v.string(),
    designation: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (existing) throw new ConvexError(`An account with the email "${args.email}" is already registered. Duplicate entries are not allowed.`);

    return await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      password: args.password,
      role: args.role,
      designation: args.designation,
      address: args.address,
      status: "active",
    });
  },
});

export const removeUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    throw new ConvexError("Hard deletion is deprecated. Please use softDeleteUser.");
  },
});

export const disableUser = mutation({
  args: {
    userId: v.id("users"),
    reason: v.optional(v.string()),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireActiveUser(ctx, args.requestorEmail);
    if (admin.role !== "Owner" && !admin.permissions?.some((p: any) => p.key === "manage_users" && p.allowed)) {
      throw new ConvexError("You do not have permission to manage users.");
    }
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new ConvexError("User not found");
    if (targetUser.role === "Owner") throw new ConvexError("You cannot disable or delete an owner account.");

    await ctx.db.patch(args.userId, {
      status: "disabled",
      disabledAt: Date.now(),
      disabledBy: admin._id,
      disabledByName: admin.name,
      disabledReason: args.reason,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const enableUser = mutation({
  args: { 
    userId: v.id("users"),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireActiveUser(ctx, args.requestorEmail);
    if (admin.role !== "Owner" && !admin.permissions?.some((p: any) => p.key === "manage_users" && p.allowed)) {
      throw new ConvexError("You do not have permission to manage users.");
    }
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new ConvexError("User not found");

    await ctx.db.patch(args.userId, {
      status: "active",
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const softDeleteUser = mutation({
  args: {
    userId: v.id("users"),
    reason: v.optional(v.string()),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireActiveUser(ctx, args.requestorEmail);
    if (admin.role !== "Owner" && !admin.permissions?.some((p: any) => p.key === "manage_users" && p.allowed)) {
      throw new ConvexError("You do not have permission to manage users.");
    }
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new ConvexError("User not found");
    if (targetUser.role === "Owner") throw new ConvexError("You cannot disable or delete an owner account.");

    await ctx.db.patch(args.userId, {
      status: "deleted",
      deletedAt: Date.now(),
      deletedBy: admin._id,
      deletedByName: admin.name,
      deleteReason: args.reason,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const restoreUser = mutation({
  args: { 
    userId: v.id("users"),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireActiveUser(ctx, args.requestorEmail);
    if (admin.role !== "Owner" && !admin.permissions?.some((p: any) => p.key === "manage_users" && p.allowed)) {
      throw new ConvexError("You do not have permission to manage users.");
    }
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new ConvexError("User not found");

    await ctx.db.patch(args.userId, {
      status: "active",
      restoredAt: Date.now(),
      restoredBy: admin._id,
      restoredByName: admin.name,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const getVendors = query({
  handler: async (ctx) => {
    return await ctx.db.query("vendors").collect();
  },
});

export const createVendor = mutation({
  args: {
    name: v.string(),
    contact: v.optional(v.string()),
    category: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      await ctx.db.insert("vendors", {
        ...args,
        status: "active",
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.data || e.message || "Failed to create vendor" };
    }
  },
});

export const updateRole = mutation({
  args: { userId: v.id("users"), role: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { role: args.role });
  },
});

export const currentUser = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .unique();
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    designation: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .unique();
    if (!user) throw new ConvexError("Your user profile could not be identified for this update.");

    await ctx.db.patch(user._id, {
      name: args.name,
      designation: args.designation,
      phone: args.phone,
    });
  },
});
export const updateVendor = mutation({
  args: {
    vendorId: v.id("vendors"),
    name: v.optional(v.string()),
    contact: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      const { vendorId, ...updates } = args;
      await ctx.db.patch(vendorId, updates);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.data || e.message || "Failed to update vendor" };
    }
  },
});

export const removeVendor = mutation({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      await ctx.db.delete(args.vendorId);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.data || e.message || "Failed to remove vendor" };
    }
  },
});

export const updateOperativePermissions = mutation({
  args: {
    userId: v.id("users"),
    permissions: v.array(v.object({
      key: v.string(),
      label: v.string(),
      allowed: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { 
      permissions: args.permissions,
      updatedAt: Date.now()
    });
    return { success: true };
  },
});

export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    let roleTemplate = await ctx.db
      .query("roles")
      .filter((q) => q.eq(q.field("name"), args.role))
      .first();
    
    const updates: any = { 
      role: args.role,
      updatedAt: Date.now()
    };
    
    if (!roleTemplate) {
      roleTemplate = await ctx.db
        .query("roles")
        .filter((q) => q.eq(q.field("name"), "Staff"))
        .first();
    }
    
    if (roleTemplate) {
      updates.permissions = roleTemplate.permissions;
    }
    
    await ctx.db.patch(args.userId, updates);
    return { success: true };
  },
});

export const setPasswordResetToken = mutation({
  args: { email: v.string(), token: v.string(), expires: v.number() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (!user) return null;
    await ctx.db.patch(user._id, {
      resetToken: args.token,
      resetExpires: args.expires,
    });
    return user._id;
  },
});

export const updatePasswordWithToken = mutation({
  args: { token: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("resetToken"), args.token))
      .unique();
    
    if (!user || !user.resetExpires || Date.now() > user.resetExpires) {
      throw new ConvexError("This password reset link is either invalid or has already expired. Please request a new one.");
    }

    await ctx.db.patch(user._id, {
      password: args.password,
      resetToken: undefined,
      resetExpires: undefined,
    });
  },
});

export const patchUser = mutation({
  args: { 
    userId: v.id("users"), 
    email: v.optional(v.string()), 
    password: v.optional(v.string()) 
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    await ctx.db.patch(userId, updates);
  },
});

export const registerUser = action({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    role: v.optional(v.string()),
    designation: v.optional(v.string()),
    employeeId: v.optional(v.string()),
    siteId: v.optional(v.id("sites")),
    phone: v.optional(v.string()),
    joiningDate: v.optional(v.string()),
    requiresAttendancePhoto: v.optional(v.boolean()),
    bloodGroup: v.optional(v.string()),
    emergencyContact: v.optional(v.string()),
    image: v.optional(v.string()),
    gender: v.optional(v.string()),
    dob: v.optional(v.string()),
    address: v.optional(v.string()),
    bankName: v.optional(v.string()),
    bankAccount: v.optional(v.string()),
    pan: v.optional(v.string()),
    pfNumber: v.optional(v.string()),
    pfUan: v.optional(v.string()),
    esicNo: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; userId?: Id<"users">; error?: string }> => {
    try {
      const hashedPassword = await bcrypt.hash(args.password, 10);
      return await ctx.runMutation(internal.users.internalCreateUser, {
        name: args.name,
        email: args.email,
        password: hashedPassword,
        role: args.role || "Staff",
        designation: args.designation,
        employeeId: args.employeeId,
        siteId: args.siteId,
        phone: args.phone,
        joiningDate: args.joiningDate,
        requiresAttendancePhoto: args.requiresAttendancePhoto,
        bloodGroup: args.bloodGroup,
        emergencyContact: args.emergencyContact,
        image: args.image,
        gender: args.gender,
        dob: args.dob,
        address: args.address,
        bankName: args.bankName,
        bankAccount: args.bankAccount,
        pan: args.pan,
        pfNumber: args.pfNumber,
        pfUan: args.pfUan,
        esicNo: args.esicNo,
        location: args.location,
      });
    } catch (e: any) {
      return { success: false, error: e.data || e.message || "Failed to register user" };
    }
  },
});

export const internalCreateUser = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    role: v.optional(v.string()),
    designation: v.optional(v.string()),
    employeeId: v.optional(v.string()),
    siteId: v.optional(v.id("sites")),
    phone: v.optional(v.string()),
    joiningDate: v.optional(v.string()),
    requiresAttendancePhoto: v.optional(v.boolean()),
    bloodGroup: v.optional(v.string()),
    emergencyContact: v.optional(v.string()),
    image: v.optional(v.string()),
    gender: v.optional(v.string()),
    dob: v.optional(v.string()),
    address: v.optional(v.string()),
    bankName: v.optional(v.string()),
    bankAccount: v.optional(v.string()),
    pan: v.optional(v.string()),
    pfNumber: v.optional(v.string()),
    pfUan: v.optional(v.string()),
    esicNo: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; userId?: Id<"users">; error?: string }> => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (existing) return { success: false, error: `An account with the email "${args.email}" is already registered in the team directory.` };

    const roleName = args.role || "Staff";
    let roleTemplate = await ctx.db
      .query("roles")
      .filter((q) => q.eq(q.field("name"), roleName))
      .first();
      
    if (!roleTemplate) {
      roleTemplate = await ctx.db
        .query("roles")
        .filter((q) => q.eq(q.field("name"), "Staff"))
        .first();
    }
      
    const initialPermissions = roleTemplate?.permissions || [];

    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      password: args.password,
      role: roleName,
      permissions: initialPermissions,
      designation: args.designation,
      employeeId: args.employeeId,
      siteId: args.siteId,
      phone: args.phone,
      status: "active",
      joiningDate: args.joiningDate || new Date().toISOString().split('T')[0],
      updatedAt: Date.now(),
      requiresAttendancePhoto: args.requiresAttendancePhoto,
      bloodGroup: args.bloodGroup,
      emergencyContact: args.emergencyContact,
      image: args.image,
      gender: args.gender,
      dob: args.dob,
      address: args.address,
      bankName: args.bankName,
      bankAccount: args.bankAccount,
      pan: args.pan,
      pfNumber: args.pfNumber,
      pfUan: args.pfUan,
      esicNo: args.esicNo,
      location: args.location,
    });

    // Automatically create a personal wallet for the user
    await ctx.db.insert("user_wallets", {
      userId: args.name,
      siteId: args.siteId,
      balance: 0,
      total_credited: 0,
      total_debited: 0,
      totalReturned: 0,
      status: "Active",
      created_at: Date.now(),
    });

    return { success: true, userId };
  },
});

export const migrateOwnerEmail = mutation({
  handler: async (ctx) => {
    const owner = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", "owner@example.com"))
      .unique();
    if (owner) {
      await ctx.db.patch(owner._id, { email: "owner@example.com" });
      return "Owner email updated to owner@example.com";
    }
    return "Owner with email owner@example.com not found";
  },
});

export const getUserFromEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

export const syncUserPermissionsWithNewRoles = mutation({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const roles = await ctx.db.query("roles").collect();

    let updatedCount = 0;
    for (const user of users) {
      const roleTemplate = roles.find(r => r.name === user.role);
      if (roleTemplate) {
        await ctx.db.patch(user._id, { permissions: roleTemplate.permissions });
        updatedCount++;
      }
    }
    return { success: true, updatedCount };
  }
});
export const internalUpdateUser = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    password: v.optional(v.string()),
    role: v.optional(v.string()),
    designation: v.optional(v.string()),
    employeeId: v.optional(v.string()),
    siteId: v.optional(v.id("sites")),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"), v.literal("disabled"), v.literal("deleted"))),
    phone: v.optional(v.string()),
    joiningDate: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
    requiresAttendancePhoto: v.optional(v.boolean()),
    image: v.optional(v.string()),
    bloodGroup: v.optional(v.string()),
    emergencyContact: v.optional(v.string()),
    gender: v.optional(v.string()),
    dob: v.optional(v.string()),
    address: v.optional(v.string()),
    salary: v.optional(v.number()),
    bankName: v.optional(v.string()),
    bankAccount: v.optional(v.string()),
    pan: v.optional(v.string()),
    pfNumber: v.optional(v.string()),
    pfUan: v.optional(v.string()),
    esicNo: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    
    const existingUser = await ctx.db.get(userId);
    if (!existingUser) throw new ConvexError("User not found");
    
    // If role is being updated and has changed, sync permissions
    if (updates.role && updates.role !== existingUser.role) {
      let roleTemplate = await ctx.db
        .query("roles")
        .filter((q) => q.eq(q.field("name"), updates.role))
        .first();
      
      if (!roleTemplate) {
        roleTemplate = await ctx.db
          .query("roles")
          .filter((q) => q.eq(q.field("name"), "Staff"))
          .first();
      }
      
      if (roleTemplate) {
        (updates as any).permissions = roleTemplate.permissions;
      }
    }

    (updates as any).updatedAt = Date.now();
    await ctx.db.patch(userId, updates);
    return { success: true };
  },
});

export const updateUserComprehensive = action({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    password: v.optional(v.string()),
    role: v.optional(v.string()),
    designation: v.optional(v.string()),
    employeeId: v.optional(v.string()),
    siteId: v.optional(v.id("sites")),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"), v.literal("disabled"), v.literal("deleted"))),
    phone: v.optional(v.string()),
    joiningDate: v.optional(v.string()),
    requiresAttendancePhoto: v.optional(v.boolean()),
    image: v.optional(v.string()),
    bloodGroup: v.optional(v.string()),
    emergencyContact: v.optional(v.string()),
    gender: v.optional(v.string()),
    dob: v.optional(v.string()),
    address: v.optional(v.string()),
    salary: v.optional(v.number()),
    bankName: v.optional(v.string()),
    bankAccount: v.optional(v.string()),
    pan: v.optional(v.string()),
    pfNumber: v.optional(v.string()),
    pfUan: v.optional(v.string()),
    esicNo: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      const { password, ...otherUpdates } = args;
      const updates: any = { ...otherUpdates };
      
      if (password && password.trim() !== '') {
        updates.password = await bcrypt.hash(password, 10);
      }
      
      return await ctx.runMutation(internal.users.internalUpdateUser, {
        userId: args.userId,
        ...updates
      });
    } catch (e: any) {
      return { success: false, error: e.data || e.message || "Failed to update user" };
    }
  },
});

export const recreateOwnerAction = action({
  args: {
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const hashedPassword = await bcrypt.hash(args.password, 10);
    return await ctx.runMutation(internal.users.internalRecreateOwner, {
      hashedPassword,
    });
  },
});

export const internalRecreateOwner = internalMutation({
  args: {
    hashedPassword: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const email = "admin@example.com";
    
    const defaultPermissions = [
      { key: 'create_transactions', label: 'Create Transactions', allowed: true },
      { key: 'approve_transactions', label: 'Approve Transactions', allowed: true },
      { key: 'manage_users', label: 'Manage Users', allowed: true },
      { key: 'view_reports', label: 'View Reports', allowed: true },
      { key: 'edit_settings', label: 'Edit Settings', allowed: true },
      { key: 'manage_roles', label: 'Manage Roles', allowed: true },
      { key: 'generate_join_codes', label: 'Generate Join Codes', allowed: true },
      { key: 'manage_invites', label: 'Manage Invites', allowed: true },
      { key: 'manage_sites', label: 'Manage Sites', allowed: true },
      { key: 'manage_company_wallet', label: 'Manage Company Wallet', allowed: true },
      { key: 'manage_attendance', label: 'Manage Attendance', allowed: true },
      { key: 'manage_requirements', label: 'Manage Requirements', allowed: true },
      { key: 'manage_notices', label: 'Manage Notices', allowed: true },
      { key: 'edit_transactions', label: 'Edit Transactions', allowed: true },
      { key: 'manage_user_documents', label: 'Manage User Documents', allowed: true },
      { key: 'generate_hr_documents', label: 'Generate HR Documents', allowed: true },
      { key: 'issue_hr_documents', label: 'Issue HR Documents', allowed: true },
      { key: 'email_hr_documents', label: 'Email HR Documents', allowed: true },
      { key: 'view_hr_documents', label: 'View HR Documents', allowed: true },
      { key: 'manage_hr_documents', label: 'Manage HR Documents', allowed: true },
    ];

    // Check if Owner role template exists, if not create it
    let ownerRole = await ctx.db
      .query("roles")
      .filter((q) => q.eq(q.field("name"), "Owner"))
      .first();
    
    if (!ownerRole) {
      await ctx.db.insert("roles", {
        name: "Owner",
        description: "Full administrative control over all modules",
        permissions: defaultPermissions,
        created_at: Date.now(),
      });
    }

    // Check if the owner user exists
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (!user) {
      // Also try to find by role "owner" or "Owner"
      user = await ctx.db
        .query("users")
        .filter((q) => q.or(q.eq(q.field("role"), "owner"), q.eq(q.field("role"), "Owner")))
        .first();
    }

    const userData = {
      name: "Owner",
      email: email,
      password: args.hashedPassword,
      role: "Owner",
      status: "active" as const,
      permissions: defaultPermissions,
      joiningDate: new Date().toISOString().split('T')[0],
      updatedAt: Date.now(),
    };

    let userId;
    if (user) {
      userId = user._id;
      await ctx.db.patch(userId, userData);
    } else {
      userId = await ctx.db.insert("users", userData);
    }

    // Initialize company wallet if not present
    let wallet = await ctx.db
      .query("company_wallet")
      .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
      .first();

    if (!wallet) {
      await ctx.db.insert("company_wallet", {
        company_name: "Acme Interiors",
        balance: 0,
        total_credited: 0,
        total_debited: 0,
        created_at: Date.now(),
      });
    }

    // Initialize personal wallet for Owner
    let personalWallet = await ctx.db
      .query("user_wallets")
      .withIndex("by_user", (q) => q.eq("userId", "Owner"))
      .first();

    if (!personalWallet) {
      await ctx.db.insert("user_wallets", {
        userId: "Owner",
        balance: 0,
        total_credited: 0,
        total_debited: 0,
        totalReturned: 0,
        status: "Active",
        created_at: Date.now(),
      });
    }

    return { success: true };
  },
});

