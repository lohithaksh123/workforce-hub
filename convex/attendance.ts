// Attendance management functions for Acme Interiors
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getHolidayInfo } from "./holiday_helper";

const OFFICE_START_TIME = "09:30";
const MIN_HOURS_HALF_DAY = 4;
const MIN_HOURS_FULL_DAY = 8;

const formatDuration = (decimalHours: number) => {
  if (!decimalHours || decimalHours <= 0) return "0h 0m";
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
};

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

// Helper to get current user and their access level
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

export const getPhotoRequirement = query({
  args: {
    userId: v.id("users"),
    siteId: v.optional(v.id("sites"))
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return { required: false };

    if (user.requiresAttendancePhoto) return { required: true };

    if (args.siteId) {
      const site = await ctx.db.get(args.siteId);
      if (site?.requiresAttendancePhoto) return { required: true };
    }

    return { required: false };
  }
});

export const checkIn = mutation({
  args: {
    employeeId: v.id("users"),
    siteId: v.optional(v.id("sites")),
    siteName: v.optional(v.string()), // Allow manual site name (e.g. "Office")
    notes: v.optional(v.string()),
    requestorEmail: v.string(),
    photoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { isAdmin, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) throw new Error("Not authenticated");

    // Regular staff can only check in for themselves
    if (!isAdmin && args.employeeId !== userId) {
      throw new Error("You can only check in for yourself.");
    }

    const today = new Date().toISOString().split("T")[0];
    const now = Date.now();

    // Check if already checked in today
    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_employee_date", (q) =>
        q.eq("employeeId", args.employeeId).eq("date", today)
      )
      .unique();

    if (existing) {
      throw new Error("You have already checked in for today.");
    }

    // Determine if late
    const startTime = new Date();
    const [hours, minutes] = OFFICE_START_TIME.split(":").map(Number);
    startTime.setHours(hours, minutes, 0, 0);

    const isLate = now > startTime.getTime();

    // Resolve site name if siteId provided but siteName is not
    let siteName = args.siteName;
    if (args.siteId && !siteName) {
      const site = await ctx.db.get(args.siteId);
      siteName = site?.name;
    }

    // Check photo requirement
    const user = (await ctx.db.get(args.employeeId)) as any;
    const site = args.siteId ? (await ctx.db.get(args.siteId)) as any : null;
    const isPhotoRequired = user?.requiresAttendancePhoto === true || site?.requiresAttendancePhoto === true;

    if (isPhotoRequired && !args.photoStorageId) {
      throw new Error("Site photo proof is required for this check-in.");
    }

    const holidayInfo = await getHolidayInfo(ctx, today, args.employeeId);
    let status = holidayInfo.isHoliday ? "holiday_working" : "Present";
    if (args.siteName === "Work from Home") {
      status = "WFH";
    }

    const attendanceId = await ctx.db.insert("attendance", {
      employeeId: args.employeeId,
      date: today,
      checkIn: now,
      status: status as any,
      approvalStatus: "Auto",
      siteId: args.siteId,
      siteName: siteName || "N/A",
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
      photoStorageId: args.photoStorageId,
      photoRequired: isPhotoRequired,
      photoStatus: isPhotoRequired ? (args.photoStorageId ? "uploaded" : "missing") : "not_required",
      photoUploadedAt: args.photoStorageId ? now : undefined,
    });

    if (args.photoStorageId) {
      await ctx.db.insert("attendance_audit_logs", {
        attendanceId,
        action: "photo_uploaded",
        userId: user.name,
        createdAt: now,
        newPhotoStorageId: args.photoStorageId,
      });
    }

    return { success: true, id: attendanceId };
  },
});

export const checkOut = mutation({
  args: {
    employeeId: v.id("users"),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) throw new Error("Not authenticated");

    // Regular staff can only check out for themselves
    if (!isAdmin && args.employeeId !== userId) {
      throw new Error("You can only check out for yourself.");
    }

    const today = new Date().toISOString().split("T")[0];
    const now = Date.now();

    const attendance = await ctx.db
      .query("attendance")
      .withIndex("by_employee_date", (q) =>
        q.eq("employeeId", args.employeeId).eq("date", today)
      )
      .unique();

    if (!attendance) {
      throw new Error("No check-in record found for today.");
    }

    if (attendance.checkOut) {
      throw new Error("You have already checked out for today.");
    }

    const totalMs = now - attendance.checkIn!;
    const totalHours = totalMs / (1000 * 60 * 60);

    let status = attendance.status;
    if (totalHours < MIN_HOURS_HALF_DAY) {
      status = "Half-day";
    }

    await ctx.db.patch(attendance._id, {
      checkOut: now,
      totalHours,
      status,
      updatedAt: now,
    });

    return { success: true };
  },
});

