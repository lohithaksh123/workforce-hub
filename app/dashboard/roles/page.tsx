'use client'

import { useState, useEffect, useContext } from 'react'
import { UserContext } from '@/components/dashboard/UserContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
    CheckCircle, 
    XCircle, 
    Plus, 
    Edit2, 
    Trash2, 
    Loader2, 
    ShieldCheck, 
    Users, 
    Settings, 
    Lock,
    Search,
    MapPin,
    Mail,
    ChevronRight,
    LayoutGrid,
    ShieldAlert
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { toast } from '@/hooks/use-toast'
import AccessDeniedBoard from '@/components/dashboard/AccessDeniedBoard'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const DEFAULT_PERMISSIONS = [
  { key: 'create_transactions', label: 'Create Transactions', allowed: false },
  { key: 'approve_transactions', label: 'Approve Transactions', allowed: false },
  { key: 'manage_users', label: 'Manage Users', allowed: false },
  { key: 'view_reports', label: 'View Reports', allowed: false },
  { key: 'edit_settings', label: 'Edit Settings', allowed: false },
  { key: 'manage_roles', label: 'Manage Roles', allowed: false },
  { key: 'generate_join_codes', label: 'Generate Join Codes', allowed: false },
  { key: 'manage_invites', label: 'Manage Invites', allowed: false },
  { key: 'manage_sites', label: 'Manage Sites', allowed: false },
  { key: 'manage_company_wallet', label: 'Manage Company Wallet', allowed: false },
  { key: 'manage_attendance', label: 'Manage Attendance', allowed: false },
  { key: 'manage_requirements', label: 'Manage Requirements', allowed: false },
  { key: 'manage_notices', label: 'Manage Notices', allowed: false },
  { key: 'edit_transactions', label: 'Edit Transactions', allowed: false },
  { key: 'manage_user_documents', label: 'Manage User Documents', allowed: false },
  { key: 'generate_hr_documents', label: 'Generate HR Documents', allowed: false },
  { key: 'issue_hr_documents', label: 'Issue HR Documents', allowed: false },
  { key: 'email_hr_documents', label: 'Email HR Documents', allowed: false },
  { key: 'view_hr_documents', label: 'View HR Documents', allowed: false },
  { key: 'manage_hr_documents', label: 'Manage HR Documents', allowed: false },
]

