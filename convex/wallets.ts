import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

export const normalizeWalletUserId = (name: string): string => {
  const n = (name || "").trim().toUpperCase();
  if (n === "T VENKATESWARA REDDY" || n === "T VENKATESWARA" || n === "T.V. REDDY" || n === "T V REDDY" || n === "TV REDDY") {
    return "T V REDDY";
  }
  if (n === "VINEETH CHINNAM" || n === "VINNETH CHINNAM") {
    return "Vinneth Chinnam";
  }
  if (n === "COMPANY OWNER" || n === "OWNER") {
    return "Company Owner";
  }
  return name;
};

export const testSync = mutation({
  args: {},
  handler: async (ctx) => {
    const duplicate = await ctx.db.get("ms79g06cdcw8yxcnb1j8aa0zvn88fm11" as Id<"user_wallets">);
    if (duplicate) {
      await ctx.db.delete(duplicate._id);
      return "deleted duplicate wallet";
    }
    return "duplicate wallet not found";
  },
});


export const getMyWallet = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const normUserId = normalizeWalletUserId(args.userId);
    const wallet = await ctx.db
      .query("user_wallets")
      .withIndex("by_user", (q) => q.eq("userId", normUserId))
      .first();
    return wallet;
  },
});

export const allocateSiteFunds = mutation({
  args: {
    siteId: v.id("sites"),
    amount: v.number(),
    notes: v.string(),
    allocatedBy: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      let siteWallet = await ctx.db
        .query("site_wallets")
        .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
        .first();

      if (!siteWallet) {
        const walletId = await ctx.db.insert("site_wallets", {
          siteId: args.siteId,
          balance: 0,
          total_credited: 0,
          total_debited: 0,
          created_at: Date.now(),
        });
        siteWallet = (await ctx.db.get(walletId))!;
      }

      const companyWallet = await ctx.db
        .query("company_wallet")
        .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
        .first();

      if (!companyWallet) return { success: false, error: "Company wallet not found" };
      if (companyWallet.balance < args.amount) return { success: false, error: "Insufficient company wallet balance" };

      // Deduct from company wallet
      await ctx.db.patch(companyWallet._id, {
        balance: companyWallet.balance - args.amount,
        total_debited: (companyWallet.total_debited ?? 0) + args.amount,
      });

      // Add to site wallet
      await ctx.db.patch(siteWallet._id, {
        balance: siteWallet.balance + args.amount,
        total_credited: (siteWallet.total_credited ?? 0) + args.amount,
      });

      // Record transaction
      await ctx.db.insert("transactions", {
        type: "DEBIT", // From company perspective
        amount: args.amount,
        source_or_vendor: "Site Allocation",
        purpose: `Allocation to Site: ${args.siteId}`,
        used_by: args.allocatedBy,
        approved_by: "Owner",
        date: new Date().toISOString().split("T")[0],
        status: "APPROVED",
        payment_method: "internal transfer",
        siteId: args.siteId,
        walletId: siteWallet._id,
        fromWalletId: companyWallet._id,
        toWalletId: siteWallet._id,
        isInternalTransfer: true,
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "Allocation failed" };
    }
  },
});

export const topUpTeamWallet = mutation({
  args: {
    siteId: v.id("sites"),
    userId: v.string(),
    amount: v.number(),
    notes: v.string(),
    approvedBy: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      const siteWallet = await ctx.db
        .query("site_wallets")
        .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
        .first();

      if (!siteWallet) return { success: false, error: "Site wallet not found" };
      if (siteWallet.balance < args.amount) return { success: false, error: "Insufficient site wallet balance" };

      let teamWallet = await ctx.db
        .query("team_wallets")
        .withIndex("by_site_user", (q) => q.eq("siteId", args.siteId).eq("userId", args.userId))
        .first();

      if (!teamWallet) {
        const teamWalletId = await ctx.db.insert("team_wallets", {
          siteId: args.siteId,
          userId: args.userId,
          balance: 0,
          total_credited: 0,
          total_debited: 0,
          created_at: Date.now(),
        });
        teamWallet = (await ctx.db.get(teamWalletId))!;
      }

      // Deduct from site wallet
      await ctx.db.patch(siteWallet._id, {
        balance: siteWallet.balance - args.amount,
      });

      // Add to team wallet
      await ctx.db.patch(teamWallet._id, {
        balance: teamWallet.balance + args.amount,
        total_credited: teamWallet.total_credited + args.amount,
        lastTopUpDate: new Date().toISOString().split("T")[0],
      });

      // Record transaction
      await ctx.db.insert("transactions", {
        type: "CREDIT", // To team member
        amount: args.amount,
        source_or_vendor: "Staff Wallet Top-up",
        purpose: `Top-up for ${args.userId} on site ${args.siteId}`,
        used_by: args.userId,
        approved_by: args.approvedBy,
        date: new Date().toISOString().split("T")[0],
        status: "APPROVED",
        payment_method: "internal transfer",
        siteId: args.siteId,
        walletId: teamWallet._id,
        fromWalletId: siteWallet._id,
        toWalletId: teamWallet._id,
        isInternalTransfer: true,
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "Top up failed" };
    }
  },
});

