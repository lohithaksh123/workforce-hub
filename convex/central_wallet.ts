import { mutation, query, internalMutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";

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

// Internal helper to record every movement
export const recordTransaction = internalMutation({
  args: {
    type: v.union(v.literal("CREDIT"), v.literal("DEBIT")),
    amount: v.number(),
    source_or_vendor: v.string(),
    purpose: v.string(),
    used_by: v.string(),
    approved_by: v.optional(v.string()),
    date: v.string(),
    status: v.literal("APPROVED"),
    requestId: v.optional(v.id("transaction_requests")),
    payment_method: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await ctx.db.insert("transactions", {
      ...args,
      time,
    });
  },
});

export const getFinancialSummary = query({
  args: {
    siteId: v.optional(v.id("sites")),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "APPROVED"),
          q.eq(q.field("status"), "COMPLETED")
        )
      )
      .collect();

    // Helper to safely classify transactions
    const classifyTransaction = (t: any): "external_credit" | "expense_debit" | "internal_transfer" | "adjustment" => {
      const typeLower = (t.type || "").toLowerCase();
      const txTypeLower = (t.transactionType || "").toLowerCase();
      const srcTypeLower = (t.sourceType || "").toLowerCase();
      const dstTypeLower = (t.destinationType || "").toLowerCase();
      const purposeLower = (t.purpose || "").toLowerCase();
      const paymentMethodLower = (t.payment_method || "").toLowerCase();

      // 1. Explicit internal transfer flags
      if (t.isInternalTransfer === true) {
        return "internal_transfer";
      }

      // 2. Adjustments
      if (typeLower === "adjustment" || t.type === "ADJUSTMENT") {
        return "adjustment";
      }

      // 3. Check if source and destination are both internal wallets/locations
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

      // 4. Mappings for credit / income / external_credit
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

      // 5. Mappings for debit / expense / spend / payment
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

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonthRaw = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    let totalReceived = 0;
    let totalSpent = 0;

    let currentMonthInflow = 0;
    let lastMonthInflow = 0;
    let currentMonthOutflow = 0;
    let lastMonthOutflow = 0;

    // Fetch wallets to compute company-wide totals
    const companyWallet = await ctx.db
      .query("company_wallet")
      .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
      .first();
    const userWallets = await ctx.db.query("user_wallets").collect();
    const siteWallets = await ctx.db.query("site_wallets").collect();

    const companyWalletBalance = companyWallet?.balance || 0;
    const employeeWalletsBalance = userWallets.reduce((acc, w) => acc + (w.balance || 0), 0);
    const siteWalletsBalance = siteWallets.reduce((acc, w) => acc + (w.balance || 0), 0);
    const totalAvailableBalance = companyWalletBalance + employeeWalletsBalance + siteWalletsBalance;

    let balance = 0;

    if (args.userId) {
      // Employee Dashboard Calculation
      const normUserId = normalizeWalletUserId(args.userId);
      const userWallet = userWallets.find(w => normalizeWalletUserId(w.userId) === normUserId);
      balance = userWallet?.balance || 0;

      transactions.forEach((t) => {
        if (normalizeWalletUserId(t.used_by) !== normUserId) return;

        const tDate = new Date(t.transactionDate || t.date);
        const tMonth = tDate.getMonth();
        const tYear = tDate.getFullYear();
        const isCurrentMonth = tMonth === thisMonth && tYear === thisYear;
        const isLastMonth = tMonth === lastMonthRaw && tYear === lastMonthYear;

        const classification = classifyTransaction(t);

        // Credit: Funds received into this specific wallet (including top-ups and user transfers)
        if (t.type === "CREDIT" || classification === "internal_transfer") {
          // If it is an internal transfer but it is a debit (from staff wallet perspective, e.g. return), ignore for credit
          if (classification === "internal_transfer" && (t.type === "DEBIT" || t.type === "RETURN")) {
            return;
          }
          totalReceived += t.amount;
          if (isCurrentMonth) currentMonthInflow += t.amount;
          if (isLastMonth) lastMonthInflow += t.amount;
        } 
        // Debit / Expenses: Money spent by employee outside the system
        else if (classification === "expense_debit") {
          totalSpent += t.amount;
          if (isCurrentMonth) currentMonthOutflow += t.amount;
          if (isLastMonth) lastMonthOutflow += t.amount;
        }
      });
    } else if (args.siteId) {
      // Site Dashboard Calculation
      const siteWallet = siteWallets.find(w => w.siteId === args.siteId);
      balance = siteWallet?.balance || 0;

      transactions.forEach((t) => {
        if (t.siteId !== args.siteId) return;

        const tDate = new Date(t.transactionDate || t.date);
        const tMonth = tDate.getMonth();
        const tYear = tDate.getFullYear();
        const isCurrentMonth = tMonth === thisMonth && tYear === thisYear;
        const isLastMonth = tMonth === lastMonthRaw && tYear === lastMonthYear;

        const classification = classifyTransaction(t);

        // Credit: Funds assigned/credited to this site
        if (t.type === "CREDIT" || (classification === "internal_transfer" && t.toWalletId === siteWallet?._id)) {
          totalReceived += t.amount;
          if (isCurrentMonth) currentMonthInflow += t.amount;
          if (isLastMonth) lastMonthInflow += t.amount;
        } 
        // Debit / Expenses: Actual expenditures spent outside on this site
        else if (classification === "expense_debit") {
          totalSpent += t.amount;
          if (isCurrentMonth) currentMonthOutflow += t.amount;
          if (isLastMonth) lastMonthOutflow += t.amount;
        }
      });
    } else {
      // Owner/Company Dashboard Calculation
      balance = totalAvailableBalance;

      transactions.forEach((t) => {
        const tDate = new Date(t.transactionDate || t.date);
        const tMonth = tDate.getMonth();
        const tYear = tDate.getFullYear();
        const isCurrentMonth = tMonth === thisMonth && tYear === thisYear;
        const isLastMonth = tMonth === lastMonthRaw && tYear === lastMonthYear;

        const classification = classifyTransaction(t);

        // Sum all external credit received
        if (classification === "external_credit") {
          totalReceived += t.amount;
          if (isCurrentMonth) currentMonthInflow += t.amount;
          if (isLastMonth) lastMonthInflow += t.amount;
        }

        // Sum all external spends (company + employees + sites)
        if (classification === "expense_debit") {
          totalSpent += t.amount;
          if (isCurrentMonth) currentMonthOutflow += t.amount;
          if (isLastMonth) lastMonthOutflow += t.amount;
        }
      });
    }

    const calculateTrend = (current: number, last: number) => {
      if (last === 0) return { value: current > 0 ? 100 : 0, direction: "up" as const };
      const diff = ((current - last) / last) * 100;
      return {
        value: Math.round(Math.abs(diff)),
        direction: diff >= 0 ? ("up" as const) : ("down" as const),
      };
    };

    return {
      balance,
      totalReceived,
      totalSpent,
      companyWalletBalance,
      employeeWalletsBalance,
      siteWalletsBalance,
      totalAvailableBalance,
      inflowTrend: calculateTrend(currentMonthInflow, lastMonthInflow),
      outflowTrend: calculateTrend(currentMonthOutflow, lastMonthOutflow),
    };
  },
});

