import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getHolidayInfo } from "./holiday_helper";

// Helper to check user access and permissions
async function checkAccess(ctx: any, email?: string) {
  if (!email) return { isAdmin: false, isStaff: false, userId: null, user: null };

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .unique();

  if (!user || user.status === "inactive") {
    return { isAdmin: false, isStaff: false, userId: null, user: null };
  }

  const permissions = (user.permissions || []) as any[];

  const hasGenerateDocPermission = permissions.some((p: any) => 
    (p.key === 'generate_hr_documents' && p.allowed === true) ||
    (p.key === 'manage_hr_documents' && p.allowed === true)
  );

  const hasIssueDocPermission = permissions.some((p: any) => 
    (p.key === 'issue_hr_documents' && p.allowed === true) ||
    (p.key === 'manage_hr_documents' && p.allowed === true)
  );

  const hasEmailDocPermission = permissions.some((p: any) => 
    (p.key === 'email_hr_documents' && p.allowed === true) ||
    (p.key === 'manage_hr_documents' && p.allowed === true)
  );

  const hasViewDocPermission = permissions.some((p: any) => 
    (p.key === 'view_hr_documents' && p.allowed === true) ||
    (p.key === 'manage_hr_documents' && p.allowed === true)
  );

  const hasManagePermission = permissions.some((p: any) => 
    (p.key === 'manage_hr_documents' && p.allowed === true)
  );

  const isAdmin = user.role === 'Owner' || hasManagePermission;

  return { 
    isAdmin, 
    isStaff: true,
    hasGenerateDocPermission: user.role === 'Owner' || hasGenerateDocPermission,
    hasIssueDocPermission: user.role === 'Owner' || hasIssueDocPermission,
    hasEmailDocPermission: user.role === 'Owner' || hasEmailDocPermission,
    hasViewDocPermission: user.role === 'Owner' || hasViewDocPermission,
    userId: user._id, 
    user 
  };
}

// Get generated documents
export const getGeneratedDocuments = query({
  args: { requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin, hasViewDocPermission, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) throw new Error("Not authenticated");

    if (isAdmin || hasViewDocPermission) {
      return await ctx.db
        .query("generatedDocuments")
        .order("desc")
        .collect();
    }

    // Normal staff see only documents issued to them
    return await ctx.db
      .query("generatedDocuments")
      .filter((q) => q.eq(q.field("userId"), userId))
      .filter((q) => q.eq(q.field("status"), "issued"))
      .order("desc")
      .collect();
  },
});

// Get document by ID
export const getGeneratedDocumentById = query({
  args: { id: v.id("generatedDocuments"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin, hasViewDocPermission, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) throw new Error("Not authenticated");

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");

    if (isAdmin || hasViewDocPermission || doc.userId === userId) {
      return doc;
    }

    throw new Error("Permission denied");
  },
});