export const returnFunds = mutation({
  args: {
    fromWalletId: v.union(v.id("site_wallets"), v.id("team_wallets")),
    amount: v.number(),
    notes: v.string(),
    processedBy: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      const fromWallet = await ctx.db.get(args.fromWalletId);
      if (!fromWallet) return { success: false, error: "Source wallet not found" };
      if (fromWallet.balance < args.amount) return { success: false, error: "Insufficient balance in source wallet" };

      // If it's a team wallet, return to site wallet
      // If it's a site wallet, return to company wallet
      
      let toWalletId: any;
      if ("userId" in fromWallet) {
        // Team Wallet
        const siteWallet = await ctx.db
          .query("site_wallets")
          .withIndex("by_site", (q) => q.eq("siteId", fromWallet.siteId))
          .first();
        
        if (!siteWallet) return { success: false, error: "Site wallet not found" };

        await ctx.db.patch(fromWallet._id, {
          balance: fromWallet.balance - args.amount,
        });

        await ctx.db.patch(siteWallet._id, {
          balance: siteWallet.balance + args.amount,
        });
        toWalletId = siteWallet._id;
      } else {
        // Site Wallet
        const companyWallet = await ctx.db
          .query("company_wallet")
          .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
          .first();

        if (!companyWallet) return { success: false, error: "Company wallet not found" };

        await ctx.db.patch(fromWallet._id, {
          balance: fromWallet.balance - args.amount,
        });

        await ctx.db.patch(companyWallet._id, {
          balance: companyWallet.balance + args.amount,
          total_debited: (companyWallet.total_debited ?? 0) - args.amount, // Correcting total debited
        });
        toWalletId = companyWallet._id;
      }

      // Record transaction
      await ctx.db.insert("transactions", {
        type: "RETURN",
        amount: args.amount,
        source_or_vendor: "Balance Return",
        purpose: `Return of unused funds: ${args.notes}`,
        used_by: args.processedBy,
        approved_by: "System",
        date: new Date().toISOString().split("T")[0],
        status: "APPROVED",
        payment_method: "internal transfer",
        fromWalletId: fromWallet._id,
        toWalletId,
        isInternalTransfer: true,
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "Return failed" };
    }
  },
});

export const getWallets = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const wallets = await ctx.db.query("user_wallets").collect();
    const pendingRequests = await ctx.db
        .query("transaction_requests")
        .filter(q => q.eq(q.field("status"), "PENDING"))
        .collect();

    return users.map(user => {
        const normUserName = normalizeWalletUserId(user.name);
        const wallet = wallets.find(w => normalizeWalletUserId(w.userId) === normUserName);
        const userPendingCount = pendingRequests.filter(r => normalizeWalletUserId(r.requested_by) === normUserName).length;
        
        return {
            _id: wallet?._id || ("virtual_" + user._id) as any,
            userId: user.name,
            role: user.role, 
            balance: wallet?.balance || 0,
            total_credited: wallet?.total_credited || 0,
            total_debited: wallet?.total_debited || 0,
            totalReturned: wallet?.totalReturned || 0,
            totalTransferredIn: wallet?.totalTransferredIn || 0,
            totalTransferredOut: wallet?.totalTransferredOut || 0,
            status: wallet?.status || "Active",
            lastTopUpDate: wallet?.lastTopUpDate,
            pendingRequests: userPendingCount,
            siteId: wallet?.siteId,
        };
    });
  },
});

