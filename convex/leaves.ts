import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getHolidayInfo } from "./holiday_helper";

// Helper to check user access
async function checkAccess(ctx: any, email?: string) {
  if (!email) return { isAdmin: false, userId: null, user: null };

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .unique();
  
  if (!user || user.status === "inactive") return { isAdmin: false, userId: null, user: null };

  const permissions = (user.permissions || []) as any[];
  const hasManagePermission = permissions.some((p: any) => 
    (p.key === 'manage_attendance' && p.allowed === true) ||
    (p.name === 'Manage Attendance' && p.allowed === true)
  );

  const isAdmin = user.role === 'Owner' || hasManagePermission;

  return { isAdmin, userId: user._id, user };
}

// Helper to get dates in range using UTC to avoid timezone issues
const getDatesInRange = (startDateStr: string, endDateStr: string) => {
  const dates = [];
  const [startYear, startMonth, startDay] = startDateStr.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDateStr.split("-").map(Number);
  
  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
  const current = new Date(start);
  
  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
};

// Helper to automatically update/create attendance records for approved leaves
async function provisionAttendance(ctx: any, requestId: Id<"leaveRequests">, now: number) {
  const request = await ctx.db.get(requestId);
  if (!request) return;

  const targetUser = await ctx.db.get(request.userId);

  const dates = getDatesInRange(request.fromDate, request.toDate);
  for (const date of dates) {
    if (targetUser) {
      const holidayInfo = await getHolidayInfo(ctx, date, targetUser);
      if (holidayInfo.isHoliday) {
        continue;
      }
    }
    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_employee_date", (q: any) => q.eq("employeeId", request.userId).eq("date", date))
      .unique();

    const status = request.isHalfDay ? "Half-day-leave" : "Leave";

    if (existing) {
      // If a check-in already exists and this is full-day, we preserve check-in but update meta.
      // If it's a half-day, we preserve check-in and update status.
      if (existing.checkIn) {
        if (request.isHalfDay) {
          await ctx.db.patch(existing._id, {
            status,
            leaveRequestId: request._id,
            leaveType: request.leaveType,
            notes: `Half-day Leave: ${request.reason}` + (existing.notes ? ` | ${existing.notes}` : ""),
            updatedAt: now,
          });
        } else {
          // Full day leave, keep check-in but annotate
          await ctx.db.patch(existing._id, {
            leaveRequestId: request._id,
            leaveType: request.leaveType,
            notes: `Approved Leave during Checked-in day: ${request.reason}` + (existing.notes ? ` | ${existing.notes}` : ""),
            updatedAt: now,
          });
        }
      } else {
        // No active check-in (e.g. was marked Absent) -> overwrite status
        await ctx.db.patch(existing._id, {
          status,
          approvalStatus: "Approved",
          leaveRequestId: request._id,
          leaveType: request.leaveType,
          notes: request.reason,
          updatedAt: now,
        });
      }
    } else {
      // Create new attendance record
      await ctx.db.insert("attendance", {
        employeeId: request.userId,
        date,
        status,
        approvalStatus: "Approved",
        leaveRequestId: request._id,
        leaveType: request.leaveType,
        notes: request.reason,
        siteId: request.siteId,
        siteName: request.siteName || "N/A",
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

// 1. Create Leave Request
export const createLeaveRequest = mutation({
  args: {
    employeeId: v.id("users"),
    leaveType: v.string(),
    fromDate: v.string(), // YYYY-MM-DD
    toDate: v.string(), // YYYY-MM-DD
    isHalfDay: v.boolean(),
    halfDaySession: v.optional(v.union(v.literal("first_half"), v.literal("second_half"))),
    reason: v.string(),
    attachmentStorageId: v.optional(v.id("_storage")),
    requestorEmail: v.string(),
    status: v.optional(v.union(v.literal("pending"), v.literal("approved"))),
  },
  handler: async (ctx, args) => {
    const { isAdmin, userId, user } = await checkAccess(ctx, args.requestorEmail);
    if (!userId || !user) throw new Error("Not authenticated");

    const defaultStatus = isAdmin ? "approved" : "pending";
    const finalStatus = args.status || defaultStatus;

    // Regular staff can only request leaves for themselves and only with pending status
    if (!isAdmin) {
      if (args.employeeId !== userId) {
        throw new Error("You do not have permission to manage leave requests.");
      }
      if (finalStatus !== "pending") {
        throw new Error("Regular staff can only submit pending leave requests.");
      }
    }

    const targetUser = (await ctx.db.get(args.employeeId)) as any;
    if (!targetUser) throw new Error("Employee not found");

    if (args.toDate < args.fromDate) {
      throw new Error("End date cannot be before start date.");
    }

    if (args.isHalfDay && args.fromDate !== args.toDate) {
      throw new Error("Half-day leave must be on the same date.");
    }

    // Check for overlap with existing pending/approved requests
    const existingRequests = await ctx.db
      .query("leaveRequests")
      .withIndex("by_user", q => q.eq("userId", args.employeeId))
      .collect();

    const hasOverlap = existingRequests.some(r => {
      if (r.status !== "pending" && r.status !== "approved") return false;
      return args.fromDate <= r.toDate && r.fromDate <= args.toDate;
    });

    if (hasOverlap) {
      throw new Error("A pending or approved leave request already exists for this date range.");
    }

    // Calculate total days excluding holidays
    let totalDays = 0;
    if (args.isHalfDay) {
      totalDays = 0.5;
    } else {
      const dates = getDatesInRange(args.fromDate, args.toDate);
      for (const d of dates) {
        const holidayInfo = await getHolidayInfo(ctx, d, targetUser);
        if (holidayInfo.isHoliday) {
          continue;
        }
        totalDays += 1;
      }
    }

    // Resolve site details from target user context
    const siteId = targetUser.siteId;
    let siteName = undefined;
    if (siteId) {
      const site = (await ctx.db.get(siteId)) as any;
      siteName = site?.name;
    }

    const now = Date.now();
    const isApproved = finalStatus === "approved";
    const leaveRequestId = await ctx.db.insert("leaveRequests", {
      userId: args.employeeId,
      userName: targetUser.name,
      userRole: targetUser.role,
      siteId,
      siteName,
      leaveType: args.leaveType,
      fromDate: args.fromDate,
      toDate: args.toDate,
      totalDays,
      isHalfDay: args.isHalfDay,
      halfDaySession: args.halfDaySession,
      reason: args.reason,
      attachmentStorageId: args.attachmentStorageId,
      status: finalStatus,
      approvedBy: isApproved ? user.email : undefined,
      approvedByName: isApproved ? user.name : undefined,
      approvedAt: isApproved ? now : undefined,
      createdBy: user.name,
      createdAt: now,
      updatedAt: now,
    });

    if (isApproved) {
      await provisionAttendance(ctx, leaveRequestId, now);
    }

    // Optional Notification for Owner/Admins (only if pending)
    if (finalStatus === "pending") {
      const owners = await ctx.db.query("users").filter(q => q.eq(q.field("role"), "Owner")).collect();
      for (const owner of owners) {
        if (owner._id === userId) continue;
        await ctx.db.insert("notifications", {
          userId: owner.name,
          title: "New Leave Request",
          description: `${targetUser.name} requested ${args.leaveType} from ${args.fromDate} to ${args.toDate}.`,
          type: "request",
          read: false,
          created_at: now,
        });
      }
    }

    return { success: true, id: leaveRequestId };
  },
});

// 2. Approve Leave Request
export const approveLeaveRequest = mutation({
  args: {
    id: v.id("leaveRequests"),
    approvalNote: v.optional(v.string()),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, user, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin || !user) {
      throw new Error("You do not have permission to manage leave requests.");
    }

    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Leave request not found");
    if (request.status !== "pending") throw new Error("Only pending requests can be approved.");

    if (request.userId === userId) {
      throw new Error("You cannot approve your own leave request.");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "approved",
      approvalNote: args.approvalNote,
      updatedAt: now,
      approvedBy: user.email,
      approvedByName: user.name,
      approvedAt: now,
    });

    await provisionAttendance(ctx, args.id, now);

    // Notify employee
    const employee = await ctx.db.get(request.userId);
    if (employee) {
      await ctx.db.insert("notifications", {
        userId: employee.name,
        title: "Leave Approved",
        description: `Your request for ${request.leaveType} has been approved.`,
        type: "request",
        read: false,
        created_at: now,
      });
    }

    return { success: true };
  },
});

// 3. Reject Leave Request
export const rejectLeaveRequest = mutation({
  args: {
    id: v.id("leaveRequests"),
    approvalNote: v.optional(v.string()), // Used as rejection note
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, user, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin || !user) {
      throw new Error("You do not have permission to manage leave requests.");
    }

    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Leave request not found");
    if (request.status !== "pending") throw new Error("Only pending requests can be rejected.");

    if (request.userId === userId) {
      throw new Error("You cannot reject your own leave request.");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "rejected",
      approvalNote: args.approvalNote,
      updatedAt: now,
      rejectedBy: user.email,
      rejectedByName: user.name,
      rejectedAt: now,
    });

    // Notify employee
    const employee = await ctx.db.get(request.userId);
    if (employee) {
      await ctx.db.insert("notifications", {
        userId: employee.name,
        title: "Leave Rejected",
        description: `Your request for ${request.leaveType} has been rejected.`,
        type: "request",
        read: false,
        created_at: now,
      });
    }

    return { success: true };
  },
});

// 4. Cancel Leave Request
export const cancelLeaveRequest = mutation({
  args: {
    id: v.id("leaveRequests"),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) throw new Error("Not authenticated");

    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Leave request not found");


    // Regular staff can only cancel their own pending requests
    if (!isAdmin && request.userId !== userId) {
      throw new Error("You do not have permission to manage leave requests.");
    }

    if (!isAdmin && request.status !== "pending") {
      throw new Error("Approved or rejected leaves can only be cancelled by a manager.");
    }

    if (request.status === "cancelled") {
      throw new Error("Leave request is already cancelled.");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "cancelled",
      updatedAt: now,
    });

    // If request was already approved, revert associated attendance records
    if (request.status === "approved") {
      const dates = getDatesInRange(request.fromDate, request.toDate);
      for (const date of dates) {
        const attendance = await ctx.db
          .query("attendance")
          .withIndex("by_employee_date", q => q.eq("employeeId", request.userId).eq("date", date))
          .unique();

        if (attendance && attendance.leaveRequestId === request._id) {
          if (attendance.checkIn) {
            let status = "Present";
            if (attendance.totalHours !== undefined && attendance.totalHours < 4) {
              status = "Half-day";
            }
            await ctx.db.patch(attendance._id, {
              status: status as any,
              leaveRequestId: undefined,
              leaveType: undefined,
              updatedAt: now,
            });
          } else {
            // No check-in, delete the leave attendance record
            await ctx.db.delete(attendance._id);
          }
        }
      }
    }

    return { success: true };
  },
});

