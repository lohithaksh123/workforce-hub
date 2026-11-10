import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getTasks = query({
  handler: async (ctx) => {
    return await ctx.db.query("tasks").order("desc").collect();
  },
});

export const getMyTasks = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const myTasks = await ctx.db
      .query("tasks")
      .withIndex("by_assignee", (q) => q.eq("assignedTo", args.userId))
      .order("desc")
      .collect();

    const everyoneTasks = await ctx.db
      .query("tasks")
      .withIndex("by_assignee", (q) => q.eq("assignedTo", "Everyone"))
      .order("desc")
      .collect();

    return [...myTasks, ...everyoneTasks].sort((a, b) => b.assignedAt - a.assignedAt);
  },
});

export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    siteId: v.optional(v.id("sites")),
    assignedTo: v.string(),
    assignedBy: v.string(),
    priority: v.union(v.literal("Low"), v.literal("Medium"), v.literal("High")),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("tasks", {
      ...args,
      status: "Pending",
      assignedAt: Date.now(),
    });

    if (args.assignedTo === "Everyone") {
      const users = await ctx.db.query("users").filter(q => q.eq(q.field("status"), "active")).collect();
      const staff = users.filter(u => u.role !== "Owner");
      
      for (const member of staff) {
        await ctx.db.insert("notifications", {
          userId: member.name,
          title: "New Global Objective",
          description: `A new task for everyone: ${args.title}`,
          type: "task",
          read: false,
          created_at: Date.now(),
        });
      }
    } else {
      // Notify specific staff member
      await ctx.db.insert("notifications", {
        userId: args.assignedTo,
        title: "New Task Assigned",
        description: `You have been assigned the task: ${args.title}`,
        type: "task",
        read: false,
        created_at: Date.now(),
      });
    }

    return taskId;
  },
});

export const updateTaskStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.union(v.literal("Pending"), v.literal("In Progress"), v.literal("Completed")),
    remarks: v.optional(v.string()),
    performedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");

    const updates: any = { status: args.status };
    if (args.status === "Completed") {
      updates.completedAt = Date.now();
      if (args.remarks) updates.remarks = args.remarks;
      if (args.performedBy) updates.completedBy = args.performedBy;
      
      // Notify Owner
      await ctx.db.insert("notifications", {
        userId: "Owner", // Default recipient for owner notifications
        title: "Task Completed",
        description: `Operative ${args.performedBy || task.assignedTo} has completed the task "${task.title}"${args.remarks ? `: ${args.remarks}` : ""}`,
        type: "task",
        read: false,
        created_at: Date.now(),
      });
    }

    await ctx.db.patch(args.id, updates);
  },
});