export const getTodayAttendance = query({
  args: { requestorEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { isAdmin, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) return [];

    const today = new Date().toISOString().split("T")[0];

    if (!isAdmin) {
      const myLog = await ctx.db
        .query("attendance")
        .withIndex("by_employee_date", (q) => q.eq("employeeId", userId).eq("date", today))
        .unique();
      return myLog ? [myLog] : [];
    }

    return await ctx.db
      .query("attendance")
      .withIndex("by_date", (q: any) => q.eq("date", today))
      .collect();
  },
});

export const getAttendanceStatsByDate = query({
  args: {
    date: v.string(),
    requestorEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { isAdmin, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) return null;

    if (!isAdmin) {
      const myLog = await ctx.db
        .query("attendance")
        .withIndex("by_employee_date", (q) => q.eq("employeeId", userId).eq("date", args.date))
        .unique();

      const hasLog = !!myLog;
      const isOnLeave = myLog ? (myLog.status === "Leave" || myLog.status === "Half-day-leave") : false;
      const isHolidayStatus = myLog ? (myLog.status === "holiday") : false;

      let holidayInfo: any = { isHoliday: false, holidayName: "" };
      if (!myLog) {
        holidayInfo = await getHolidayInfo(ctx, args.date, userId);
      }

      const present = hasLog && !isOnLeave && !isHolidayStatus && myLog.status !== "Absent" ? 1 : 0;
      const leave = isOnLeave ? 1 : 0;
      const holiday = isHolidayStatus || (!myLog && holidayInfo.isHoliday) ? 1 : 0;
      const absent = !myLog && !holidayInfo.isHoliday ? 1 : (myLog && myLog.status === "Absent" ? 1 : 0);
      const totalHours = myLog ? (myLog.totalHours || 0) : 0;
      const overtime = myLog ? Math.max(0, (myLog.totalHours || 0) - MIN_HOURS_FULL_DAY) : 0;

      return {
        present,
        absent,
        leave,
        holiday,
        late: myLog && myLog.status === "Late" ? 1 : 0,
        pendingApprovals: myLog && myLog.approvalStatus === "Pending" ? 1 : 0,
        totalHours,
        overtime,
        isPersonal: true
      };
    }

    const attendance = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q: any) => q.eq("date", args.date))
      .collect();

    const staffCount = await ctx.db.query("users").collect();
    const activeStaff = staffCount.filter(u => u.status === "active" && u.role !== "Owner");

    let present = 0;
    let leave = 0;
    let holiday = 0;
    let absent = 0;
    let late = 0;
    let pendingApprovals = 0;

    for (const u of activeStaff) {
      const log = attendance.find(a => a.employeeId === u._id);
      if (log) {
        const status = log.status;
        if (status === "Leave" || status === "Half-day-leave") {
          leave++;
        } else if (status === "Absent") {
          absent++;
        } else if (status === "holiday" || status === "Holiday") {
          holiday++;
        } else {
          present++;
          if (status === "Late") late++;
        }
        if (log.approvalStatus === "Pending") pendingApprovals++;
      } else {
        const holidayInfo = await getHolidayInfo(ctx, args.date, u);
        if (holidayInfo.isHoliday) {
          holiday++;
        } else {
          absent++;
        }
      }
    }

    const totalHours = attendance.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);
    const overtime = attendance.reduce((acc, curr) => {
      const ot = Math.max(0, (curr.totalHours || 0) - MIN_HOURS_FULL_DAY);
      return acc + ot;
    }, 0);

    return {
      present,
      absent,
      leave,
      holiday,
      late,
      pendingApprovals,
      totalHours,
      overtime,
      isPersonal: false
    };
  },
});