export const getAllTransactions = query({
  handler: async (ctx) => {
    const transactions = await ctx.db.query("transactions").collect();
    return transactions.sort((a, b) => {
      const dateA = a.transactionDate || a.date;
      const dateB = b.transactionDate || b.date;
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      return b._creationTime - a._creationTime;
    });
  },
});

export const getReportsData = query({
  args: {
    siteId: v.optional(v.id("sites")),
  },
  handler: async (ctx, args) => {
    let transactions;
    if (args.siteId) {
      transactions = await ctx.db
        .query("transactions")
        .filter((q) => q.eq(q.field("siteId"), args.siteId))
        .collect();
    } else {
      transactions = await ctx.db.query("transactions").collect();
    }
    
    const monthlyData: Record<string, { month: string, revenue: number, spent: number }> = {};
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const vendorData: Record<string, number> = {};
    const requesterData: Record<string, number> = {};
    
    transactions.forEach(t => {
      const date = new Date(t.transactionDate || t.date || Date.now());
      const monthIndex = date.getMonth();
      const month = months[monthIndex];
      
      if (!monthlyData[month]) {
        monthlyData[month] = { month, revenue: 0, spent: 0 };
      }
      
      if (t.type === "CREDIT") {
        monthlyData[month].revenue += t.amount;
      } else if (t.type === "DEBIT") {
        monthlyData[month].spent += t.amount;
        
        // Only track vendor/requester for DEBIT
        if (t.source_or_vendor) {
          vendorData[t.source_or_vendor] = (vendorData[t.source_or_vendor] || 0) + t.amount;
        }
        if (t.used_by) {
          requesterData[t.used_by] = (requesterData[t.used_by] || 0) + t.amount;
        }
      }
    });

    // Attendance Reports Integration
    const attendance = await ctx.db.query("attendance").collect();
    const attendanceByMonth: Record<string, { month: string, present: number, late: number, leave: number }> = {};
    
    attendance.forEach(a => {
        const date = new Date(a.date);
        const month = months[date.getMonth()];
        
        if (!attendanceByMonth[month]) attendanceByMonth[month] = { month, present: 0, late: 0, leave: 0 };
        
        if (a.status === "Leave" || a.status === "Half-day-leave") {
            attendanceByMonth[month].leave++;
        } else if (a.status !== "Absent") {
            attendanceByMonth[month].present++;
            if (a.status === "Late") attendanceByMonth[month].late++;
        }
    });

    const totalPresent = attendance.filter(a => a.status !== "Leave" && a.status !== "Half-day-leave" && a.status !== "Absent").length;
    const totalLeave = attendance.filter(a => a.status === "Leave" || a.status === "Half-day-leave").length;
    const totalLate = attendance.filter(a => a.status === "Late").length;

    return {
      monthly: Object.values(monthlyData).sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month)),
      vendors: Object.entries(vendorData).map(([name, value]) => ({ name, value })),
      requesters: Object.entries(requesterData).map(([employee, amount]) => ({ employee, amount })),
      attendance: {
          monthly: Object.values(attendanceByMonth).sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month)),
          totalPresent,
          totalLeave,
          totalLate,
          totalOvertime: attendance.reduce((acc, a) => acc + Math.max(0, (a.totalHours || 0) - 8), 0)
      }
    };
  },
});

