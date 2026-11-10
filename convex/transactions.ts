import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const getTransactions = query({
  args: {},
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

export const getTransactionsBySite = query({
  args: { siteId: v.id("sites") },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.or(
        q.eq(q.field("siteId"), args.siteId),
        q.eq(q.field("sourceId"), args.siteId as any),
        q.eq(q.field("destinationId"), args.siteId as any)
      ))
      .collect();
    
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

export const getTransactionsByVendor = query({
  args: { vendorName: v.string() },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .filter((q) => q.eq(q.field("source_or_vendor"), args.vendorName))
      .collect();
    
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

export const attachBill = mutation({
  args: {
    transactionId: v.id("transactions"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.transactionId, {
      billStorageId: args.storageId,
    });
  },
});

export const deleteBill = mutation({
  args: {
    transactionId: v.id("transactions"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.transactionId, {
      billStorageId: undefined,
    });
    await ctx.storage.delete(args.storageId);
  },
});

// Helper for permission checks
async function validatePermission(ctx: any, userName: string, permissionKey: string) {
    const user = await ctx.db.query("users").filter((q: any) => q.eq(q.field("name"), userName)).first();
    if (!user) throw new Error("User not found");
    if (user.status === "disabled") throw new Error("Your account is disabled. Please contact the owner.");
    if (user.status === "deleted") throw new Error("Your account has been removed.");
    const isOwner = user.role === "Owner";
    const hasPermission = user.permissions?.find((p: any) => p.key === permissionKey && p.allowed);
    if (!isOwner && !hasPermission) {
        throw new Error(`Unauthorized: Missing ${permissionKey} permission`);
    }
    return user;
}

// 1. Create Manual Transaction (Income / Expense)
export const createManualTransaction = mutation({
  args: {
    type: v.union(v.literal("CREDIT"), v.literal("DEBIT")),
    transactionDate: v.string(),
    time: v.optional(v.string()),
    amount: v.number(),
    siteId: v.optional(v.id("sites")),
    source_or_vendor: v.optional(v.string()),
    purpose: v.string(),
    payment_method: v.string(),
    notes: v.optional(v.string()),
    performed_by: v.string(),
  },
  handler: async (ctx, args) => {
    await validatePermission(ctx, args.performed_by, "create_transactions");

    if (args.amount <= 0) throw new Error("Amount must be greater than 0");
    const today = new Date().toISOString().split('T')[0];
    if (args.transactionDate > today) throw new Error("Future transaction dates are not allowed.");

    let fromWalletId: any = undefined;
    let toWalletId: any = undefined;

    // Update balances
    if (args.siteId) {
        const siteWallet = await ctx.db.query("site_wallets").withIndex("by_site", (q: any) => q.eq("siteId", args.siteId)).first();
        if (siteWallet) {
            const diff = args.type === "CREDIT" ? args.amount : -args.amount;
            await ctx.db.patch(siteWallet._id, {
                balance: siteWallet.balance + diff,
                [args.type === "CREDIT" ? "total_credited" : "total_debited"]: (siteWallet[args.type === "CREDIT" ? "total_credited" : "total_debited"] || 0) + args.amount
            });
            if (args.type === "CREDIT") {
                toWalletId = siteWallet._id;
            } else {
                fromWalletId = siteWallet._id;
            }
        }
    } else {
        const companyWallet = await ctx.db.query("company_wallet").filter((q: any) => q.eq(q.field("company_name"), "Acme Interiors")).first();
        if (companyWallet) {
            const diff = args.type === "CREDIT" ? args.amount : -args.amount;
            await ctx.db.patch(companyWallet._id, {
                balance: companyWallet.balance + diff,
                [args.type === "CREDIT" ? "total_credited" : "total_debited"]: (companyWallet[args.type === "CREDIT" ? "total_credited" : "total_debited"] || 0) + args.amount
            });
            if (args.type === "CREDIT") {
                toWalletId = companyWallet._id;
            } else {
                fromWalletId = companyWallet._id;
            }
        }
    }

    return await ctx.db.insert("transactions", {
      ...args,
      date: args.transactionDate,
      status: "COMPLETED",
      created_at: Date.now(),
      used_by: args.performed_by,
      fromWalletId,
      toWalletId,
    });
  },
});

// 2. Create Staff Wallet Transfer
export const createStaffWalletTransfer = mutation({
  args: {
    transactionDate: v.string(),
    time: v.optional(v.string()),
    fromType: v.union(v.literal("Company Vault"), v.literal("Staff Wallet"), v.literal("Site Budget")),
    fromId: v.optional(v.string()), // userId or siteId
    toType: v.union(v.literal("Company Vault"), v.literal("Staff Wallet"), v.literal("Site Budget")),
    toId: v.optional(v.string()), // userId or siteId
    amount: v.number(),
    reason: v.string(),
    notes: v.optional(v.string()),
    performed_by: v.string(),
  },
  handler: async (ctx, args) => {
    await validatePermission(ctx, args.performed_by, "manage_company_wallet");

    if (args.amount <= 0) throw new Error("Amount must be greater than 0");
    if (args.fromType === args.toType && args.fromId === args.toId) throw new Error("Source and destination cannot be the same");

    const today = new Date().toISOString().split('T')[0];
    if (args.transactionDate > today) throw new Error("Future transaction dates are not allowed.");

    // Deduct from Source
    let fromWalletId: any;
    let fromName: string = args.fromType;
    if (args.fromType === "Company Vault") {
        const vault = await ctx.db.query("company_wallet").first();
        if (!vault || vault.balance < args.amount) throw new Error("Insufficient funds in Company Vault");
        await ctx.db.patch(vault._id, { balance: vault.balance - args.amount, total_debited: (vault.total_debited || 0) + args.amount });
        fromWalletId = vault._id;
    } else if (args.fromType === "Site Budget") {
        const siteWallet = await ctx.db.query("site_wallets").withIndex("by_site", (q: any) => q.eq("siteId", args.fromId as Id<"sites">)).first();
        if (!siteWallet || siteWallet.balance < args.amount) throw new Error("Insufficient funds in Site Budget");
        await ctx.db.patch(siteWallet._id, { balance: siteWallet.balance - args.amount, total_debited: (siteWallet.total_debited || 0) + args.amount });
        fromWalletId = siteWallet._id;
        fromName = `Site: ${args.fromId}`;
    } else {
        const staffWallet = await ctx.db.query("user_wallets").withIndex("by_user", (q: any) => q.eq("userId", args.fromId!)).first();
        if (!staffWallet || staffWallet.balance < args.amount) throw new Error("Insufficient funds in Staff Wallet");
        await ctx.db.patch(staffWallet._id, { balance: staffWallet.balance - args.amount, totalTransferredOut: (staffWallet.totalTransferredOut || 0) + args.amount });
        fromWalletId = staffWallet._id;
        fromName = `Staff: ${args.fromId}`;
    }

    // Add to Destination
    let toWalletId: any;
    let toName: string = args.toType;
    if (args.toType === "Company Vault") {
        const vault = await ctx.db.query("company_wallet").first();
        if (!vault) throw new Error("Company Vault not found");
        await ctx.db.patch(vault._id, { balance: vault.balance + args.amount, total_credited: (vault.total_credited || 0) + args.amount });
        toWalletId = vault._id;
    } else if (args.toType === "Site Budget") {
        const siteWallet = await ctx.db.query("site_wallets").withIndex("by_site", (q: any) => q.eq("siteId", args.toId as Id<"sites">)).first();
        if (!siteWallet) throw new Error("Site Budget not found");
        await ctx.db.patch(siteWallet._id, { balance: siteWallet.balance + args.amount, total_credited: (siteWallet.total_credited || 0) + args.amount });
        toWalletId = siteWallet._id;
        toName = `Site: ${args.toId}`;
    } else {
        let staffWallet = await ctx.db.query("user_wallets").withIndex("by_user", (q: any) => q.eq("userId", args.toId!)).first();
        if (!staffWallet) {
            const id = await ctx.db.insert("user_wallets", { userId: args.toId!, balance: 0, totalReturned: 0, status: "Active", created_at: Date.now() });
            staffWallet = (await ctx.db.get(id))!;
        }
        await ctx.db.patch(staffWallet._id, { balance: staffWallet.balance + args.amount, totalTransferredIn: (staffWallet.totalTransferredIn || 0) + args.amount });
        toWalletId = staffWallet._id;
        toName = `Staff: ${args.toId}`;
    }

    return await ctx.db.insert("transactions", {
      type: "TRANSFER",
      amount: args.amount,
      purpose: args.reason,
      date: args.transactionDate,
      time: args.time,
      status: "COMPLETED",
      performed_by: args.performed_by,
      used_by: args.toType === "Staff Wallet" ? args.toId! : args.performed_by,
      fromWalletId,
      toWalletId,
      sourceType: args.fromType,
      sourceId: args.fromId,
      sourceName: fromName,
      destinationType: args.toType,
      destinationId: args.toId,
      destinationName: toName,
      isInternalTransfer: true,
      created_at: Date.now(),
      transactionDate: args.transactionDate,
      notes: args.notes,
    });
  },
});

// 3. Create Company Vault Adjustment
export const createCompanyVaultAdjustment = mutation({
  args: {
    transactionDate: v.string(),
    adjustmentType: v.union(v.literal("Add Balance"), v.literal("Reduce Balance")),
    amount: v.number(),
    reason: v.string(),
    notes: v.optional(v.string()),
    performed_by: v.string(),
  },
  handler: async (ctx, args) => {
    await validatePermission(ctx, args.performed_by, "manage_company_wallet");

    if (args.amount <= 0) throw new Error("Amount must be greater than 0");
    
    const vault = await ctx.db.query("company_wallet").first();
    if (!vault) throw new Error("Company Vault not found");

    const diff = args.adjustmentType === "Add Balance" ? args.amount : -args.amount;
    await ctx.db.patch(vault._id, { 
        balance: vault.balance + diff,
        [args.adjustmentType === "Add Balance" ? "total_credited" : "total_debited"]: (vault[args.adjustmentType === "Add Balance" ? "total_credited" : "total_debited"] || 0) + args.amount
    });

    const fromWalletId = args.adjustmentType === "Reduce Balance" ? vault._id : undefined;
    const toWalletId = args.adjustmentType === "Add Balance" ? vault._id : undefined;

    return await ctx.db.insert("transactions", {
      type: "ADJUSTMENT",
      amount: args.amount,
      purpose: args.reason,
      date: args.transactionDate,
      status: "COMPLETED",
      performed_by: args.performed_by,
      used_by: "Company Vault",
      source_or_vendor: "Vault Adjustment",
      isInternalTransfer: true,
      created_at: Date.now(),
      transactionDate: args.transactionDate,
      notes: args.notes,
      fromWalletId,
      toWalletId,
    });
  },
});

// Helper to adjust wallet balances during edits
async function adjustBalanceSync(ctx: any, type: string, amount: number, info: { walletId?: Id<any>, siteId?: any, used_by?: string, isInternal?: boolean, isReverse?: boolean }) {
    let walletDoc: any = null;
    
    // 1. Try explicit walletId
    if (info.walletId) {
        walletDoc = await ctx.db.get(info.walletId);
    }

    // 2. Try siteId -> site_wallets
    if (!walletDoc && info.siteId && info.siteId !== 'all') {
        walletDoc = await ctx.db.query("site_wallets")
            .withIndex("by_site", (q: any) => q.eq("siteId", info.siteId))
            .first();
    }

    // 3. Try used_by -> user_wallets
    if (!walletDoc && info.used_by && !["Company Vault", "Vault Adjustment", "N/A"].includes(info.used_by)) {
        walletDoc = await ctx.db.query("user_wallets")
            .withIndex("by_user", (q: any) => q.eq("userId", info.used_by!))
            .first();
    }

    // 4. Fallback to Company Vault
    if (!walletDoc) {
        walletDoc = await ctx.db.query("company_wallet").first();
    }

    if (!walletDoc) return;

    const diff = type === "CREDIT" ? amount : -amount;
    const patch: any = { balance: (walletDoc.balance || 0) + diff };

    // Update totals appropriately
    const totalDiff = info.isReverse ? -amount : amount;
    const totalType = info.isReverse ? (type === "CREDIT" ? "DEBIT" : "CREDIT") : type; // Use the actual transaction type for total field selection

    if (info.isInternal) {
        if ("totalTransferredIn" in walletDoc) {
            const field = totalType === "CREDIT" ? "totalTransferredIn" : "totalTransferredOut";
            patch[field] = Math.max(0, (walletDoc[field] || 0) + totalDiff);
        } else if ("total_credited" in walletDoc) {
            const field = totalType === "CREDIT" ? "total_credited" : "total_debited";
            patch[field] = Math.max(0, (walletDoc[field] || 0) + totalDiff);
        }
    } else {
        if ("total_credited" in walletDoc) {
            const field = totalType === "CREDIT" ? "total_credited" : "total_debited";
            patch[field] = Math.max(0, (walletDoc[field] || 0) + totalDiff);
        }
    }

    await ctx.db.patch(walletDoc._id, patch);
}

// 4. Update Transaction (Robust Edit)
export const updateTransaction = mutation({
  args: {
    id: v.id("transactions"),
    type: v.optional(v.union(v.literal("CREDIT"), v.literal("DEBIT"), v.literal("TRANSFER"), v.literal("RETURN"), v.literal("ADJUSTMENT"))),
    transactionDate: v.optional(v.string()),
    time: v.optional(v.string()),
    amount: v.optional(v.number()),
    siteId: v.optional(v.union(v.id("sites"), v.literal("all"))),
    source_or_vendor: v.optional(v.string()),
    purpose: v.optional(v.string()),
    payment_method: v.optional(v.string()),
    notes: v.optional(v.string()),
    reasonForEdit: v.string(),
    edited_by: v.string(),
  },
  handler: async (ctx, args) => {
    const { id, edited_by, reasonForEdit, ...updates } = args;
    
    // 1. Get current user & Check permission
    const performer = await ctx.db.query("users").filter(q => q.eq(q.field("name"), edited_by)).first();
    if (!performer) throw new Error("User not found");
    
    const hasPerm = performer.role === "Owner" || 
                    performer.permissions?.find(p => (p.key === "edit_transactions" || p.name === "edit_transactions") && p.allowed);
    if (!hasPerm) throw new Error("You do not have permission to edit transactions.");

    // 3. Fetch old transaction
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Transaction not found");

    // 4. Validate new amount
    if (updates.amount !== undefined && updates.amount <= 0) throw new Error("Amount must be greater than 0");

    const isFinancialChange = 
        (updates.amount !== undefined && updates.amount !== existing.amount) ||
        (updates.type !== undefined && updates.type !== existing.type) ||
        (updates.siteId !== undefined && updates.siteId !== existing.siteId);

    let balanceAdjustmentSummary = "No financial change.";

    if (isFinancialChange) {
        // Only affect balance if already APPROVED or COMPLETED
        const affectsBalance = existing.status === "APPROVED" || existing.status === "COMPLETED";

        if (affectsBalance) {
            // PHASE 1: Reverse Old Effect
            if (existing.type === "TRANSFER") {
                await adjustBalanceSync(ctx, "CREDIT", existing.amount, { 
                    walletId: existing.fromWalletId, 
                    siteId: existing.sourceType === "Site Budget" ? existing.sourceId : undefined,
                    used_by: existing.sourceType === "Staff Wallet" ? existing.sourceId : undefined,
                    isInternal: true,
                    isReverse: true
                });
                await adjustBalanceSync(ctx, "DEBIT", existing.amount, { 
                    walletId: existing.toWalletId, 
                    siteId: existing.destinationType === "Site Budget" ? existing.destinationId : undefined,
                    used_by: existing.destinationType === "Staff Wallet" ? existing.destinationId : undefined,
                    isInternal: true,
                    isReverse: true
                });
            } else {
                const reverseType = existing.type === "CREDIT" ? "DEBIT" : "CREDIT";
                await adjustBalanceSync(ctx, reverseType, existing.amount, { 
                    walletId: existing.walletId, 
                    siteId: existing.siteId, 
                    used_by: existing.used_by,
                    isInternal: existing.isInternalTransfer,
                    isReverse: true
                });
            }

            // PHASE 2: Apply New Effect
            const newType = updates.type || existing.type;
            const newAmount = updates.amount !== undefined ? updates.amount : existing.amount;
            const newSiteId = updates.siteId !== undefined ? (updates.siteId === 'all' ? undefined : updates.siteId) : existing.siteId;

            if (newType === "TRANSFER") {
                await adjustBalanceSync(ctx, "DEBIT", newAmount, { 
                    walletId: existing.fromWalletId, 
                    siteId: existing.sourceType === "Site Budget" ? existing.sourceId : undefined,
                    used_by: existing.sourceType === "Staff Wallet" ? existing.sourceId : undefined,
                    isInternal: true
                });
                await adjustBalanceSync(ctx, "CREDIT", newAmount, { 
                    walletId: existing.toWalletId, 
                    siteId: existing.destinationType === "Site Budget" ? existing.destinationId : undefined,
                    used_by: existing.destinationType === "Staff Wallet" ? existing.destinationId : undefined,
                    isInternal: true
                });
                balanceAdjustmentSummary = `Transfer amount corrected from ₹${existing.amount.toLocaleString()} to ₹${newAmount.toLocaleString()}. Both accounts adjusted.`;
            } else {
                await adjustBalanceSync(ctx, newType, newAmount, { 
                    walletId: existing.walletId, 
                    siteId: newSiteId, 
                    used_by: existing.used_by,
                    isInternal: existing.isInternalTransfer
                });
                
                const delta = newAmount - existing.amount;
                if (newType === "DEBIT") {
                    balanceAdjustmentSummary = delta > 0 
                        ? `Expense increased by ₹${delta.toLocaleString()}. ₹${delta.toLocaleString()} deducted from balance.`
                        : `Expense reduced by ₹${Math.abs(delta).toLocaleString()}. ₹${Math.abs(delta).toLocaleString()} returned to balance.`;
                } else if (newType === "CREDIT") {
                    balanceAdjustmentSummary = delta > 0
                        ? `Income increased by ₹${delta.toLocaleString()}. ₹${delta.toLocaleString()} added to balance.`
                        : `Income reduced by ₹${Math.abs(delta).toLocaleString()}. ₹${Math.abs(delta).toLocaleString()} removed from balance.`;
                }
            }

            let adjustmentAmount = 0;
            if (newType === existing.type) {
                adjustmentAmount = Math.abs(newAmount - existing.amount);
            } else {
                adjustmentAmount = newAmount + existing.amount;
            }

            // Create Wallet History Correction Entry (for transparency)
            // We insert a separate transaction of type ADJUSTMENT that doesn't affect balance itself (since we already did it)
            await ctx.db.insert("transactions", {
                type: "ADJUSTMENT",
                amount: adjustmentAmount, // Reflects the actual delta applied to the balance
                purpose: `Correction: ${balanceAdjustmentSummary}`,
                used_by: existing.used_by,
                date: new Date().toISOString().split("T")[0],
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: "COMPLETED",
                performed_by: edited_by,
                notes: `Original Transaction ID: ${id}. Reason: ${reasonForEdit}`,
                siteId: existing.siteId,
                isInternalTransfer: true
            });
        }
    }

    // Update the transaction record
    const patchData: any = { ...updates };
    if (updates.transactionDate) patchData.date = updates.transactionDate;
    if (updates.siteId === 'all') patchData.siteId = undefined;
    
    await ctx.db.patch(id, patchData);

    // Audit Log
    await ctx.db.insert("audit_logs", {
        transactionId: id,
        editedBy: edited_by,
        editedAt: Date.now(),
        oldValues: {
            type: existing.type,
            amount: existing.amount,
            date: existing.transactionDate || existing.date,
            siteId: existing.siteId,
            purpose: existing.purpose,
            source_or_vendor: existing.source_or_vendor,
            payment_method: existing.payment_method,
        },
        newValues: updates,
        reasonForEdit,
        balanceAdjustmentSummary,
    });

    return { success: true, balanceAdjustmentSummary };
  },
});

export const verifyTransactionStatus = mutation({
  args: {
    id: v.id("transactions"),
    status: v.union(v.literal("PENDING"), v.literal("APPROVED"), v.literal("REJECTED"), v.literal("COMPLETED")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
    });
  },
});

export const getBillUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const getAuditLogs = query({
  args: { transactionId: v.id("transactions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("audit_logs")
      .withIndex("by_transaction", q => q.eq("transactionId", args.transactionId))
      .order("desc")
      .collect();
  },
});
