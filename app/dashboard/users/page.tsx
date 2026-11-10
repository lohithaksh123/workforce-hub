'use client'

import { useState, useContext } from 'react'
import { UserContext } from '@/components/dashboard/UserContext'
import { 
  Plus, 
  Trash2, 
  Loader2, 
  Edit2, 
  Users,
  AlertCircle, 
  Mail, 
  ShieldCheck, 
  UserPlus, 
  Briefcase, 
  MapPin, 
  Lock,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  DollarSign,
  Camera,
  Phone as PhoneIcon,
  FileText,
  Download,
  Eye,
  File,
  FileImage,
  X,
  Calendar,
  MoreVertical
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import HrDocumentGenerator from '@/components/dashboard/HrDocumentGenerator'
import HrPayrollGenerator from '@/components/dashboard/HrPayrollGenerator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PasswordInput } from '@/components/ui/password-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQuery, useMutation, useAction, useConvex } from "convex/react"
import { api } from "@/convex/_generated/api"
import { handleRegenerateIdCard } from '@/components/dashboard/IdCardGenerator'
import { toast } from '@/hooks/use-toast'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import AccessDeniedBoard from '@/components/dashboard/AccessDeniedBoard'
import { motion, AnimatePresence } from 'framer-motion'
import { ImageCropperModal } from '@/components/dashboard/settings/ImageCropperModal'


const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const formatEmpId = (id: string | undefined) => {
  if (!id || !id.trim()) return undefined;
  const trimmed = id.trim();
  if (trimmed.toUpperCase().startsWith("EMP-")) {
    return `EMP-${trimmed.substring(5)}`;
  }
  return `EMP-${trimmed}`;
};