export const getAttendanceLogs = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    employeeId: v.optional(v.id("users")),
    siteId: v.optional(v.id("sites")),
    status: v.optional(v.string()),
    requestorEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { isAdmin, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) return [];

    let results;

    if (!isAdmin) {
      // Strictly only current user logs
      results = await ctx.db
        .query("attendance")
        .withIndex("by_employee", (q) => q.eq("employeeId", userId))
        .order("desc")
        .collect();

      // Filter by date in memory
      if (args.startDate && args.endDate) {
        results = results.filter(r => r.date >= args.startDate! && r.date <= args.endDate!);
      } else if (args.startDate) {
        results = results.filter(r => r.date === args.startDate);
      }

      const targetDate = args.startDate;
      if (targetDate && (!args.endDate || args.startDate === args.endDate) && results.length === 0) {
        const u = await ctx.db.get(userId);
        if (u && (u as any).role !== "Owner") {
          const holidayInfo = await getHolidayInfo(ctx, targetDate, u);
          if (holidayInfo.isHoliday) {
            results.push({
              _id: ("holiday_" + userId + "_" + targetDate) as any,
              _creationTime: u._creationTime,
              employeeId: userId,
              date: targetDate,
              status: "holiday" as any,
              holidayName: holidayInfo.holidayName,
              approvalStatus: "Auto",
              siteName: "N/A",
              createdAt: u._creationTime,
              updatedAt: u._creationTime,
              checkIn: undefined,
              checkOut: undefined,
              totalHours: 0,
            } as any);
          } else {
            results.push({
              _id: ("absent_" + userId + "_" + targetDate) as any,
              _creationTime: u._creationTime,
              employeeId: userId,
              date: targetDate,
              status: "Absent",
              approvalStatus: "Auto",
              siteName: "N/A",
              createdAt: u._creationTime,
              updatedAt: u._creationTime,
            });
          }
        }
      }
    } else {
      // Admin view
      if (args.startDate && args.endDate) {
        results = await ctx.db
          .query("attendance")
          .withIndex("by_date", (q) => q.gte("date", args.startDate!).lte("date", args.endDate!))
          .collect();
      } else if (args.startDate) {
        results = await ctx.db
          .query("attendance")
          .withIndex("by_date", (q) => q.eq("date", args.startDate!))
          .collect();
      } else {
        results = await ctx.db
          .query("attendance")
          .order("desc")
          .collect();
      }

      if (args.employeeId) {
        results = results.filter((r) => r.employeeId === args.employeeId);
      }
    }

    const targetDate = args.startDate;
    if (isAdmin && targetDate && (!args.endDate || args.startDate === args.endDate)) {
      const activeUsers = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("status"), "active"))
        .collect();

      const existingEmployeeIds = new Set(results.map(r => r.employeeId));

      for (const user of activeUsers) {
        if (args.employeeId && user._id !== args.employeeId) {
          continue;
        }
        if ((user as any).role === "Owner") {
          continue;
        }
        if (!existingEmployeeIds.has(user._id)) {
          const holidayInfo = await getHolidayInfo(ctx, targetDate, user);
          if (holidayInfo.isHoliday) {
            results.push({
              _id: ("holiday_" + user._id + "_" + targetDate) as any,
              _creationTime: user._creationTime,
              employeeId: user._id,
              date: targetDate,
              status: "holiday" as any,
              holidayName: holidayInfo.holidayName,
              approvalStatus: "Auto",
              siteName: "N/A",
              createdAt: user._creationTime,
              updatedAt: user._creationTime,
              checkIn: undefined,
              checkOut: undefined,
              totalHours: 0,
            } as any);
          } else {
            results.push({
              _id: ("absent_" + user._id + "_" + targetDate) as any,
              _creationTime: user._creationTime,
              employeeId: user._id,
              date: targetDate,
              status: "Absent",
              approvalStatus: "Auto",
              siteName: "N/A",
              createdAt: user._creationTime,
              updatedAt: user._creationTime,
            });
          }
        }
      }
    }

    // In-memory filters
    if (args.siteId) {
      results = results.filter((r) => r.siteId === args.siteId);
    }
    if (args.status) {
      results = results.filter((r) => r.status === args.status);
    }

    // Enrich
    const enriched = await Promise.all(
      results.map(async (r) => {
        const employee = (await ctx.db.get(r.employeeId)) as any;
        const site = r.siteId ? (await ctx.db.get(r.siteId)) as any : null;
        return {
          ...r,
          employeeName: employee?.name || "Unknown",
          employeeRole: employee?.role || "Staff",
          siteName: r.siteName || site?.name || "N/A", // Use persisted siteName or fallback to site lookup
        };
      })
    );

    return enriched;
  },
});