export const getWalletStats = query({
  handler: async (ctx) => {
    const wallets = await ctx.db.query("user_wallets").collect();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    
    const transactions = await ctx.db
        .query("transactions")
        .collect();
    
    const filteredTransactions = transactions.filter(t => (t.transactionDate || t.date) >= startOfMonth);

    const companyWallet = await ctx.db
      .query("company_wallet")
      .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
      .first();
    const siteWallets = await ctx.db.query("site_wallets").collect();

    const companyWalletBalance = companyWallet?.balance || 0;
    const siteWalletsBalance = siteWallets.reduce((acc, w) => acc + (w.balance || 0), 0);
    const userWalletsBalance = wallets.reduce((acc, w) => acc + w.balance, 0);

    const totalBalance = companyWalletBalance + userWalletsBalance + siteWalletsBalance;
    const activeCount = wallets.filter(w => w.status === "Active").length;
    
    const addedThisMonth = filteredTransactions
        .filter(t => t.type === "CREDIT" && t.isInternalTransfer)
        .reduce((acc, t) => acc + t.amount, 0);
        
    const spentThisMonth = filteredTransactions
        .filter(t => t.type === "DEBIT" && !t.isInternalTransfer)
        .reduce((acc, t) => acc + t.amount, 0);

    return {
        totalBalance,
        activeCount,
        addedThisMonth,
        spentThisMonth,
    };
  }
});

export const getWalletById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    let wallet: any = null;
    let userId: string = "";

    if (args.id.startsWith("virtual_")) {
        const userDocId = args.id.replace("virtual_", "") as Id<"users">;
        const user = await ctx.db.get(userDocId) as Doc<"users"> | null;
        if (!user) return null;
        const normUserId = normalizeWalletUserId(user.name);
        const actualWallet = await ctx.db
            .query("user_wallets")
            .withIndex("by_user", q => q.eq("userId", normUserId))
            .first();
        if (actualWallet) {
            wallet = actualWallet;
            userId = actualWallet.userId;
        } else {
            wallet = {
                userId: normUserId,
                balance: 0,
                total_credited: 0,
                total_debited: 0,
                totalReturned: 0,
                status: "Active",
                _id: args.id,
            };
            userId = normUserId;
        }
    } else {
        wallet = await ctx.db.get(args.id as Id<"user_wallets">);
        if (!wallet) return null;
        userId = (wallet as Doc<"user_wallets">).userId;
    }

    const normUserId = normalizeWalletUserId(userId);
    const allTransactions = await ctx.db
        .query("transactions")
        .collect();

    const transactions = allTransactions
        .filter(t => 
          normalizeWalletUserId(t.used_by) === normUserId ||
          (t.sourceId && normalizeWalletUserId(t.sourceId) === normUserId) ||
          (t.destinationId && normalizeWalletUserId(t.destinationId) === normUserId) ||
          t.fromWalletId === wallet._id ||
          t.toWalletId === wallet._id ||
          t.walletId === wallet._id
        )
        .sort((a, b) => {
          const dateA = a.transactionDate || a.date;
          const dateB = b.transactionDate || b.date;
          if (dateA !== dateB) {
            return dateB.localeCompare(dateA);
          }
          return b._creationTime - a._creationTime;
        });

    return { ...wallet, transactions };
  },
});


export const createUserWallet = mutation({
  args: {
    userId: v.string(),
    siteId: v.optional(v.id("sites")),
  },
  handler: async (ctx, args) => {
    const normUserId = normalizeWalletUserId(args.userId);
    const existing = await ctx.db
        .query("user_wallets")
        .withIndex("by_user", q => q.eq("userId", normUserId))
        .first();
    if (existing) return existing._id;

    return await ctx.db.insert("user_wallets", {
      userId: normUserId,
      siteId: args.siteId,
      balance: 0,
      total_credited: 0,
      total_debited: 0,
      totalReturned: 0,
      status: "Active",
      created_at: Date.now(),
    });
  },
});