export default function UsersPage() {
  const convex = useConvex()
  const users = useQuery(api.users.getUsers)
  const roles = useQuery(api.roles.getRoles)
  const sites = useQuery(api.sites.getSites)
  
  const registerUser = useAction(api.users.registerUser as any)
  const removeUser = useMutation(api.users.removeUser)
  const toggleStatus = useMutation(api.users.toggleStatus)
  const updateUserComprehensive = useAction(api.users.updateUserComprehensive)

  const disableUser = useMutation(api.users.disableUser)
  const enableUser = useMutation(api.users.enableUser)
  const softDeleteUser = useMutation(api.users.softDeleteUser)
  const restoreUser = useMutation(api.users.restoreUser)

  const [disableModalOpen, setDisableModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [enableModalOpen, setEnableModalOpen] = useState(false)
  const [restoreModalOpen, setRestoreModalOpen] = useState(false)
  const [actionReason, setActionReason] = useState('')
  const [targetUser, setTargetUser] = useState<any>(null)

  // ID Card System Hooks
  const idCardTemplate = useQuery(api.id_card.getTemplate)
  const frontTemplateUrl = useQuery(api.users.getUserProfileImageUrl, { storageId: idCardTemplate?.frontStorageId || undefined })
  const backTemplateUrl = useQuery(api.users.getUserProfileImageUrl, { storageId: idCardTemplate?.backStorageId || undefined })
  const generateDocUploadUrl = useMutation(api.user_documents.generateUploadUrl)
  const saveOfficeIdCard = useMutation(api.id_card.saveOfficeIdCard)
  const generateUploadUrl = useMutation(api.users.generateUploadUrl)
  
  const { user: loggedInUser } = useContext(UserContext)
  const { data: session } = useSession()
  const userEmail = session?.user?.email

  // Details modal states
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<any>(null)

  // HR Document & Payroll generators states
  const [docGeneratorOpen, setDocGeneratorOpen] = useState(false)
  const [payrollGeneratorOpen, setPayrollGeneratorOpen] = useState(false)
  const [payrollMode, setPayrollMode] = useState<'payslip' | 'calculator'>('payslip')
  const [preselectedUserId, setPreselectedUserId] = useState<string | undefined>(undefined)
  
  // Doc preview / operations
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<any>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  
  const [docToDelete, setDocToDelete] = useState<any>(null)
  const [isConfirmDeleteDocOpen, setIsConfirmDeleteDocOpen] = useState(false)
  const [isDeletingDoc, setIsDeletingDoc] = useState(false)

  // Convex integration for user documents
  const selectedUserDocs = useQuery(
    api.user_documents.getUserDocuments,
    selectedUserForDetails && userEmail
      ? { userId: selectedUserForDetails._id, requestorEmail: userEmail }
      : "skip"
  )
  
  const getDocumentDownloadUrl = useMutation(api.user_documents.getDocumentDownloadUrl)
  const deleteUserDocument = useMutation(api.user_documents.deleteUserDocument)

  const getDocTypeIcon = (type: string) => {
    switch (type) {
      case 'Resume': return <FileText className="h-4 w-4 text-indigo-500" />
      case 'ID Proof': case 'Address Proof': return <ShieldCheck className="h-4 w-4 text-blue-500" />
      case 'Certificate': return <ShieldAlert className="h-4 w-4 text-amber-500" />
      case 'Agreement': return <Briefcase className="h-4 w-4 text-emerald-500" />
      default: return <FileText className="h-4 w-4 text-slate-500" />
    }
  };

  const triggerDocumentPreview = async (doc: any) => {
    const safeEmail = userEmail || loggedInUser?.email || '';
    if (!safeEmail) {
      toast({ title: "Preview Failed", variant: "destructive", description: "Authentication missing. Please sign in again." });
      return;
    }
    setPreviewDoc(doc);
    setPreviewUrl(null);
    setIsPreviewOpen(true);
    setIsLoadingPreview(true);

    try {
      const url = await getDocumentDownloadUrl({ id: doc._id, action: "viewed", requestorEmail: safeEmail });
      setPreviewUrl(url);
    } catch (err: any) {
      toast({ title: "Preview Failed", variant: "destructive", description: err.message });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const triggerDocumentDownload = async (doc: any) => {
    const safeEmail = userEmail || loggedInUser?.email || '';
    if (!safeEmail) {
      toast({ title: "Download Failed", variant: "destructive", description: "Authentication missing. Please sign in again." });
      return;
    }
    const activeToast = toast({ title: "Preparing download", description: `Preparing "${doc.fileName}" for download...` });
    try {
      const url = await getDocumentDownloadUrl({ id: doc._id, action: "downloaded", requestorEmail: safeEmail });
      
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not download file data.");
      const blob = await response.blob();
      
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      
      activeToast.dismiss();
      toast({ title: "Download Started", description: "Download started successfully." });
    } catch (err: any) {
      activeToast.dismiss();
      toast({ title: "Download Failed", variant: "destructive", description: "Download failed: " + err.message });
    }
  };

  const handleDeleteDoc = async () => {
    if (!docToDelete) return;
    setIsDeletingDoc(true);
    try {
      await deleteUserDocument({ id: docToDelete._id, requestorEmail: userEmail! });
      toast({ title: "Removed", description: "Document removed successfully." });
      setIsConfirmDeleteDocOpen(false);
      setDocToDelete(null);
    } catch (err: any) {
      toast({ title: "Delete Failed", variant: "destructive", description: err.message || "Failed to remove document." });
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'disabled' | 'deleted' | 'all'>('active')
  
  const [newUser, setNewUser] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: 'Staff', 
    designation: '', 
    employeeId: '',
    siteId: '',
    phone: '',
    joiningDate: new Date().toISOString().split('T')[0],
    requiresAttendancePhoto: false,
    bloodGroup: '',
    emergencyContact: '',
    image: '',
    gender: '',
    dob: '',
    address: '',
    bankName: '',
    bankAccount: '',
    pan: '',
    pfNumber: '',
    pfUan: '',
    esicNo: '',
    location: ''
  })
  
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [registrationError, setRegistrationError] = useState<string | null>(null)
  
  const [editOpen, setEditOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [editFormData, setEditFormData] = useState({ 
    name: '',
    email: '',
    role: '', 
    designation: '',
    employeeId: '',
    siteId: '',
    password: '',
    phone: '',
    joiningDate: '',
    status: 'active' as 'active' | 'inactive' | 'disabled' | 'deleted',
    requiresAttendancePhoto: false,
    bloodGroup: '',
    emergencyContact: '',
    image: '',
    gender: '',
    dob: '',
    address: '',
    bankName: '',
    bankAccount: '',
    pan: '',
    pfNumber: '',
    pfUan: '',
    esicNo: '',
    location: ''
  })
  const [editError, setEditError] = useState<string | null>(null)
  const [customRoleName, setCustomRoleName] = useState('')
  const [editCustomRoleName, setEditCustomRoleName] = useState('')

  // Profile photo cropping states
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [isCropModalOpen, setIsCropModalOpen] = useState(false)
  const [isUploadingProfilePhoto, setIsUploadingProfilePhoto] = useState(false)
  const [cropperTarget, setCropperTarget] = useState<'new' | 'edit' | null>(null)

  // Query hooks to fetch selected user profile photo URL
  const newUserProfileImageUrl = useQuery(
    api.users.getUserProfileImageUrl,
    newUser.image ? { storageId: newUser.image } : "skip"
  )
  const editingUserProfileImageUrl = useQuery(
    api.users.getUserProfileImageUrl,
    editFormData.image ? { storageId: editFormData.image } : "skip"
  )

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'new' | 'edit') => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setImageToCrop(reader.result as string)
      setCropperTarget(target)
      setIsCropModalOpen(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleProfilePhotoCropComplete = async (croppedBlob: Blob) => {
    setIsCropModalOpen(false)
    setIsUploadingProfilePhoto(true)
    const activeToast = toast({ title: "Uploading photo...", description: "Uploading profile photo..." })
    try {
      const postUrl = await generateUploadUrl()
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: croppedBlob,
      })
      if (!result.ok) throw new Error("Upload failed")
      const { storageId } = await result.json()
      
      if (cropperTarget === 'new') {
        setNewUser(prev => ({ ...prev, image: storageId }))
      } else if (cropperTarget === 'edit') {
        setEditFormData(prev => ({ ...prev, image: storageId }))
      }
      activeToast.dismiss()
      toast({ title: "Upload Success", description: "Photo uploaded successfully." })
    } catch (error) {
      activeToast.dismiss()
      toast({ title: "Upload Failed", variant: "destructive", description: "Failed to upload photo." })
    } finally {
      setIsUploadingProfilePhoto(false)
      setImageToCrop(null)
      setCropperTarget(null)
    }
  }

  const hasDocPermission = loggedInUser && (loggedInUser.role === 'Owner' || loggedInUser.permissions?.some((p: any) => (p.key === 'generate_hr_documents' || p.key === 'manage_hr_documents') && p.allowed));

  const hasUsersPermission = loggedInUser && (loggedInUser.role === 'Owner' || loggedInUser.permissions?.some((p: any) => p.key === 'manage_users' && p.allowed));

  if (!hasUsersPermission) {
    return <AccessDeniedBoard />
  }

  const handleAddUser = async () => {
    setRegistrationError(null)
    if (!newUser.name || !newUser.email || !newUser.password) {
      setRegistrationError("Name, Email and Password are required for setup.")
      return
    }
    if (newUser.role === 'CUSTOM' && !customRoleName.trim()) {
      setRegistrationError("Please specify a custom role name.")
      return
    }
    setIsSaving(true)
    try {
      const result = (await registerUser({
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role === 'CUSTOM' ? customRoleName.trim() : newUser.role,
        designation: newUser.designation,
        employeeId: formatEmpId(newUser.employeeId),
        siteId: newUser.siteId && newUser.siteId !== 'central' ? (newUser.siteId as any) : undefined,
        phone: newUser.phone,
        joiningDate: newUser.joiningDate,
        requiresAttendancePhoto: newUser.requiresAttendancePhoto,
        bloodGroup: newUser.bloodGroup || undefined,
        emergencyContact: newUser.emergencyContact || undefined,
        image: newUser.image || undefined,
        gender: newUser.gender || undefined,
        dob: newUser.dob || undefined,
        address: newUser.address || undefined,
        bankName: newUser.bankName || undefined,
        bankAccount: newUser.bankAccount || undefined,
        pan: newUser.pan || undefined,
        pfNumber: newUser.pfNumber || undefined,
        pfUan: newUser.pfUan || undefined,
        esicNo: newUser.esicNo || undefined,
        location: newUser.location || undefined,
      })) as any

      if (result.success) {
        setOpen(false)
        const targetName = newUser.name
        const targetEmail = newUser.email
        const targetRole = newUser.role === 'CUSTOM' ? customRoleName.trim() : newUser.role
        const targetDesignation = newUser.designation
        const targetEmployeeId = formatEmpId(newUser.employeeId)
        const targetPhone = newUser.phone
        const targetBloodGroup = newUser.bloodGroup
        const targetEmergencyContact = newUser.emergencyContact
        const targetUserId = result.userId
        const targetImage = newUser.image

        setNewUser({ 
          name: '', 
          email: '', 
          password: '', 
          role: 'Staff', 
          designation: '', 
          employeeId: '',
          siteId: '', 
          phone: '',
          joiningDate: new Date().toISOString().split('T')[0],
          requiresAttendancePhoto: false,
          bloodGroup: '',
          emergencyContact: '',
          image: '',
          gender: '',
          dob: '',
          address: '',
          bankName: '',
          bankAccount: '',
          pan: '',
          pfNumber: '',
          pfUan: '',
          esicNo: '',
          location: ''
        })
        setCustomRoleName('')
        toast({ title: "Intelligence Shared", description: "New member added. Generating ID Card..." })

        setTimeout(async () => {
          try {
            const profileUrl = targetImage
              ? await convex.query(api.users.getUserProfileImageUrl, { storageId: targetImage })
              : null

            await handleRegenerateIdCard({
              user: {
                _id: targetUserId as any,
                name: targetName,
                email: targetEmail,
                role: targetRole,
                designation: targetDesignation,
                employeeId: targetEmployeeId,
                phone: targetPhone,
                bloodGroup: targetBloodGroup,
                emergencyContact: targetEmergencyContact,
                image: targetImage,
              },
              profileImageUrl: profileUrl || null,
              frontTemplateUrl: frontTemplateUrl || null,
              backTemplateUrl: backTemplateUrl || null,
              requestorEmail: userEmail!,
              generateUploadUrlFn: (args) => generateDocUploadUrl(args),
              saveOfficeIdCardFn: (args) => saveOfficeIdCard(args),
            })
            toast({ title: "Success", description: `Office ID Card generated for ${targetName}.` })
          } catch (e: any) {
            console.error("Auto ID Card generation failed", e)
            toast({ title: "Warning", variant: "destructive", description: `ID Card compilation failed: ` + e.message })
          }
        }, 100)
      } else {
        setRegistrationError(result.error || "Failed to finalize registration.")
      }
    } catch (e: any) {
      setRegistrationError("A synchronization error occurred. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditUser = (user: any) => {
    setEditError(null)
    setEditingUser(user)
    const isStandardRole = roles?.some((r: any) => r.name === user.role)
    const isCustom = !isStandardRole
    setEditCustomRoleName(isCustom ? user.role : '')
    setEditFormData({
      name: user.name,
      email: user.email,
      role: isCustom ? 'CUSTOM' : user.role,
      designation: user.designation || '',
      employeeId: user.employeeId || '',
      siteId: user.siteId || 'central',
      password: '',
      phone: user.phone || '',
      joiningDate: user.joiningDate || '',
      status: user.status || 'active',
      requiresAttendancePhoto: user.requiresAttendancePhoto || false,
      bloodGroup: user.bloodGroup || '',
      emergencyContact: user.emergencyContact || '',
      image: user.image || '',
      gender: user.gender || '',
      dob: user.dob || '',
      address: user.address || '',
      bankName: user.bankName || '',
      bankAccount: user.bankAccount || '',
      pan: user.pan || '',
      pfNumber: user.pfNumber || '',
      pfUan: user.pfUan || '',
      esicNo: user.esicNo || '',
      location: user.location || ''
    })
    setEditOpen(true)
  }

  const handleUpdate = async () => {
    if (!editingUser) return
    setEditError(null)
    if (editFormData.role === 'CUSTOM' && !editCustomRoleName.trim()) {
      setEditError("Please specify a custom role name.")
      return
    }
    setIsSaving(true)
    try {
      const result = (await updateUserComprehensive({
        userId: editingUser._id,
        name: editFormData.name,
        email: editFormData.email,
        role: editFormData.role === 'CUSTOM' ? editCustomRoleName.trim() : editFormData.role,
        designation: editFormData.designation,
        employeeId: formatEmpId(editFormData.employeeId),
        siteId: editFormData.siteId && editFormData.siteId !== 'central' ? (editFormData.siteId as any) : undefined,
        password: editFormData.password || undefined,
        status: editFormData.status,
        phone: editFormData.phone,
        joiningDate: editFormData.joiningDate,
        requiresAttendancePhoto: editFormData.requiresAttendancePhoto,
        bloodGroup: editFormData.bloodGroup || undefined,
        emergencyContact: editFormData.emergencyContact || undefined,
        image: editFormData.image || undefined,
        gender: editFormData.gender || undefined,
        dob: editFormData.dob || undefined,
        address: editFormData.address || undefined,
        bankName: editFormData.bankName || undefined,
        bankAccount: editFormData.bankAccount || undefined,
        pan: editFormData.pan || undefined,
        pfNumber: editFormData.pfNumber || undefined,
        pfUan: editFormData.pfUan || undefined,
        esicNo: editFormData.esicNo || undefined,
        location: editFormData.location || undefined,
      })) as any
      
      if (result.success) {
        setEditOpen(false)
        const targetUserId = editingUser._id
        const targetImage = editFormData.image
        const targetName = editFormData.name
        const targetEmail = editFormData.email
        const targetRole = editFormData.role === 'CUSTOM' ? editCustomRoleName.trim() : editFormData.role
        const targetDesignation = editFormData.designation
        const targetEmployeeId = formatEmpId(editFormData.employeeId)
        const targetPhone = editFormData.phone
        const targetBloodGroup = editFormData.bloodGroup
        const targetEmergencyContact = editFormData.emergencyContact

        setEditingUser(null)
        setEditCustomRoleName('')
        toast({ title: "Intelligence Updated", description: "Member profile synchronized. Regenerating ID Card..." })

        setTimeout(async () => {
          try {
            const profileUrl = targetImage
              ? await convex.query(api.users.getUserProfileImageUrl, { storageId: targetImage })
              : null

            await handleRegenerateIdCard({
              user: {
                _id: targetUserId as any,
                name: targetName,
                email: targetEmail,
                role: targetRole,
                designation: targetDesignation,
                employeeId: targetEmployeeId,
                phone: targetPhone,
                image: targetImage,
                bloodGroup: targetBloodGroup,
                emergencyContact: targetEmergencyContact,
              },
              profileImageUrl: profileUrl || null,
              frontTemplateUrl: frontTemplateUrl || null,
              backTemplateUrl: backTemplateUrl || null,
              requestorEmail: userEmail!,
              generateUploadUrlFn: (args) => generateDocUploadUrl(args),
              saveOfficeIdCardFn: (args) => saveOfficeIdCard(args),
            })
            toast({ title: "Success", description: `Office ID Card regenerated for ${targetName}.` })
          } catch (e: any) {
            console.error("Auto ID Card regeneration failed", e)
            toast({ title: "Warning", variant: "destructive", description: `ID Card compilation failed for ${targetName}: ` + e.message })
          }
        }, 100)
      } else {
        setEditError(result.error || "Failed to update member credentials.")
      }
    } catch (e: any) {
      setEditError("Operational error during update. Please verify connection.")
    } finally {
      setIsSaving(false)
    }
  }

  const getRoleBadge = (role: string) => {
    const baseClass = "border-none text-[10px] px-2 py-0.5 font-black uppercase tracking-widest transition-all"
    switch (role) {
      case 'Owner': return <Badge className={cn(baseClass, "bg-rose-500/20 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]")}>Owner</Badge>
      case 'Project Manager': return <Badge className={cn(baseClass, "bg-amber-500/20 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]")}>Project Manager</Badge>
      case 'Accountant': return <Badge className={cn(baseClass, "bg-blue-500/20 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]")}>Accountant</Badge>
      case 'Staff': return <Badge className={cn(baseClass, "bg-emerald-500/20 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]")}>Staff</Badge>
      default: return <Badge className={cn(baseClass, "bg-indigo-500/20 text-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.1)]")}>{role}</Badge>
    }
  }

  const filteredUsers = users?.filter(u => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.designation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    
    let matchesStatus = false;
    if (statusFilter === 'all') matchesStatus = true;
    else if (statusFilter === 'active') matchesStatus = u.status === 'active' || u.status === 'inactive' || !u.status;
    else if (statusFilter === 'disabled') matchesStatus = u.status === 'disabled';
    else if (statusFilter === 'deleted') matchesStatus = u.status === 'deleted';

    return matchesSearch && matchesRole && matchesStatus;
  }) || [];

  const executeDisable = async () => {
    if (!targetUser || !userEmail) return;
    setIsSaving(true);
    try {
      const res = await disableUser({ userId: targetUser._id, reason: actionReason, requestorEmail: userEmail }) as any;
      if (res.success) {
        toast({ title: "User Disabled", description: `${targetUser.name} has been disabled.` });
        setDisableModalOpen(false); setTargetUser(null); setActionReason('');
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ title: "Action Failed", variant: "destructive", description: e.message || "Failed to disable." });
    } finally { setIsSaving(false); }
  }

  const executeEnable = async () => {
    if (!targetUser || !userEmail) return;
    setIsSaving(true);
    try {
      const res = await enableUser({ userId: targetUser._id, requestorEmail: userEmail }) as any;
      if (res.success) {
        toast({ title: "User Enabled", description: `${targetUser.name} has been restored to active.` });
        setEnableModalOpen(false); setTargetUser(null);
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ title: "Action Failed", variant: "destructive", description: e.message || "Failed to enable." });
    } finally { setIsSaving(false); }
  }

  const executeDelete = async () => {
    if (!targetUser || !userEmail) return;
    setIsSaving(true);
    try {
      const res = await softDeleteUser({ userId: targetUser._id, reason: actionReason, requestorEmail: userEmail }) as any;
      if (res.success) {
        toast({ title: "User Deleted", description: `${targetUser.name} has been marked as deleted.` });
        setDeleteModalOpen(false); setTargetUser(null); setActionReason('');
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ title: "Action Failed", variant: "destructive", description: e.message || "Failed to delete." });
    } finally { setIsSaving(false); }
  }

  const executeRestore = async () => {
    if (!targetUser || !userEmail) return;
    setIsSaving(true);
    try {
      const res = await restoreUser({ userId: targetUser._id, requestorEmail: userEmail }) as any;
      if (res.success) {
        toast({ title: "User Restored", description: `${targetUser.name} has been restored successfully.` });
        setRestoreModalOpen(false); setTargetUser(null);
      } else throw new Error(res.error);
    } catch (e: any) {
      toast({ title: "Action Failed", variant: "destructive", description: e.message || "Failed to restore." });
    } finally { setIsSaving(false); }
  }

  return <div className="space-y-6 pb-20 w-full max-w-full min-w-0 overflow-hidden mx-auto animate-in fade-in duration-700">
      <div className="relative p-6 sm:p-8 rounded-xl bg-slate-950 text-white overflow-hidden shadow-xl border border-white/5">
        <div className="absolute top-[-50%] right-[-10%] w-[40%] h-[200%] bg-primary/10 rounded-full blur-[100px]" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 w-full min-w-0">
          <div className="space-y-2 text-center md:text-left w-full sm:w-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
              Operational Management
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight italic uppercase leading-tight">
              Team Intelligence <span className="text-primary italic">Hub</span>
            </h1>
            <p className="text-slate-400 font-medium text-xs sm:text-sm max-w-lg mx-auto md:mx-0">
              Configure your core operational team. Manage access, credentials, and site assignments with precision.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-center md:justify-end">
            {hasDocPermission && (
              <>
                <Button 
                  onClick={() => { setPreselectedUserId(undefined); setDocGeneratorOpen(true); }}
                  className="w-full sm:w-auto h-14 px-6 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <FileText className="h-4 w-4 text-indigo-400" />
                  Generate Doc
                </Button>

                <Button 
                  onClick={() => { setPreselectedUserId(undefined); setPayrollGeneratorOpen(true); setPayrollMode('payslip'); }}
                  className="w-full sm:w-auto h-14 px-6 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <FileText className="h-4 w-4 text-emerald-400" />
                  Generate Payslips
                </Button>

                <Button 
                  onClick={() => { setPreselectedUserId(undefined); setPayrollGeneratorOpen(true); setPayrollMode('calculator'); }}
                  className="w-full sm:w-auto h-14 px-6 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white rounded-2xl font-bold uppercase tracking-wider text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <DollarSign className="h-4 w-4 text-amber-400" />
                  Calculate Salary
                </Button>
              </>
            )}

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) setRegistrationError(null) }}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto h-14 px-8 bg-primary text-white hover:bg-primary/90 border border-white/10 rounded-2xl font-black italic uppercase tracking-widest text-sm shadow-lg shadow-primary/10 transition-all active:scale-95 group">
                  <UserPlus className="mr-3 h-5 w-5" />
                  Initialize Member
                </Button>
              </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-xl bg-slate-950 border-slate-800 text-white p-0 max-h-[90vh] overflow-y-auto rounded-xl">
              <div className="p-6 sm:p-8 bg-gradient-to-br from-indigo-500/20 to-transparent">
                <DialogHeader>
                  <DialogTitle className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter">New Intelligence Unit</DialogTitle>
                  <DialogDescription className="text-slate-400 font-medium italic">Create a new operative in the team directory.</DialogDescription>
                </DialogHeader>

                {registrationError && (
                  <Alert variant="destructive" className="mt-6 bg-rose-500/10 border-rose-500 text-rose-500 rounded-2xl">
                    <ShieldAlert className="h-5 w-5" />
                    <AlertTitle className="font-black uppercase text-xs tracking-widest">Protocol Breach</AlertTitle>
                    <AlertDescription className="text-xs font-bold leading-relaxed">{registrationError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-6 py-6 sm:py-8">
                  {/* Profile Photo Section */}
                  <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-white/5">
                    <div className="relative group">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-slate-900 flex items-center justify-center border-4 border-slate-800 shadow-xl relative z-10">
                        {newUserProfileImageUrl ? (
                          <img src={newUserProfileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-slate-500">
                            <Users className="h-8 w-8 text-slate-600" />
                            <span className="text-[9px] font-black uppercase tracking-tighter">No Photo</span>
                          </div>
                        )}
                        {isUploadingProfilePhoto && cropperTarget === 'new' && (
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-20">
                            <Loader2 className="h-8 w-8 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                      <label 
                        htmlFor="new-photo-upload" 
                        className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 active:scale-95 transition-all z-30"
                      >
                        <Camera className="h-5 w-5" />
                        <input 
                          id="new-photo-upload" 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleProfilePhotoUpload(e, 'new')}
                          disabled={isUploadingProfilePhoto}
                        />
                      </label>
                    </div>
                    <div className="flex-1 text-center sm:text-left space-y-1">
                      <h4 className="text-sm font-black uppercase tracking-tight text-white">Operative Photo</h4>
                      <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                        Upload a clear headshot. This will be printed on the corporate ID card and used for facial recognition/attendance check-in logs.
                      </p>
                      <div className="pt-2 flex flex-wrap justify-center sm:justify-start gap-2">
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm" 
                          className="h-8 px-3 rounded-xl border-slate-800 bg-slate-900 text-slate-300 hover:text-white font-bold text-xs"
                          onClick={() => document.getElementById('new-photo-upload')?.click()}
                          disabled={isUploadingProfilePhoto}
                        >
                          Upload Photo
                        </Button>
                        {newUser.image && (
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-3 rounded-xl text-rose-500 hover:bg-rose-500/10 hover:text-rose-400 font-bold text-xs"
                            onClick={() => setNewUser(prev => ({ ...prev, image: '' }))}
                            disabled={isUploadingProfilePhoto}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Operative Name</Label>
                      <Input
                        placeholder="e.g. ARJUN MEHTA"
                        className="h-14 bg-white/5 border-white/10 rounded-2xl focus:ring-primary focus:border-primary text-sm font-bold placeholder:text-slate-600"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Secure Email</Label>
                      <Input
                        type="email"
                        placeholder="name@example.com"
                        className="h-14 bg-white/5 border-white/10 rounded-2xl focus:ring-primary focus:border-primary text-sm font-bold placeholder:text-slate-600"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contact Phone</Label>
                      <Input 
                        placeholder="+91 XXXXX XXXXX" 
                        className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold italic" 
                        value={newUser.phone} 
                        onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Initialization Password</Label>
                      <div className="relative">
                        <PasswordInput
                          placeholder="••••••••••••"
                          className="h-14 bg-white/5 border-white/10 rounded-2xl focus:ring-primary focus:border-primary text-sm font-bold"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Primary Role</Label>
                      <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                        <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold">
                          <SelectValue placeholder="ROLE" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
                          {roles?.map((role) => (
                            <SelectItem key={role._id} value={role.name} className="focus:bg-primary/20 rounded-xl">
                              {role.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="CUSTOM" className="focus:bg-primary/20 rounded-xl">
                            Custom Role...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newUser.role === 'CUSTOM' && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Custom Role Name</Label>
                        <Input
                          placeholder="e.g. Senior Supervisor"
                          className="h-14 bg-white/5 border-white/10 rounded-2xl focus:ring-primary focus:border-primary text-sm font-bold placeholder:text-slate-600"
                          value={customRoleName}
                          onChange={(e) => setCustomRoleName(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Assigned Site</Label>
                      <Select value={newUser.siteId} onValueChange={(value) => setNewUser({ ...newUser, siteId: value })}>
                        <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold">
                          <SelectValue placeholder="SITE" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
                          <SelectItem value="central" className="focus:bg-primary/20 rounded-xl">Central Unit</SelectItem>
                          {sites?.map((site) => (
                            <SelectItem key={site._id} value={site._id} className="focus:bg-primary/20 rounded-xl">
                              {site.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Joining Date</Label>
                      <Input
                        type="date"
                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold"
                        value={newUser.joiningDate}
                        onChange={(e) => setNewUser({ ...newUser, joiningDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Employee ID</Label>
                      <Input
                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                        placeholder="e.g. EMP-101"
                        value={newUser.employeeId}
                        onChange={(e) => setNewUser({ ...newUser, employeeId: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Designation</Label>
                      <Input
                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                        placeholder="e.g. Site Engineer"
                        value={newUser.designation}
                        onChange={(e) => setNewUser({ ...newUser, designation: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Gender</Label>
                      <Select value={newUser.gender} onValueChange={(value) => setNewUser({ ...newUser, gender: value })}>
                        <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold">
                          <SelectValue placeholder="Gender" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
                          <SelectItem value="Male" className="focus:bg-primary/20 rounded-xl">Male</SelectItem>
                          <SelectItem value="Female" className="focus:bg-primary/20 rounded-xl">Female</SelectItem>
                          <SelectItem value="Other" className="focus:bg-primary/20 rounded-xl">Other</SelectItem>
                          <SelectItem value="Prefer not to say" className="focus:bg-primary/20 rounded-xl">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Date of Birth</Label>
                      <Input
                        type="date"
                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold"
                        value={newUser.dob}
                        onChange={(e) => setNewUser({ ...newUser, dob: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Blood Group</Label>
                      <Input
                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                        placeholder="e.g. O+ / B+"
                        value={newUser.bloodGroup}
                        onChange={(e) => setNewUser({ ...newUser, bloodGroup: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Emergency Contact</Label>
                      <Input
                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                        placeholder="Emergency phone number"
                        value={newUser.emergencyContact}
                        onChange={(e) => setNewUser({ ...newUser, emergencyContact: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Correspondence Address</Label>
                      <Textarea
                        className="bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600 min-h-[80px]"
                        placeholder="Operative's full correspondence address..."
                        value={newUser.address}
                        onChange={(e) => setNewUser({ ...newUser, address: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Bank Name</Label>
                      <Input
                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                        placeholder="e.g. HDFC Bank"
                        value={newUser.bankName}
                        onChange={(e) => setNewUser({ ...newUser, bankName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Bank Account Number</Label>
                      <Input
                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                        placeholder="e.g. 50100234567890"
                        value={newUser.bankAccount}
                        onChange={(e) => setNewUser({ ...newUser, bankAccount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">PAN</Label>
                      <Input
                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                        placeholder="e.g. ABCDE1234F"
                        value={newUser.pan}
                        onChange={(e) => setNewUser({ ...newUser, pan: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Location</Label>
                      <Input
                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                        placeholder="e.g. Mumbai"
                        value={newUser.location}
                        onChange={(e) => setNewUser({ ...newUser, location: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">PF Number</Label>
                      <Input
                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                        placeholder="e.g. MH/BAN/12345/678"
                        value={newUser.pfNumber}
                        onChange={(e) => setNewUser({ ...newUser, pfNumber: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">PF UAN</Label>
                      <Input
                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                        placeholder="e.g. 100987654321"
                        value={newUser.pfUan}
                        onChange={(e) => setNewUser({ ...newUser, pfUan: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">ESIC Number</Label>
                      <Input
                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                        placeholder="e.g. 31123456780011001"
                        value={newUser.esicNo}
                        onChange={(e) => setNewUser({ ...newUser, esicNo: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 italic">Site Photo Proof</Label>
                      <button 
                        type="button"
                        onClick={() => setNewUser({ ...newUser, requiresAttendancePhoto: !newUser.requiresAttendancePhoto })}
                        className={cn(
                          "w-full h-14 rounded-2xl font-black uppercase tracking-widest text-[9px] transition-all border",
                          newUser.requiresAttendancePhoto 
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-lg shadow-rose-500/5" 
                            : "bg-white/5 border-white/10 text-slate-500"
                        )}
                      >
                        {newUser.requiresAttendancePhoto ? "Mandatory Photo" : "Photo Optional"}
                      </button>
                    </div>
                  </div>
                </div>

                <DialogFooter className="pt-4 border-t border-white/5">
                  <Button 
                    onClick={handleAddUser} 
                    className="w-full h-16 bg-primary text-white hover:bg-indigo-600 font-black italic uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20" 
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : "Deploy Operative"}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-10">
        <div className="lg:col-span-1 space-y-8">
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl border-white/20 dark:border-slate-800/50 rounded-xl shadow-2xl p-6 sm:p-8 lg:sticky lg:top-10">
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary italic mb-2">Search Registry</h3>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="NAME OR EMAIL..." 
                    className="h-12 bg-white/50 dark:bg-black/20 border-white/20 dark:border-slate-700/50 rounded-2xl pl-12 text-xs font-bold uppercase tracking-widest"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary italic mb-4">Functional Filters</h3>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                  <button 
                    onClick={() => setRoleFilter('all')}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-bold text-[10px] sm:text-xs uppercase tracking-widest",
                      roleFilter === 'all' ? "bg-primary text-white shadow-lg" : "hover:bg-primary/5 text-slate-500"
                    )}
                  >
                    All Operatives
                    <ShieldCheck className="h-4 w-4 hidden sm:block" />
                  </button>
                  {roles?.map(role => {
                    const getRoleIcon = (roleName: string) => {
                      switch (roleName) {
                        case 'Owner': return <ShieldAlert className="h-4 w-4 opacity-50" />
                        case 'Project Manager': return <Briefcase className="h-4 w-4 opacity-50" />
                        case 'Accountant': return <DollarSign className="h-5 w-5 opacity-50" />
                        case 'Staff': return <Users className="h-4 w-4 opacity-50" />
                        default: return <UserPlus className="h-4 w-4 opacity-50" />
                      }
                    }
                    return (
                      <button 
                        key={role._id}
                        onClick={() => setRoleFilter(role.name)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-bold text-[10px] sm:text-xs uppercase tracking-widest",
                          roleFilter === role.name ? "bg-primary text-white shadow-lg" : "hover:bg-primary/5 text-slate-500"
                        )}
                      >
                        {role.name}
                        <div className="hidden sm:block">{getRoleIcon(role.name)}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary italic mb-4">Access Status</h3>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                  <button 
                    onClick={() => setStatusFilter('all')}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-bold text-[10px] sm:text-xs uppercase tracking-widest",
                      statusFilter === 'all' ? "bg-primary text-white shadow-lg" : "hover:bg-primary/5 text-slate-500"
                    )}
                  >
                    All Users
                  </button>
                  <button 
                    onClick={() => setStatusFilter('active')}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-bold text-[10px] sm:text-xs uppercase tracking-widest",
                      statusFilter === 'active' ? "bg-emerald-500 text-white shadow-lg" : "hover:bg-emerald-500/10 text-slate-500"
                    )}
                  >
                    Active
                  </button>
                  <button 
                    onClick={() => setStatusFilter('disabled')}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-bold text-[10px] sm:text-xs uppercase tracking-widest",
                      statusFilter === 'disabled' ? "bg-amber-500 text-white shadow-lg" : "hover:bg-amber-500/10 text-slate-500"
                    )}
                  >
                    Disabled
                  </button>
                  <button 
                    onClick={() => setStatusFilter('deleted')}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-bold text-[10px] sm:text-xs uppercase tracking-widest",
                      statusFilter === 'deleted' ? "bg-rose-500 text-white shadow-lg" : "hover:bg-rose-500/10 text-slate-500"
                    )}
                  >
                    Deleted
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  <span>Directory Status</span>
                  <span>{filteredUsers.length} ONLINE</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[75%]" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl border-white/20 dark:border-slate-800/50 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center justify-between mb-8 pb-6 border-b border-white/10 dark:border-slate-800 gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-primary/10 rounded-xl">
                    <Briefcase className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter">Team Directory</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Full access and audit history</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-slate-500/5 border-slate-200 dark:border-slate-800 text-slate-500 px-3 py-1 rounded-lg font-black italic uppercase tracking-widest text-[9px]">
                  {filteredUsers.length} Records
                </Badge>
              </div>

              <div className="space-y-6">
                {!users ? (
                  <div className="flex flex-col items-center justify-center py-20 sm:py-32 space-y-4">
                    <Loader2 className="animate-spin h-10 sm:h-12 w-10 sm:w-12 text-primary" />
                    <span className="text-xs font-black uppercase tracking-[0.4em] text-slate-400">Syncing Registry...</span>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-20 sm:py-32 space-y-4">
                    <div className="inline-flex p-6 bg-slate-100 dark:bg-slate-800 rounded-full">
                      <Search className="h-8 sm:h-10 w-8 sm:w-10 text-slate-400" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter">No Operatives Found</h3>
                    <p className="text-slate-400 font-medium italic text-sm">Try adjusting your search or role filters.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    <AnimatePresence mode='popLayout'>
                      {filteredUsers.map((item, idx) => (
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: idx * 0.05 }}
                          key={item._id}
                          onClick={() => { setSelectedUserForDetails(item); setDetailsOpen(true); }}
                          className="group relative p-4 sm:p-6 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all duration-300 shadow-sm cursor-pointer"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                            <div className="flex items-center gap-4 sm:gap-6">
                              <div className="relative shrink-0">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-black text-lg border border-white/10 shadow-lg shadow-primary/10 transition-transform group-hover:scale-105">
                                  {item.name?.[0]?.toUpperCase()}
                                </div>
                                <div className={cn(
                                  "absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-lg border-2 border-slate-900 flex items-center justify-center",
                                  item.status === 'active' ? "bg-emerald-500" : "bg-rose-500"
                                )}>
                                  <div className="w-1.5 h-1.5 rounded-full bg-white transition-transform group-hover:scale-125" />
                                </div>
                              </div>
                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                  <h3 className="text-base sm:text-lg font-black italic uppercase tracking-tighter group-hover:text-primary transition-colors leading-none truncate">{item.name}</h3>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {getRoleBadge(item.role)}
                                    {item.employeeId && (
                                      <Badge variant="outline" className="border-white/10 bg-white/5 text-[9px] px-2 py-0.5 font-black uppercase tracking-widest text-slate-400 shadow-sm">
                                        ID: {item.employeeId}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-1.5 text-[9px] sm:text-[10px] font-bold text-slate-400 tracking-widest">
                                  <span className="flex items-center gap-1.5 lowercase tracking-normal truncate"><Mail className="h-3 w-3 text-slate-500 shrink-0" /> {item.email}</span>
                                  {item.phone && <span className="flex items-center gap-1.5"><PhoneIcon className="h-3 w-3 text-slate-500 shrink-0" /> {item.phone}</span>}
                                  <span className="flex items-center gap-1.5 uppercase"><Briefcase className="h-3 w-3 text-slate-500 shrink-0" /> {item.designation || 'N/A'}</span>
                                  <span className="flex items-center gap-1.5 uppercase"><MapPin className="h-3 w-3 text-slate-500 shrink-0" /> {sites?.find(s => s._id === item.siteId)?.name || 'Central Unit'}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 pt-4 sm:pt-0 border-t sm:border-0 border-white/5" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all shadow-lg"
                                  >
                                    <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-slate-950 border-slate-800 text-white w-48 rounded-xl p-1.5 shadow-2xl">
                                  {hasDocPermission && (
                                    <>
                                      <DropdownMenuItem 
                                        onClick={() => { setPreselectedUserId(item._id); setDocGeneratorOpen(true); }}
                                        className="hover:bg-white/5 rounded-lg font-bold text-xs py-2.5 px-3 flex items-center gap-2 cursor-pointer"
                                      >
                                        <FileText className="h-3.5 w-3.5 text-indigo-400" />
                                        Generate Document
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => { setPreselectedUserId(item._id); setPayrollGeneratorOpen(true); setPayrollMode('payslip'); }}
                                        className="hover:bg-white/5 rounded-lg font-bold text-xs py-2.5 px-3 flex items-center gap-2 cursor-pointer"
                                      >
                                        <FileText className="h-3.5 w-3.5 text-emerald-400" />
                                        Generate Payslip
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => { setPreselectedUserId(item._id); setPayrollGeneratorOpen(true); setPayrollMode('calculator'); }}
                                        className="hover:bg-white/5 rounded-lg font-bold text-xs py-2.5 px-3 flex items-center gap-2 cursor-pointer"
                                      >
                                        <DollarSign className="h-3.5 w-3.5 text-amber-400" />
                                        Calculate Salary
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator className="bg-white/5 my-1" />
                                    </>
                                  )}
                                  <DropdownMenuItem 
                                    onClick={() => { setSelectedUserForDetails(item); setDetailsOpen(true); }}
                                    className="hover:bg-white/5 rounded-lg font-bold text-xs py-2.5 px-3 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                                    View Documents
                                  </DropdownMenuItem>
                                  
                                  {(!item.status || item.status === 'active' || item.status === 'inactive') && (
                                    <>
                                      <DropdownMenuItem 
                                        onClick={() => handleEditUser(item)}
                                        className="hover:bg-white/5 rounded-lg font-bold text-xs py-2.5 px-3 flex items-center gap-2 cursor-pointer"
                                      >
                                        <Edit2 className="h-3.5 w-3.5 text-primary" />
                                        Edit Profile
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => { setTargetUser(item); setDisableModalOpen(true); }}
                                        className="hover:bg-white/5 rounded-lg font-bold text-xs py-2.5 px-3 flex items-center gap-2 text-amber-400 cursor-pointer"
                                      >
                                        <XCircle className="h-3.5 w-3.5" />
                                        Disable User
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => { setTargetUser(item); setDeleteModalOpen(true); }}
                                        className="hover:bg-white/5 rounded-lg font-bold text-xs py-2.5 px-3 flex items-center gap-2 text-rose-500 cursor-pointer"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                        Delete User
                                      </DropdownMenuItem>
                                    </>
                                  )}

                                  {item.status === 'disabled' && (
                                    <>
                                      <DropdownMenuItem 
                                        onClick={() => { setTargetUser(item); setEnableModalOpen(true); }}
                                        className="hover:bg-white/5 rounded-lg font-bold text-xs py-2.5 px-3 flex items-center gap-2 text-emerald-400 cursor-pointer"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                        Enable User
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => { setTargetUser(item); setDeleteModalOpen(true); }}
                                        className="hover:bg-white/5 rounded-lg font-bold text-xs py-2.5 px-3 flex items-center gap-2 text-rose-500 cursor-pointer"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                        Delete User
                                      </DropdownMenuItem>
                                    </>
                                  )}

                                  {item.status === 'deleted' && (
                                    <DropdownMenuItem 
                                      onClick={() => { setTargetUser(item); setRestoreModalOpen(true); }}
                                      className="hover:bg-white/5 rounded-lg font-bold text-xs py-2.5 px-3 flex items-center gap-2 text-emerald-400 cursor-pointer"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                      Restore User
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl bg-slate-950 border-slate-800 text-white p-0 max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl">
          <Tabs defaultValue="profile" className="w-full">
            <div className="px-6 sm:px-10 pt-6 sm:pt-10 pb-6 bg-gradient-to-br from-primary/10 to-transparent">
              <DialogHeader className="mb-6 sm:mb-8">
                <DialogTitle className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter flex items-center gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary flex items-center justify-center font-black">
                    {editingUser?.name?.[0]?.toUpperCase()}
                  </div>
                  Member Profile Suite
                </DialogTitle>
                <DialogDescription className="text-slate-400 font-medium italic mt-1 text-xs sm:text-sm">Configure operative access and security levels.</DialogDescription>
              </DialogHeader>

              <TabsList className="bg-white/5 p-1.5 rounded-2xl border border-white/5 w-full h-auto flex flex-wrap sm:flex-nowrap gap-1">
                <TabsTrigger value="profile" className="flex-1 rounded-xl h-10 sm:h-12 font-black uppercase tracking-widest text-[9px] sm:text-[10px] data-[state=active]:bg-primary data-[state=active]:text-white">Profile Identity</TabsTrigger>
                <TabsTrigger value="security" className="flex-1 rounded-xl h-10 sm:h-12 font-black uppercase tracking-widest text-[9px] sm:text-[10px] data-[state=active]:bg-rose-500 data-[state=active]:text-white">Security Suite</TabsTrigger>
                <TabsTrigger value="status" className="flex-1 rounded-xl h-10 sm:h-12 font-black uppercase tracking-widest text-[9px] sm:text-[10px] data-[state=active]:bg-emerald-500 data-[state=active]:text-white">Status Monitor</TabsTrigger>
              </TabsList>
            </div>

            <div className="p-6 sm:p-10 space-y-6 min-h-[300px] sm:min-h-[400px]">
              {editError && (
                <Alert variant="destructive" className="bg-rose-500/10 border-rose-500 text-rose-500 rounded-2xl">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle className="font-black uppercase text-[10px] tracking-widest">Update Error</AlertTitle>
                  <AlertDescription className="text-xs font-bold leading-relaxed">{editError}</AlertDescription>
                </Alert>
              )}

              <TabsContent value="profile" className="m-0 space-y-6">
                {/* Profile Photo Section */}
                <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-white/5">
                  <div className="relative group">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-slate-900 flex items-center justify-center border-4 border-slate-800 shadow-xl relative z-10">
                      {editingUserProfileImageUrl ? (
                        <img src={editingUserProfileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-500">
                          <Users className="h-8 w-8 text-slate-600" />
                          <span className="text-[9px] font-black uppercase tracking-tighter">No Photo</span>
                        </div>
                      )}
                      {isUploadingProfilePhoto && cropperTarget === 'edit' && (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-20">
                          <Loader2 className="h-8 w-8 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                    <label 
                      htmlFor="edit-photo-upload" 
                      className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 active:scale-95 transition-all z-30"
                    >
                      <Camera className="h-5 w-5" />
                      <input 
                        id="edit-photo-upload" 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleProfilePhotoUpload(e, 'edit')}
                        disabled={isUploadingProfilePhoto}
                      />
                    </label>
                  </div>
                  <div className="flex-1 text-center sm:text-left space-y-1">
                    <h4 className="text-sm font-black uppercase tracking-tight text-white">Operative Photo</h4>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                      Upload a clear headshot. This will be printed on the corporate ID card and used for facial recognition/attendance check-in logs.
                    </p>
                    <div className="pt-2 flex flex-wrap justify-center sm:justify-start gap-2">
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm" 
                        className="h-8 px-3 rounded-xl border-slate-800 bg-slate-900 text-slate-300 hover:text-white font-bold text-xs"
                        onClick={() => document.getElementById('edit-photo-upload')?.click()}
                        disabled={isUploadingProfilePhoto}
                      >
                        Upload Photo
                      </Button>
                      {editFormData.image && (
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-3 rounded-xl text-rose-500 hover:bg-rose-500/10 hover:text-rose-400 font-bold text-xs"
                          onClick={() => setEditFormData(prev => ({ ...prev, image: '' }))}
                          disabled={isUploadingProfilePhoto}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Member Name</Label>
                    <Input 
                      className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold" 
                      value={editFormData.name} 
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</Label>
                    <Input 
                      className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold" 
                      value={editFormData.email} 
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Role Architecture</Label>
                    <Select value={editFormData.role} onValueChange={(value) => setEditFormData({ ...editFormData, role: value })}>
                      <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">
                        {roles?.map((r: any) => (
                          <SelectItem key={r._id} value={r.name} className="py-3 focus:bg-primary/20">{r.name}</SelectItem>
                        ))}
                        <SelectItem value="CUSTOM" className="py-3 focus:bg-primary/20">Custom Role...</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {editFormData.role === 'CUSTOM' && (
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Custom Role Name</Label>
                      <Input
                        placeholder="e.g. Senior Supervisor"
                        className="h-14 bg-white/5 border-white/10 rounded-2xl focus:ring-primary focus:border-primary text-sm font-bold placeholder:text-slate-600"
                        value={editCustomRoleName}
                        onChange={(e) => setEditCustomRoleName(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contact Phone</Label>
                    <Input 
                      className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold" 
                      value={editFormData.phone} 
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Operational Site</Label>
                    <Select value={editFormData.siteId} onValueChange={(value) => setEditFormData({ ...editFormData, siteId: value })}>
                      <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">
                         <SelectItem value="central" className="py-3 focus:bg-primary/20">Central Unit</SelectItem>
                        {sites?.map((s: any) => (
                          <SelectItem key={s._id} value={s._id} className="py-3 focus:bg-primary/20">{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Joining Date</Label>
                    <Input
                      type="date"
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold"
                      value={editFormData.joiningDate}
                      onChange={(e) => setEditFormData({ ...editFormData, joiningDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Designation</Label>
                    <Input
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                      value={editFormData.designation}
                      onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Gender</Label>
                    <Select value={editFormData.gender} onValueChange={(value) => setEditFormData({ ...editFormData, gender: value })}>
                      <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold">
                        <SelectValue placeholder="Gender" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
                        <SelectItem value="Male" className="focus:bg-primary/20 rounded-xl">Male</SelectItem>
                        <SelectItem value="Female" className="focus:bg-primary/20 rounded-xl">Female</SelectItem>
                        <SelectItem value="Other" className="focus:bg-primary/20 rounded-xl">Other</SelectItem>
                        <SelectItem value="Prefer not to say" className="focus:bg-primary/20 rounded-xl">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Date of Birth</Label>
                    <Input
                      type="date"
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold"
                      value={editFormData.dob}
                      onChange={(e) => setEditFormData({ ...editFormData, dob: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Blood Group</Label>
                    <Input
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                      value={editFormData.bloodGroup}
                      onChange={(e) => setEditFormData({ ...editFormData, bloodGroup: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Emergency Contact</Label>
                    <Input
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                      value={editFormData.emergencyContact}
                      onChange={(e) => setEditFormData({ ...editFormData, emergencyContact: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Employee ID</Label>
                    <Input
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                      value={editFormData.employeeId}
                      onChange={(e) => setEditFormData({ ...editFormData, employeeId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Bank Name</Label>
                    <Input
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                      placeholder="e.g. HDFC Bank"
                      value={editFormData.bankName}
                      onChange={(e) => setEditFormData({ ...editFormData, bankName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Bank Account Number</Label>
                    <Input
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                      placeholder="e.g. 50100234567890"
                      value={editFormData.bankAccount}
                      onChange={(e) => setEditFormData({ ...editFormData, bankAccount: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">PAN</Label>
                    <Input
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                      placeholder="e.g. ABCDE1234F"
                      value={editFormData.pan}
                      onChange={(e) => setEditFormData({ ...editFormData, pan: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Location</Label>
                    <Input
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                      placeholder="e.g. Mumbai"
                      value={editFormData.location}
                      onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">PF Number</Label>
                    <Input
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                      placeholder="e.g. MH/BAN/12345/678"
                      value={editFormData.pfNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, pfNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">PF UAN</Label>
                    <Input
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                      placeholder="e.g. 100987654321"
                      value={editFormData.pfUan}
                      onChange={(e) => setEditFormData({ ...editFormData, pfUan: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">ESIC Number</Label>
                    <Input
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600"
                      placeholder="e.g. 31123456780011001"
                      value={editFormData.esicNo}
                      onChange={(e) => setEditFormData({ ...editFormData, esicNo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Correspondence Address</Label>
                    <Textarea
                      className="bg-white/5 border-white/10 rounded-2xl text-sm font-bold placeholder:text-slate-600 min-h-[80px]"
                      placeholder="Operative's correspondence address..."
                      value={editFormData.address}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="security" className="m-0 space-y-8">
                <div className="p-8 rounded-xl bg-rose-500/5 border border-rose-500/10 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-rose-500/20 rounded-2xl text-rose-500">
                      <Lock className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black italic uppercase tracking-tighter text-rose-500 leading-none">Credential Override</h4>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Leave blank to maintain current access</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Set New Secure Password</Label>
                    <PasswordInput 
                      placeholder="NEW PASSWORD (OPTIONAL)" 
                      className="h-16 bg-black/20 border-white/5 rounded-2xl focus:ring-rose-500 focus:border-rose-500 text-sm font-bold"
                      value={editFormData.password}
                      onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                    />
                  </div>
                  <p className="text-[10px] font-medium italic text-slate-500 leading-relaxed px-2">
                    Setting a new password will instantly override the member's current credentials. They must be notified manually of the change.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="status" className="m-0 space-y-8">
                <div className="p-8 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-6">
                   <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-500">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black italic uppercase tracking-tighter text-emerald-500 leading-none">Security Status Monitor</h4>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Toggle active operational status</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-6 bg-black/20 rounded-2xl border border-white/5">
                    <div className="space-y-1">
                      <span className="text-sm font-bold">Account Access Token</span>
                      <p className="text-[10px] font-medium text-slate-400">Determines if the member can access the system</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, status: editFormData.status === 'active' ? 'inactive' : 'active' })}
                      className={cn(
                        "flex items-center gap-3 px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all",
                        editFormData.status === 'active' ? "bg-emerald-500/20 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]" : "bg-rose-500/20 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.1)]"
                      )}
                    >
                      {editFormData.status === 'active' ? (
                        <><CheckCircle2 className="h-4 w-4" /> ACTIVE OPERATIVE</>
                      ) : (
                        <><XCircle className="h-4 w-4" /> ACCESS REVOKED</>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-6 bg-black/20 rounded-2xl border border-white/5">
                    <div className="space-y-1">
                      <span className="text-sm font-bold">Attendance Photo Verification</span>
                      <p className="text-[10px] font-medium text-slate-400">Enforce mandatory site photo proof during check-in</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, requiresAttendancePhoto: !editFormData.requiresAttendancePhoto })}
                      className={cn(
                        "flex items-center gap-3 px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all border",
                        editFormData.requiresAttendancePhoto 
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.1)]" 
                          : "bg-white/5 border-white/10 text-slate-500"
                      )}
                    >
                      {editFormData.requiresAttendancePhoto ? (
                        <><Camera className="h-4 w-4" /> PHOTO MANDATORY</>
                      ) : (
                        <><Camera className="h-4 w-4" /> PHOTO OPTIONAL</>
                      )}
                    </button>
                  </div>
                </div>
              </TabsContent>
            </div>

            <div className="p-10 border-t border-white/5 bg-black/20">
              <DialogFooter>
                <Button 
                  onClick={handleUpdate} 
                  className="w-full h-18 py-8 bg-primary hover:bg-indigo-600 text-white font-black italic uppercase tracking-widest text-lg rounded-xl shadow-xl shadow-primary/20" 
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : "Commit Intelligence Changes"}
                </Button>
              </DialogFooter>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Dialog: User Details / Docs Monitor */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl bg-slate-950 border-slate-800 text-white p-0 max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl">
          {selectedUserForDetails && (
            <div className="flex flex-col">
              {/* Header profile bar */}
              <div className="p-6 sm:p-10 bg-gradient-to-br from-primary/10 to-transparent border-b border-white/5 flex flex-col sm:flex-row items-center gap-6">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-black text-3xl border-2 border-white/10 shadow-xl">
                    {selectedUserForDetails.name?.[0]?.toUpperCase()}
                  </div>
                  <div className={cn(
                    "absolute -bottom-1 -right-1 w-5 h-5 rounded-lg border-2 border-slate-955 flex items-center justify-center",
                    selectedUserForDetails.status === 'active' ? "bg-emerald-500" : "bg-rose-500"
                  )}>
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                </div>
                
                <div className="space-y-1.5 text-center sm:text-left min-w-0 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <DialogTitle className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter truncate text-white leading-none">{selectedUserForDetails.name}</DialogTitle>
                    <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                      {getRoleBadge(selectedUserForDetails.role)}
                      {selectedUserForDetails.employeeId && (
                        <Badge variant="outline" className="border-white/10 bg-white/5 text-[9px] px-2 py-0.5 font-black uppercase tracking-widest text-slate-400">
                          ID: {selectedUserForDetails.employeeId}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1">
                    <span>{selectedUserForDetails.designation || "Staff Member"}</span>
                    <span>•</span>
                    <span>{sites?.find(s => s._id === selectedUserForDetails.siteId)?.name || 'Central Unit'}</span>
                  </p>
                </div>
              </div>

              {/* Body Content */}
              <div className="p-6 sm:p-10 space-y-8">
                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white/5 p-6 rounded-2xl border border-white/5">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Mail className="h-3 w-3" /> Email Address
                    </span>
                    <div className="text-sm font-bold text-slate-200 truncate">{selectedUserForDetails.email}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <PhoneIcon className="h-3 w-3" /> Contact Phone
                    </span>
                    <div className="text-sm font-bold text-slate-200">{selectedUserForDetails.phone || "N/A"}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" /> Date of Joining
                    </span>
                    <div className="text-sm font-bold text-slate-200 tabular-nums">
                      {selectedUserForDetails.joiningDate ? new Date(selectedUserForDetails.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : "N/A"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Camera className="h-3 w-3" /> Attendance Photo Proof
                    </span>
                    <div className="text-sm font-bold text-slate-200 uppercase tracking-widest text-xs flex items-center gap-1">
                      {selectedUserForDetails.requiresAttendancePhoto ? (
                        <span className="text-rose-400">Photo Proof Mandatory</span>
                      ) : (
                        <span className="text-slate-400">Photo Proof Optional</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      🚻 Gender
                    </span>
                    <div className="text-sm font-bold text-slate-200 uppercase">{selectedUserForDetails.gender || "N/A"}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      🎂 Date of Birth
                    </span>
                    <div className="text-sm font-bold text-slate-200 tabular-nums">
                      {selectedUserForDetails.dob ? new Date(selectedUserForDetails.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : "N/A"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      🩸 Blood Group
                    </span>
                    <div className="text-sm font-bold text-slate-200 uppercase">{selectedUserForDetails.bloodGroup || "N/A"}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      🚨 Emergency Contact
                    </span>
                    <div className="text-sm font-bold text-slate-200">{selectedUserForDetails.emergencyContact || "N/A"}</div>
                  </div>
                  {selectedUserForDetails.address && (
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        📍 Correspondence Address
                      </span>
                      <div className="text-sm font-bold text-slate-200 whitespace-pre-wrap">{selectedUserForDetails.address}</div>
                    </div>
                  )}
                </div>

                {/* Documents section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <h4 className="text-sm font-black italic uppercase tracking-tighter flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Uploaded Documents Vault
                    </h4>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                      {selectedUserDocs === undefined ? "Syncing..." : `${selectedUserDocs.length} Files`}
                    </span>
                  </div>

                  {selectedUserDocs === undefined ? (
                    <div className="flex items-center justify-center py-10 gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-xs font-bold text-slate-500 italic">Syncing file records...</span>
                    </div>
                  ) : selectedUserDocs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-12 bg-white/5 border border-dashed border-white/10 rounded-2xl p-6 gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-tight block">No Documents Found</span>
                        <span className="text-[10px] text-slate-500 italic block max-w-xs leading-normal">
                          This operative hasn't uploaded any ID proofs, certificates, or work documents yet.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                      {selectedUserDocs.map((doc) => (
                        <div key={doc._id} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all flex items-center justify-between gap-4 group">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
                              {getDocTypeIcon(doc.documentType)}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-slate-200 block truncate" title={doc.documentTitle}>{doc.documentTitle}</span>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter truncate block mt-0.5 font-bold">
                                {doc.documentType} • {formatBytes(doc.fileSize)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button 
                              variant="outline" 
                              size="icon" 
                              onClick={() => triggerDocumentPreview(doc)}
                              className="h-8 w-8 rounded-lg border-white/10 bg-white/5 hover:bg-primary hover:text-white transition-all"
                              title="Preview"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="icon" 
                              onClick={() => triggerDocumentDownload(doc)}
                              className="h-8 w-8 rounded-lg border-white/10 bg-white/5 hover:bg-emerald-500 hover:text-white transition-all"
                              title="Download"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="icon" 
                              onClick={() => { setDocToDelete(doc); setIsConfirmDeleteDocOpen(true); }}
                              className="h-8 w-8 rounded-lg border-white/10 bg-white/5 hover:bg-rose-500 hover:text-white transition-all"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 sm:p-10 border-t border-white/5 bg-black/20 flex flex-col sm:flex-row gap-3 justify-end rounded-b-3xl">
                <Button 
                  variant="outline"
                  onClick={() => { setDetailsOpen(false); handleEditUser(selectedUserForDetails); }}
                  className="h-12 px-6 rounded-xl border-white/10 bg-white/5 hover:bg-primary hover:text-white font-bold uppercase tracking-widest text-[10px]"
                >
                  <Edit2 className="h-4 w-4 mr-2" /> Edit Profile Suite
                </Button>
                <Button 
                  onClick={() => setDetailsOpen(false)}
                  className="h-12 px-6 bg-slate-800 text-white hover:bg-slate-700 font-bold uppercase tracking-widest text-[10px] rounded-xl"
                >
                  Close Directory View
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Document Intelligence Preview */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl bg-slate-950 text-white border-slate-800 rounded-3xl p-0 max-h-[92vh] overflow-y-auto">
          <div className="p-6 sm:p-8 space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <Eye className="h-5 w-5" />
                </div>
                Document Intelligence Preview
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-medium italic mt-1">
                Secure temporary preview environment. Access has been audited.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-black/40 p-4 rounded-xl text-xs border border-white/5">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Document Title</span>
                  <div className="font-bold text-slate-200">{previewDoc?.documentTitle}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Document Type</span>
                  <div>
                    <Badge className="bg-indigo-500/10 text-indigo-500 border-none font-bold uppercase tracking-widest text-[8px] px-1.5 py-0.5 mt-0.5">
                      {previewDoc?.documentType}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Owner / User</span>
                  <div className="font-bold text-slate-200">{previewDoc?.userName}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">File Size</span>
                  <div className="font-bold text-slate-200 tabular-nums">{previewDoc ? formatBytes(previewDoc.fileSize) : "-"}</div>
                </div>
              </div>

              {previewDoc?.notes && (
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Document Notes</span>
                  <p className="text-xs text-slate-400 italic bg-black/20 p-3 rounded-xl border border-white/5">
                    {previewDoc.notes}
                  </p>
                </div>
              )}

              {/* Preview Block */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950 flex flex-col items-center justify-center p-8 min-h-[220px] max-h-[400px] relative">
                {isLoadingPreview ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                    <span className="text-xs font-bold text-slate-500 italic">Generating secure link...</span>
                  </div>
                ) : previewUrl ? (
                  previewDoc.fileType.startsWith("image/") ? (
                    <img src={previewUrl} alt={previewDoc.documentTitle} className="max-w-full max-h-[300px] object-contain rounded-lg shadow-2xl" />
                  ) : previewDoc.fileType === "application/pdf" ? (
                    <div className="w-full h-full min-h-[320px] flex flex-col">
                      <iframe 
                        src={`${previewUrl}#toolbar=0`} 
                        className="w-full h-[320px] border border-slate-800 bg-white rounded-xl"
                        title={previewDoc.documentTitle}
                      />
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                        <span className="font-bold truncate max-w-[70%]}">{previewDoc.fileName}</span>
                        <Button 
                          variant="link"
                          type="button"
                          onClick={() => window.open(previewUrl, "_blank")}
                          className="h-auto p-0 text-indigo-400 hover:text-indigo-300 font-bold text-xs"
                        >
                          Open Full View ↗
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-4 text-center">
                      <File className="h-16 w-16 text-slate-400" />
                      <div className="space-y-2">
                        <span className="text-xs font-bold block">{previewDoc.fileName}</span>
                        <span className="text-[10px] text-slate-500 max-w-sm block italic">
                          Preview is not supported for Word files or other documents on this dashboard view. Please download the file to inspect.
                        </span>
                      </div>
                      <Button 
                        onClick={() => triggerDocumentDownload(previewDoc)}
                        className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs"
                      >
                        <Download className="h-3.5 w-3.5 mr-2" />
                        Download Document
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="text-xs font-bold text-rose-500">Failed to resolve secure download link.</div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-800/80 gap-2 sm:gap-0" onClick={(e) => e.stopPropagation()}>
              <Button 
                variant="ghost"
                onClick={() => { setIsPreviewOpen(false); setPreviewDoc(null); setPreviewUrl(null); }}
                className="h-12 px-6 rounded-xl hover:bg-slate-800 text-slate-400 font-bold"
              >
                Close Preview
              </Button>
              {previewUrl && (
                <Button 
                  onClick={() => triggerDocumentDownload(previewDoc)}
                  className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-black italic uppercase tracking-widest rounded-xl"
                >
                  Download File
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirm Document Delete */}
      <Dialog open={isConfirmDeleteDocOpen} onOpenChange={setIsConfirmDeleteDocOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md bg-slate-950 text-white border-slate-800 rounded-3xl p-0" onClick={(e) => e.stopPropagation()}>
          <div className="p-6 sm:p-8 space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                  <Trash2 className="h-5 w-5" />
                </div>
                Remove File?
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-medium italic mt-1">
                This action is irreversible. The record and the storage file will be completely wiped.
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 text-slate-300 space-y-2">
              <p className="text-xs font-medium">Are you sure you want to remove this document?</p>
              <div className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-tight">
                📄 {docToDelete?.documentTitle}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-800/80 gap-2 sm:gap-0">
              <Button 
                variant="ghost"
                onClick={() => { setIsConfirmDeleteDocOpen(false); setDocToDelete(null); }}
                className="h-12 px-6 rounded-xl hover:bg-slate-800 text-slate-400 font-bold"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleDeleteDoc}
                disabled={isDeletingDoc}
                className="h-12 px-6 bg-rose-500 hover:bg-rose-600 text-white font-black italic uppercase tracking-widest rounded-xl"
              >
                {isDeletingDoc ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Confirm Removal"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={disableModalOpen} onOpenChange={(o) => { setDisableModalOpen(o); if(!o) setActionReason(''); }}>
        <AlertDialogContent className="w-[95vw] sm:max-w-md bg-slate-950 border-slate-800 text-white rounded-xl p-6 sm:p-10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-amber-500">Suspend Access?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 font-medium italic mt-2 text-sm">
              This will disable dashboard access for <strong>{targetUser?.name}</strong>. Their data will remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reason (Optional)</Label>
              <Input 
                value={actionReason} 
                onChange={(e) => setActionReason(e.target.value)} 
                placeholder="e.g. Leave of absence"
                className="bg-white/5 border-white/10 text-white focus:border-amber-500 h-12 rounded-xl"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-end mt-4">
            <AlertDialogCancel className="h-12 px-6 rounded-xl border-white/10 bg-transparent hover:bg-white/5 font-bold uppercase tracking-widest text-[10px]">Cancel</AlertDialogCancel>
            <Button 
              onClick={executeDisable} 
              disabled={isSaving} 
              className="h-12 px-6 rounded-xl bg-amber-600 hover:bg-amber-700 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-amber-900/20"
            >
              {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Confirm Suspend"}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={enableModalOpen} onOpenChange={setEnableModalOpen}>
        <AlertDialogContent className="w-[95vw] sm:max-w-md bg-slate-950 border-slate-800 text-white rounded-xl p-6 sm:p-10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-emerald-500">Restore Access?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 font-medium italic mt-2 text-sm">
              This will re-enable dashboard access for <strong>{targetUser?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-end mt-8">
            <AlertDialogCancel className="h-12 px-6 rounded-xl border-white/10 bg-transparent hover:bg-white/5 font-bold uppercase tracking-widest text-[10px]">Cancel</AlertDialogCancel>
            <Button 
              onClick={executeEnable} 
              disabled={isSaving} 
              className="h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-900/20"
            >
              {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Confirm Restore"}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteModalOpen} onOpenChange={(o) => { setDeleteModalOpen(o); if(!o) setActionReason(''); }}>
        <AlertDialogContent className="w-[95vw] sm:max-w-md bg-slate-950 border-slate-800 text-white rounded-xl p-6 sm:p-10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-rose-500">Decommission Operative?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 font-medium italic mt-2 text-sm">
              This will mark <strong>{targetUser?.name}</strong> as deleted. They will lose all access, but their historic data and audit logs will remain permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reason for deletion (Optional)</Label>
              <Input 
                value={actionReason} 
                onChange={(e) => setActionReason(e.target.value)} 
                placeholder="e.g. Resigned"
                className="bg-white/5 border-white/10 text-white focus:border-rose-500 h-12 rounded-xl"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-end mt-4">
            <AlertDialogCancel className="h-12 px-6 rounded-xl border-white/10 bg-transparent hover:bg-white/5 font-bold uppercase tracking-widest text-[10px]">Cancel</AlertDialogCancel>
            <Button 
              onClick={executeDelete} 
              disabled={isSaving} 
              className="h-12 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-900/20"
            >
              {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Confirm Delete"}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={restoreModalOpen} onOpenChange={setRestoreModalOpen}>
        <AlertDialogContent className="w-[95vw] sm:max-w-md bg-slate-950 border-slate-800 text-white rounded-xl p-6 sm:p-10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-emerald-500">Recover Operative?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 font-medium italic mt-2 text-sm">
              This will recover <strong>{targetUser?.name}</strong> from deleted status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-end mt-8">
            <AlertDialogCancel className="h-12 px-6 rounded-xl border-white/10 bg-transparent hover:bg-white/5 font-bold uppercase tracking-widest text-[10px]">Cancel</AlertDialogCancel>
            <Button 
              onClick={executeRestore} 
              disabled={isSaving} 
              className="h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-900/20"
            >
              {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Confirm Recover"}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <ImageCropperModal
        isOpen={isCropModalOpen}
        onClose={() => {
          setIsCropModalOpen(false)
          setImageToCrop(null)
          setCropperTarget(null)
        }}
        imageSrc={imageToCrop}
        onCropComplete={handleProfilePhotoCropComplete}
        isUploading={isUploadingProfilePhoto}
      />

      <HrDocumentGenerator 
        open={docGeneratorOpen}
        onClose={() => setDocGeneratorOpen(false)}
        preselectedUserId={preselectedUserId}
        requestorEmail={userEmail || ''}
      />

      <HrPayrollGenerator 
        open={payrollGeneratorOpen}
        onClose={() => setPayrollGeneratorOpen(false)}
        preselectedUserId={preselectedUserId}
        initialMode={payrollMode}
        requestorEmail={userEmail || ''}
      />
    </div>
}