// Default document templates list if database is empty
const DEFAULT_TEMPLATES = [
  {
    templateName: "Member Default",
    documentType: "Offer Letter",
    rolePreset: "Staff",
    body: "Following our recent discussions, we are pleased to offer you the position of {{designation}} at {{companyName}}. We believe your skills and experience will be a valuable addition to our team.\n\nYour employment will start on {{joiningDate}}.\n\nSalary: {{salary}} per month.\n\nLocation: {{siteName}}.\n\nAuthorized Signatory: {{authorizedPerson}}\nDate: {{letterDate}}",
    defaultFields: {
      companyName: "Acme Interiors",
      authorizedPerson: "Company Owner",
      siteName: "Office (Main Branch)",
      designation: "Interior Designer",
      salary: "Rs. 25,000",
      joiningDate: "2026-06-15",
      letterDate: "2026-06-09"
    },
    isActive: true
  },
  {
    templateName: "Intern Default",
    documentType: "Internship Offer Letter",
    rolePreset: "Intern",
    body: "We are pleased to offer you an internship position as {{designation}} at {{companyName}} starting on {{joiningDate}}.\n\nStipend: {{salary}} per month.\n\nAuthorized Signatory: {{authorizedPerson}}",
    defaultFields: {
      companyName: "Acme Interiors",
      authorizedPerson: "Company Owner",
      designation: "Design Intern",
      salary: "Rs. 10,000",
      joiningDate: "2026-06-15",
      letterDate: "2026-06-09"
    },
    isActive: true
  },
  {
    templateName: "Member Default",
    documentType: "Experience Letter",
    rolePreset: "Staff",
    body: "This is to certify that {{employeeName}} was employed at {{companyName}} as {{designation}} from {{joiningDate}} to {{exitDate}}.\n\nDuring their tenure, they demonstrated great professionalism and dedication. We wish them all the best in their future endeavors.\n\nAuthorized Signatory: {{authorizedPerson}}",
    defaultFields: {
      companyName: "Acme Interiors",
      authorizedPerson: "Company Owner",
      designation: "Site Supervisor",
      joiningDate: "2025-01-01",
      exitDate: "2026-05-30",
      letterDate: "2026-06-09"
    },
    isActive: true
  }
];

// Get templates
export const getDocumentTemplates = query({
  args: {},
  handler: async (ctx) => {
    const dbTemplates = await ctx.db
      .query("documentTemplates")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (dbTemplates.length > 0) {
      return dbTemplates;
    }

    return DEFAULT_TEMPLATES;
  },
});

// Get members list for dropdown
export const getMembersForDocumentGeneration = query({
  args: { requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin, hasGenerateDocPermission } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin && !hasGenerateDocPermission) {
      throw new Error("Permission denied");
    }

    const allUsers = await ctx.db.query("users").collect();
    return allUsers.filter(u => u.status !== 'deleted');
  },
});

// Create draft document
export const createGeneratedDocumentDraft = mutation({
  args: {
    memberType: v.union(v.literal("existing"), v.literal("custom")),
    userId: v.optional(v.id("users")),
    employeeName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    designation: v.optional(v.string()),
    documentType: v.string(),
    templateName: v.string(),
    documentTitle: v.string(),
    documentBody: v.string(),
    documentFields: v.any(),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, hasGenerateDocPermission, user } = await checkAccess(ctx, args.requestorEmail);
    if (!user || (!isAdmin && !hasGenerateDocPermission)) {
      throw new Error("Permission denied");
    }

    const { requestorEmail, ...fields } = args;

    const docId = await ctx.db.insert("generatedDocuments", {
      ...fields,
      status: "draft",
      createdBy: user.email,
      createdByName: user.name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return docId;
  },
});

// Update draft document
export const updateGeneratedDocumentFields = mutation({
  args: {
    id: v.id("generatedDocuments"),
    documentTitle: v.string(),
    documentBody: v.string(),
    documentFields: v.any(),
    employeeName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    designation: v.optional(v.string()),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, hasGenerateDocPermission } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin && !hasGenerateDocPermission) {
      throw new Error("Permission denied");
    }

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");
    if (doc.status === "issued") throw new Error("Cannot edit an already issued document");

    const patch: any = {
      documentTitle: args.documentTitle,
      documentBody: args.documentBody,
      documentFields: args.documentFields,
      updatedAt: Date.now(),
    };

    if (args.employeeName) patch.employeeName = args.employeeName;
    if (args.email) patch.email = args.email;
    if (args.phone) patch.phone = args.phone;
    if (args.designation) patch.designation = args.designation;

    await ctx.db.patch(args.id, patch);

    return { success: true };
  },
});