export const updateAttendanceByAdmin = mutation({
  args: {
    id: v.string(),
    employeeId: v.optional(v.id("users")),
    date: v.optional(v.string()),
    checkIn: v.optional(v.number()),
    checkOut: v.optional(v.number()),
    siteId: v.optional(v.union(v.id("sites"), v.literal("office"), v.literal("wfh"))),
    siteName: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("Present"),
      v.literal("Absent"),
      v.literal("Late"),
      v.literal("Half-day"),
      v.literal("Leave"),
      v.literal("Half-day-leave"),
      v.literal("holiday"),
      v.literal("Holiday"),
      v.literal("holiday_working"),
      v.literal("Present / Holiday Work"),
      v.literal("WFH")
    )),
    notes: v.optional(v.string()),
    approvalStatus: v.optional(v.union(
      v.literal("Auto"),
      v.literal("Manual"),
      v.literal("Pending"),
      v.literal("Approved"),
      v.literal("Rejected")
    )),
    requestorEmail: v.string(),
    photoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { isAdmin, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) throw new Error("Not authenticated");

    let existing;
    if (args.id.startsWith("absent_") || args.id.startsWith("holiday_")) {
      existing = null;
    } else {
      existing = await ctx.db.get(args.id as Id<"attendance">);
    }

    if (!existing) {
      if (!isAdmin) {
        throw new Error("You do not have permission to create this record.");
      }
      if (!args.employeeId || !args.date) {
        throw new Error("Cannot create attendance record: employeeId and date are required.");
      }

      // Check if already checked in today
      const alreadyCheckedIn = await ctx.db
        .query("attendance")
        .withIndex("by_employee_date", (q) =>
          q.eq("employeeId", args.employeeId!).eq("date", args.date!)
        )
        .unique();

      if (alreadyCheckedIn) {
        throw new Error("A record already exists for this employee and date.");
      }

      const { id, requestorEmail, employeeId, date, ...updates } = args;

      let resolvedSiteId: Id<"sites"> | undefined = undefined;
      let resolvedSiteName = "N/A";

      if (args.siteId !== undefined) {
        if (args.siteId === "office") {
          resolvedSiteId = undefined;
          resolvedSiteName = "Office (Main Branch)";
        } else if (args.siteId === "wfh") {
          resolvedSiteId = undefined;
          resolvedSiteName = "Work from Home";
        } else {
          resolvedSiteId = args.siteId as Id<"sites">;
          const site = await ctx.db.get(resolvedSiteId);
          resolvedSiteName = site?.name || "N/A";
        }
      } else if (updates.siteName) {
        resolvedSiteName = updates.siteName;
      }

      const now = Date.now();
      const finalCheckIn = updates.checkIn;
      const finalCheckOut = updates.checkOut;
      let totalHours = undefined;
      if (finalCheckIn && finalCheckOut) {
        totalHours = (finalCheckOut - finalCheckIn) / (1000 * 60 * 60);
      }

      let status = updates.status || "Present";

      const attendanceId = await ctx.db.insert("attendance", {
        employeeId: args.employeeId,
        date: args.date,
        checkIn: finalCheckIn ?? undefined,
        checkOut: finalCheckOut ?? undefined,
        totalHours,
        status: status as any,
        approvalStatus: updates.approvalStatus || "Manual",
        siteId: resolvedSiteId,
        siteName: resolvedSiteName,
        notes: updates.notes,
        createdAt: now,
        updatedAt: now,
        photoStorageId: updates.photoStorageId,
        photoRequired: false,
        photoStatus: updates.photoStorageId ? "uploaded" : "not_required",
        photoUploadedAt: updates.photoStorageId ? now : undefined,
      });

      return { success: true, id: attendanceId };
    }

    const { id, requestorEmail, employeeId, date, ...updates } = args;
    const patch: any = { ...updates, updatedAt: Date.now() };

    // Resolve site name if siteId is updated
    if (args.siteId !== undefined) {
      if (args.siteId === "office") {
        patch.siteId = undefined;
        patch.siteName = "Office (Main Branch)";
      } else if (args.siteId === "wfh") {
        patch.siteId = undefined;
        patch.siteName = "Work from Home";
      } else {
        const site = await ctx.db.get(args.siteId as Id<"sites">);
        patch.siteId = args.siteId as Id<"sites">;
        patch.siteName = site?.name || "N/A";
      }
    }

    if (updates.checkIn !== undefined || updates.checkOut !== undefined) {
      patch.approvalStatus = "Manual";
    }

    const finalCheckIn = updates.checkIn ?? existing.checkIn;
    const finalCheckOut = updates.checkOut ?? existing.checkOut;

    if (finalCheckIn) {
      if (finalCheckOut) {
        patch.totalHours = (finalCheckOut - finalCheckIn) / (1000 * 60 * 60);
      }

      if (updates.status === undefined) {
        if (patch.totalHours !== undefined) {
          if (patch.totalHours < MIN_HOURS_HALF_DAY) {
            patch.status = "Half-day";
          } else {
            patch.status = "Present";
          }
        } else {
          patch.status = "Present";
        }
      }
    }

    await ctx.db.patch(id as Id<"attendance">, patch);

    // Audit photo change
    if (args.photoStorageId !== undefined && args.photoStorageId !== existing.photoStorageId) {
      const { user } = await checkAccess(ctx, args.requestorEmail);
      await ctx.db.insert("attendance_audit_logs", {
        attendanceId: id as Id<"attendance">,
        action: args.photoStorageId ? (existing.photoStorageId ? "photo_replaced" : "photo_uploaded") : "photo_removed",
        userId: user?.name || "System",
        createdAt: Date.now(),
        oldPhotoStorageId: existing.photoStorageId,
        newPhotoStorageId: args.photoStorageId,
      });

      // Update photo status
      await ctx.db.patch(id as Id<"attendance">, {
        photoStatus: args.photoStorageId ? "uploaded" : (existing.photoRequired ? "missing" : "not_required"),
        photoUploadedAt: args.photoStorageId ? Date.now() : undefined,
      });
    }

    return { success: true };
  },
});

