import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const classifyTransaction = (t: any): "external_credit" | "expense_debit" | "internal_transfer" | "adjustment" => {
  const typeLower = (t.type || "").toLowerCase();
  const txTypeLower = (t.transactionType || "").toLowerCase();
  const srcTypeLower = (t.sourceType || "").toLowerCase();
  const dstTypeLower = (t.destinationType || "").toLowerCase();
  const purposeLower = (t.purpose || "").toLowerCase();
  const paymentMethodLower = (t.payment_method || "").toLowerCase();

  if (t.isInternalTransfer === true) {
    return "internal_transfer";
  }

  if (typeLower === "adjustment" || t.type === "ADJUSTMENT") {
    return "adjustment";
  }

  const isSrcInternal = 
    srcTypeLower.includes("vault") || 
    srcTypeLower.includes("wallet") || 
    srcTypeLower.includes("budget") ||
    t.fromWalletId !== undefined ||
    t.source_or_vendor === "Company Vault" ||
    t.source_or_vendor === "Balance Return" ||
    t.source_or_vendor === "Site Allocation" ||
    t.source_or_vendor === "Staff Wallet Top-up";

  const isDstInternal = 
    dstTypeLower.includes("vault") || 
    dstTypeLower.includes("wallet") || 
    dstTypeLower.includes("budget") ||
    t.toWalletId !== undefined ||
    t.purpose?.includes("Allocation to Site") ||
    t.purpose?.includes("Top-up for") ||
    t.purpose?.includes("Wallet Return") ||
    txTypeLower === "top_up" ||
    txTypeLower === "reallocation";

  if (
    typeLower === "transfer" || 
    typeLower === "return" ||
    txTypeLower === "reallocation" ||
    txTypeLower === "top_up" ||
    paymentMethodLower === "internal transfer" ||
    (isSrcInternal && isDstInternal)
  ) {
    return "internal_transfer";
  }

  if (
    typeLower === "credit" || 
    typeLower === "income" || 
    typeLower === "external_credit" ||
    txTypeLower === "external_credit" ||
    purposeLower.startsWith("deposit:")
  ) {
    if (t.source_or_vendor === "Company Vault" || t.source_or_vendor === "Balance Return") {
      return "internal_transfer";
    }
    return "external_credit";
  }

  if (
    typeLower === "debit" || 
    typeLower === "expense" || 
    typeLower === "spend" || 
    typeLower === "payment" || 
    typeLower === "expense_debit"
  ) {
    if (t.source_or_vendor === "Site Allocation" || purposeLower.startsWith("allocation to site")) {
      return "internal_transfer";
    }
    return "expense_debit";
  }

  if (t.type === "CREDIT") return "external_credit";
  if (t.type === "DEBIT") return "expense_debit";
  return "expense_debit";
};

export const getSites = query({
  handler: async (ctx) => {
    const sites = await ctx.db.query("sites").order("desc").collect();
    const transactions = await ctx.db.query("transactions").collect();
    
    const sitesWithWallets = await Promise.all(
      sites.map(async (site) => {
        const wallet = await ctx.db
          .query("site_wallets")
          .withIndex("by_site", (q) => q.eq("siteId", site._id))
          .first();
        
        const siteTransactions = transactions.filter(t => t.siteId === site._id);
        
        const calculated_allocated = wallet?.total_credited || 0;
        const calculated_spent = siteTransactions
          .filter(t => (t.status === "APPROVED" || t.status === "COMPLETED") && classifyTransaction(t) === "expense_debit")
          .reduce((sum, t) => sum + t.amount, 0);
        const calculated_balance = calculated_allocated - calculated_spent;

        return {
          ...site,
          wallet: wallet ? {
            ...wallet,
            calculated_allocated,
            calculated_spent,
            calculated_balance
          } : null,
        };
      })
    );
    return sitesWithWallets;
  },
});

export const getSiteFinancesForDashboard = query({
  handler: async (ctx) => {
    const sites = await ctx.db.query("sites").collect();
    const allTransactions = await ctx.db.query("transactions").collect();

    const siteFinances = await Promise.all(sites.map(async (site) => {
      const siteTransactions = allTransactions.filter(t => t.siteId === site._id);
      
      const wallet = await ctx.db.query("site_wallets").withIndex("by_site", q => q.eq("siteId", site._id)).first();
      
      const totalAssigned = wallet?.total_credited || 0;
      const totalExpenses = siteTransactions
        .filter(t => (t.status === "APPROVED" || t.status === "COMPLETED") && classifyTransaction(t) === "expense_debit")
        .reduce((sum, t) => sum + t.amount, 0);
      const fundsAvailable = totalAssigned - totalExpenses;

      return {
        id: site._id,
        name: site.name,
        location: site.location,
        status: site.status,
        totalAssigned,
        totalExpenses,
        fundsAvailable,
      };
    }));
    
    return siteFinances;
  },
});

