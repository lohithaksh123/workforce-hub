import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// --- Requirements ---

export const createRequirement = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("requirements", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateRequirement = mutation({
  args: {
    id: v.id("requirements"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const deleteRequirement = mutation({
  args: { id: v.id("requirements") },
  handler: async (ctx, args) => {
    // Also delete associated categories and people? 
    // Usually safer to keep them or clean up. 
    // User asked for "Delete (with confirmation)" in UI.
    const categories = await ctx.db
      .query("requirementCategories")
      .withIndex("by_requirement", (q) => q.eq("requirementId", args.id))
      .collect();

    for (const cat of categories) {
      const people = await ctx.db
        .query("requirementPeople")
        .withIndex("by_category", (q) => q.eq("categoryId", cat._id))
        .collect();
      for (const p of people) await ctx.db.delete(p._id);
      await ctx.db.delete(cat._id);
    }

    const orphanPeople = await ctx.db
      .query("requirementPeople")
      .withIndex("by_requirement", (q) => q.eq("requirementId", args.id))
      .collect();
    for (const p of orphanPeople) await ctx.db.delete(p._id);

    await ctx.db.delete(args.id);
  },
});

export const getRequirements = query({
  handler: async (ctx) => {
    const reqs = await ctx.db.query("requirements").order("desc").collect();
    
    // Enrich with person count
    return await Promise.all(reqs.map(async (r) => {
        const peopleCount = (await ctx.db
            .query("requirementPeople")
            .withIndex("by_requirement", q => q.eq("requirementId", r._id))
            .collect()).length;
        
        const hasCategories = (await ctx.db
            .query("requirementCategories")
            .withIndex("by_requirement", q => q.eq("requirementId", r._id))
            .collect()).length > 0;

        return { ...r, peopleCount, hasCategories };
    }));
  },
});

// --- Categories ---

export const createCategory = mutation({
  args: {
    requirementId: v.id("requirements"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("requirementCategories", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCategory = mutation({
  args: {
    id: v.id("requirementCategories"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      name: args.name,
      updatedAt: Date.now(),
    });
  },
});

export const deleteCategory = mutation({
  args: { id: v.id("requirementCategories") },
  handler: async (ctx, args) => {
    const people = await ctx.db
      .query("requirementPeople")
      .withIndex("by_category", (q) => q.eq("categoryId", args.id))
      .collect();
    for (const p of people) await ctx.db.delete(p._id);
    await ctx.db.delete(args.id);
  },
});

export const getCategoriesByRequirement = query({
  args: { requirementId: v.id("requirements") },
  handler: async (ctx, args) => {
    const cats = await ctx.db
      .query("requirementCategories")
      .withIndex("by_requirement", (q) => q.eq("requirementId", args.requirementId))
      .collect();

    return await Promise.all(cats.map(async (c) => {
        const peopleCount = (await ctx.db
            .query("requirementPeople")
            .withIndex("by_category", q => q.eq("categoryId", c._id))
            .collect()).length;
        return { ...c, peopleCount };
    }));
  },
});

// --- People ---

export const createPerson = mutation({
  args: {
    requirementId: v.id("requirements"),
    categoryId: v.optional(v.id("requirementCategories")),
    name: v.string(),
    phone: v.string(),
    role: v.string(),
    siteId: v.optional(v.id("sites")),
    availability: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate phone (simple check for duplicate in same requirement)
    const existing = await ctx.db
        .query("requirementPeople")
        .withIndex("by_phone", q => q.eq("phone", args.phone))
        .filter(q => q.eq(q.field("requirementId"), args.requirementId))
        .unique();
    
    if (existing) {
        throw new Error("A person with this phone number already exists in this requirement.");
    }

    const now = Date.now();
    return await ctx.db.insert("requirementPeople", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updatePerson = mutation({
  args: {
    id: v.id("requirementPeople"),
    name: v.string(),
    phone: v.string(),
    role: v.string(),
    siteId: v.optional(v.id("sites")),
    availability: v.optional(v.string()),
    categoryId: v.optional(v.id("requirementCategories")),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const deletePerson = mutation({
  args: { id: v.id("requirementPeople") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getPeopleByRequirement = query({
  args: { requirementId: v.id("requirements") },
  handler: async (ctx, args) => {
    const people = await ctx.db
      .query("requirementPeople")
      .withIndex("by_requirement", (q) => q.eq("requirementId", args.requirementId))
      .collect();
    
    return await Promise.all(people.map(async p => {
        const site = p.siteId ? await ctx.db.get(p.siteId) : null;
        return { ...p, siteName: site?.name || "N/A" };
    }));
  },
});

export const getPeopleByCategory = query({
  args: { categoryId: v.id("requirementCategories") },
  handler: async (ctx, args) => {
    const people = await ctx.db
      .query("requirementPeople")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();

    return await Promise.all(people.map(async p => {
        const site = p.siteId ? await ctx.db.get(p.siteId) : null;
        return { ...p, siteName: site?.name || "N/A" };
    }));
  },
});