export const uploadAttendancePhoto = mutation({
  args: {
    attendanceId: v.id("attendance"),
    photoStorageId: v.id("_storage"),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, userId, user } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db.get(args.attendanceId);
    if (!existing) throw new Error("Attendance record not found");

    // Staff can only upload their own photo, Admin can upload for anyone
    if (!isAdmin && existing.employeeId !== userId) {
      throw new Error("You do not have permission to upload photo for this record.");
    }

    const now = Date.now();
    await ctx.db.patch(args.attendanceId, {
      photoStorageId: args.photoStorageId,
      photoStatus: "uploaded",
      photoUploadedAt: now,
      updatedAt: now,
    });

    // Log the action
    await ctx.db.insert("attendance_audit_logs", {
      attendanceId: args.attendanceId,
      action: existing.photoStorageId ? "photo_replaced" : "photo_uploaded",
      userId: user?.name || "System",
      createdAt: now,
      oldPhotoStorageId: existing.photoStorageId,
      newPhotoStorageId: args.photoStorageId,
    });

    return { success: true };
  },
});

export const approveAttendance = mutation({
  args: { id: v.id("attendance"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin) throw new Error("Not authorized to approve attendance");

    await ctx.db.patch(args.id, {
      approvalStatus: "Approved",
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const rejectAttendance = mutation({
  args: { id: v.id("attendance"), requestorEmail: v.string() },
  handler: async (ctx, args) => {
    const { isAdmin } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin) throw new Error("Not authorized to reject attendance");

    await ctx.db.patch(args.id, {
      approvalStatus: "Rejected",
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const getMyTodayAttendance = query({
  args: { employeeId: v.id("users"), requestorEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { isAdmin, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) return null;

    if (!isAdmin && args.employeeId !== userId) {
      throw new Error("You can only access your own data.");
    }

    const today = new Date().toISOString().split("T")[0];
    return await ctx.db
      .query("attendance")
      .withIndex("by_employee_date", (q) =>
        q.eq("employeeId", args.employeeId).eq("date", today)
      )
      .unique();
  },
});

export const getAttendancePhotoUrl = query({
  args: {
    attendanceId: v.id("attendance"),
    requestorEmail: v.string()
  },
  handler: async (ctx, args) => {
    const { isAdmin, userId } = await checkAccess(ctx, args.requestorEmail);
    if (!userId) throw new Error("Not authenticated");

    const attendance = await ctx.db.get(args.attendanceId);
    if (!attendance || !attendance.photoStorageId) return null;

    // Access control
    if (!isAdmin && attendance.employeeId !== userId) {
      throw new Error("You do not have permission to view this attendance proof.");
    }

    return await ctx.storage.getUrl(attendance.photoStorageId);
  }
});

// Holiday and Attendance Settings Queries & Mutations
export const getAttendanceSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("attendanceSettings").collect();
    return settings[0] || { weeklyOffDays: ["sunday"] };
  }
});

export const updateAttendanceSettings = mutation({
  args: {
    weeklyOffDays: v.array(v.string()),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, user } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin || !user) throw new Error("Not authorized");
    
    const existing = await ctx.db.query("attendanceSettings").collect();
    const now = Date.now();
    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, {
        weeklyOffDays: args.weeklyOffDays,
        updatedBy: user.name,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("attendanceSettings", {
        weeklyOffDays: args.weeklyOffDays,
        updatedBy: user.name,
        updatedAt: now,
      });
    }
    return { success: true };
  }
});

export const getHolidays = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("holidays").order("desc").collect();
  }
});

export const createHoliday = mutation({
  args: {
    name: v.string(),
    date: v.string(),
    type: v.string(),
    appliesTo: v.union(v.literal("all"), v.literal("site"), v.literal("role")),
    siteId: v.optional(v.id("sites")),
    roleId: v.optional(v.string()),
    notes: v.optional(v.string()),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, user } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin || !user) throw new Error("Not authorized");

    const existing = await ctx.db
      .query("holidays")
      .withIndex("by_date", q => q.eq("date", args.date))
      .collect();

    if (existing.some(h => h.isActive && h.name === args.name)) {
      throw new Error("A holiday with this name already exists on this date.");
    }

    const now = Date.now();
    await ctx.db.insert("holidays", {
      name: args.name,
      date: args.date,
      type: args.type,
      appliesTo: args.appliesTo,
      siteId: args.siteId,
      roleId: args.roleId,
      isActive: true,
      notes: args.notes,
      createdBy: user.name,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true };
  }
});

