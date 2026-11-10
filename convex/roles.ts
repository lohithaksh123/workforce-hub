import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getRoles = query({
  handler: async (ctx) => {
    return await ctx.db.query("roles").order("desc").collect();
  },
});

export const createRole = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    permissions: v.array(v.object({
      key: v.string(),
      label: v.string(),
      allowed: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("roles", {
      ...args,
      created_at: Date.now(),
    });
  },
});

export const updateRole = mutation({
  args: {
    id: v.id("roles"),
    name: v.string(),
    description: v.string(),
    permissions: v.array(v.object({
      key: v.string(),
      label: v.string(),
      allowed: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
    // 1. Update the role template itself
    await ctx.db.patch(id, updates);
    
    // 2. Cascade changes: Find all users with this role name
    const usersWithRole = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), updates.name))
      .collect();
      
    // 3. Update their individual permissions arrays to match the new template
    for (const user of usersWithRole) {
      await ctx.db.patch(user._id, { permissions: updates.permissions });
    }
  },
});

export const deleteRole = mutation({
  args: { id: v.id("roles") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const resetRolesToPicture2 = mutation({
  handler: async (ctx) => {
    // 1. Wipe existing roles
    const existing = await ctx.db.query("roles").collect();
    for (const r of existing) {
      await ctx.db.delete(r._id);
    }

    const defaultPermissions = [
      { key: 'create_transactions', label: 'Create Transactions', allowed: false },
      { key: 'approve_transactions', label: 'Approve Transactions', allowed: false },
      { key: 'manage_users', label: 'Manage Users', allowed: false },
      { key: 'view_reports', label: 'View Reports', allowed: false },
      { key: 'edit_settings', label: 'Edit Settings', allowed: false },
      { key: 'manage_roles', label: 'Manage Roles', allowed: false },
      { key: 'generate_join_codes', label: 'Generate Join Codes', allowed: false },
      { key: 'manage_invites', label: 'Manage Invites', allowed: false },
      { key: 'manage_sites', label: 'Manage Sites', allowed: false },
      { key: 'manage_company_wallet', label: 'Manage Company Wallet', allowed: false },
      { key: 'manage_attendance', label: 'Manage Attendance', allowed: false },
      { key: 'manage_requirements', label: 'Manage Requirements', allowed: false },
      { key: 'manage_notices', label: 'Manage Notices', allowed: false },
      { key: 'edit_transactions', label: 'Edit Transactions', allowed: false },
      { key: 'manage_user_documents', label: 'Manage User Documents', allowed: false },
      { key: 'generate_hr_documents', label: 'Generate HR Documents', allowed: false },
      { key: 'issue_hr_documents', label: 'Issue HR Documents', allowed: false },
      { key: 'email_hr_documents', label: 'Email HR Documents', allowed: false },
      { key: 'view_hr_documents', label: 'View HR Documents', allowed: false },
      { key: 'manage_hr_documents', label: 'Manage HR Documents', allowed: false },
      { key: 'manage_estimates', label: 'Manage Estimates', allowed: false },
      { key: 'create_estimates', label: 'Create Estimates', allowed: false },
      { key: 'edit_estimates', label: 'Edit Estimates', allowed: false },
      { key: 'approve_estimates', label: 'Approve Estimates', allowed: false },
      { key: 'convert_estimate_to_budget', label: 'Convert Estimate to Site Budget', allowed: false },
      { key: 'view_estimate_reports', label: 'View Estimate Reports', allowed: false },
      { key: 'manage_rate_library', label: 'Manage Rate Library', allowed: false },
      { key: 'manage_estimate_templates', label: 'Manage Estimate Templates', allowed: false },
    ];

    const picture2Roles = [
      {
        name: 'Intern',
        description: 'Learner - view and create requests',
        permissions: defaultPermissions.map(p => ({
          ...p,
          allowed: ['create_transactions', 'view_reports'].includes(p.key)
        })),
      },
      {
        name: 'Staff',
        description: 'Field staff - basic portal access',
        permissions: defaultPermissions.map(p => ({
          ...p,
          allowed: ['create_transactions', 'view_reports'].includes(p.key)
        })),
      },
      {
        name: 'Accountant',
        description: 'Financial management and audit access',
        permissions: defaultPermissions.map(p => ({
          ...p,
          allowed: ['create_transactions', 'approve_transactions', 'view_reports', 'manage_company_wallet', 'edit_transactions'].includes(p.key)
        })),
      },
      {
        name: 'Project Manager',
        description: 'Site management and team oversight',
        permissions: defaultPermissions.map(p => ({
          ...p,
          allowed: ['create_transactions', 'approve_transactions', 'manage_users', 'view_reports', 'manage_sites', 'manage_attendance', 'manage_requirements'].includes(p.key)
        })),
      },
      {
        name: 'Owner',
        description: 'Full administrative control over all modules',
        permissions: defaultPermissions.map(p => ({
          ...p,
          allowed: true
        })),
      },
    ];

    for (const role of picture2Roles) {
      await ctx.db.insert("roles", {
        ...role,
        created_at: Date.now(),
      });
    }
    
    return { success: true, count: picture2Roles.length };
  }
});

export const syncUsersWithRoleTemplates = mutation({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const roles = await ctx.db.query("roles").collect();
    let count = 0;

    for (const user of users) {
      const template = roles.find(r => r.name === user.role);
      if (template) {
        // Construct merged permissions: respect existing overrides if keys match, otherwise use template
        const mergedPermissions = template.permissions.map(tp => {
           // Look for existing permission by key or name
           const existing = (user.permissions as any[])?.find(p => p.key === tp.key || p.name === tp.label);
           return {
             ...tp,
             allowed: existing ? existing.allowed : tp.allowed
           };
        });

        await ctx.db.patch(user._id, { 
          permissions: mergedPermissions,
          updatedAt: Date.now()
        });
        count++;
      }
    }
    return { success: true, updated: count };
  }
});