export const getSiteById = query({
  args: { id: v.id("sites") },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.id);
    if (!site) return null;
    
    const wallet = await ctx.db
      .query("site_wallets")
      .withIndex("by_site", (q) => q.eq("siteId", args.id))
      .first();
      
    const teamWallets = await Promise.all(
        site.teamMembers.map(async (userId) => {
            const userWallet = await ctx.db
                .query("user_wallets")
                .withIndex("by_user", q => q.eq("userId", userId))
                .first();
            
            // Only return the actual wallet if it belongs to THIS site
            if (userWallet && userWallet.siteId === args.id) {
                return userWallet;
            }
            
            // Otherwise return a zero-balance "placeholder" for this site's context
            return { userId, balance: 0, total_credited: 0, total_debited: 0, status: "Active" };
        })
    );
      
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("siteId"), args.id))
      .collect();

    // Compute "Allocated"
    const totalAllocated = wallet?.total_credited || 0;
    const totalSpent = transactions
      .filter(t => (t.status === "APPROVED" || t.status === "COMPLETED") && classifyTransaction(t) === "expense_debit")
      .reduce((sum, t) => sum + t.amount, 0);
    const fundsAvailable = totalAllocated - totalSpent;

    return {
      ...site,
      wallet: wallet ? {
        ...wallet,
        calculated_allocated: totalAllocated,
        calculated_spent: totalSpent,
        calculated_balance: fundsAvailable
      } : null,
      teamWallets,
    };
  },
});

export const createSite = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    location: v.string(),
    status: v.union(v.literal("Active"), v.literal("On Hold"), v.literal("Completed"), v.literal("Archived")),
    startDate: v.string(),
    expectedEndDate: v.optional(v.string()),
    projectType: v.optional(v.union(
      v.literal("Commercial"),
      v.literal("Residential"),
      v.literal("Villa"),
      v.literal("Apartments"),
      v.literal("Others")
    )),
    managerId: v.string(),
    clientName: v.string(),
    teamMembers: v.array(v.string()),
    notes: v.string(),
    requiresAttendancePhoto: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; siteId?: Id<"sites">; error?: string }> => {
    try {
      // Check if site code already exists
      const existing = await ctx.db
        .query("sites")
        .withIndex("by_code", (q) => q.eq("code", args.code))
        .first();
      if (existing) return { success: false, error: "A site with this code already exists." };

      const siteId = await ctx.db.insert("sites", {
        ...args,
        created_at: Date.now(),
      });

      // Initialize site wallet
      await ctx.db.insert("site_wallets", {
        siteId,
        balance: 0,
        total_credited: 0,
        total_debited: 0,
        created_at: Date.now(),
      });

      return { success: true, siteId };
    } catch (e: any) {
      return { success: false, error: e.data || e.message || "Failed to create site" };
    }
  },
});

export const updateSite = mutation({
  args: {
    id: v.id("sites"),
    name: v.string(),
    code: v.string(),
    location: v.string(),
    status: v.union(v.literal("Active"), v.literal("On Hold"), v.literal("Completed"), v.literal("Archived")),
    startDate: v.string(),
    expectedEndDate: v.optional(v.string()),
    projectType: v.optional(v.union(
      v.literal("Commercial"),
      v.literal("Residential"),
      v.literal("Villa"),
      v.literal("Apartments"),
      v.literal("Others")
    )),
    managerId: v.string(),
    clientName: v.string(),
    teamMembers: v.array(v.string()),
    notes: v.string(),
    requiresAttendancePhoto: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      const { id, ...updates } = args;
      
      // Check code uniqueness if changed
      const current = await ctx.db.get(id);
      if (current?.code !== updates.code) {
        const existing = await ctx.db
          .query("sites")
          .withIndex("by_code", (q) => q.eq("code", updates.code))
          .first();
        if (existing) return { success: false, error: "A site with this code already exists." };
      }

      await ctx.db.patch(id, updates);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.data || e.message || "Failed to update site" };
    }
  },
});

export const deleteSite = mutation({
  args: { id: v.id("sites") },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      // Check if site has any transactions or balance
      const wallet = await ctx.db
        .query("site_wallets")
        .withIndex("by_site", (q) => q.eq("siteId", args.id))
        .first();
      
      if (wallet && wallet.balance > 0) {
        return { success: false, error: "Cannot delete a site with active balance. Return funds to company wallet first." };
      }

      // Check for transactions
      const transactions = await ctx.db
        .query("transactions")
        .filter((q) => q.eq(q.field("siteId"), args.id))
        .first();
      
      if (transactions) {
        return { success: false, error: "Cannot delete a site with transaction history. Archive it instead." };
      }

      await ctx.db.delete(args.id);
      // Delete associated wallet if exists
      if (wallet) await ctx.db.delete(wallet._id);
      
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.data || e.message || "Failed to delete site" };
    }
  },
});

export const addTeamMember = mutation({
  args: { siteId: v.id("sites"), userId: v.string() },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");
    
    if (site.teamMembers.includes(args.userId)) {
      return { success: false, error: "Member already assigned to this site" };
    }
    
    const newMembers = [...site.teamMembers, args.userId];
    await ctx.db.patch(args.siteId, { teamMembers: newMembers });
    
    return { success: true };
  },
});

export const removeTeamMember = mutation({
  args: { siteId: v.id("sites"), userId: v.string() },
  handler: async (ctx, args) => {
    const site = await ctx.db.get(args.siteId);
    if (!site) throw new Error("Site not found");
    
    const newMembers = site.teamMembers.filter(m => m !== args.userId);
    await ctx.db.patch(args.siteId, { teamMembers: newMembers });
    
    return { success: true };
  },
});
