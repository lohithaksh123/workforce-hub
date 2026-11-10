'use client'

import { createContext } from 'react'

export const UserContext = createContext<{
  user: { name: string, email?: string, role: string, permissions: Array<{ key: string, label: string, allowed: boolean }> };
  setUser: (user: any) => void;
}>({
  user: { 
    name: 'Owner', 
    role: 'Owner', 
    permissions: [
      { key: 'create_transactions', label: 'Create Transactions', allowed: true },
      { key: 'approve_transactions', label: 'Approve Transactions', allowed: true },
      { key: 'manage_users', label: 'Manage Users', allowed: true },
      { key: 'view_reports', label: 'View Reports', allowed: true },
      { key: 'edit_settings', label: 'Edit Settings', allowed: true },
      { key: 'manage_roles', label: 'Manage Roles', allowed: true },
      { key: 'generate_join_codes', label: 'Generate Join Codes', allowed: true },
      { key: 'manage_invites', label: 'Manage Invites', allowed: true },
      { key: 'manage_user_documents', label: 'Manage User Documents', allowed: true },
      { key: 'generate_hr_documents', label: 'Generate HR Documents', allowed: true },
      { key: 'issue_hr_documents', label: 'Issue HR Documents', allowed: true },
      { key: 'email_hr_documents', label: 'Email HR Documents', allowed: true },
      { key: 'view_hr_documents', label: 'View HR Documents', allowed: true },
      { key: 'manage_hr_documents', label: 'Manage HR Documents', allowed: true },
      { key: 'manage_estimates', label: 'Manage Estimates', allowed: true },
      { key: 'create_estimates', label: 'Create Estimates', allowed: true },
      { key: 'edit_estimates', label: 'Edit Estimates', allowed: true },
      { key: 'approve_estimates', label: 'Approve Estimates', allowed: true },
      { key: 'convert_estimate_to_budget', label: 'Convert Estimate to Site Budget', allowed: true },
      { key: 'view_estimate_reports', label: 'View Estimate Reports', allowed: true },
      { key: 'manage_rate_library', label: 'Manage Rate Library', allowed: true },
      { key: 'manage_estimate_templates', label: 'Manage Estimate Templates', allowed: true },
    ] 
  },
  setUser: () => {}
})
