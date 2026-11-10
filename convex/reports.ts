import { query } from "./_generated/server";
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

// Helper to get dates in range using UTC
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

export const generateAttendanceReportData = query({
  args: {
    reportType: v.string(), // "monthly" | "custom_range" | "employee" | "site" | "leave"
    fromDate: v.optional(v.string()), // YYYY-MM-DD
    toDate: v.optional(v.string()), // YYYY-MM-DD
    month: v.optional(v.string()), // YYYY-MM
    employeeId: v.optional(v.id("users")),
    siteId: v.optional(v.id("sites")),
    status: v.optional(v.string()),
    leaveType: v.optional(v.string()),
    proofStatus: v.optional(v.string()),
    requestorEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const { isAdmin, userId, user } = await checkAccess(ctx, args.requestorEmail);
    if (!userId || !user) throw new Error("Not authenticated");

    // Enforce Security Permissions
    if (!isAdmin) {
      // Normal staff can only download their own attendance report.
      // employeeId MUST be specified and match their own userId.
      if (!args.employeeId || args.employeeId !== userId) {
        throw new Error("You do not have permission to generate this report.");
      }
      // Cannot view site reports
      if (args.reportType === "site") {
        throw new Error("You do not have permission to generate this report.");
      }
    }

    // Resolve date range
    let fromDate = args.fromDate || "";
    let toDate = args.toDate || "";

    if (args.reportType === "monthly") {
      if (!args.month) {
        throw new Error("Month is required for Monthly Attendance Report.");
      }
      const [year, mVal] = args.month.split("-").map(Number);
      const lastDay = new Date(year, mVal, 0).getDate();
      fromDate = `${args.month}-01`;
      toDate = `${args.month}-${String(lastDay).padStart(2, '0')}`;
    }

    if (!fromDate || !toDate) {
      if (args.reportType !== "leave") {
        throw new Error("Date range (From Date and To Date) is required.");
      }
    }

    if (fromDate && toDate && toDate < fromDate) {
      throw new Error("To Date cannot be before From Date.");
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // Helper maps
    const allUsers = await ctx.db.query("users").collect();
    const userMap = new Map(allUsers.map(u => [u._id, u]));

    const allSites = await ctx.db.query("sites").collect();
    const siteMap = new Map(allSites.map(s => [s._id, s.name]));

    let records: any[] = [];
    let summary: any = {};
    let totalCount = 0;

    // A) Monthly or Custom Date Range Report
    if (args.reportType === "monthly" || args.reportType === "custom_range") {
      let targetUsers = allUsers.filter(u => u.status === "active");
      if (args.employeeId) {
        targetUsers = targetUsers.filter(u => u._id === args.employeeId);
      }

      // Fetch attendance records in range (optimized with index if employeeId is specified)
      const attendance = args.employeeId
        ? await ctx.db
            .query("attendance")
            .withIndex("by_employee_date", (q: any) =>
              q.eq("employeeId", args.employeeId)
               .gte("date", fromDate)
               .lte("date", toDate)
            )
            .collect()
        : await ctx.db
            .query("attendance")
            .withIndex("by_date", (q: any) => q.gte("date", fromDate).lte("date", toDate))
            .collect();

      const datesInRange = getDatesInRange(fromDate, toDate);
      const detailedRecords = [];

      for (const u of targetUsers) {
        const userAttendance = attendance.filter(a => a.employeeId === u._id);
        const attByDate = new Map(userAttendance.map(a => [a.date, a]));

        for (const date of datesInRange) {
          const record = attByDate.get(date);
          if (record) {
            detailedRecords.push({
              _id: record._id,
              date,
              employeeId: u._id,
              employeeName: u.name,
              role: u.role,
              siteName: record.siteName || (record.siteId ? (siteMap.get(record.siteId) || "N/A") : "N/A"),
              siteId: record.siteId,
              checkIn: record.checkIn,
              checkOut: record.checkOut,
              totalHours: record.totalHours || 0,
              status: record.status,
              approvalStatus: record.approvalStatus,
              photoStatus: record.photoStatus || "not_required",
              photoRequired: record.photoRequired || false,
              leaveType: record.leaveType,
              notes: record.notes || "",
            });
          } else {
            const holidayInfo = await getHolidayInfo(ctx, date, u);
            if (holidayInfo.isHoliday) {
              detailedRecords.push({
                _id: `holiday_${u._id}_${date}`,
                date,
                employeeId: u._id,
                employeeName: u.name,
                role: u.role,
                siteName: "N/A",
                siteId: undefined,
                checkIn: undefined,
                checkOut: undefined,
                totalHours: 0,
                status: "holiday",
                holidayName: holidayInfo.holidayName,
                approvalStatus: "Auto",
                photoStatus: "not_required",
                photoRequired: false,
                leaveType: undefined,
                notes: "",
              });
            } else {
              detailedRecords.push({
                _id: `absent_${u._id}_${date}`,
                date,
                employeeId: u._id,
                employeeName: u.name,
                role: u.role,
                siteName: "N/A",
                siteId: undefined,
                checkIn: undefined,
                checkOut: undefined,
                totalHours: 0,
                status: "Absent",
                approvalStatus: "Auto",
                photoStatus: "not_required",
                photoRequired: false,
                leaveType: undefined,
                notes: "",
              });
            }
          }
        }
      }

      let filtered = detailedRecords;
      if (args.siteId) {
        filtered = filtered.filter(r => r.siteId === args.siteId || (!r.siteId && userMap.get(r.employeeId)?.siteId === args.siteId));
      }
      if (args.status && args.status !== "ALL") {
        filtered = filtered.filter(r => r.status === args.status);
      }
      if (args.proofStatus && args.proofStatus !== "ALL") {
        filtered = filtered.filter(r => r.photoStatus === args.proofStatus);
      }

      records = filtered;
      totalCount = filtered.length;

      summary = {
        totalRecords: filtered.length,
        presentCount: filtered.filter(r => r.status === "Present" || r.status === "Late" || r.status === "Half-day" || r.status === "holiday_working").length,
        absentCount: filtered.filter(r => r.status === "Absent").length,
        leaveCount: filtered.filter(r => r.status === "Leave" || r.status === "Half-day-leave").length,
        holidayCount: filtered.filter(r => r.status === "holiday" || r.status === "Holiday").length,
        totalHours: filtered.reduce((acc, r) => acc + r.totalHours, 0),
        overtimeHours: filtered.reduce((acc, r) => acc + Math.max(0, r.totalHours - 8), 0),
      };
    }

    // C) Employee-wise Report
    else if (args.reportType === "employee") {
      if (!args.employeeId) {
        throw new Error("Employee selection is required.");
      }
      const u = userMap.get(args.employeeId);
      if (!u) throw new Error("Employee not found.");

      const attendance = await ctx.db
        .query("attendance")
        .withIndex("by_employee_date", (q: any) =>
          q.eq("employeeId", u._id)
           .gte("date", fromDate)
           .lte("date", toDate)
        )
        .collect();

      const userAttendance = attendance.filter(a => a.employeeId === u._id);
      const attByDate = new Map(userAttendance.map(a => [a.date, a]));

      const datesInRange = getDatesInRange(fromDate, toDate);
      const detailedRecords = [];

      let totalPresentDays = 0;
      let totalAbsentDays = 0;
      let totalLeaveDays = 0;
      let lateCount = 0;
      let totalHours = 0;
      let overtime = 0;
      let missingProofCount = 0;

      let holidayCount = 0;

      for (const date of datesInRange) {
        const record = attByDate.get(date);
        if (record) {
          const status = record.status;
          if (status === "Present" || status === "Late" || status === "Half-day" || status === "holiday_working") {
            totalPresentDays++;
          } else if (status === "Leave" || status === "Half-day-leave") {
            totalLeaveDays++;
          } else if (status === "Absent") {
            totalAbsentDays++;
          } else if (status === "holiday" || status === "Holiday") {
            holidayCount++;
          }

          if (status === "Late") lateCount++;
          totalHours += record.totalHours || 0;
          overtime += Math.max(0, (record.totalHours || 0) - 8);

          if (record.photoRequired === true && record.photoStatus === "missing") {
            missingProofCount++;
          }

          detailedRecords.push({
            _id: record._id,
            date,
            siteName: record.siteName || (record.siteId ? (siteMap.get(record.siteId) || "N/A") : "N/A"),
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            totalHours: record.totalHours || 0,
            status: record.status,
            approvalStatus: record.approvalStatus,
            photoStatus: record.photoStatus || "not_required",
            photoRequired: record.photoRequired || false,
            notes: record.notes || "",
            holidayName: (record.status === "holiday" || record.status === "Holiday") ? (record.notes || "Holiday") : undefined,
          });
        } else {
          const holidayInfo = await getHolidayInfo(ctx, date, u);
          if (holidayInfo.isHoliday) {
            holidayCount++;
            detailedRecords.push({
              _id: `holiday_${u._id}_${date}`,
              date,
              siteName: "N/A",
              checkIn: undefined,
              checkOut: undefined,
              totalHours: 0,
              status: "holiday",
              holidayName: holidayInfo.holidayName,
              approvalStatus: "Auto",
              photoStatus: "not_required",
              photoRequired: false,
              notes: "",
            });
          } else {
            totalAbsentDays++;
            detailedRecords.push({
              _id: `absent_${u._id}_${date}`,
              date,
              siteName: "N/A",
              checkIn: undefined,
              checkOut: undefined,
              totalHours: 0,
              status: "Absent",
              approvalStatus: "Auto",
              photoStatus: "not_required",
              photoRequired: false,
              notes: "",
            });
          }
        }
      }

      records = detailedRecords;
      totalCount = detailedRecords.length;

      summary = {
        employeeName: u.name,
        role: u.role,
        totalPresentDays,
        totalAbsentDays,
        totalLeaveDays,
        totalHolidayDays: holidayCount,
        lateCount,
        totalHours,
        overtime,
        missingProofCount,
      };
    }

    // D) Site-wise Report
    else if (args.reportType === "site") {
      if (!args.siteId) {
        throw new Error("Site selection is required.");
      }

      const attendance = await ctx.db
        .query("attendance")
        .withIndex("by_date", (q: any) => q.gte("date", fromDate).lte("date", toDate))
        .collect();

      const siteAttendance = attendance.filter(a => a.siteId === args.siteId);
      const siteEmployees = allUsers.filter(u => u.status === "active" && u.siteId === args.siteId);

      const datesInRange = getDatesInRange(fromDate, toDate);
      const detailedRecords: any[] = [];

      for (const date of datesInRange) {
        const dayRecords = siteAttendance.filter(a => a.date === date);
        const userIdsWithRecords = new Set(dayRecords.map(a => a.employeeId));

        for (const record of dayRecords) {
          const emp = userMap.get(record.employeeId);
          detailedRecords.push({
            _id: record._id,
            date,
            employeeId: record.employeeId,
            employeeName: emp?.name || "Unknown",
            role: emp?.role || "Staff",
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            totalHours: record.totalHours || 0,
            status: record.status,
            photoStatus: record.photoStatus || "not_required",
            photoRequired: record.photoRequired || false,
            approvalStatus: record.approvalStatus,
          });
        }

        for (const u of siteEmployees) {
          if (!userIdsWithRecords.has(u._id)) {
            const holidayInfo = await getHolidayInfo(ctx, date, u);
            if (holidayInfo.isHoliday) {
              detailedRecords.push({
                _id: `holiday_${u._id}_${date}`,
                date,
                employeeId: u._id,
                employeeName: u.name,
                role: u.role,
                checkIn: undefined,
                checkOut: undefined,
                totalHours: 0,
                status: "holiday",
                photoStatus: "not_required",
                photoRequired: false,
                approvalStatus: "Auto",
              });
            } else {
              detailedRecords.push({
                _id: `absent_${u._id}_${date}`,
                date,
                employeeId: u._id,
                employeeName: u.name,
                role: u.role,
                checkIn: undefined,
                checkOut: undefined,
                totalHours: 0,
                status: "Absent",
                photoStatus: "not_required",
                photoRequired: false,
                approvalStatus: "Auto",
              });
            }
          }
        }
      }

      records = detailedRecords;
      totalCount = detailedRecords.length;

      const presentEmps = new Set(detailedRecords.filter(r => r.status === "Present" || r.status === "Late" || r.status === "Half-day" || r.status === "holiday_working").map(r => r.employeeId));

      summary = {
        siteName: siteMap.get(args.siteId) || "N/A",
        totalStaffWorked: presentEmps.size,
        totalHours: detailedRecords.reduce((acc, r) => acc + r.totalHours, 0),
        presentCount: detailedRecords.filter(r => r.status === "Present" || r.status === "Late" || r.status === "Half-day" || r.status === "holiday_working").length,
        leaveCount: detailedRecords.filter(r => r.status === "Leave" || r.status === "Half-day-leave").length,
        absentCount: detailedRecords.filter(r => r.status === "Absent").length,
        holidayCount: detailedRecords.filter(r => r.status === "holiday" || r.status === "Holiday").length,
        missingProofCount: siteAttendance.filter(r => r.photoRequired === true && r.photoStatus === "missing").length,
      };
    }

    // E) Leave Report
    else if (args.reportType === "leave") {
      let leaves;
      if (args.employeeId) {
        leaves = await ctx.db
          .query("leaveRequests")
          .withIndex("by_user", (q: any) => q.eq("userId", args.employeeId))
          .collect();
        if (fromDate && toDate) {
          leaves = leaves.filter(r => r.fromDate <= toDate && r.toDate >= fromDate);
        }
      } else if (fromDate && toDate) {
        leaves = await ctx.db
          .query("leaveRequests")
          .withIndex("by_from_date", (q: any) => q.lte("fromDate", toDate))
          .collect();
        leaves = leaves.filter(r => r.toDate >= fromDate);
      } else {
        leaves = await ctx.db.query("leaveRequests").collect();
      }

      const enrichedLeaves = leaves.map(l => {
        const emp = userMap.get(l.userId);
        return {
          ...l,
          employeeName: l.userName || emp?.name || "Unknown",
          role: l.userRole || emp?.role || "Staff",
        };
      });

      let filtered = enrichedLeaves;
      if (args.employeeId) {
        filtered = filtered.filter(l => l.userId === args.employeeId);
      }
      if (args.status && args.status !== "ALL") {
        filtered = filtered.filter(l => l.status === args.status);
      }
      if (args.leaveType && args.leaveType !== "ALL") {
        filtered = filtered.filter(l => l.leaveType === args.leaveType);
      }

      filtered.sort((a, b) => b.fromDate.localeCompare(a.fromDate));

      records = filtered;
      totalCount = filtered.length;

      summary = {
        totalLeaves: filtered.length,
        approvedCount: filtered.filter(l => l.status === "approved").length,
        pendingCount: filtered.filter(l => l.status === "pending").length,
        rejectedCount: filtered.filter(l => l.status === "rejected").length,
        cancelledCount: filtered.filter(l => l.status === "cancelled").length,
      };
    }

    return {
      records,
      summary,
      totalCount,
      generatedAt: Date.now(),
    };
  },
});