export default function RolesPage() {
  const roles = useQuery(api.roles.getRoles)
  const users = useQuery(api.users.getUsers)
  const sites = useQuery(api.sites.getSites)
  
  const createRole = useMutation(api.roles.createRole)
  const updateRole = useMutation(api.roles.updateRole)
  const deleteRole = useMutation(api.roles.deleteRole)
  const resetRoles = useMutation(api.roles.resetRolesToPicture2)
  
  const updateUserPermissions = useMutation(api.users.updateOperativePermissions)
  const updateUserRole = useMutation(api.users.updateUserRole)
  
  const { user: loggedInUser } = useContext(UserContext)

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingRole, setEditingRole] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: DEFAULT_PERMISSIONS,
  })
  
  const [isResetting, setIsResetting] = useState(false)
  
  // User Access Assignment State
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [isUserAccessOpen, setIsUserAccessOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [userAccessData, setUserAccessData] = useState({
    role: '',
    permissions: DEFAULT_PERMISSIONS
  })

  const hasRolesPermission = loggedInUser && (loggedInUser.role === 'Owner' || loggedInUser.permissions?.some((p: any) => p.key === 'manage_roles' && p.allowed));

  if (!hasRolesPermission) {
    return <AccessDeniedBoard />
  }

  const handleReset = async () => {
    if (!confirm('This will wipe all custom roles and reset to the picture 2 configuration. Continue?')) return
    setIsResetting(true)
    try {
      await resetRoles()
      toast({ title: 'System Reset', description: 'Roles have been synced with latest specification' })
    } catch (e) {
      toast({ title: 'Reset Failed', variant: 'destructive', description: 'Backend sync error' })
    } finally {
      setIsResetting(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.name) return
    setIsSaving(true)
    try {
      await createRole(formData)
      setIsAddOpen(false)
      setFormData({ name: '', description: '', permissions: DEFAULT_PERMISSIONS })
      toast({ title: 'Success', description: 'New role template created' })
    } catch (e) {
      toast({ title: 'Error', variant: 'destructive', description: 'Failed to create role template' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditRole = (role: any) => {
    setEditingRole(role)
    const mergedPermissions = DEFAULT_PERMISSIONS.map(def => {
      const existing = role.permissions.find((p: any) => p.key === def.key || p.name === def.label)
      return existing ? { ...def, allowed: existing.allowed } : def
    })
    setFormData({
      name: role.name,
      description: role.description,
      permissions: mergedPermissions,
    })
    setIsEditOpen(true)
  }

  const handleUpdateRole = async () => {
    if (!editingRole || !formData.name) return
    setIsSaving(true)
    try {
      await updateRole({
        id: editingRole._id,
        ...formData
      })
      setIsEditOpen(false)
      setEditingRole(null)
      toast({ title: 'Success', description: 'Role template updated' })
    } catch (e) {
      toast({ title: 'Error', variant: 'destructive', description: 'Failed to update role template' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteRole = async (id: any) => {
    if (!confirm('Are you sure you want to delete this role template?')) return
    try {
      await deleteRole({ id })
      toast({ title: 'Deleted', description: 'Role template removed' })
    } catch (e) {
      toast({ title: 'Error', variant: 'destructive', description: 'Failed to delete role' })
    }
  }

  const handleEditUserAccess = (user: any) => {
    setSelectedUser(user)
    const mergedPermissions = DEFAULT_PERMISSIONS.map(def => {
      const existing = user.permissions?.find((p: any) => p.key === def.key || p.name === def.label)
      return existing ? { ...def, allowed: existing.allowed } : def
    })
    setUserAccessData({
      role: user.role,
      permissions: mergedPermissions
    })
    setIsUserAccessOpen(true)
  }

  const handleUpdateUserAccess = async () => {
    if (!selectedUser) return
    setIsSaving(true)
    try {
      // 1. Update role if changed (this also resets permissions to role default in backend if needed)
      if (userAccessData.role !== selectedUser.role) {
        await updateUserRole({ userId: selectedUser._id, role: userAccessData.role })
      }
      
      // 2. Update permissions
      await updateUserPermissions({ 
        userId: selectedUser._id, 
        permissions: userAccessData.permissions 
      })
      
      setIsUserAccessOpen(false)
      toast({ title: 'Access Updated', description: `Permissions updated for ${selectedUser.name}` })
    } catch (e) {
      toast({ title: 'Error', variant: 'destructive', description: 'Failed to update access' })
    } finally {
      setIsSaving(false)
    }
  }

  const togglePermission = (index: number, isUserAccess = false) => {
    if (isUserAccess) {
      const newPermissions = [...userAccessData.permissions]
      newPermissions[index] = { ...newPermissions[index], allowed: !newPermissions[index].allowed }
      setUserAccessData({ ...userAccessData, permissions: newPermissions })
    } else {
      const newPermissions = [...formData.permissions]
      newPermissions[index] = { ...newPermissions[index], allowed: !newPermissions[index].allowed }
      setFormData({ ...formData, permissions: newPermissions })
    }
  }

  const filteredUsers = users?.filter(u => 
    u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
  )

  const getRoleIcon = (roleName: string) => {
    switch (roleName) {
      case 'Owner': return <ShieldAlert className="h-5 w-5 text-rose-500" />
      case 'Project Manager': return <BriefcaseIcon className="h-5 w-5 text-amber-500" />
      case 'Accountant': return <DollarSignIcon className="h-5 w-5 text-blue-500" />
      case 'Staff': return <Users className="h-5 w-5 text-emerald-500" />
      default: return <Settings className="h-5 w-5 text-indigo-500" />
    }
  }

  return (
    <div className="space-y-12 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="relative p-6 sm:p-8 rounded-2xl bg-slate-950 text-white overflow-hidden shadow-2xl border border-white/5">
        <div className="absolute top-[-50%] right-[-10%] w-[40%] h-[200%] bg-primary/10 rounded-full blur-[100px]" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left w-full sm:w-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
              Access Architecture
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight italic uppercase leading-tight">
              Security & <span className="text-primary italic">Roles</span>
            </h1>
            <p className="text-slate-400 font-medium text-xs sm:text-sm max-w-lg italic mx-auto md:mx-0">
              Define role templates and orchestrate individual operative permissions with granular precision.
            </p>
          </div>
          <Button
            onClick={handleReset}
            disabled={isResetting}
            className="h-12 px-6 bg-primary hover:bg-indigo-650 text-white font-black italic uppercase tracking-widest text-xs rounded-xl shadow-xl shadow-primary/20 transition-all shrink-0"
          >
            {isResetting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4 shrink-0" />} 
            Sync Default Roles
          </Button>
        </div>
      </div>

      {/* Section B: User Access Assignment (PRIMARY) */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
            <Users className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-black italic uppercase tracking-tighter">Operative Access Assignment</h2>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800 ml-4" />
        </div>

        <Card className="bg-white/40 dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
            <CardHeader className="p-8 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="space-y-1 text-center md:text-left">
                        <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">Team Directory</CardTitle>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Assign roles and custom permissions per operative</p>
                    </div>
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="SEARCH OPERATIVES..." 
                            className="h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 rounded-xl pl-12 text-xs font-black uppercase tracking-widest"
                            value={userSearchTerm}
                            onChange={(e) => setUserSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-slate-800">
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Operative</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Current Role</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Assignment</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Status</th>
                                <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredUsers?.map((user) => (
                                <tr key={user._id} className="group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm border border-primary/20">
                                                {user.name?.[0]?.toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-black italic uppercase tracking-tight text-slate-900 dark:text-white leading-none">{user.name}</span>
                                                <span className="text-[10px] font-bold text-slate-500 mt-1 lowercase flex items-center gap-1"><Mail className="h-3 w-3" /> {user.email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2">
                                            {getRoleIcon(user.role)}
                                            <span className="text-xs font-black uppercase tracking-widest italic">{user.role}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <MapPin className="h-3.5 w-3.5" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">
                                                {sites?.find(s => s._id === user.siteId)?.name || 'Central Unit'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <Badge className={cn(
                                            "text-[9px] font-black uppercase tracking-widest italic border-none",
                                            user.status === 'active' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                                        )}>
                                            {user.status}
                                        </Badge>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-10 px-4 border-slate-200 dark:border-slate-800 hover:bg-primary hover:text-white hover:border-primary font-black italic uppercase tracking-widest text-[9px] rounded-xl transition-all"
                                            onClick={() => handleEditUserAccess(user)}
                                        >
                                            Edit Access <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredUsers?.map((user) => (
                        <div key={user._id} className="p-6 space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-lg border border-primary/20">
                                    {user.name?.[0]?.toUpperCase()}
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="font-black italic uppercase tracking-tight text-slate-900 dark:text-white truncate">{user.name}</span>
                                    <span className="text-[10px] font-bold text-slate-500 mt-0.5 lowercase truncate">{user.email}</span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Current Role</span>
                                    <div className="flex items-center gap-2">
                                        {getRoleIcon(user.role)}
                                        <span className="text-[10px] font-black uppercase tracking-widest italic">{user.role}</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Assignment</span>
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <MapPin className="h-3 w-3" />
                                        <span className="text-[9px] font-bold uppercase tracking-widest truncate">
                                            {sites?.find(s => s._id === user.siteId)?.name || 'Central Unit'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <Badge className={cn(
                                    "text-[9px] font-black uppercase tracking-widest italic border-none",
                                    user.status === 'active' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                                )}>
                                    {user.status}
                                </Badge>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-9 px-4 border-slate-200 dark:border-slate-800 hover:bg-primary hover:text-white hover:border-primary font-black italic uppercase tracking-widest text-[9px] rounded-xl transition-all"
                                    onClick={() => handleEditUserAccess(user)}
                                >
                                    Edit Access <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
      </section>

      <Dialog open={isUserAccessOpen} onOpenChange={setIsUserAccessOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl bg-slate-950 border-slate-800 text-white p-0 max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl">
            <div className="p-6 sm:p-8 bg-gradient-to-br from-indigo-500/20 to-transparent">
                <DialogHeader className="mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center font-black text-2xl shadow-xl shadow-primary/20">
                            {selectedUser?.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                            <DialogTitle className="text-3xl font-black italic uppercase tracking-tighter">Commitment Access Suite</DialogTitle>
                            <DialogDescription className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1 italic">
                                Overriding security protocols for <span className="text-white italic">{selectedUser?.name}</span>
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-6">
                    <div className="md:col-span-1 space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Select Operative Role</Label>
                            <Select 
                                value={userAccessData.role} 
                                onValueChange={(value) => {
                                    setUserAccessData({ ...userAccessData, role: value })
                                    // Optionally load template permissions when role changes
                                    const roleTemplate = roles?.find(r => r.name === value)
                                    if (roleTemplate) {
                                        setUserAccessData(prev => ({ ...prev, permissions: roleTemplate.permissions as any }))
                                    }
                                }}
                            >
                                <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-xl font-bold uppercase tracking-widest text-xs">
                                    <SelectValue placeholder="Role Template" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                                    {roles?.map(role => (
                                        <SelectItem key={role._id} value={role.name} className="focus:bg-primary/20 py-3 uppercase font-black tracking-widest text-[10px] italic">
                                            {role.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[9px] text-slate-500 font-medium italic mt-2 leading-relaxed">
                                Changing the role will automatically apply the default permission template to this user.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                            <div className="flex items-center gap-2 text-primary">
                                <Lock className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Security Note</span>
                            </div>
                            <p className="text-[9px] text-slate-400 font-medium italic leading-relaxed">
                                You can manually toggle individual permissions below after selecting a role to create a customized access level.
                            </p>
                        </div>
                    </div>

                    <div className="md:col-span-2 space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Granular Protocol Access</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] sm:max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {userAccessData.permissions.map((p: any, i: number) => (
                                <div 
                                    key={p.key} 
                                    className={cn(
                                        "flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer",
                                        p.allowed 
                                            ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-100" 
                                            : "bg-white/5 border-white/10 text-slate-400 opacity-60"
                                    )}
                                    onClick={() => togglePermission(i, true)}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-widest italic">{p.label}</span>
                                    <Checkbox 
                                        checked={p.allowed} 
                                        className={cn(
                                            "border-none",
                                            p.allowed ? "bg-emerald-500 text-white" : "bg-white/10"
                                        )}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter className="pt-8 border-t border-white/5">
                    <Button 
                        onClick={handleUpdateUserAccess} 
                        className="w-full h-16 bg-primary hover:bg-indigo-600 text-white font-black italic uppercase tracking-widest text-lg rounded-xl shadow-2xl shadow-primary/20" 
                        disabled={isSaving}
                    >
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : "Deploy Access Protocols"}
                    </Button>
                </DialogFooter>
            </div>
        </DialogContent>
      </Dialog>
      
      {/* Edit Role Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-xl bg-slate-950 border-slate-800 text-white p-0 max-h-[90vh] overflow-y-auto rounded-2xl">
          <div className="p-8 bg-gradient-to-br from-indigo-500/20 to-transparent">
            <DialogHeader>
                <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Edit Role Blueprint</DialogTitle>
                <DialogDescription className="text-slate-400 italic">Update template for {editingRole?.name}.</DialogDescription>
            </DialogHeader>
            <RoleForm formData={formData} setFormData={setFormData} onTogglePermission={(i: number) => togglePermission(i)} />
            <DialogFooter className="pt-6 border-t border-white/5">
                <Button onClick={handleUpdateRole} className="w-full h-14 bg-primary hover:bg-indigo-600 font-black italic uppercase tracking-widest rounded-xl" disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Commit Template Changes"}
                </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RoleForm({ formData, setFormData, onTogglePermission }: any) {
  return (
    <div className="space-y-6 py-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic ml-1">Blueprint Identity</Label>
            <Input 
                placeholder="e.g. PROJECT MANAGER" 
                className="h-14 bg-white/5 border-white/10 rounded-xl font-bold uppercase tracking-widest text-xs italic"
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
            />
        </div>
        <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic ml-1">Directive Objective</Label>
            <Input 
                placeholder="Briefly describe this role's responsibility" 
                className="h-14 bg-white/5 border-white/10 rounded-xl font-bold italic text-slate-300"
                value={formData.description} 
                onChange={e => setFormData({ ...formData, description: e.target.value })} 
            />
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-white/5">
        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic ml-1">Default Protocol Access</Label>
        <div className="grid grid-cols-1 gap-2">
          {formData.permissions.map((p: any, i: number) => (
            <div 
                key={p.key} 
                className={cn(
                    "flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer",
                    p.allowed 
                        ? "bg-primary/10 border-primary/20 text-white" 
                        : "bg-white/5 border-white/10 text-slate-500 opacity-60"
                )}
                onClick={() => onTogglePermission(i)}
            >
               <span className="text-[10px] font-black uppercase tracking-widest italic">{p.label}</span>
               <Checkbox checked={p.allowed} className={cn("border-none", p.allowed ? "bg-primary text-white" : "bg-white/10")} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BriefcaseIcon({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
}

function DollarSignIcon({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
}
