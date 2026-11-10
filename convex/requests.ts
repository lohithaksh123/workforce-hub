import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";

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

export const findUserByName = async (ctx: any, name: string) => {
  const norm = normalizeWalletUserId(name);
  if (norm === "T V REDDY") {
    return await ctx.db.query("users").filter((q: any) => q.eq(q.field("name"), "T VENKATESWARA REDDY")).first();
  }
  if (norm === "Vinneth Chinnam") {
    return await ctx.db.query("users").filter((q: any) => q.eq(q.field("name"), "Vineeth Chinnam")).first();
  }
  return await ctx.db.query("users").filter((q: any) => q.eq(q.field("name"), name)).first();
};

export const getRequests = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("transaction_requests").order("desc").collect();
  },
});

export const createRequest = mutation({
  args: {
    purpose: v.string(),
    vendor_name: v.optional(v.string()),
    amount: v.number(),
    payment_method: v.string(),
    description: v.optional(v.string()),
    requested_by: v.string(),
    requesterUserId: v.optional(v.string()),
    requesterName: v.optional(v.string()),
    requestType: v.optional(v.union(v.literal("expense_request"), v.literal("wallet_fund_request"))),
    siteId: v.optional(v.id("sites")),
    siteName: v.optional(v.string()),
    walletId: v.optional(v.union(v.id("site_wallets"), v.id("team_wallets"), v.id("user_wallets"))),
    targetWalletId: v.optional(v.id("user_wallets")),
    category: v.optional(v.string()),
    type: v.optional(v.union(v.literal("Expense"), v.literal("Top-up"), v.literal("Return"))),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; requestId?: Id<"transaction_requests">; error?: string }> => {
    try {
      const user = await findUserByName(ctx, args.requested_by);
      
      if (!user || user.status === "inactive") {
        return { success: false, error: "Your account is currently inactive and cannot make requests." };
      }

      const normRequestedBy = normalizeWalletUserId(args.requested_by);

      const requestId = await ctx.db.insert("transaction_requests", {
        ...args,
        requested_by: normRequestedBy,
        status: "PENDING",
        requestType: args.requestType || "expense_request",
        category: args.category as any,
        type: (args.type === "Top-up" ? "CREDIT" : "DEBIT") as any,
        created_at: Date.now(),
      });

      // For Expense Requests, we create a PENDING transaction entry as before
      if (!args.requestType || args.requestType === "expense_request") {
        await ctx.db.insert("transactions", {
          type: (args.type === "Top-up" ? "CREDIT" : "DEBIT") as any,
          amount: args.amount,
          source_or_vendor: args.vendor_name,
          purpose: args.purpose,
          used_by: normRequestedBy,
          date: args.date || new Date().toISOString().split("T")[0],
          status: "PENDING",
          requestId,
          payment_method: args.payment_method,
          siteId: args.siteId,
          walletId: args.walletId,
          category: args.category,
        });
      }

      // Notify Owners
      const owners = await ctx.db.query("users").filter((q) => q.eq(q.field("role"), "Owner")).collect();
      let siteLabel = "";
      if (args.siteId) {
        const site = await ctx.db.get(args.siteId);
        siteLabel = site ? ` for [${site.name}]` : "";
      }

      const typeLabel = args.requestType === "wallet_fund_request" ? "Wallet Fund Request" : 
                       (args.type === "Top-up" ? "Wallet Top-up Request" : "New Transaction Request");

      for (const owner of owners) {
        await ctx.db.insert("notifications", {
          userId: owner.name,
          title: typeLabel,
          description: `${args.requested_by} submitted a ${args.requestType === 'wallet_fund_request' ? 'fund' : 'transaction'} request for ₹${args.amount.toLocaleString()}${siteLabel}.`,
          type: "request",
          read: false,
          created_at: Date.now(),
        });
      }

      return { success: true, requestId };
    } catch (e: any) {
      return { success: false, error: e.data || e.message || "Failed to create request" };
    }
  },
});