export const topUpUserWallet = mutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    siteId: v.union(v.id("sites"), v.string()), // Allow "COMPANY"
    notes: v.string(),
    approvedBy: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      if (args.amount <= 0) return { success: false, error: "Amount must be positive" };

      const normUserId = normalizeWalletUserId(args.userId);
      let wallet = await ctx.db
          .query("user_wallets")
          .withIndex("by_user", q => q.eq("userId", normUserId))
          .first();

      if (!wallet) {
          const id = await ctx.db.insert("user_wallets", {
              userId: normUserId,
              siteId: args.siteId === "COMPANY" ? undefined : (args.siteId as Id<"sites">),
              balance: 0,
              total_credited: 0,
              total_debited: 0,
              totalReturned: 0,
              status: "Active",
              created_at: Date.now(),
          });
          wallet = (await ctx.db.get(id))!;
      }

      if (wallet.status !== "Active") return { success: false, error: "Cannot top up a non-active wallet" };

      const isCompanySource = args.siteId === "COMPANY";
      let sourceName = "";
      let sourceWalletId: any;

      if (isCompanySource) {
        const companyWallet = await ctx.db
          .query("company_wallet")
          .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
          .first();
        if (!companyWallet) return { success: false, error: "Company wallet not found" };
        if (companyWallet.balance < args.amount) {
          return { success: false, error: `Insufficient company vault balance. Current available: ₹${companyWallet.balance.toLocaleString()}.` };
        }
        
        await ctx.db.patch(companyWallet._id, {
          balance: companyWallet.balance - args.amount,
          total_debited: (companyWallet.total_debited ?? 0) + args.amount,
        });
        sourceName = "Company Vault";
        sourceWalletId = companyWallet._id;
      } else {
        // Strictly deduct from Site source
        const siteWallet = await ctx.db
          .query("site_wallets")
          .withIndex("by_site", (q) => q.eq("siteId", args.siteId as Id<"sites">))
          .first();
        
        if (!siteWallet) return { success: false, error: "Site wallet not found for the selected project" };
        if (siteWallet.balance < args.amount) {
          return { 
            success: false, 
            error: `Insufficient site budget. Current available: ₹${siteWallet.balance.toLocaleString()}. Please allocate more funds to the site from the company vault first.` 
          };
        }

        // Update Site Wallet (Deduct)
        await ctx.db.patch(siteWallet._id, { 
          balance: siteWallet.balance - args.amount 
        });
        sourceName = "Site Budget";
        sourceWalletId = siteWallet._id;
      }

      // Record Balances
      const beforeBalance = wallet.balance;
      const afterBalance = wallet.balance + args.amount;

      // Update User Wallet (Add)
      await ctx.db.patch(wallet._id, {
        balance: afterBalance,
        siteId: isCompanySource ? wallet.siteId : (args.siteId as Id<"sites">), // Update current project context only if site is selected
        total_credited: (wallet.total_credited ?? 0) + args.amount,
        lastTopUpDate: new Date().toISOString().split("T")[0],
      });

      // Record transaction
      await ctx.db.insert("transactions", {
        type: "CREDIT", 
        amount: args.amount,
        before_balance: beforeBalance,
        after_balance: afterBalance,
        source_or_vendor: sourceName,
        purpose: `Wallet Top-up: ${args.notes}`,
        used_by: args.userId,
        performed_by: args.approvedBy, 
        approved_by: args.approvedBy,
        date: new Date().toISOString().split("T")[0],
        status: "APPROVED",
        payment_method: "internal transfer",
        siteId: isCompanySource ? wallet.siteId : (args.siteId as Id<"sites">),
        walletId: wallet._id as any,
        fromWalletId: sourceWalletId,
        toWalletId: wallet._id,
        isInternalTransfer: true,
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "Top up failed" };
    }
  },
});