export const updateHoliday = mutation({
  args: {
    id: v.id("holidays"),
    name: v.string(),
    date: v.string(),
    type: v.string(),
    appliesTo: v.union(v.literal("all"), v.literal("site"), v.literal("role")),
    siteId: v.optional(v.id("sites")),
    roleId: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, user } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin || !user) throw new Error("Not authorized");

    const { id, requestorEmail, ...fields } = args;
    await ctx.db.patch(id, {
      ...fields,
      updatedAt: Date.now(),
    });
    return { success: true };
  }
});

export const deleteHoliday = mutation({
  args: {
    id: v.id("holidays"),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin) throw new Error("Not authorized");

    await ctx.db.delete(args.id);
    return { success: true };
  }
});

export const getOverrides = query({
  args: {},
  handler: async (ctx) => {
    const overrides = await ctx.db.query("attendanceOverrides").collect();
    
    return await Promise.all(overrides.map(async o => {
      let userName = "N/A";
      let siteName = "N/A";
      if (o.userId) {
        const u = await ctx.db.get(o.userId);
        userName = u?.name || "Unknown Staff";
      }
      if (o.siteId) {
        const s = await ctx.db.get(o.siteId);
        siteName = s?.name || "Unknown Site";
      }
      return {
        ...o,
        userName,
        siteName,
      };
    }));
  }
});

export const createOverride = mutation({
  args: {
    userId: v.optional(v.id("users")),
    siteId: v.optional(v.id("sites")),
    date: v.string(),
    overrideType: v.union(v.literal("working_day"), v.literal("holiday")),
    reason: v.string(),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, user } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin || !user) throw new Error("Not authorized");

    if (args.userId) {
      const existing = await ctx.db
        .query("attendanceOverrides")
        .withIndex("by_user_date", q => q.eq("userId", args.userId!).eq("date", args.date))
        .unique();
      if (existing) throw new Error("An override already exists for this employee on this date.");
    } else if (args.siteId) {
      const existing = await ctx.db
        .query("attendanceOverrides")
        .withIndex("by_site_date", q => q.eq("siteId", args.siteId!).eq("date", args.date))
        .unique();
      if (existing) throw new Error("An override already exists for this site on this date.");
    } else {
      throw new Error("Either Employee or Site must be selected for override.");
    }

    await ctx.db.insert("attendanceOverrides", {
      userId: args.userId,
      siteId: args.siteId,
      date: args.date,
      overrideType: args.overrideType,
      reason: args.reason,
      createdBy: user.name,
      createdAt: Date.now(),
    });
    return { success: true };
  }
});

export const deleteOverride = mutation({
  args: {
    id: v.id("attendanceOverrides"),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin } = await checkAccess(ctx, args.requestorEmail);
    if (!isAdmin) throw new Error("Not authorized");

    await ctx.db.delete(args.id);
    return { success: true };
  }
});
//non



