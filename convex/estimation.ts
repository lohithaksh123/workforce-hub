import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Helper to check user access via email parameter
async function verifyPermission(ctx: any, email: string, permissionKey: string) {
  if (!email) {
    throw new ConvexError("Unauthorized: Missing user email identification.");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .unique();
  
  if (!user || user.status === "inactive" || user.status === "disabled" || user.status === "deleted") {
    throw new ConvexError("Unauthorized: Account is inactive or does not exist.");
  }

  if (user.role === "Owner") return user;

  const permissions = (user.permissions || []) as any[];
  const hasManageAll = permissions.some((p: any) => 
    (p.key === "manage_estimates" || p.name === "manage_estimates" || p.name === "Manage Estimates") && p.allowed === true
  );

  if (hasManageAll) return user;

  const hasSpecific = permissions.some((p: any) => 
    (p.key === permissionKey || p.name === permissionKey) && p.allowed === true
  );

  if (!hasSpecific) {
    throw new ConvexError(`Unauthorized: Missing permission ${permissionKey}`);
  }

  return user;
}

// Log helper for audits
async function logEstimationAction(
  ctx: any,
  action: string,
  user: any,
  details: string,
  opts?: { estimateId?: Id<"estimates">; estimateNumber?: string; siteId?: Id<"sites"> }
) {
  await ctx.db.insert("estimation_audit_logs", {
    action,
    estimateId: opts?.estimateId,
    estimateNumber: opts?.estimateNumber,
    siteId: opts?.siteId,
    performedBy: user.email,
    performedByName: user.name,
    createdAt: Date.now(),
    details,
  });
}

// Calculate Totals Backend Helper
function calculateEstimateTotals(
  items: Array<{ quantity: number; costPerUnit: number }>,
  discountType?: string,
  discountValue?: number,
  bufferType?: string,
  bufferValue?: number,
  gstType?: string,
  gstValue?: number
) {
  const subtotal = items.reduce((sum, item) => {
    const qty = Math.max(0, item.quantity);
    const cpu = Math.max(0, item.costPerUnit);
    return sum + (qty * cpu);
  }, 0);

  let discountAmount = 0;
  if (discountType === "Percentage" && discountValue) {
    discountAmount = (subtotal * discountValue) / 100;
  } else if (discountType === "Amount" && discountValue) {
    discountAmount = discountValue;
  }
  const afterDiscount = Math.max(0, subtotal - discountAmount);

  let bufferAmount = 0;
  if (bufferType === "Percentage" && bufferValue) {
    bufferAmount = (afterDiscount * bufferValue) / 100;
  } else if (bufferType === "Amount" && bufferValue) {
    bufferAmount = bufferValue;
  }
  const afterBuffer = Math.max(0, afterDiscount + bufferAmount);

  let gstAmount = 0;
  if (gstType === "GST Percentage" && gstValue) {
    gstAmount = (afterBuffer * gstValue) / 100;
  } else if (gstType === "GST Amount" && gstValue) {
    gstAmount = gstValue;
  }

  const grandTotal = Math.round((afterBuffer + gstAmount) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    bufferAmount: Math.round(bufferAmount * 100) / 100,
    gstAmount: Math.round(gstAmount * 100) / 100,
    grandTotal,
  };
}

// ==========================================
// QUERIES
// ==========================================

export const getEstimates = query({
  args: {
    requestorEmail: v.string(),
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    siteId: v.optional(v.string()),
    projectType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Permission validation (viewing estimates is default for authorized roles or view_estimate_reports)
    await verifyPermission(ctx, args.requestorEmail, "create_estimates"); // Anyone with create/edit/manage estimates can view
    
    let query = ctx.db.query("estimates");
    const all = await query.order("desc").collect();

    return all.filter((est) => {
      if (args.status && args.status !== "all" && est.status !== args.status) return false;
      if (args.siteId && args.siteId !== "all" && est.siteId !== args.siteId) return false;
      if (args.projectType && args.projectType !== "all" && est.projectType !== args.projectType) return false;
      if (args.search) {
        const term = args.search.toLowerCase();
        return (
          est.estimateNumber.toLowerCase().includes(term) ||
          est.clientName.toLowerCase().includes(term) ||
          est.siteName.toLowerCase().includes(term)
        );
      }
      return true;
    });
  },
});

export const getEstimateById = query({
  args: { id: v.id("estimates"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    await verifyPermission(ctx, args.requestorEmail, "create_estimates");
    const estimate = await ctx.db.get(args.id);
    if (!estimate) return null;

    const items = await ctx.db
      .query("estimateItems")
      .withIndex("by_estimateId", (q) => q.eq("estimateId", args.id))
      .collect();

    // sort items by serialNo
    items.sort((a, b) => a.serialNo - b.serialNo);

    return { ...estimate, items };
  },
});

export const getEstimatesBySite = query({
  args: { siteId: v.id("sites"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    await verifyPermission(ctx, args.requestorEmail, "create_estimates");
    return await ctx.db
      .query("estimates")
      .withIndex("by_siteId", (q) => q.eq("siteId", args.siteId))
      .collect();
  },
});

export const getEstimateItems = query({
  args: { estimateId: v.id("estimates"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    await verifyPermission(ctx, args.requestorEmail, "create_estimates");
    const items = await ctx.db
      .query("estimateItems")
      .withIndex("by_estimateId", (q) => q.eq("estimateId", args.estimateId))
      .collect();
    return items.sort((a, b) => a.serialNo - b.serialNo);
  },
});

export const getEstimateVsActual = query({
  args: {
    requestorEmail: v.string(),
    siteId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyPermission(ctx, args.requestorEmail, "view_estimate_reports");

    // Get sites
    const sites = await ctx.db.query("sites").collect();
    const targetSiteId = args.siteId && args.siteId !== "all" ? args.siteId : null;

    const results = [];

    for (const site of sites) {
      if (targetSiteId && site._id !== targetSiteId) continue;

      // Find active converted budget or approved estimate
      const activeBudget = await ctx.db
        .query("siteBudgetVersions")
        .withIndex("by_siteId", (q) => q.eq("siteId", site._id))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      let estimateId = activeBudget?.estimateId;
      let estimateNumber = activeBudget?.estimateNumber || "None";
      let estimatedAmount = activeBudget?.budgetAmount || 0;

      if (!activeBudget) {
        // Fallback: search for latest approved estimate
        const approvedEstimate = await ctx.db
          .query("estimates")
          .withIndex("by_siteId", (q) => q.eq("siteId", site._id))
          .filter((q) => q.eq(q.field("status"), "approved"))
          .order("desc")
          .first();

        if (approvedEstimate) {
          estimateId = approvedEstimate._id;
          estimateNumber = approvedEstimate.estimateNumber;
          estimatedAmount = approvedEstimate.grandTotal;
        }
      }

      // Fetch estimate items for category-wise breakdown if estimateId exists
      const estimateItems = estimateId
        ? await ctx.db
            .query("estimateItems")
            .withIndex("by_estimateId", (q) => q.eq("estimateId", estimateId))
            .collect()
        : [];

      // Group estimates by category
      const estCategories: Record<string, number> = {};
      estimateItems.forEach((item) => {
        estCategories[item.category] = (estCategories[item.category] || 0) + item.totalCost;
      });

      // Sum actual expense transactions (type DEBIT, status APPROVED/COMPLETED, not internal transfers)
      const transactions = await ctx.db
        .query("transactions")
        .filter((q) => q.eq(q.field("siteId"), site._id))
        .collect();

      const validTransactions = transactions.filter(
        (t) =>
          t.type === "DEBIT" &&
          (t.status === "APPROVED" || t.status === "COMPLETED") &&
          !t.isInternalTransfer
      );

      const actualSpent = validTransactions.reduce((sum, t) => sum + t.amount, 0);

      // Group actual spent by category
      const actCategories: Record<string, number> = {};
      validTransactions.forEach((t) => {
        const cat = t.category || "Miscellaneous";
        actCategories[cat] = (actCategories[cat] || 0) + t.amount;
      });

      // Calculate category comparisons
      const categoriesList = Array.from(
        new Set([...Object.keys(estCategories), ...Object.keys(actCategories)])
      );

      const categoryComparisons = categoriesList.map((cat) => {
        const estVal = estCategories[cat] || 0;
        const actVal = actCategories[cat] || 0;
        const diff = actVal - estVal;
        return {
          category: cat,
          estimated: estVal,
          actual: actVal,
          difference: diff,
          status: diff > 0 ? "Over Budget" : diff === 0 ? "On Track" : "Under Budget",
        };
      });

      const remainingBudget = estimatedAmount - actualSpent;
      const difference = actualSpent - estimatedAmount;
      let status = "On Track";
      if (difference > 0) status = "Over Budget";
      else if (difference < 0) status = "Under Budget";

      results.push({
        siteId: site._id,
        siteName: site.name,
        estimateNumber,
        estimatedAmount,
        actualSpent,
        remainingBudget,
        difference,
        status,
        categoryComparisons,
      });
    }

    return results;
  },
});

export const getRateLibrary = query({
  args: {
    requestorEmail: v.string(),
    category: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyPermission(ctx, args.requestorEmail, "create_estimates");
    let query = ctx.db.query("rateLibrary");
    const all = await query.order("desc").collect();

    return all.filter((item) => {
      if (args.category && args.category !== "all" && item.category !== args.category) return false;
      if (args.search) {
        const term = args.search.toLowerCase();
        return item.itemName.toLowerCase().includes(term);
      }
      return item.isActive;
    });
  },
});

export const getEstimateTemplates = query({
  args: {
    requestorEmail: v.string(),
    projectType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyPermission(ctx, args.requestorEmail, "create_estimates");
    let query = ctx.db.query("estimateTemplates");
    const all = await query.order("desc").collect();

    const result = [];
    for (const t of all) {
      if (args.projectType && args.projectType !== "all" && t.projectType !== args.projectType) continue;
      
      const items = await ctx.db
        .query("estimateTemplateItems")
        .withIndex("by_templateId", (q) => q.eq("templateId", t._id))
        .collect();

      result.push({
        ...t,
        items,
      });
    }

    return result;
  },
});

export const getEstimateExportData = query({
  args: { estimateId: v.id("estimates"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    await verifyPermission(ctx, args.requestorEmail, "create_estimates");
    const est = await ctx.db.get(args.estimateId);
    if (!est) throw new ConvexError("Estimate not found");

    const items = await ctx.db
      .query("estimateItems")
      .withIndex("by_estimateId", (q) => q.eq("estimateId", args.estimateId))
      .collect();

    items.sort((a, b) => a.serialNo - b.serialNo);

    // Group items by category for category summary
    const catMap: Record<string, number> = {};
    items.forEach((item) => {
      catMap[item.category] = (catMap[item.category] || 0) + item.totalCost;
    });
    const categorySummary = Object.entries(catMap).map(([category, amount]) => ({
      category,
      amount,
    }));

    return {
      estimate: est,
      items,
      categorySummary,
    };
  },
});

export const getEstimateReportData = query({
  args: { requestorEmail: v.string() },
  handler: async (ctx, args) => {
    await verifyPermission(ctx, args.requestorEmail, "view_estimate_reports");
    const estimates = await ctx.db.query("estimates").collect();
    const activeBudgets = await ctx.db.query("siteBudgetVersions").filter((q) => q.eq(q.field("isActive"), true)).collect();
    const transactions = await ctx.db.query("transactions").collect();

    // 1. Total estimates count & volume
    const totalCount = estimates.length;
    const totalVolume = estimates.reduce((sum, e) => sum + e.grandTotal, 0);

    // 2. Counts by Status
    const countsByStatus = {
      draft: estimates.filter(e => e.status === "draft").length,
      sent: estimates.filter(e => e.status === "sent").length,
      approved: estimates.filter(e => e.status === "approved").length,
      rejected: estimates.filter(e => e.status === "rejected").length,
      converted: estimates.filter(e => e.status === "converted").length,
      completed: estimates.filter(e => e.status === "completed").length,
    };

    // 3. Over Budget Sites
    const overBudgetSites = [];
    for (const b of activeBudgets) {
      const siteTxs = transactions.filter(
        t => t.siteId === b.siteId && 
        t.type === "DEBIT" && 
        (t.status === "APPROVED" || t.status === "COMPLETED") && 
        !t.isInternalTransfer
      );
      const actual = siteTxs.reduce((sum, t) => sum + t.amount, 0);
      if (actual > b.budgetAmount) {
        overBudgetSites.push({
          siteId: b.siteId,
          siteName: b.siteName,
          budget: b.budgetAmount,
          actual,
          excess: actual - b.budgetAmount,
        });
      }
    }

    return {
      totalCount,
      totalVolume,
      countsByStatus,
      overBudgetSites,
    };
  },
});


// ==========================================
// MUTATIONS
// ==========================================

export const createEstimate = mutation({
  args: {
    requestorEmail: v.string(),
    siteId: v.id("sites"),
    clientName: v.string(),
    clientPhone: v.optional(v.string()),
    clientEmail: v.optional(v.string()),
    projectAddress: v.optional(v.string()),
    projectType: v.string(),
    estimateDate: v.string(),
    validUntil: v.optional(v.string()),
    discountType: v.optional(v.string()),
    discountValue: v.optional(v.number()),
    gstType: v.optional(v.string()),
    gstValue: v.optional(v.number()),
    bufferType: v.optional(v.string()),
    bufferValue: v.optional(v.number()),
    notes: v.optional(v.string()),
    termsAndConditions: v.optional(v.string()),
    items: v.array(
      v.object({
        category: v.string(),
        subcategory: v.optional(v.string()),
        itemName: v.string(),
        description: v.optional(v.string()),
        quantity: v.number(),
        unit: v.string(),
        costPerUnit: v.number(),
        vendorId: v.optional(v.string()),
        vendorName: v.optional(v.string()),
        notes: v.optional(v.string()),
        length: v.optional(v.number()),
        width: v.optional(v.number()),
        height: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await verifyPermission(ctx, args.requestorEmail, "create_estimates");

    const site = await ctx.db.get(args.siteId);
    if (!site) throw new ConvexError("Site not found");

    // Generate Estimate number EST-XXX
    const estimates = await ctx.db.query("estimates").collect();
    const estimateNumber = `EST-${String(estimates.length + 1).padStart(3, "0")}`;

    // Calculate totals backend-side
    const totals = calculateEstimateTotals(
      args.items,
      args.discountType,
      args.discountValue,
      args.bufferType,
      args.bufferValue,
      args.gstType,
      args.gstValue
    );

    const estimateId = await ctx.db.insert("estimates", {
      estimateNumber,
      siteId: args.siteId,
      siteName: site.name,
      clientName: args.clientName,
      clientPhone: args.clientPhone,
      clientEmail: args.clientEmail,
      projectAddress: args.projectAddress,
      projectType: args.projectType,
      estimateDate: args.estimateDate,
      validUntil: args.validUntil,
      subtotal: totals.subtotal,
      discountType: args.discountType || "none",
      discountValue: args.discountValue || 0,
      discountAmount: totals.discountAmount,
      gstType: args.gstType || "No GST",
      gstValue: args.gstValue || 0,
      gstAmount: totals.gstAmount,
      bufferType: args.bufferType || "none",
      bufferValue: args.bufferValue || 0,
      bufferAmount: totals.bufferAmount,
      grandTotal: totals.grandTotal,
      status: "draft",
      preparedBy: user.email,
      preparedByName: user.name,
      notes: args.notes,
      termsAndConditions: args.termsAndConditions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Save items
    for (let i = 0; i < args.items.length; i++) {
      const item = args.items[i];
      const qty = Math.max(0, item.quantity);
      const cpu = Math.max(0, item.costPerUnit);
      await ctx.db.insert("estimateItems", {
        estimateId,
        serialNo: i + 1,
        category: item.category,
        subcategory: item.subcategory,
        itemName: item.itemName,
        description: item.description,
        quantity: qty,
        unit: item.unit,
        costPerUnit: cpu,
        totalCost: Math.round(qty * cpu * 100) / 100,
        vendorId: item.vendorId,
        vendorName: item.vendorName,
        notes: item.notes,
        length: item.length,
        width: item.width,
        height: item.height,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    await logEstimationAction(ctx, "created", user, `Created estimate draft ${estimateNumber} for client ${args.clientName}`, {
      estimateId,
      estimateNumber,
      siteId: args.siteId,
    });

    return { success: true, estimateId, estimateNumber };
  },
});

export const updateEstimate = mutation({
  args: {
    requestorEmail: v.string(),
    id: v.id("estimates"),
    clientName: v.string(),
    clientPhone: v.optional(v.string()),
    clientEmail: v.optional(v.string()),
    projectAddress: v.optional(v.string()),
    projectType: v.string(),
    estimateDate: v.string(),
    validUntil: v.optional(v.string()),
    discountType: v.optional(v.string()),
    discountValue: v.optional(v.number()),
    gstType: v.optional(v.string()),
    gstValue: v.optional(v.number()),
    bufferType: v.optional(v.string()),
    bufferValue: v.optional(v.number()),
    notes: v.optional(v.string()),
    termsAndConditions: v.optional(v.string()),
    items: v.array(
      v.object({
        category: v.string(),
        subcategory: v.optional(v.string()),
        itemName: v.string(),
        description: v.optional(v.string()),
        quantity: v.number(),
        unit: v.string(),
        costPerUnit: v.number(),
        vendorId: v.optional(v.string()),
        vendorName: v.optional(v.string()),
        notes: v.optional(v.string()),
        length: v.optional(v.number()),
        width: v.optional(v.number()),
        height: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await verifyPermission(ctx, args.requestorEmail, "edit_estimates");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Estimate not found");

    if (existing.status !== "draft" && existing.status !== "rejected") {
      throw new ConvexError("Only Draft or Rejected estimates can be edited.");
    }

    // Calculate totals backend-side
    const totals = calculateEstimateTotals(
      args.items,
      args.discountType,
      args.discountValue,
      args.bufferType,
      args.bufferValue,
      args.gstType,
      args.gstValue
    );

    await ctx.db.patch(args.id, {
      clientName: args.clientName,
      clientPhone: args.clientPhone,
      clientEmail: args.clientEmail,
      projectAddress: args.projectAddress,
      projectType: args.projectType,
      estimateDate: args.estimateDate,
      validUntil: args.validUntil,
      subtotal: totals.subtotal,
      discountType: args.discountType || "none",
      discountValue: args.discountValue || 0,
      discountAmount: totals.discountAmount,
      gstType: args.gstType || "No GST",
      gstValue: args.gstValue || 0,
      gstAmount: totals.gstAmount,
      bufferType: args.bufferType || "none",
      bufferValue: args.bufferValue || 0,
      bufferAmount: totals.bufferAmount,
      grandTotal: totals.grandTotal,
      notes: args.notes,
      termsAndConditions: args.termsAndConditions,
      updatedAt: Date.now(),
    });

    // Delete existing items
    const oldItems = await ctx.db
      .query("estimateItems")
      .withIndex("by_estimateId", (q) => q.eq("estimateId", args.id))
      .collect();
    for (const item of oldItems) {
      await ctx.db.delete(item._id);
    }

    // Save new items
    for (let i = 0; i < args.items.length; i++) {
      const item = args.items[i];
      const qty = Math.max(0, item.quantity);
      const cpu = Math.max(0, item.costPerUnit);
      await ctx.db.insert("estimateItems", {
        estimateId: args.id,
        serialNo: i + 1,
        category: item.category,
        subcategory: item.subcategory,
        itemName: item.itemName,
        description: item.description,
        quantity: qty,
        unit: item.unit,
        costPerUnit: cpu,
        totalCost: Math.round(qty * cpu * 100) / 100,
        vendorId: item.vendorId,
        vendorName: item.vendorName,
        notes: item.notes,
        length: item.length,
        width: item.width,
        height: item.height,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    await logEstimationAction(ctx, "edited", user, `Updated estimate ${existing.estimateNumber} details`, {
      estimateId: args.id,
      estimateNumber: existing.estimateNumber,
      siteId: existing.siteId,
    });

    return { success: true };
  },
});

export const deleteOrArchiveEstimate = mutation({
  args: { id: v.id("estimates"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await verifyPermission(ctx, args.requestorEmail, "manage_estimates");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Estimate not found");

    // We do archive instead of hard delete to keep audit history
    await ctx.db.patch(args.id, {
      status: "archived",
      updatedAt: Date.now(),
    });

    await logEstimationAction(ctx, "archived", user, `Archived estimate ${existing.estimateNumber}`, {
      estimateId: args.id,
      estimateNumber: existing.estimateNumber,
      siteId: existing.siteId,
    });

    return { success: true };
  },
});

export const duplicateEstimate = mutation({
  args: { id: v.id("estimates"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await verifyPermission(ctx, args.requestorEmail, "create_estimates");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Estimate not found");

    const oldItems = await ctx.db
      .query("estimateItems")
      .withIndex("by_estimateId", (q) => q.eq("estimateId", args.id))
      .collect();

    // Generate duplicate Estimate number
    const allEst = await ctx.db.query("estimates").collect();
    const newNumber = `EST-${String(allEst.length + 1).padStart(3, "0")}`;

    const newEstimateId = await ctx.db.insert("estimates", {
      estimateNumber: newNumber,
      siteId: existing.siteId,
      siteName: existing.siteName,
      clientName: `${existing.clientName} (Copy)`,
      clientPhone: existing.clientPhone,
      clientEmail: existing.clientEmail,
      projectAddress: existing.projectAddress,
      projectType: existing.projectType,
      estimateDate: new Date().toISOString().split("T")[0],
      validUntil: existing.validUntil,
      subtotal: existing.subtotal,
      discountType: existing.discountType,
      discountValue: existing.discountValue,
      discountAmount: existing.discountAmount,
      gstType: existing.gstType,
      gstValue: existing.gstValue,
      gstAmount: existing.gstAmount,
      bufferType: existing.bufferType,
      bufferValue: existing.bufferValue,
      bufferAmount: existing.bufferAmount,
      grandTotal: existing.grandTotal,
      status: "draft",
      preparedBy: user.email,
      preparedByName: user.name,
      notes: existing.notes,
      termsAndConditions: existing.termsAndConditions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Duplicate items
    for (const item of oldItems) {
      await ctx.db.insert("estimateItems", {
        estimateId: newEstimateId,
        serialNo: item.serialNo,
        category: item.category,
        subcategory: item.subcategory,
        itemName: item.itemName,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        costPerUnit: item.costPerUnit,
        totalCost: item.totalCost,
        vendorId: item.vendorId,
        vendorName: item.vendorName,
        notes: item.notes,
        length: item.length,
        width: item.width,
        height: item.height,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    await logEstimationAction(ctx, "duplicated", user, `Duplicated estimate ${existing.estimateNumber} as ${newNumber}`, {
      estimateId: newEstimateId,
      estimateNumber: newNumber,
      siteId: existing.siteId,
    });

    return { success: true, duplicatedId: newEstimateId };
  },
});

export const markEstimateSent = mutation({
  args: { id: v.id("estimates"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await verifyPermission(ctx, args.requestorEmail, "create_estimates");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Estimate not found");

    await ctx.db.patch(args.id, {
      status: "sent",
      updatedAt: Date.now(),
    });

    await logEstimationAction(ctx, "sent", user, `Marked estimate ${existing.estimateNumber} as sent to client`, {
      estimateId: args.id,
      estimateNumber: existing.estimateNumber,
      siteId: existing.siteId,
    });

    return { success: true };
  },
});

export const markEstimateApproved = mutation({
  args: { id: v.id("estimates"), requestorEmail: v.string(), approvedBy: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await verifyPermission(ctx, args.requestorEmail, "approve_estimates");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Estimate not found");

    await ctx.db.patch(args.id, {
      status: "approved",
      approvedBy: args.approvedBy || user.name,
      approvedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await logEstimationAction(ctx, "approved", user, `Approved estimate ${existing.estimateNumber} (Approved by: ${args.approvedBy || user.name})`, {
      estimateId: args.id,
      estimateNumber: existing.estimateNumber,
      siteId: existing.siteId,
    });

    return { success: true };
  },
});

export const markEstimateRejected = mutation({
  args: { id: v.id("estimates"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await verifyPermission(ctx, args.requestorEmail, "approve_estimates");
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Estimate not found");

    await ctx.db.patch(args.id, {
      status: "rejected",
      updatedAt: Date.now(),
    });

    await logEstimationAction(ctx, "rejected", user, `Rejected estimate ${existing.estimateNumber}`, {
      estimateId: args.id,
      estimateNumber: existing.estimateNumber,
      siteId: existing.siteId,
    });

    return { success: true };
  },
});

export const convertEstimateToSiteBudget = mutation({
  args: {
    requestorEmail: v.string(),
    id: v.id("estimates"),
    versionName: v.string(),
    notes: v.optional(v.string()),
    mode: v.union(v.literal("replace"), v.literal("add"), v.literal("version")), // replace existing active, add/merge, or version
  },
  handler: async (ctx, args) => {
    const user = await verifyPermission(ctx, args.requestorEmail, "convert_estimate_to_budget");
    const est = await ctx.db.get(args.id);
    if (!est) throw new ConvexError("Estimate not found");

    if (est.status !== "approved") {
      throw new ConvexError("Only Approved estimates can be converted to Site Budget.");
    }

    const site = await ctx.db.get(est.siteId);
    if (!site) throw new ConvexError("Site not found");

    // Check for existing active budgets
    const activeBudgets = await ctx.db
      .query("siteBudgetVersions")
      .withIndex("by_siteId", (q) => q.eq("siteId", est.siteId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    let newBudgetAmount = est.grandTotal;

    if (args.mode === "add" && activeBudgets.length > 0) {
      const activeAmount = activeBudgets.reduce((sum, b) => sum + b.budgetAmount, 0);
      newBudgetAmount = activeAmount + est.grandTotal;
    }

    // Set other versions to inactive if replace or version mode
    if (args.mode === "replace" || args.mode === "version") {
      for (const b of activeBudgets) {
        await ctx.db.patch(b._id, { isActive: false });
      }
    }

    // Insert new version
    await ctx.db.insert("siteBudgetVersions", {
      siteId: est.siteId,
      siteName: site.name,
      estimateId: est._id,
      estimateNumber: est.estimateNumber,
      budgetAmount: newBudgetAmount,
      versionName: args.versionName,
      isActive: true,
      createdBy: user.name,
      createdAt: Date.now(),
      notes: args.notes,
    });

    // Update Estimate Status to Converted
    await ctx.db.patch(est._id, {
      status: "converted",
      convertedToBudgetAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Also update/sync the site_wallets balance or total budget if exist?
    // Wait, the prompt says: "Site budget becomes estimate grand total... Wallet/Site Budget if existing should reflect it"
    // Let's check: site_wallets table holds the currently allocated balance. In this app, site_wallets holds the actual cash in hand of the site.
    // However, does the site budget represent a total budget? Yes, in site details and wallets pages:
    // Wallet/Site Budget shows site wallet balance. Some tables might compare expenditures against this wallet.
    // Wait, if they want "Wallet/Site Budget if existing should reflect it", let's make sure we also log this budget amount.
    // Wait, converting an estimate to a site budget should not create transaction of allocation (income/expense).
    // But does it set the site wallet's planned balance?
    // No, "It is only budget planning unless funds are actually allocated."
    // But wait, the site page details shows "Remaining Budget" and "Estimated Budget".
    // We will retrieve the converted budget amount directly in site detail queries!

    await logEstimationAction(ctx, "converted_to_budget", user, `Converted approved estimate ${est.estimateNumber} to Site Budget version: ${args.versionName}. New active budget: ${newBudgetAmount}`, {
      estimateId: est._id,
      estimateNumber: est.estimateNumber,
      siteId: est.siteId,
    });

    return { success: true, budgetAmount: newBudgetAmount };
  },
});

// ==========================================
// RATE LIBRARY MUTATIONS
// ==========================================

export const createRateItem = mutation({
  args: {
    requestorEmail: v.string(),
    itemName: v.string(),
    category: v.string(),
    unit: v.string(),
    defaultRate: v.number(),
    vendorId: v.optional(v.string()),
    vendorName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await verifyPermission(ctx, args.requestorEmail, "manage_rate_library");
    
    const id = await ctx.db.insert("rateLibrary", {
      itemName: args.itemName,
      category: args.category,
      unit: args.unit,
      defaultRate: args.defaultRate,
      vendorId: args.vendorId,
      vendorName: args.vendorName,
      notes: args.notes,
      isActive: true,
      createdBy: user.name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await logEstimationAction(ctx, "rate_item_created", user, `Created rate item: ${args.itemName} in category ${args.category}`);

    return { success: true, rateItemId: id };
  },
});

export const updateRateItem = mutation({
  args: {
    requestorEmail: v.string(),
    id: v.id("rateLibrary"),
    itemName: v.string(),
    category: v.string(),
    unit: v.string(),
    defaultRate: v.number(),
    vendorId: v.optional(v.string()),
    vendorName: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await verifyPermission(ctx, args.requestorEmail, "manage_rate_library");

    await ctx.db.patch(args.id, {
      itemName: args.itemName,
      category: args.category,
      unit: args.unit,
      defaultRate: args.defaultRate,
      vendorId: args.vendorId,
      vendorName: args.vendorName,
      notes: args.notes,
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    await logEstimationAction(ctx, "rate_item_edited", user, `Updated rate item: ${args.itemName}`);

    return { success: true };
  },
});

export const archiveRateItem = mutation({
  args: { id: v.id("rateLibrary"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await verifyPermission(ctx, args.requestorEmail, "manage_rate_library");
    
    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAt: Date.now(),
    });

    await logEstimationAction(ctx, "rate_item_archived", user, `Archived rate item ID ${args.id}`);

    return { success: true };
  },
});

// ==========================================
// TEMPLATE MUTATIONS
// ==========================================

export const createEstimateTemplate = mutation({
  args: {
    requestorEmail: v.string(),
    templateName: v.string(),
    projectType: v.string(),
    description: v.optional(v.string()),
    items: v.array(
      v.object({
        category: v.string(),
        itemName: v.string(),
        description: v.optional(v.string()),
        quantity: v.optional(v.number()),
        unit: v.string(),
        costPerUnit: v.optional(v.number()),
        notes: v.optional(v.string()),
        length: v.optional(v.number()),
        width: v.optional(v.number()),
        height: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await verifyPermission(ctx, args.requestorEmail, "manage_estimate_templates");

    const templateId = await ctx.db.insert("estimateTemplates", {
      templateName: args.templateName,
      projectType: args.projectType,
      description: args.description,
      isActive: true,
      createdBy: user.name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    for (const item of args.items) {
      await ctx.db.insert("estimateTemplateItems", {
        templateId,
        category: item.category,
        itemName: item.itemName,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        costPerUnit: item.costPerUnit,
        notes: item.notes,
        length: item.length,
        width: item.width,
        height: item.height,
      });
    }

    await logEstimationAction(ctx, "template_created", user, `Created estimate template: ${args.templateName} for type ${args.projectType}`);

    return { success: true, templateId };
  },
});

export const updateEstimateTemplate = mutation({
  args: {
    requestorEmail: v.string(),
    id: v.id("estimateTemplates"),
    templateName: v.string(),
    projectType: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    items: v.array(
      v.object({
        category: v.string(),
        itemName: v.string(),
        description: v.optional(v.string()),
        quantity: v.optional(v.number()),
        unit: v.string(),
        costPerUnit: v.optional(v.number()),
        notes: v.optional(v.string()),
        length: v.optional(v.number()),
        width: v.optional(v.number()),
        height: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await verifyPermission(ctx, args.requestorEmail, "manage_estimate_templates");

    await ctx.db.patch(args.id, {
      templateName: args.templateName,
      projectType: args.projectType,
      description: args.description,
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    // Delete existing template items
    const oldItems = await ctx.db
      .query("estimateTemplateItems")
      .withIndex("by_templateId", (q) => q.eq("templateId", args.id))
      .collect();
    for (const item of oldItems) {
      await ctx.db.delete(item._id);
    }

    // Insert new template items
    for (const item of args.items) {
      await ctx.db.insert("estimateTemplateItems", {
        templateId: args.id,
        category: item.category,
        itemName: item.itemName,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        costPerUnit: item.costPerUnit,
        notes: item.notes,
        length: item.length,
        width: item.width,
        height: item.height,
      });
    }

    await logEstimationAction(ctx, "template_edited", user, `Updated estimate template: ${args.templateName}`);

    return { success: true };
  },
});

export const seedEstimationData = mutation({
  args: { requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await verifyPermission(ctx, args.requestorEmail, "manage_rate_library");

    // 1. Seed Rate Library
    const existingRates = await ctx.db.query("rateLibrary").collect();
    if (existingRates.length === 0) {
      const defaultRates = [
        { itemName: "Plywood 18mm (Commercial)", category: "Woodwork / Carpentry", unit: "Sheets", defaultRate: 2500 },
        { itemName: "Laminate (Standard 1mm)", category: "Woodwork / Carpentry", unit: "Sheets", defaultRate: 1200 },
        { itemName: "False Ceiling (Gypsum board)", category: "False Ceiling", unit: "Sq.ft", defaultRate: 120 },
        { itemName: "Painting (Emulsion interior)", category: "Painting", unit: "Sq.ft", defaultRate: 18 },
        { itemName: "Electrical Point (Light/Fan wiring)", category: "Electrical", unit: "Points", defaultRate: 650 },
        { itemName: "Carpenter Labour", category: "Labour", unit: "Days", defaultRate: 900 },
        { itemName: "Transport (Lumpsum)", category: "Transport", unit: "Lumpsum", defaultRate: 8000 },
        { itemName: "Civil Work (Wall Plastering)", category: "Civil Work", unit: "Sq.ft", defaultRate: 350 },
        { itemName: "Plumbing Point (Kitchen Sink)", category: "Plumbing", unit: "Points", defaultRate: 1500 },
        { itemName: "Premium LED Spotlight", category: "Lighting", unit: "Nos", defaultRate: 450 },
        { itemName: "Cabinet Handles (Standard)", category: "Hardware", unit: "Nos", defaultRate: 150 },
        { itemName: "Post-Construction Cleaning", category: "Cleaning", unit: "Lumpsum", defaultRate: 5000 },
      ];

      for (const r of defaultRates) {
        await ctx.db.insert("rateLibrary", {
          ...r,
          isActive: true,
          createdBy: user.name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    // 2. Seed Templates
    const existingTemplates = await ctx.db.query("estimateTemplates").collect();
    if (existingTemplates.length === 0) {
      const templates = [
        {
          templateName: "2BHK Interior Estimate Template",
          projectType: "2BHK Interior",
          description: "Standard 2BHK complete interior estimate framework.",
          items: [
            { category: "False Ceiling", itemName: "False Ceiling (Gypsum board)", description: "Living and bedrooms false ceiling setup", quantity: 600, unit: "Sq.ft", costPerUnit: 120 },
            { category: "Painting", itemName: "Painting (Emulsion interior)", description: "Premium paint work", quantity: 2400, unit: "Sq.ft", costPerUnit: 18 },
            { category: "Woodwork / Carpentry", itemName: "Plywood 18mm (Commercial)", description: "Wardrobe structure plywood", quantity: 45, unit: "Sheets", costPerUnit: 2500 },
            { category: "Woodwork / Carpentry", itemName: "Laminate (Standard 1mm)", description: "Wardrobe external laminate sheets", quantity: 25, unit: "Sheets", costPerUnit: 1200 },
            { category: "Labour", itemName: "Carpenter Labour", description: "Carpentry installation days", quantity: 30, unit: "Days", costPerUnit: 900 },
            { category: "Transport", itemName: "Transport (Lumpsum)", description: "Material carriage", quantity: 1, unit: "Lumpsum", costPerUnit: 8000 },
          ]
        },
        {
          templateName: "Modular Kitchen Estimate Template",
          projectType: "Modular Kitchen",
          description: "Premium modular kitchen layout woodwork and fittings.",
          items: [
            { category: "Woodwork / Carpentry", itemName: "Plywood 18mm (Commercial)", description: "Kitchen counter and cabinets structure", quantity: 20, unit: "Sheets", costPerUnit: 2500 },
            { category: "Woodwork / Carpentry", itemName: "Laminate (Standard 1mm)", description: "Kitchen shutters laminate", quantity: 12, unit: "Sheets", costPerUnit: 1200 },
            { category: "Plumbing", itemName: "Plumbing Point (Kitchen Sink)", description: "Faucet, pipes and sink layout", quantity: 1, unit: "Points", costPerUnit: 1500 },
            { category: "Hardware", itemName: "Cabinet Handles (Standard)", description: "Premium designer handles", quantity: 18, unit: "Nos", costPerUnit: 150 },
            { category: "Labour", itemName: "Carpenter Labour", description: "Modular kitchen assembly", quantity: 12, unit: "Days", costPerUnit: 900 },
          ]
        }
      ];

      for (const t of templates) {
        const templateId = await ctx.db.insert("estimateTemplates", {
          templateName: t.templateName,
          projectType: t.projectType,
          description: t.description,
          isActive: true,
          createdBy: user.name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        for (const item of t.items) {
          await ctx.db.insert("estimateTemplateItems", {
            templateId,
            category: item.category,
            itemName: item.itemName,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            costPerUnit: item.costPerUnit,
          });
        }
      }
    }

    return { success: true };
  }
});