export const updateWalletStatus = mutation({
  args: {
    id: v.id("user_wallets"),
    status: v.union(v.literal("Active"), v.literal("Frozen"), v.literal("Archived")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
    return { success: true };
  },
});

export const returnUserFunds = mutation({
  args: {
    walletId: v.id("user_wallets"),
    amount: v.number(),
    notes: v.string(),
    processedBy: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      const wallet = await ctx.db.get(args.walletId);
      if (!wallet) return { success: false, error: "Wallet not found" };
      if (wallet.balance < args.amount) return { success: false, error: "Insufficient balance" };

      const companyWallet = await ctx.db
        .query("company_wallet")
        .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
        .first();
      
      if (!companyWallet) return { success: false, error: "Company wallet not found" };

      const beforeBalance = wallet.balance;
      const afterBalance = wallet.balance - args.amount;

      await ctx.db.patch(wallet._id, {
        balance: afterBalance,
        totalReturned: (wallet.totalReturned || 0) + args.amount,
      });

      await ctx.db.patch(companyWallet._id, {
        balance: companyWallet.balance + args.amount,
        total_debited: (companyWallet.total_debited ?? 0) - args.amount,
      });

      await ctx.db.insert("transactions", {
        type: "RETURN",
        amount: args.amount,
        before_balance: beforeBalance,
        after_balance: afterBalance,
        source_or_vendor: "Balance Return",
        purpose: `Wallet Return: ${args.notes}`,
        used_by: wallet.userId,
        performed_by: args.processedBy,
        approved_by: args.processedBy,
        date: new Date().toISOString().split("T")[0],
        status: "APPROVED",
        payment_method: "internal transfer",
        walletId: wallet._id as any,
        fromWalletId: wallet._id,
        toWalletId: companyWallet._id,
        isInternalTransfer: true,
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "Return failed" };
    }
  },
});

export const getCompanyVaultBalance = query({
  handler: async (ctx) => {
    const wallet = await ctx.db
      .query("company_wallet")
      .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
      .first();
    return wallet?.balance || 0;
  },
});

export const getSiteBudgets = query({
  handler: async (ctx) => {
    const sites = await ctx.db.query("sites").collect();
    const siteWallets = await ctx.db.query("site_wallets").collect();
    
    return sites.map(site => {
      const wallet = siteWallets.find(w => w.siteId === site._id);
      return {
        _id: wallet?._id,
        siteId: site._id,
        name: site.name,
        balance: wallet?.balance || 0,
      };
    });
  },
});

export const getWalletTransactions = query({
  args: { 
    walletId: v.optional(v.string()), // Can be userId or walletId
    type: v.optional(v.string()) 
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("transactions");
    
    const all = await q.order("desc").collect();
    
    if (args.walletId) {
      return all.filter(t => 
        t.used_by === args.walletId || 
        t.walletId === args.walletId || 
        t.fromWalletId === args.walletId || 
        t.toWalletId === args.walletId ||
        t.sourceId === args.walletId ||
        t.destinationId === args.walletId
      );
    }
    
    if (args.type) {
      return all.filter(t => t.transactionType === args.type || t.type === args.type);
    }
    
    return all;
  },
});

export const topUpStaffWallet = mutation({
  args: {
    userId: v.string(),
    amount: v.number(),
    reason: v.string(),
    performedBy: v.string(), // Name of the user performing the action
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Permission Check
      const performer = await ctx.db.query("users").filter(q => q.eq(q.field("name"), args.performedBy)).first();
      if (!performer) return { success: false, error: "User not found" };
      
      const hasPerm = performer.role === "Owner" || 
                      performer.permissions?.find(p => (p.key === "manage_company_wallet" || p.name === "manage_company_wallet") && p.allowed);
      if (!hasPerm) return { success: false, error: "Unauthorized: Missing manage_company_wallet permission" };

      if (args.amount <= 0) return { success: false, error: "Amount must be positive" };

      // 2. Get/Create User Wallet
      const normUserId = normalizeWalletUserId(args.userId);
      let wallet = await ctx.db
          .query("user_wallets")
          .withIndex("by_user", q => q.eq("userId", normUserId))
          .first();

      if (!wallet) {
          const id = await ctx.db.insert("user_wallets", {
              userId: normUserId,
              balance: 0,
              total_credited: 0,
              total_debited: 0,
              totalReturned: 0,
              status: "Active",
              created_at: Date.now(),
          });
          wallet = (await ctx.db.get(id))!;
      }

      if (wallet.status !== "Active") return { success: false, error: "Cannot top up a non-active wallet" };

      // 3. Deduct from Company Vault
      const companyWallet = await ctx.db
        .query("company_wallet")
        .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
        .first();
      
      if (!companyWallet) return { success: false, error: "Company vault not found" };
      if (companyWallet.balance < args.amount) {
        return { success: false, error: `Insufficient company vault balance. Current available: ₹${companyWallet.balance.toLocaleString()}.` };
      }
      
      await ctx.db.patch(companyWallet._id, {
        balance: companyWallet.balance - args.amount,
        total_debited: (companyWallet.total_debited ?? 0) + args.amount,
      });

      // 4. Update User Wallet
      const beforeBalance = wallet.balance;
      const afterBalance = wallet.balance + args.amount;

      await ctx.db.patch(wallet._id, {
        balance: afterBalance,
        total_credited: (wallet.total_credited ?? 0) + args.amount,
        lastTopUpDate: new Date().toISOString().split("T")[0],
      });

      // 5. Record Transaction
      await ctx.db.insert("transactions", {
        type: "CREDIT", 
        transactionType: "top_up",
        amount: args.amount,
        before_balance: beforeBalance,
        after_balance: afterBalance,
        sourceType: "Company Vault",
        sourceName: "Company Vault",
        destinationType: "Staff Wallet",
        destinationId: wallet._id,
        destinationName: args.userId,
        source_or_vendor: "Company Vault",
        purpose: args.reason,
        used_by: args.userId,
        performed_by: args.performedBy, 
        approved_by: args.performedBy,
        createdBy: args.performedBy,
        approvedBy: args.performedBy,
        date: new Date().toISOString().split("T")[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: "COMPLETED",
        payment_method: "internal transfer",
        walletId: wallet._id as any,
        toWalletId: wallet._id,
        fromWalletId: companyWallet._id,
        isInternalTransfer: true,
        created_at: Date.now(),
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "Top up failed" };
    }
  },
});

export const reallocateFunds = mutation({
  args: {
    sourceType: v.union(v.literal("Staff Wallet"), v.literal("Site Budget"), v.literal("Company Vault")),
    sourceId: v.string(), // can be userId, siteId, or empty for Vault
    destinationType: v.union(v.literal("Staff Wallet"), v.literal("Site Budget"), v.literal("Company Vault")),
    destinationId: v.string(),
    amount: v.number(),
    reason: v.string(),
    performedBy: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Permission Check
      const performer = await ctx.db.query("users").filter(q => q.eq(q.field("name"), args.performedBy)).first();
      if (!performer) return { success: false, error: "User not found" };
      
      const hasPerm = performer.role === "Owner" || 
                      performer.permissions?.find(p => (p.key === "manage_company_wallet" || p.name === "manage_company_wallet") && p.allowed);
      if (!hasPerm) return { success: false, error: "Unauthorized: Missing manage_company_wallet permission" };

      if (args.amount <= 0) return { success: false, error: "Amount must be positive" };
      if (args.sourceType === args.destinationType && args.sourceId === args.destinationId) {
        return { success: false, error: "Source and destination cannot be the same" };
      }

      // 2. Get Source Wallet
      let fromWallet: any = null;
      let fromName = "";
      
      if (args.sourceType === "Company Vault") {
        fromWallet = await ctx.db.query("company_wallet").filter(q => q.eq(q.field("company_name"), "Acme Interiors")).first();
        fromName = "Company Vault";
      } else if (args.sourceType === "Site Budget") {
        const site = await ctx.db.get(args.sourceId as Id<"sites">);
        if (!site) return { success: false, error: "Source site not found" };
        fromWallet = await ctx.db.query("site_wallets").withIndex("by_site", q => q.eq("siteId", site._id)).first();
        fromName = `Site: ${site.name}`;
      } else {
        // Staff Wallet
        const normSourceId = normalizeWalletUserId(args.sourceId);
        fromWallet = await ctx.db.query("user_wallets").withIndex("by_user", q => q.eq("userId", normSourceId)).first();
        fromName = `Staff: ${normSourceId}`;
      }

      if (!fromWallet) return { success: false, error: "Source wallet not found" };
      if (fromWallet.balance < args.amount) return { success: false, error: "Insufficient funds in source" };

      // 3. Get/Create Destination Wallet
      let toWallet: any = null;
      let toName = "";

      if (args.destinationType === "Company Vault") {
        toWallet = await ctx.db.query("company_wallet").filter(q => q.eq(q.field("company_name"), "Acme Interiors")).first();
        toName = "Company Vault";
      } else if (args.destinationType === "Site Budget") {
        const site = await ctx.db.get(args.destinationId as Id<"sites">);
        if (!site) return { success: false, error: "Destination site not found" };
        toWallet = await ctx.db.query("site_wallets").withIndex("by_site", q => q.eq("siteId", site._id)).first();
        if (!toWallet) {
           const id = await ctx.db.insert("site_wallets", { siteId: site._id, balance: 0, total_credited: 0, total_debited: 0, created_at: Date.now() });
           toWallet = (await ctx.db.get(id))!;
        }
        toName = `Site: ${site.name}`;
      } else {
        // Staff Wallet
        const normDestId = normalizeWalletUserId(args.destinationId);
        toWallet = await ctx.db.query("user_wallets").withIndex("by_user", q => q.eq("userId", normDestId)).first();
        if (!toWallet) {
          const id = await ctx.db.insert("user_wallets", { userId: normDestId, balance: 0, total_credited: 0, total_debited: 0, totalReturned: 0, status: "Active", created_at: Date.now() });
          toWallet = (await ctx.db.get(id))!;
        }
        toName = `Staff: ${normDestId}`;
      }

      if (!toWallet) return { success: false, error: "Destination wallet not found" };

      // 4. Execute Atomic Patches
      const fromOriginalBalance = fromWallet.balance;
      const toOriginalBalance = toWallet.balance;

      // Deduct from Source
      if (args.sourceType === "Company Vault") {
        await ctx.db.patch(fromWallet._id, { balance: fromWallet.balance - args.amount, total_debited: (fromWallet.total_debited ?? 0) + args.amount });
      } else if (args.sourceType === "Site Budget") {
        await ctx.db.patch(fromWallet._id, { balance: fromWallet.balance - args.amount, total_debited: (fromWallet.total_debited || 0) + args.amount });
      } else {
        await ctx.db.patch(fromWallet._id, { 
          balance: fromWallet.balance - args.amount, 
          totalTransferredOut: (fromWallet.totalTransferredOut || 0) + args.amount 
        });
      }

      // Add to Destination
      if (args.destinationType === "Company Vault") {
        await ctx.db.patch(toWallet._id, { balance: toWallet.balance + args.amount });
      } else if (args.destinationType === "Site Budget") {
        await ctx.db.patch(toWallet._id, { balance: toWallet.balance + args.amount, total_credited: (toWallet.total_credited || 0) + args.amount });
      } else {
        await ctx.db.patch(toWallet._id, { 
          balance: toWallet.balance + args.amount, 
          totalTransferredIn: (toWallet.totalTransferredIn || 0) + args.amount 
        });
      }

      // 5. Record Audit Log
      await ctx.db.insert("transactions", {
        type: "TRANSFER",
        transactionType: "reallocation",
        amount: args.amount,
        before_balance: fromOriginalBalance,
        after_balance: fromOriginalBalance - args.amount,
        fromWalletId: fromWallet._id,
        toWalletId: toWallet._id,
        sourceType: args.sourceType,
        sourceId: args.sourceId,
        sourceName: fromName,
        destinationType: args.destinationType,
        destinationId: args.destinationId,
        destinationName: toName,
        source_or_vendor: `Reallocation: ${fromName} → ${toName}`,
        purpose: args.reason,
        used_by: (toWallet as any).userId || "System",
        performed_by: args.performedBy,
        approved_by: args.performedBy,
        createdBy: args.performedBy,
        approvedBy: args.performedBy,
        date: new Date().toISOString().split("T")[0],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: "COMPLETED",
        isInternalTransfer: true,
        created_at: Date.now(),
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "Reallocation failed" };
    }
  },
});
export const initializeAllUserWallets = mutation({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let createdCount = 0;
    for (const user of users) {
      const normUserId = normalizeWalletUserId(user.name);
      const existing = await ctx.db
        .query("user_wallets")
        .withIndex("by_user", q => q.eq("userId", normUserId))
        .first();
      
      if (!existing) {
        await ctx.db.insert("user_wallets", {
          userId: normUserId,
          balance: 0,
          total_credited: 0,
          total_debited: 0,
          totalReturned: 0,
          status: "Active",
          created_at: Date.now(),
        });
        createdCount++;
      }
    }
    return { success: true, createdCount };
  }
});
