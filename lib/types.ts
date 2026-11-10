// Company types
export interface Company {
  id: string
  name: string
  joinCode: string
  ownerId: string
  businessType?: string
  walletBalance: number
  createdAt: Date
  updatedAt: Date
}

export interface Wallet {
  id: string
  companyId: string
  balance: number
  currency: string
  lastUpdated: Date
}

// User types
export type UserRole = 'owner' | 'supervisor' | 'designer' | 'accountant' | 'staff'

export interface User {
  id: string
  phone: string
  email?: string
  name?: string
  profileCompleted: boolean
  companySetupCompleted: boolean
  companyId?: string
  role: UserRole
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface OTPSession {
  id: string
  phone: string
  otp: string
  expiresAt: Date
  attempts: number
  verified: boolean
  userId?: string
  createdAt: Date
}

// Transaction types
export type TransactionType = 'credit' | 'debit'
export type TransactionStatus = 'pending' | 'approved' | 'rejected' | 'completed'
export type PaymentMethod = 'bank_transfer' | 'cash' | 'card' | 'check'

export interface Transaction {
  id: string
  companyId: string
  type: TransactionType
  amount: number
  status: TransactionStatus
  description: string
  category?: string
  vendor?: string
  customerId?: string
  vendorId?: string
  paymentMethod: PaymentMethod
  createdBy: string
  approvedBy?: string
  rejectionReason?: string
  createdAt: Date
  updatedAt: Date
  approvedAt?: Date
}

// Expense request types
export interface ExpenseRequest {
  id: string
  companyId: string
  amount: number
  vendor: string
  purpose: string
  paymentMethod: PaymentMethod
  status: TransactionStatus
  requestedBy: string
  approvedBy?: string
  rejectionReason?: string
  createdAt: Date
  updatedAt: Date
  approvedAt?: Date
}

// Role types
export interface RolePermission {
  id: string
  role: UserRole
  canApproveTransactions: boolean
  canManageUsers: boolean
  canViewReports: boolean
  canEditSettings: boolean
  canCreateTransactions: boolean
}

// Auth types - OTP based
export interface SendOTPRequest {
  phone: string
}

export interface VerifyOTPRequest {
  phone: string
  otp: string
}

export interface VerifyOTPResponse {
  success: boolean
  sessionId: string
  isNewUser: boolean
}

export interface ProfileSetupRequest {
  name: string
  email?: string
  sessionId: string
}

export interface CompanySetupRequest {
  sessionId: string
  action: 'create' | 'join' | 'skip'
  companyName?: string // for create
  businessType?: string // for create
  joinCode?: string // for join
}

export interface AuthSession {
  userId: string
  phone: string
  name?: string
  email?: string
  companyId?: string
  role: UserRole
  profileCompleted: boolean
  companySetupCompleted: boolean
}