// 5. Get My Leave Requests
export const getMyLeaveRequests = query({
  args: { requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) return [];

    const requests = await ctx.db
      .query("leaveRequests")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    // Enrich with file URLs
    return await Promise.all(
      requests.map(async r => {
        const attachmentUrl = r.attachmentStorageId
          ? await ctx.storage.getUrl(r.attachmentStorageId)
          : undefined;
        return { ...r, attachmentUrl };
      })
    );
  },
});

// 6. Get All Leave Requests For Manager
export const getAllLeaveRequestsForManager = query({
  args: { requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin) {
      throw new Error("You do not have permission to manage leave requests.");
    }

    const requests = await ctx.db.query("leaveRequests").collect();

    // Enrich with file URLs
    const enriched = await Promise.all(
      requests.map(async r => {
        const attachmentUrl = r.attachmentStorageId
          ? await ctx.storage.getUrl(r.attachmentStorageId)
          : undefined;
        return { ...r, attachmentUrl };
      })
    );

    // Sort by createdAt desc
    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// 7. Get Pending Leave Requests count
export const getPendingLeaveRequests = query({
  args: { requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin) return 0;

    const pending = await ctx.db
      .query("leaveRequests")
      .withIndex("by_status", q => q.eq("status", "pending"))
      .collect();

    return pending.length;
  },
});

// 8. Get Leave Request By Id
export const getLeaveRequestById = query({
  args: { id: v.id("leaveRequests"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) throw new Error("Not authenticated");

    const request = await ctx.db.get(args.id);
    if (!request) return null;

    if (!isAdmin && request.userId !== userId) {
      throw new Error("You do not have permission to view this leave request.");
    }

    const attachmentUrl = request.attachmentStorageId
      ? await ctx.storage.getUrl(request.attachmentStorageId)
      : undefined;

    return { ...request, attachmentUrl };
  },
});
