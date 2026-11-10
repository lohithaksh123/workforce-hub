import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  company_wallet: defineTable({
    company_name: v.literal("Acme Interiors"),
    balance: v.number(),
    total_credited: v.optional(v.number()),
    total_debited: v.optional(v.number()),
    total_received: v.optional(v.number()), // temporary for migration
    total_spent: v.optional(v.number()),    // temporary for migration
    created_at: v.number(),
  }),

  wallet_additions: defineTable({
    amount: v.number(),
    source: v.string(),
    source_name: v.optional(v.string()),
    notes: v.string(),
    added_by: v.string(),
    date: v.string(),
  }),


  transaction_requests: defineTable({
    purpose: v.string(),
    vendor_name: v.optional(v.string()),
    amount: v.number(),
    payment_method: v.string(),
    description: v.optional(v.string()),
    requested_by: v.string(),
    requesterUserId: v.optional(v.string()),
    requesterName: v.optional(v.string()),
    status: v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
      v.literal("COMPLETED")
    ),
    requestType: v.optional(v.union(v.literal("expense_request"), v.literal("wallet_fund_request"))),
    created_at: v.number(),
    siteId: v.optional(v.id("sites")),
    siteName: v.optional(v.string()),
    walletId: v.optional(v.union(v.id("site_wallets"), v.id("team_wallets"), v.id("user_wallets"))),
    targetWalletId: v.optional(v.id("user_wallets")),
    category: v.optional(v.string()),
    type: v.optional(v.union(v.literal("DEBIT"), v.literal("CREDIT"), v.literal("RETURN"))),
    approved_by: v.optional(v.string()),
    approved_at: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    date: v.optional(v.string()),
  }),

  transactions: defineTable({
    type: v.union(
      v.literal("CREDIT"), 
      v.literal("DEBIT"), 
      v.literal("TRANSFER"), 
      v.literal("RETURN"), 
      v.literal("ADJUSTMENT")
    ),
    amount: v.number(),
    before_balance: v.optional(v.number()), 
    after_balance: v.optional(v.number()),  
    source_or_vendor: v.optional(v.string()), 
    purpose: v.string(),
    used_by: v.string(),
    performed_by: v.optional(v.string()), 
    approved_by: v.optional(v.string()),
    date: v.string(),
    time: v.optional(v.string()),
    status: v.union(
        v.literal("PENDING"), 
        v.literal("APPROVED"), 
        v.literal("REJECTED"),
        v.literal("COMPLETED")
    ),
    requestId: v.optional(v.id("transaction_requests")),
    payment_method: v.optional(v.string()),
    billStorageId: v.optional(v.id("_storage")),
    siteId: v.optional(v.id("sites")),
    walletId: v.optional(v.union(v.id("site_wallets"), v.id("team_wallets"), v.id("user_wallets"))),
    fromWalletId: v.optional(v.union(v.id("site_wallets"), v.id("user_wallets"), v.id("company_wallet"), v.id("team_wallets"))),
    toWalletId: v.optional(v.union(v.id("site_wallets"), v.id("user_wallets"), v.id("company_wallet"), v.id("team_wallets"))),
    
    // Enhanced movement fields
    transactionType: v.optional(v.string()), // "top_up" or "reallocation"
    sourceType: v.optional(v.string()), // "Staff Wallet", "Site Budget", "Company Vault"
    sourceId: v.optional(v.string()),
    sourceName: v.optional(v.string()),
    destinationType: v.optional(v.string()),
    destinationId: v.optional(v.string()),
    destinationName: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    approvedBy: v.optional(v.string()),
    created_at: v.optional(v.number()),
    
    category: v.optional(v.string()),
    isInternalTransfer: v.optional(v.boolean()),
    transactionDate: v.optional(v.string()), // For backdated transactions
    notes: v.optional(v.string()), // Detailed notes for the entry
  }),

  audit_logs: defineTable({
    transactionId: v.id("transactions"),
    editedBy: v.string(),
    editedAt: v.number(),
    oldValues: v.any(),
    newValues: v.any(),
    reasonForEdit: v.string(),
    balanceAdjustmentSummary: v.optional(v.string()),
  }).index("by_transaction", ["transactionId"]),

  sites: defineTable({
    name: v.string(),
    code: v.string(),
    location: v.string(),
    status: v.union(v.literal("Active"), v.literal("On Hold"), v.literal("Completed"), v.literal("Archived")),
    startDate: v.string(),
    expectedEndDate: v.optional(v.string()),
    projectType: v.optional(v.union(
      v.literal("Commercial"),
      v.literal("Residential"),
      v.literal("Villa"),
      v.literal("Apartments"),
      v.literal("Others")
    )),
    managerId: v.string(), 
    clientName: v.string(),
    teamMembers: v.array(v.string()), 
    notes: v.string(),
    created_at: v.number(),
    requiresAttendancePhoto: v.optional(v.boolean()),
  }).index("by_code", ["code"]),

  site_wallets: defineTable({
    siteId: v.id("sites"),
    balance: v.number(),
    total_credited: v.optional(v.number()), // total funds assigned
    total_debited: v.optional(v.number()), // total expenses
    totalAllocated: v.optional(v.number()), // temporary for migration
    totalSpent: v.optional(v.number()),    // temporary for migration
    created_at: v.number(),
  }).index("by_site", ["siteId"]),

  team_wallets: defineTable({
    siteId: v.id("sites"),
    userId: v.string(), 
    balance: v.number(),
    total_credited: v.number(),
    total_debited: v.number(),
    lastTopUpDate: v.optional(v.string()),
    created_at: v.number(),
  }).index("by_site_user", ["siteId", "userId"]),

  user_wallets: defineTable({
    userId: v.string(), 
    balance: v.number(),
    openingBalance: v.optional(v.number()),
    total_credited: v.optional(v.number()), 
    total_debited: v.optional(v.number()), 
    totalAdded: v.optional(v.number()), // temporary for migration
    totalSpent: v.optional(v.number()), // temporary for migration
    totalReturned: v.number(), 
    totalTransferredIn: v.optional(v.number()),
    totalTransferredOut: v.optional(v.number()),
    totalAdjustments: v.optional(v.number()),
    status: v.union(v.literal("Active"), v.literal("Frozen"), v.literal("Archived")),
    lastTopUpDate: v.optional(v.string()),
    siteId: v.optional(v.id("sites")), 
    created_at: v.number(),
  }).index("by_user", ["userId"])
    .index("by_site", ["siteId"]),

  users: defineTable({
    name: v.string(),
    email: v.string(),
    password: v.optional(v.string()), // Hashed password
    role: v.string(), // e.g. Owner, Supervisor, Designer, etc.
    designation: v.optional(v.string()),
    employeeId: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("disabled"), v.literal("deleted")),
    disabledAt: v.optional(v.number()),
    disabledBy: v.optional(v.string()),
    disabledByName: v.optional(v.string()),
    disabledReason: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.string()),
    deletedByName: v.optional(v.string()),
    deleteReason: v.optional(v.string()),
    restoredAt: v.optional(v.number()),
    restoredBy: v.optional(v.string()),
    restoredByName: v.optional(v.string()),
    permissions: v.optional(v.array(v.object({
      key: v.optional(v.string()),
      label: v.optional(v.string()),
      name: v.optional(v.string()),
      allowed: v.boolean(),
    }))),
    resetToken: v.optional(v.string()),
    resetExpires: v.optional(v.number()),
    phone: v.optional(v.string()),
    image: v.optional(v.string()),
    siteId: v.optional(v.id("sites")),
    joiningDate: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
    requiresAttendancePhoto: v.optional(v.boolean()),
    bloodGroup: v.optional(v.string()),
    emergencyContact: v.optional(v.string()),
    gender: v.optional(v.string()),
    dob: v.optional(v.string()),
    salary: v.optional(v.number()),
    address: v.optional(v.string()),
    bankName: v.optional(v.string()),
    bankAccount: v.optional(v.string()),
    pan: v.optional(v.string()),
    pfNumber: v.optional(v.string()),
    pfUan: v.optional(v.string()),
    esicNo: v.optional(v.string()),
    location: v.optional(v.string()),
  }).index("by_email", ["email"]),

  vendors: defineTable({
    name: v.string(),
    contact: v.optional(v.string()),
    category: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive")),
    totalPaid: v.optional(v.number()), // For directory stats
    paymentCount: v.optional(v.number()),
    lastPaymentDate: v.optional(v.string()),
  }),


  roles: defineTable({
    name: v.string(),
    description: v.string(),
    permissions: v.array(v.object({
      key: v.optional(v.string()),
      label: v.optional(v.string()),
      name: v.optional(v.string()),
      allowed: v.boolean(),
    })),
    created_at: v.number(),
  }),

  site_assets: defineTable({
    siteId: v.id("sites"),
    title: v.string(),
    type: v.union(v.literal("Photo"), v.literal("Drawing"), v.literal("Measurement"), v.literal("Other")),
    storageId: v.id("_storage"),
    format: v.string(), // e.g. "image/jpeg", "application/pdf"
    uploadedBy: v.string(),
    created_at: v.number(),
  }).index("by_site", ["siteId"]),

  notifications: defineTable({
    userId: v.string(), // Name or ID of the recipient (e.g. "Owner")
    title: v.string(),
    description: v.string(),
    read: v.boolean(),
    created_at: v.number(),
    type: v.optional(v.string()), // e.g. "request", "payment", etc.
  }).index("by_user", ["userId"]),

  tasks: defineTable({
    title: v.string(),
    description: v.string(),
    siteId: v.optional(v.id("sites")),
    assignedTo: v.string(), // Name or ID of the staff
    assignedBy: v.string(), // Name or ID of the owner
    priority: v.union(v.literal("Low"), v.literal("Medium"), v.literal("High")),
    status: v.union(v.literal("Pending"), v.literal("In Progress"), v.literal("Completed")),
    dueDate: v.optional(v.string()),
    assignedAt: v.number(),
    completedAt: v.optional(v.number()),
    completedBy: v.optional(v.string()),
    remarks: v.optional(v.string()),
  }).index("by_assignee", ["assignedTo"])
    .index("by_site", ["siteId"]),
  attendance: defineTable({
    employeeId: v.id("users"),
    date: v.string(), // YYYY-MM-DD
    checkIn: v.optional(v.number()), // timestamp
    checkOut: v.optional(v.number()), // timestamp
    totalHours: v.optional(v.number()),
    status: v.union(
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
    ),
    holidayName: v.optional(v.string()),
    approvalStatus: v.union(
      v.literal("Auto"),
      v.literal("Manual"),
      v.literal("Pending"),
      v.literal("Approved"),
      v.literal("Rejected")
    ),
    siteId: v.optional(v.id("sites")),
    siteName: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    photoStorageId: v.optional(v.id("_storage")),
    photoUrl: v.optional(v.string()),
    photoUploadedAt: v.optional(v.number()),
    photoRequired: v.optional(v.boolean()),
    photoStatus: v.optional(v.union(v.literal("uploaded"), v.literal("missing"), v.literal("not_required"))),
    leaveRequestId: v.optional(v.id("leaveRequests")),
    leaveType: v.optional(v.string()),
  })
    .index("by_date", ["date"])
    .index("by_employee", ["employeeId"])
    .index("by_site", ["siteId"])
    .index("by_approval", ["approvalStatus"])
    .index("by_employee_date", ["employeeId", "date"]),

  leaveRequests: defineTable({
    userId: v.id("users"),
    userName: v.string(),
    userRole: v.optional(v.string()),
    siteId: v.optional(v.id("sites")),
    siteName: v.optional(v.string()),
    leaveType: v.string(),
    fromDate: v.string(), // YYYY-MM-DD
    toDate: v.string(), // YYYY-MM-DD
    totalDays: v.number(),
    isHalfDay: v.boolean(),
    halfDaySession: v.optional(v.union(v.literal("first_half"), v.literal("second_half"))),
    reason: v.string(),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentUrl: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("cancelled")
    ),
    approvalNote: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    approvedBy: v.optional(v.string()),
    approvedByName: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    rejectedBy: v.optional(v.string()),
    rejectedByName: v.optional(v.string()),
    rejectedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_from_date", ["fromDate"])
    .index("by_to_date", ["toDate"])
    .index("by_site", ["siteId"]),

  requirements: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  requirementCategories: defineTable({
    requirementId: v.id("requirements"),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_requirement", ["requirementId"]),

  requirementPeople: defineTable({
    requirementId: v.id("requirements"),
    categoryId: v.optional(v.id("requirementCategories")),
    name: v.string(),
    phone: v.string(),
    role: v.string(), 
    siteId: v.optional(v.id("sites")),
    availability: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_requirement", ["requirementId"])
    .index("by_category", ["categoryId"])
    .index("by_phone", ["phone"]),

  attendance_audit_logs: defineTable({
    attendanceId: v.id("attendance"),
    action: v.union(v.literal("photo_uploaded"), v.literal("photo_replaced"), v.literal("photo_removed")),
    userId: v.string(), // Name or ID
    createdAt: v.number(),
    oldPhotoStorageId: v.optional(v.id("_storage")),
    newPhotoStorageId: v.optional(v.id("_storage")),
  }).index("by_attendance", ["attendanceId"]),

  notices: defineTable({
    title: v.string(),
    message: v.string(),
    priority: v.union(v.literal("normal"), v.literal("important"), v.literal("urgent")),
    audience: v.union(v.literal("all"), v.literal("roles"), v.literal("sites"), v.literal("users")),
    roleIds: v.optional(v.array(v.string())),
    siteIds: v.optional(v.array(v.id("sites"))),
    userIds: v.optional(v.array(v.string())), // User names/names
    isPinned: v.boolean(),
    isActive: v.boolean(),
    createdBy: v.string(), // User name or ID
    createdByName: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.optional(v.number()),
    approvalStatus: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
  })
    .index("by_active", ["isActive"])
    .index("by_created", ["createdAt"])
    .index("by_priority", ["priority"])
    .index("by_audience", ["audience"]),

  notice_reads: defineTable({
    noticeId: v.id("notices"),
    userId: v.string(),
    readAt: v.number(),
  })
    .index("by_notice", ["noticeId"])
    .index("by_user", ["userId"])
    .index("by_notice_user", ["noticeId", "userId"]),

  userDocuments: defineTable({
    userId: v.id("users"),
    userName: v.string(),
    documentTitle: v.string(),
    documentType: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    storageId: v.id("_storage"),
    uploadedBy: v.string(),
    uploadedByName: v.string(),
    uploadedAt: v.number(),
    notes: v.optional(v.string()),
    visibility: v.union(v.literal("private"), v.literal("owner_visible"), v.literal("manager_visible")),
    status: v.union(v.literal("active"), v.literal("archived")),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_type", ["documentType"])
    .index("by_uploadedAt", ["uploadedAt"])
    .index("by_status", ["status"]),

  documentAuditLogs: defineTable({
    documentId: v.id("userDocuments"),
    action: v.string(), // "uploaded" | "viewed" | "downloaded" | "edited" | "archived" | "deleted"
    performedBy: v.string(),
    performedByName: v.string(),
    targetUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_document", ["documentId"])
    .index("by_target_user", ["targetUserId"]),

  idCardTemplates: defineTable({
    frontStorageId: v.optional(v.id("_storage")),
    backStorageId: v.optional(v.id("_storage")),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }),

  userInvites: defineTable({
    inviteCode: v.string(),
    inviteTitle: v.optional(v.string()),
    intendedRoleId: v.optional(v.string()),
    intendedRoleName: v.optional(v.string()),
    intendedSiteId: v.optional(v.id("sites")),
    intendedSiteName: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("used"), v.literal("expired"), v.literal("revoked")),
    maxUses: v.number(),
    usedCount: v.number(),
    expiresAt: v.number(),
    createdBy: v.string(),
    createdByName: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_code", ["inviteCode"])
    .index("by_status", ["status"])
    .index("by_expires", ["expiresAt"])
    .index("by_creator", ["createdBy"]),

  userJoinRequests: defineTable({
    inviteId: v.id("userInvites"),
    inviteCode: v.string(),
    fullName: v.string(),
    email: v.string(),
    phone: v.string(),
    passwordHash: v.string(),
    designation: v.optional(v.string()),
    requestedRoleId: v.optional(v.string()),
    requestedRoleName: v.optional(v.string()),
    siteId: v.optional(v.id("sites")),
    siteName: v.optional(v.string()),
    joiningDate: v.optional(v.string()),
    bloodGroup: v.optional(v.string()),
    address: v.optional(v.string()),
    emergencyContactName: v.optional(v.string()),
    emergencyContactPhone: v.optional(v.string()),
    emergencyContactRelationship: v.optional(v.string()),
    gender: v.optional(v.string()),
    dob: v.optional(v.string()),
    profilePhotoStorageId: v.optional(v.id("_storage")),
    resumeStorageId: v.optional(v.id("_storage")),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.literal("changes_requested")),
    ownerNote: v.optional(v.string()),
    submittedAt: v.number(),
    updatedAt: v.number(),
    approvedBy: v.optional(v.string()),
    approvedByName: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    rejectedBy: v.optional(v.string()),
    rejectedByName: v.optional(v.string()),
    rejectedAt: v.optional(v.number()),
    createdUserId: v.optional(v.id("users")),
  })
    .index("by_status", ["status"])
    .index("by_email", ["email"])
    .index("by_phone", ["phone"])
    .index("by_code", ["inviteCode"])
    .index("by_submitted", ["submittedAt"]),

  joinRequestDocuments: defineTable({
    joinRequestId: v.id("userJoinRequests"),
    documentTitle: v.string(),
    documentType: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    storageId: v.id("_storage"),
    uploadedAt: v.number(),
  })
    .index("by_request", ["joinRequestId"]),

  onboarding_audit_logs: defineTable({
    action: v.string(),
    performedBy: v.string(),
    performedByName: v.string(),
    targetRequestId: v.optional(v.id("userJoinRequests")),
    targetUserId: v.optional(v.id("users")),
    inviteId: v.optional(v.id("userInvites")),
    createdAt: v.number(),
    details: v.string(),
  })
    .index("by_action", ["action"])
    .index("by_created", ["createdAt"]),

  attendanceSettings: defineTable({
    weeklyOffDays: v.array(v.string()),
    updatedBy: v.string(),
    updatedAt: v.number(),
  }),

  holidays: defineTable({
    name: v.string(),
    date: v.string(), // YYYY-MM-DD
    type: v.string(), // Festival, Company Holiday, Government Holiday, Custom
    appliesTo: v.union(v.literal("all"), v.literal("site"), v.literal("role")),
    siteId: v.optional(v.id("sites")),
    roleId: v.optional(v.string()),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_isActive", ["isActive"])
    .index("by_siteId", ["siteId"])
    .index("by_roleId", ["roleId"]),

  attendanceOverrides: defineTable({
    userId: v.optional(v.id("users")),
    siteId: v.optional(v.id("sites")),
    date: v.string(), // YYYY-MM-DD
    overrideType: v.union(v.literal("working_day"), v.literal("holiday")),
    reason: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
  })
    .index("by_date", ["date"])
    .index("by_user_date", ["userId", "date"])
    .index("by_site_date", ["siteId", "date"]),

  generatedDocuments: defineTable({
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
    documentFields: v.any(), // Record<string, string>
    status: v.union(
      v.literal("draft"),
      v.literal("unissued"),
      v.literal("issued"),
      v.literal("emailed"),
      v.literal("cancelled")
    ),
    pdfStorageId: v.optional(v.id("_storage")),
    docxStorageId: v.optional(v.id("_storage")),
    issuedBy: v.optional(v.string()),
    issuedByName: v.optional(v.string()),
    issuedAt: v.optional(v.number()),
    emailedAt: v.optional(v.number()),
    createdBy: v.string(),
    createdByName: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  documentTemplates: defineTable({
    templateName: v.string(),
    documentType: v.string(),
    rolePreset: v.string(),
    body: v.string(),
    defaultFields: v.any(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  estimates: defineTable({
    estimateNumber: v.string(),
    siteId: v.id("sites"),
    siteName: v.string(),
    clientName: v.string(),
    clientPhone: v.optional(v.string()),
    clientEmail: v.optional(v.string()),
    projectAddress: v.optional(v.string()),
    projectType: v.string(),
    estimateDate: v.string(),
    validUntil: v.optional(v.string()),
    subtotal: v.number(),
    discountType: v.optional(v.string()),
    discountValue: v.optional(v.number()),
    discountAmount: v.number(),
    gstType: v.optional(v.string()),
    gstValue: v.optional(v.number()),
    gstAmount: v.number(),
    bufferType: v.optional(v.string()),
    bufferValue: v.optional(v.number()),
    bufferAmount: v.number(),
    grandTotal: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("converted"),
      v.literal("completed"),
      v.literal("archived")
    ),
    preparedBy: v.string(),
    preparedByName: v.string(),
    approvedBy: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    convertedToBudgetAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    termsAndConditions: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_siteId", ["siteId"])
    .index("by_status", ["status"])
    .index("by_estimateNumber", ["estimateNumber"])
    .index("by_createdAt", ["createdAt"]),

  estimateItems: defineTable({
    estimateId: v.id("estimates"),
    serialNo: v.number(),
    category: v.string(),
    subcategory: v.optional(v.string()),
    itemName: v.string(),
    description: v.optional(v.string()),
    quantity: v.number(),
    unit: v.string(),
    costPerUnit: v.number(),
    totalCost: v.number(),
    vendorId: v.optional(v.string()),
    vendorName: v.optional(v.string()),
    notes: v.optional(v.string()),
    length: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_estimateId", ["estimateId"]),

  estimateTemplates: defineTable({
    templateName: v.string(),
    projectType: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_projectType", ["projectType"]),

  estimateTemplateItems: defineTable({
    templateId: v.id("estimateTemplates"),
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
  }).index("by_templateId", ["templateId"]),

  rateLibrary: defineTable({
    itemName: v.string(),
    category: v.string(),
    unit: v.string(),
    defaultRate: v.number(),
    vendorId: v.optional(v.string()),
    vendorName: v.optional(v.string()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_category", ["category"]),

  siteBudgetVersions: defineTable({
    siteId: v.id("sites"),
    siteName: v.string(),
    estimateId: v.optional(v.id("estimates")),
    estimateNumber: v.optional(v.string()),
    budgetAmount: v.number(),
    versionName: v.string(),
    isActive: v.boolean(),
    createdBy: v.string(),
    createdAt: v.number(),
    notes: v.optional(v.string()),
  }).index("by_siteId", ["siteId"]),

  estimation_audit_logs: defineTable({
    action: v.string(),
    estimateId: v.optional(v.id("estimates")),
    estimateNumber: v.optional(v.string()),
    siteId: v.optional(v.id("sites")),
    performedBy: v.string(),
    performedByName: v.string(),
    createdAt: v.number(),
    details: v.string(),
  }).index("by_estimate", ["estimateId"])
    .index("by_site", ["siteId"]),
});