export const getWallet = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("company_wallet")
      .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
      .first();
  },
});

export const initializeWallet = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("company_wallet")
      .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
      .first();
    
    if (existing) return existing._id;

    return await ctx.db.insert("company_wallet", {
      company_name: "Acme Interiors",
      balance: 0,
      total_credited: 0,
      total_debited: 0,
      created_at: Date.now(),
    });
  },
});

export const addOwnerMoney = mutation({
  // Mutation to add money to company wallet
  args: {
    amount: v.number(),
    source: v.string(), 
    source_name: v.string(),
    siteId: v.optional(v.id("sites")),
    notes: v.string(),
    added_by: v.string(),
    date: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      let wallet = await ctx.db
        .query("company_wallet")
        .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
        .first();

      if (!wallet) {
        const newWalletId = await ctx.db.insert("company_wallet", {
          company_name: "Acme Interiors",
          balance: 0,
          total_credited: 0,
          total_debited: 0,
          created_at: Date.now(),
        });
        wallet = await ctx.db.get(newWalletId);
      }

      if (!wallet) return { success: false, error: "Failed to initialize wallet" };

      let finalBalance = wallet.balance;
      let finalTotalCredited = wallet.total_credited ?? 0;
      let finalTotalDebited = wallet.total_debited ?? 0;

      if (args.siteId) {
        // Since we are allocating directly to a site, the money is added to the company wallet and immediately deducted to go to the site.
        // Thus, company balance is unchanged, but external credit and internal debit counts both increase.
        finalTotalCredited += args.amount;
        finalTotalDebited += args.amount;
      } else {
        // Deposited into company wallet directly without allocation
        finalBalance += args.amount;
        finalTotalCredited += args.amount;
      }

      await ctx.db.patch(wallet._id, {
        balance: finalBalance,
        total_credited: finalTotalCredited,
        total_debited: finalTotalDebited,
      });

      await ctx.db.insert("wallet_additions", {
          amount: args.amount,
          source: args.source,
          source_name: args.source_name,
          notes: args.notes,
          added_by: args.added_by,
          date: args.date,
      });

      // Unified Transaction Recording
      await ctx.db.insert("transactions", {
        type: "CREDIT",
        amount: args.amount,
        source_or_vendor: args.source_name,
        purpose: "Deposit: " + (args.notes || args.source),
        used_by: args.added_by,
        date: args.date,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: "APPROVED",
        payment_method: args.source,
        siteId: args.siteId,
        toWalletId: wallet._id,
      });

      // Auto-allocate to Site if provided
      if (args.siteId) {
        const siteWallet = await ctx.db
            .query("site_wallets")
            .withIndex("by_site", q => q.eq("siteId", args.siteId as any))
            .first();

        if (siteWallet) {
            // Add to site wallet
            await ctx.db.patch(siteWallet._id, {
                balance: siteWallet.balance + args.amount,
                total_credited: (siteWallet.total_credited || 0) + args.amount
            });

            // Log the allocation (internal transfer)
            await ctx.db.insert("transactions", {
                type: "DEBIT",
                amount: args.amount,
                source_or_vendor: "Site Allocation",
                purpose: "Auto-allocated from direct deposit: " + args.source_name,
                used_by: "System",
                date: args.date,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: "APPROVED",
                payment_method: "Auto",
                siteId: args.siteId,
                walletId: siteWallet._id,
                fromWalletId: wallet._id,
                toWalletId: siteWallet._id,
                isInternalTransfer: true
            });
        }
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.data || e.message || "Failed to add money" };
    }
  },
});