export const updateRequestStatus = mutation({
  args: {
    id: v.id("transaction_requests"),
    status: v.union(v.literal("APPROVED"), v.literal("REJECTED"), v.literal("COMPLETED")),
    approved_by: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      const request = await ctx.db.get(args.id);
      if (!request) return { success: false, error: "Request not found" };

      // Handle Wallet Fund Request Logic
      if (request.requestType === "wallet_fund_request" && (args.status === "APPROVED" || args.status === "COMPLETED")) {
        const companyWallet = await ctx.db
          .query("company_wallet")
          .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
          .first();

        if (!companyWallet) return { success: false, error: "Company Vault not found" };
        if (companyWallet.balance < request.amount) return { success: false, error: "Insufficient Company Vault balance" };

        // Find requester's wallet (either targetWalletId or find by requesterName/requested_by)
        let targetWallet = null;
        if (request.targetWalletId) {
          targetWallet = await ctx.db.get(request.targetWalletId);
        }
        
        if (!targetWallet && request.requesterName) {
          const normReqName = normalizeWalletUserId(request.requesterName);
          targetWallet = await ctx.db.query("user_wallets").filter(q => q.eq(q.field("userId"), normReqName)).first();
        }
        
        if (!targetWallet) {
          const normReqBy = normalizeWalletUserId(request.requested_by);
          targetWallet = await ctx.db.query("user_wallets").filter(q => q.eq(q.field("userId"), normReqBy)).first();
        }

        if (!targetWallet) return { success: false, error: "Requester's wallet not found" };

        // 1. Deduct from Company Vault
        await ctx.db.patch(companyWallet._id, {
          balance: companyWallet.balance - request.amount,
          total_debited: (companyWallet.total_debited ?? 0) + request.amount,
        });

        // 2. Add to Requester Wallet
        await ctx.db.patch(targetWallet._id, {
          balance: targetWallet.balance + request.amount,
          total_credited: (targetWallet.total_credited ?? 0) + request.amount,
          lastTopUpDate: new Date().toISOString().split("T")[0],
        });

        // 3. Create Global Transaction record
        await ctx.db.insert("transactions", {
          type: "CREDIT",
          transactionType: "wallet_fund_request",
          amount: request.amount,
          sourceType: "company_vault",
          sourceName: "Company Vault",
          destinationType: "staff_wallet",
          destinationName: normalizeWalletUserId(request.requested_by),
          purpose: `Fund Request: ${request.purpose}`,
          used_by: normalizeWalletUserId(request.requested_by),
          approved_by: args.approved_by || "Owner",
          date: new Date().toISOString().split("T")[0],
          status: "COMPLETED",
          requestId: args.id,
          fromWalletId: companyWallet._id,
          toWalletId: targetWallet._id,
          isInternalTransfer: true,
          created_at: Date.now(),
        });

        // 4. Mark Request as Completed
        await ctx.db.patch(args.id, {
          status: "COMPLETED",
          approved_by: args.approved_by,
          approved_at: Date.now(),
          completedAt: Date.now(),
        });

        return { success: true };
      }

      // Existing Expense/Top-up Logic
      await ctx.db.patch(args.id, {
        status: args.status as any,
        approved_by: args.approved_by,
      });

      if (args.status === "APPROVED" || args.status === "COMPLETED") {
        const existingTx = await ctx.db
            .query("transactions")
            .filter(q => q.eq(q.field("requestId"), args.id))
            .first();
        
        if (existingTx && existingTx.status === "APPROVED") return { success: true };

        let walletToUpdate = null;
        let siteWalletToUpdate = null;

        if (request.walletId) {
          const wallet = await ctx.db.get(request.walletId);
          if (wallet) {
            walletToUpdate = wallet;
            if ("siteId" in wallet && wallet.siteId) {
                const siteWallet = await ctx.db.query("site_wallets").filter(q => q.eq(q.field("siteId"), wallet.siteId as any)).first();
                siteWalletToUpdate = siteWallet;
            }
          }
        }

        let fromWalletId: any = undefined;
        let toWalletId: any = undefined;

        if (walletToUpdate) {
            if (request.type === "CREDIT") {
                toWalletId = walletToUpdate._id;
                if (request.siteId) {
                    const siteWallet = await ctx.db.query("site_wallets").filter(q => q.eq(q.field("siteId"), request.siteId as any)).first();
                    if (siteWallet) {
                        fromWalletId = siteWallet._id;
                    }
                } else {
                    const companyWallet = await ctx.db
                      .query("company_wallet")
                      .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
                      .first();
                    if (companyWallet) {
                        fromWalletId = companyWallet._id;
                    }
                }
            } else {
                fromWalletId = walletToUpdate._id;
            }
        } else {
            const companyWallet = await ctx.db
              .query("company_wallet")
              .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
              .first();
            if (companyWallet) {
                fromWalletId = companyWallet._id;
            }
        }

        if (walletToUpdate) {
            if (request.type === "CREDIT") {
                await ctx.db.patch(walletToUpdate._id, {
                    balance: walletToUpdate.balance + request.amount,
                    total_credited: (walletToUpdate.total_credited || 0) + request.amount,
                });

                if (request.siteId) {
                    const siteWallet = await ctx.db.query("site_wallets").filter(q => q.eq(q.field("siteId"), request.siteId as any)).first();
                    if (siteWallet) {
                        await ctx.db.patch(siteWallet._id, { balance: siteWallet.balance - request.amount });
                    }
                } else {
                    const companyWallet = await ctx.db
                      .query("company_wallet")
                      .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
                      .first();
                    if (companyWallet) {
                        await ctx.db.patch(companyWallet._id, {
                            balance: companyWallet.balance - request.amount,
                            total_debited: (companyWallet.total_debited ?? 0) + request.amount,
                        });
                    }
                }
            } else {
                await ctx.db.patch(walletToUpdate._id, {
                    balance: walletToUpdate.balance - request.amount,
                    total_debited: (walletToUpdate.total_debited || 0) + request.amount,
                });

                if (siteWalletToUpdate) {
                    await ctx.db.patch(siteWalletToUpdate._id, {
                        total_debited: (siteWalletToUpdate.total_debited || 0) + request.amount,
                    });
                }
            }
        } else {
            const companyWallet = await ctx.db
              .query("company_wallet")
              .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
              .first();

            if (!companyWallet) return { success: false, error: "Company wallet not found" };
            if (companyWallet.balance < request.amount) return { success: false, error: "Insufficient company wallet balance" };

            await ctx.db.patch(companyWallet._id, {
              balance: companyWallet.balance - request.amount,
              total_debited: (companyWallet.total_debited ?? 0) + request.amount,
            });
        }

        if (existingTx) {
            await ctx.db.patch(existingTx._id, {
                status: "APPROVED",
                approved_by: args.approved_by || "Owner",
                fromWalletId,
                toWalletId,
            });
        } else {
            await ctx.db.insert("transactions", {
                type: (request.type === "CREDIT" ? "CREDIT" : "DEBIT") as any,
                amount: request.amount,
                source_or_vendor: request.vendor_name,
                purpose: request.purpose,
                used_by: request.requested_by,
                approved_by: args.approved_by || "Owner",
                date: new Date().toISOString().split("T")[0],
                status: "APPROVED",
                requestId: args.id,
                payment_method: request.payment_method,
                siteId: request.siteId,
                walletId: request.walletId,
                category: request.category,
                fromWalletId,
                toWalletId,
              });
        }
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.data || e.message || "Failed to update request" };
    }
  },
});