// Issue generated document officially
export const issueGeneratedDocument = mutation({
  args: {
    id: v.id("generatedDocuments"),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, hasIssueDocPermission, user } = await checkAccess(ctx, args.requestorEmail);
    if (!user || (!isAdmin && !hasIssueDocPermission)) {
      throw new Error("Permission denied");
    }

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");

    const documentNumber = `DOC-${Date.now().toString().substring(6)}`;

    await ctx.db.patch(args.id, {
      status: "issued",
      issuedBy: user.email,
      issuedByName: user.name,
      issuedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true, documentNumber };
  },
});

// Save PDF / DOCX storage IDs
export const saveGeneratedDocumentFiles = mutation({
  args: {
    id: v.id("generatedDocuments"),
    pdfStorageId: v.optional(v.id("_storage")),
    docxStorageId: v.optional(v.id("_storage")),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, hasIssueDocPermission } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin && !hasIssueDocPermission) {
      throw new Error("Permission denied");
    }

    const patch: any = { updatedAt: Date.now() };
    if (args.pdfStorageId) patch.pdfStorageId = args.pdfStorageId;
    if (args.docxStorageId) patch.docxStorageId = args.docxStorageId;

    await ctx.db.patch(args.id, patch);

    return { success: true };
  },
});

// Mark document as emailed
export const emailGeneratedDocument = mutation({
  args: {
    id: v.id("generatedDocuments"),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, hasEmailDocPermission } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin && !hasEmailDocPermission) {
      throw new Error("Permission denied");
    }

    await ctx.db.patch(args.id, {
      status: "emailed",
      emailedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Delete document draft
export const deleteDocumentDraft = mutation({
  args: {
    id: v.id("generatedDocuments"),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, hasGenerateDocPermission } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin && !hasGenerateDocPermission) {
      throw new Error("Permission denied");
    }

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");
    if (doc.status === "issued") throw new Error("Cannot delete issued documents");

    // Clean files if upload was performed
    if (doc.pdfStorageId) {
      try { await ctx.storage.delete(doc.pdfStorageId); } catch(e) {}
    }
    if (doc.docxStorageId) {
      try { await ctx.storage.delete(doc.docxStorageId); } catch(e) {}
    }

    await ctx.db.delete(args.id);

    return { success: true };
  },
});

// Salary and payroll calculation query
export const calculateSalaryDetails = query({
  args: {
    userId: v.id("users"),
    year: v.number(),
    month: v.number(),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, hasGenerateDocPermission, user: reqUser } = await checkAccess(ctx, args.requestorEmail);
    if (!reqUser) throw new Error("Not authenticated");
    if (!isAdmin && !hasGenerateDocPermission) {
      throw new Error("Permission denied");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("User not found");

    const lastDate = new Date(args.year, args.month, 0).getDate();
    const attendanceLogs = await ctx.db
      .query("attendance")
      .withIndex("by_employee", (q) => q.eq("employeeId", args.userId))
      .collect();

    const monthStr = String(args.month).padStart(2, '0');
    const prefix = `${args.year}-${monthStr}-`;
    const monthLogs = attendanceLogs.filter(log => log.date.startsWith(prefix));

    const logsMap = new Map<string, any>();
    for (const log of monthLogs) {
      logsMap.set(log.date, log);
    }

    const dateBreakdown = [];
    let holidaysCount = 0;
    let presentCount = 0;
    let halfDaysCount = 0;
    let paidLeavesCount = 0;
    let unpaidLeavesCount = 0;
    let absentsCount = 0;

    for (let day = 1; day <= lastDate; day++) {
      const dateStr = `${args.year}-${monthStr}-${String(day).padStart(2, '0')}`;
      
      const tempDate = new Date(args.year, args.month - 1, day);
      const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayOfWeek = daysOfWeek[tempDate.getDay()];

      const holidayInfo = await getHolidayInfo(ctx, dateStr, targetUser);
      const log = logsMap.get(dateStr);

      let status = "Absent";
      let hoursWorked = 0;
      let notes = "";
      let isHoliday = holidayInfo.isHoliday;
      let holidayName = holidayInfo.holidayName || null;
      let salaryWeight = 0;
      let category: "present" | "half-day" | "paid-leave" | "unpaid-leave" | "absent" | "holiday" = "absent";

      if (log) {
        status = log.status;
        hoursWorked = log.totalHours || 0;
        notes = log.notes || "";
        
        if (status === "Present" || status === "Late" || status === "WFH" || status === "Present / Holiday Work" || status === "holiday_working") {
          salaryWeight = 1.0;
          presentCount++;
          category = "present";
        } else if (status === "Half-day") {
          salaryWeight = 0.5;
          halfDaysCount++;
          category = "half-day";
        } else if (status === "Half-day-leave") {
          const isPaid = log.leaveType ? !["Unpaid Leave", "LWP"].includes(log.leaveType) : true;
          salaryWeight = isPaid ? 1.0 : 0.5;
          halfDaysCount++;
          if (isPaid) {
            paidLeavesCount += 0.5;
            category = "paid-leave";
          } else {
            unpaidLeavesCount += 0.5;
            category = "unpaid-leave";
          }
        } else if (status === "Leave") {
          const isPaid = log.leaveType ? !["Unpaid Leave", "LWP"].includes(log.leaveType) : true;
          salaryWeight = isPaid ? 1.0 : 0.0;
          if (isPaid) {
            paidLeavesCount++;
            category = "paid-leave";
          } else {
            unpaidLeavesCount++;
            category = "unpaid-leave";
          }
        } else if (status === "Holiday" || status === "holiday") {
          salaryWeight = 1.0;
          holidaysCount++;
          category = "holiday";
        } else {
          salaryWeight = 0.0;
          absentsCount++;
          category = "absent";
        }
      } else {
        if (isHoliday) {
          salaryWeight = 1.0;
          holidaysCount++;
          status = "Holiday";
          category = "holiday";
        } else {
          salaryWeight = 0.0;
          absentsCount++;
          status = "Absent";
          category = "absent";
        }
      }

      dateBreakdown.push({
        date: dateStr,
        dayOfWeek,
        isHoliday,
        holidayName,
        attendanceStatus: status,
        hoursWorked,
        notes,
        salaryWeight,
        category,
      });
    }

    const actualWorkingDays = lastDate - holidaysCount;
    const netPayableDays = presentCount + (halfDaysCount * 0.5) + paidLeavesCount;

    const baseSalary = targetUser.salary || 0;
    const dailyRate = actualWorkingDays > 0 ? (baseSalary / actualWorkingDays) : 0;
    
    let calculatedSalary = 0;
    if (baseSalary > 0) {
      calculatedSalary = Math.round(netPayableDays * dailyRate);
      if (calculatedSalary > baseSalary) {
        calculatedSalary = baseSalary;
      }
    }
    const deductions = baseSalary - calculatedSalary;

    return {
      dateBreakdown,
      summary: {
        totalCalendarDays: lastDate,
        holidays: holidaysCount,
        actualWorkingDays,
        presentDays: presentCount,
        halfDays: halfDaysCount,
        paidLeaves: paidLeavesCount,
        unpaidLeaves: unpaidLeavesCount,
        absents: absentsCount,
        netPayableDays,
        dailyRate: Math.round(dailyRate * 100) / 100,
        calculatedSalary,
        deductions,
        baseSalary,
      }
    };
  }
});

// Create custom template
export const createCustomTemplate = mutation({
  args: {
    templateName: v.string(),
    documentType: v.string(),
    rolePreset: v.string(),
    body: v.string(),
    defaultFields: v.any(),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, hasGenerateDocPermission } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin && !hasGenerateDocPermission) {
      throw new Error("Permission denied");
    }

    const templateId = await ctx.db.insert("documentTemplates", {
      templateName: args.templateName,
      documentType: args.documentType,
      rolePreset: args.rolePreset,
      body: args.body,
      defaultFields: args.defaultFields,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return templateId;
  },
});

