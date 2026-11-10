import { Id } from "./_generated/dataModel";

export async function getHolidayInfo(
  ctx: any,
  dateStr: string,
  userOrId: any
) {
  let user: any = null;
  if (userOrId) {
    if (typeof userOrId === "string") {
      try {
        user = await ctx.db.get(userOrId as Id<"users">);
      } catch (e) {
        // Ignore parsing errors
      }
    } else if (typeof userOrId === "object" && userOrId._id) {
      user = userOrId;
    }
  }

  // 1. Check user-specific override first
  if (user?._id) {
    const userOverride = await ctx.db
      .query("attendanceOverrides")
      .withIndex("by_user_date", (q: any) => q.eq("userId", user._id).eq("date", dateStr))
      .unique();
    if (userOverride) {
      if (userOverride.overrideType === "working_day") {
        return { isHoliday: false };
      } else if (userOverride.overrideType === "holiday") {
        return { isHoliday: true, holidayName: userOverride.reason || "Holiday Override", holidayType: "Override" };
      }
    }
  }

  // 2. Check site-specific override
  if (user?.siteId) {
    const siteOverride = await ctx.db
      .query("attendanceOverrides")
      .withIndex("by_site_date", (q: any) => q.eq("siteId", user.siteId).eq("date", dateStr))
      .unique();
    if (siteOverride) {
      if (siteOverride.overrideType === "working_day") {
        return { isHoliday: false };
      } else if (siteOverride.overrideType === "holiday") {
        return { isHoliday: true, holidayName: siteOverride.reason || "Holiday Override", holidayType: "Override" };
      }
    }
  }

  // 3. Check custom holidays
  const customHolidays = await ctx.db
    .query("holidays")
    .withIndex("by_date", (q: any) => q.eq("date", dateStr))
    .collect();

  for (const holiday of customHolidays) {
    if (!holiday.isActive) continue;
    
    let applies = false;
    if (holiday.appliesTo === "all") {
      applies = true;
    } else if (holiday.appliesTo === "site" && user?.siteId && holiday.siteId === user.siteId) {
      applies = true;
    } else if (holiday.appliesTo === "role" && user?.role && holiday.roleId === user.role) {
      applies = true;
    }

    if (applies) {
      return { isHoliday: true, holidayName: holiday.name, holidayType: holiday.type };
    }
  }

  // 4. Check weekly off days
  const settingsList = await ctx.db.query("attendanceSettings").collect();
  const settings = settingsList[0] || { weeklyOffDays: ["sunday"] };
  const weeklyOffDays = settings.weeklyOffDays || ["sunday"];

  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayName = daysOfWeek[date.getUTCDay()];

  if (weeklyOffDays.includes(dayName)) {
    return { isHoliday: true, holidayName: "Holiday", holidayType: "Weekly Off" };
  }

  return { isHoliday: false };
}