export const useMoney = mutation({
  args: {
    amount: v.number(),
    vendor: v.optional(v.string()),
    purpose: v.string(),
    payment_method: v.string(),
    notes: v.optional(v.string()),
    used_by: v.string(),
    siteId: v.optional(v.id("sites")),
    walletId: v.optional(v.union(v.id("site_wallets"), v.id("team_wallets"), v.id("user_wallets"))),
    category: v.optional(v.string()),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    try {
      const user = await findUserByName(ctx, args.used_by);
      if (!user || user.status === "inactive") return { success: false, error: "Your account is currently inactive and cannot spend money." };

      const normUsedBy = normalizeWalletUserId(args.used_by);

      let walletToUpdate = null;
      let siteWalletToUpdate = null;

      let effectiveSiteId = args.siteId;

      if (args.walletId) {
        const wallet = await ctx.db.get(args.walletId);
        if (wallet) {
          walletToUpdate = wallet;
          // Inherit siteId from wallet if missing in args
          if (!effectiveSiteId && "siteId" in wallet && wallet.siteId) {
            effectiveSiteId = wallet.siteId as any;
          }

          const siteRef = effectiveSiteId || ("siteId" in wallet ? wallet.siteId : null);
          if (siteRef) {
            const siteWallet = await ctx.db.query("site_wallets").filter(q => q.eq(q.field("siteId"), siteRef as any)).first();
            siteWalletToUpdate = siteWallet;
          }
        }
      }

      let fromWalletId: any = undefined;
      if (walletToUpdate) {
        if (walletToUpdate.balance < args.amount) return { success: false, error: "Insufficient balance in selected wallet" };
        if ("status" in walletToUpdate && walletToUpdate.status !== "Active") return { success: false, error: `Wallet is currently ${walletToUpdate.status}` };
        
        await ctx.db.patch(walletToUpdate._id, {
          balance: walletToUpdate.balance - args.amount,
          total_debited: (walletToUpdate.total_debited || 0) + args.amount,
        });

        if (siteWalletToUpdate) {
          await ctx.db.patch(siteWalletToUpdate._id, {
            total_debited: (siteWalletToUpdate.total_debited || 0) + args.amount,
          });
        }
        fromWalletId = walletToUpdate._id;
      } else {
        const wallet = await ctx.db
          .query("company_wallet")
          .filter((q) => q.eq(q.field("company_name"), "Acme Interiors"))
          .first();

        if (!wallet) return { success: false, error: "Company wallet not found" };
        if (wallet.balance < args.amount) return { success: false, error: "Insufficient company wallet balance" };

        await ctx.db.patch(wallet._id, {
          balance: wallet.balance - args.amount,
          total_debited: (wallet.total_debited ?? 0) + args.amount,
        });
        fromWalletId = wallet._id;
      }

      // Update aggregated vendor data
      if (args.vendor) {
        const vendor = await ctx.db
          .query("vendors")
          .filter((q) => q.eq(q.field("name"), args.vendor!))
          .first();
        
        if (vendor) {
          await ctx.db.patch(vendor._id, {
            totalPaid: (vendor.totalPaid || 0) + args.amount,
            paymentCount: (vendor.paymentCount || 0) + 1,
            lastPaymentDate: new Date().toISOString().split("T")[0],
          });
        }
      }

      const date = args.date || new Date().toISOString().split("T")[0];
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      await ctx.db.insert("transactions", {
        type: "DEBIT",
        amount: args.amount,
        source_or_vendor: args.vendor,
        purpose: args.purpose,
        used_by: normUsedBy,
        approved_by: "Direct Spend", 
        date,
        status: "APPROVED",
        payment_method: args.payment_method,
        siteId: effectiveSiteId,
        walletId: args.walletId,
        category: args.category,
        fromWalletId,
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.data || e.message || "Failed to process spend" };
    }
  },
});

export const getTransactions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("transactions").order("desc").collect();
  },
});