export const syncWalletFromTransactions = mutation({
  handler: async (ctx) => {
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "APPROVED"),
          q.eq(q.field("status"), "COMPLETED")
        )
      )
      .collect();
      
    const wallet = await ctx.db
      .query("company_wallet")
      .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
      .first();

    if (!wallet) return { balance: 0, received: 0, spent: 0 };

    let balance = 0;
    let received = 0;
    let spent = 0;

    transactions.forEach(t => {
      // Only count external flows for Received/Spent totals
      const isExternal = t.isInternalTransfer !== true;

      // 1. If explicit modern wallet IDs are set, use them
      if (t.toWalletId === wallet._id) {
        balance += t.amount;
        if (isExternal) received += t.amount;
      } else if (t.fromWalletId === wallet._id) {
        balance -= t.amount;
        if (isExternal) spent += t.amount;
      } 
      // 2. Fall back to legacy rules if both fromWalletId and toWalletId are absent
      else if (!t.fromWalletId && !t.toWalletId) {
        const isDepositToVault = t.type === "CREDIT" && !t.isInternalTransfer && !t.walletId;
        const isAllocationFromVault = t.type === "DEBIT" && t.isInternalTransfer && t.purpose.startsWith("Allocation to Site");
        const isExpenseFromVault = t.type === "DEBIT" && !t.isInternalTransfer && !t.walletId;
        const isTopUpFromVault = t.type === "CREDIT" && t.isInternalTransfer && (t.source_or_vendor === "Company Vault" || t.sourceType === "Company Vault" || t.purpose.includes("Fund Request"));
        const isReturnToVault = t.type === "RETURN" && (t.purpose.includes("unused funds") || t.purpose.includes("Wallet Return") || t.source_or_vendor === "Balance Return");

        if (isDepositToVault) {
          balance += t.amount;
          if (isExternal) received += t.amount;
        } else if (isAllocationFromVault) {
          balance -= t.amount;
        } else if (isExpenseFromVault) {
          balance -= t.amount;
          if (isExternal) spent += t.amount;
        } else if (isTopUpFromVault) {
          balance -= t.amount;
        } else if (isReturnToVault) {
          balance += t.amount;
        }
      }
    });

    await ctx.db.patch(wallet._id, {
      balance,
      total_credited: received,
      total_debited: spent,
    });
    
    return { balance, received, spent };
  }
});

export const getRoleSpending = query({
  handler: async (ctx) => {
    const outTransactions = await ctx.db
      .query("transactions")
      .filter((q) => q.and(
        q.eq(q.field("type"), "DEBIT"),
        q.or(
          q.eq(q.field("status"), "APPROVED"),
          q.eq(q.field("status"), "COMPLETED")
        ),
        q.neq(q.field("isInternalTransfer"), true)
      ))
      .collect();

    const roleSpending: Record<string, number> = {};
    const users = await ctx.db.query("users").collect();
    const roles = await ctx.db.query("roles").collect();
    
    const userRoleMap: Record<string, string> = {};
    users.forEach(u => {
      userRoleMap[normalizeWalletUserId(u.name)] = u.role;
    });

    const validRoleNames = new Set(roles.map(r => r.name));

    // Initialize with all roles to ensure "Reserved" positions
    roles.forEach(r => {
      roleSpending[r.name] = 0;
    });

    for (const tx of outTransactions) {
      // 1. Try to find role via user name lookup
      // 2. If fails, check if used_by IS a role name (for testing roles)
      // 3. Fallback to 'Staff'
      const normUsedBy = normalizeWalletUserId(tx.used_by);
      const role = userRoleMap[normUsedBy] || 
                   (validRoleNames.has(tx.used_by) ? tx.used_by : "Staff");
      
      roleSpending[role] = (roleSpending[role] || 0) + tx.amount;
    }

    const roleColors: Record<string, string> = {
      "Owner": "#6366f1",      // Indigo
      "Admin": "#ec4899",      // Pink
      "Supervisor": "#10b981", // Emerald
      "Designer": "#3b82f6",   // Blue
      "Manager": "#8b5cf6",    // Purple
      "Accountant": "#6366f1", // Also Indigo
      "Intern": "#f59e0b",     // Amber
      "Staff": "#94a3b8",      // Slate
    };

    return Object.entries(roleSpending)
      .map(([role, amount]) => ({
        role,
        amount,
        fill: roleColors[role] || "#94a3b8"
      }))
      .sort((a, b) => b.amount - a.amount);
  },
});

