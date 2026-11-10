'use client'

import { useState, useContext, useEffect, useRef } from 'react'
import { UserContext } from '@/components/dashboard/UserContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { 
    Save, 
    Building2, 
    Bell, 
    ShieldCheck, 
    User as UserIcon, 
    Calendar, 
    Mail, 
    Phone, 
    Lock,
    Loader2,
    Shield,
    Camera,
    Upload,
    FileText,
    Plus,
    Trash2,
    Download,
    Eye,
    Edit2,
    Search,
    Filter,
    X,
    File,
    FileImage,
    Info,
    Archive,
    RefreshCw
} from 'lucide-react'
import { PasswordInput } from '@/components/ui/password-input'
import { IdCardSuite, IdCardFront, IdCardBack, handleRegenerateIdCard } from '@/components/dashboard/IdCardGenerator'
import { ImageCropperModal } from '@/components/dashboard/settings/ImageCropperModal'
import { useQuery, useAction, useMutation, useConvex } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'

const DOCUMENT_TYPES = [
  "Resume",
  "ID Proof",
  "Address Proof",
  "Certificate",
  "Agreement",
  "Personal Document",
  "Work Document",
  "Other"
];

const VISIBILITY_OPTIONS = [
  { value: "private", label: "Private (Only Me & Owner)" },
  { value: "owner_visible", label: "Visible to Owner" },
  { value: "manager_visible", label: "Visible to Owner & Managers" }
];

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

export default function SettingsPage() {
  const { data: session } = useSession()
  const convex = useConvex()
  const { user: contextUser } = useContext(UserContext)
  const userEmail = session?.user?.email
  const dbUser = useQuery(api.users.getUserFromEmail, userEmail ? { email: userEmail } : "skip")
  const isAdmin = dbUser?.role === 'Owner'
  const hasDocManagePermission = !!(dbUser?.role === 'Owner' || dbUser?.permissions?.some((p: any) => p.key === 'manage_user_documents' && p.allowed))
  
  const updateUserComprehensive = useAction(api.users.updateUserComprehensive)
  
  const [credentials, setCredentials] = useState({ password: '', confirmPassword: '' })
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  
  const [profileData, setProfileData] = useState({
    name: '',
    phone: '',
    designation: '',
    image: '',
    bloodGroup: '',
    emergencyContact: '',
    gender: '',
    dob: '',
    employeeId: ''
  })

  const generateUploadUrl = useMutation(api.users.generateUploadUrl)
  const [isUploading, setIsUploading] = useState(false)

  const profileImageUrl = useQuery(api.users.getUserProfileImageUrl, { storageId: profileData.image || undefined })

  // Document Management States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadTitle, setUploadTitle] = useState("")
  const [uploadType, setUploadType] = useState("")
  const [uploadNotes, setUploadNotes] = useState("")
  const [uploadVisibility, setUploadVisibility] = useState("private")
  const [isUploadingFiles, setIsUploadingFiles] = useState(false)
  const [uploadProgressMsg, setUploadProgressMsg] = useState("")

  const [editingDoc, setEditingDoc] = useState<any>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editType, setEditType] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editVisibility, setEditVisibility] = useState("private")
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const [docToDelete, setDocToDelete] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [previewDoc, setPreviewDoc] = useState<any>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Team Documents Filtering States
  const [teamSearch, setTeamSearch] = useState("")
  const [teamTypeFilter, setTeamTypeFilter] = useState("ALL")
  const [teamUserFilter, setTeamUserFilter] = useState("ALL")
  const [teamRoleFilter, setTeamRoleFilter] = useState("ALL")
  const [teamSortOrder, setTeamSortOrder] = useState("desc")

  // Convex documents integrations
  const myDocs = useQuery(api.user_documents.getMyDocuments, userEmail ? { requestorEmail: userEmail } : "skip")
  const teamDocs = useQuery(api.user_documents.getAllUserDocumentsForManager, hasDocManagePermission && userEmail ? { requestorEmail: userEmail } : "skip")
  const teamUsers = useQuery(api.users.getUsers)
  
  const generateDocUploadUrl = useMutation(api.user_documents.generateUploadUrl)
  const saveUserDocument = useMutation(api.user_documents.saveUserDocument)
  const updateUserDocument = useMutation(api.user_documents.updateUserDocument)
  const deleteUserDocument = useMutation(api.user_documents.deleteUserDocument)
  const archiveUserDocument = useMutation(api.user_documents.archiveUserDocument)
  const getDocumentDownloadUrl = useMutation(api.user_documents.getDocumentDownloadUrl)

  // ID Card System Integrations
  const idCardTemplate = useQuery(api.id_card.getTemplate)
  const frontTemplateUrl = useQuery(api.users.getUserProfileImageUrl, { storageId: idCardTemplate?.frontStorageId || undefined })
  const backTemplateUrl = useQuery(api.users.getUserProfileImageUrl, { storageId: idCardTemplate?.backStorageId || undefined })
  
  // My own generated ID Card PDF doc
  const myIdCardDoc = useQuery(api.id_card.getEmployeeIdCard, dbUser ? { userId: dbUser._id } : "skip")
  
  // Mutations
  const generateTemplateUploadUrl = useMutation(api.id_card.generateUploadUrl)
  const saveTemplate = useMutation(api.id_card.saveTemplate)
  const saveOfficeIdCard = useMutation(api.id_card.saveOfficeIdCard)

  // ID Card Background upload states
  const [isUploadingFrontTemplate, setIsUploadingFrontTemplate] = useState(false)
  const [isUploadingBackTemplate, setIsUploadingBackTemplate] = useState(false)
  const [selectedUserForIdCardPreview, setSelectedUserForIdCardPreview] = useState<any>(null)
  const [isIdCardPreviewModalOpen, setIsIdCardPreviewModalOpen] = useState(false)
  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false)

  // Profile photo cropping states
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [isCropModalOpen, setIsCropModalOpen] = useState(false)

  // Selected employee profile image url for on-demand preview
  const previewUserProfileImageUrl = useQuery(
    api.users.getUserProfileImageUrl,
    selectedUserForIdCardPreview?.image ? { storageId: selectedUserForIdCardPreview.image } : "skip"
  )

  // Selected employee's generated ID Card PDF doc
  const previewUserIdCardDoc = useQuery(
    api.id_card.getEmployeeIdCard,
    selectedUserForIdCardPreview?._id ? { userId: selectedUserForIdCardPreview._id } : "skip"
  )

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Background templates must be less than 5MB.")
      return
    }

    if (side === 'front') setIsUploadingFrontTemplate(true)
    else setIsUploadingBackTemplate(true)

    const toastId = toast.loading(`Uploading ${side} ID card template...`)

    try {
      const uploadUrl = await generateTemplateUploadUrl({ requestorEmail: dbUser!.email })
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!result.ok) throw new Error("Upload server rejected the background template.")
      
      const { storageId } = await result.json()

      await saveTemplate({
        frontStorageId: side === 'front' ? storageId : undefined,
        backStorageId: side === 'back' ? storageId : undefined,
        requestorEmail: dbUser!.email,
      })

      toast.success(`${side.toUpperCase()} background template uploaded and saved.`, { id: toastId })
    } catch (err: any) {
      console.error(err)
      toast.error(`Failed to upload ${side} template: ` + err.message, { id: toastId })
    } finally {
      if (side === 'front') setIsUploadingFrontTemplate(false)
      else setIsUploadingBackTemplate(false)
    }
  }

  const handleRegenerateEmployeeIdCard = async (targetUser: any) => {
    const toastId = toast.loading(`Compiling and generating ID card for ${targetUser.name}...`)
    try {
      const profileUrl = targetUser.image
        ? await convex.query(api.users.getUserProfileImageUrl, { storageId: targetUser.image })
        : null
      const frontUrl = idCardTemplate?.frontStorageId
        ? await convex.query(api.users.getUserProfileImageUrl, { storageId: idCardTemplate.frontStorageId })
        : null
      const backUrl = idCardTemplate?.backStorageId
        ? await convex.query(api.users.getUserProfileImageUrl, { storageId: idCardTemplate.backStorageId })
        : null

      await handleRegenerateIdCard({
        user: {
          _id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          designation: targetUser.designation,
          employeeId: targetUser.employeeId,
          phone: targetUser.phone,
          image: targetUser.image,
          bloodGroup: targetUser.bloodGroup,
          emergencyContact: targetUser.emergencyContact,
        },
        profileImageUrl: profileUrl || null,
        frontTemplateUrl: frontUrl || null,
        backTemplateUrl: backUrl || null,
        requestorEmail: dbUser!.email,
        generateUploadUrlFn: (args) => generateDocUploadUrl(args),
        saveOfficeIdCardFn: (args) => saveOfficeIdCard(args),
      })
      toast.success(`ID Card for ${targetUser.name} successfully updated.`, { id: toastId })
    } catch (err: any) {
      console.error(err)
      toast.error(`Failed to generate card for ${targetUser.name}: ` + err.message, { id: toastId })
    }
  }

  const handleRegenerateAllIdCards = async () => {
    if (!teamUsers || teamUsers.length === 0) return
    setIsRegeneratingAll(true)
    const toastId = toast.loading("Starting batch compilation of all employee ID Cards...")
    let successCount = 0
    let failCount = 0

    try {
      const frontUrl = idCardTemplate?.frontStorageId
        ? await convex.query(api.users.getUserProfileImageUrl, { storageId: idCardTemplate.frontStorageId })
        : null
      const backUrl = idCardTemplate?.backStorageId
        ? await convex.query(api.users.getUserProfileImageUrl, { storageId: idCardTemplate.backStorageId })
        : null

      for (const u of teamUsers) {
        try {
          const profileUrl = u.image
            ? await convex.query(api.users.getUserProfileImageUrl, { storageId: u.image })
            : null

          await handleRegenerateIdCard({
            user: {
              _id: u._id,
              name: u.name,
              email: u.email,
              role: u.role,
              designation: u.designation,
              employeeId: u.employeeId,
              phone: u.phone,
              image: u.image,
              bloodGroup: u.bloodGroup,
              emergencyContact: u.emergencyContact,
            },
            profileImageUrl: profileUrl || null,
            frontTemplateUrl: frontUrl || null,
            backTemplateUrl: backUrl || null,
            requestorEmail: dbUser!.email,
            generateUploadUrlFn: (args) => generateDocUploadUrl(args),
            saveOfficeIdCardFn: (args) => saveOfficeIdCard(args),
          })
          successCount++
        } catch (e) {
          console.error(`Batch generation failed for ${u.name}`, e)
          failCount++
        }
      }
      toast.success(`Batch compilation complete! Success: ${successCount}, Failures: ${failCount}`, { id: toastId })
    } catch (err: any) {
      toast.error("Batch operation failed: " + err.message, { id: toastId })
    } finally {
      setIsRegeneratingAll(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setImageToCrop(reader.result as string)
      setIsCropModalOpen(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    setIsCropModalOpen(false)
    setIsUploading(true)
    const toastId = toast.loading("Uploading photo...")
    try {
      const postUrl = await generateUploadUrl()
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: croppedBlob,
      })
      if (!result.ok) throw new Error("Upload failed")
      const { storageId } = await result.json()
      setProfileData(prev => ({ ...prev, image: storageId }))
      toast.success("Photo uploaded successfully. Save profile to apply changes.", { id: toastId })
    } catch (error) {
      toast.error("Failed to upload photo.", { id: toastId })
    } finally {
      setIsUploading(false)
      setImageToCrop(null)
    }
  }

  useEffect(() => {
    if (dbUser) {
        setProfileData({
            name: dbUser.name || '',
            phone: dbUser.phone || '',
            designation: dbUser.designation || '',
            image: dbUser.image || '',
            bloodGroup: dbUser.bloodGroup || '',
            emergencyContact: dbUser.emergencyContact || '',
            gender: dbUser.gender || '',
            dob: dbUser.dob || '',
            employeeId: dbUser.employeeId || ''
        })
    }
  }, [dbUser])

  const handleUpdatePassword = async () => {
    if (!credentials.password) {
        toast.error("Password cannot be empty.")
        return
    }
    if (credentials.password !== credentials.confirmPassword) {
        toast.error("Passwords do not match.")
        return
    }
    
    setIsUpdatingPassword(true)
    try {
        const result = await updateUserComprehensive({
            userId: dbUser!._id,
            password: credentials.password
        })
        
        if (result.success) {
            toast.success("Password updated successfully.")
            setCredentials({ password: '', confirmPassword: '' })
        } else {
            toast.error(result.error || "Failed to update password.")
        }
    } catch (e: any) {
        toast.error("An unexpected error occurred.")
    } finally {
        setIsUpdatingPassword(false)
    }
  }

  const handleUpdateProfile = async () => {
    setIsSavingProfile(true)
    const toastId = toast.loading("Updating profile...")
    try {
        const result = await updateUserComprehensive({
            userId: dbUser!._id,
            name: profileData.name,
            phone: profileData.phone,
            designation: profileData.designation,
            image: profileData.image,
            bloodGroup: profileData.bloodGroup || undefined,
            emergencyContact: profileData.emergencyContact || undefined,
            gender: profileData.gender || undefined,
            dob: profileData.dob || undefined,
            employeeId: formatEmpId(profileData.employeeId)
        })
        
        if (result.success) {
            toast.success("Profile updated successfully.", { id: toastId })
            
            // Auto-regenerate ID Card
            try {
              const updatedUser = {
                _id: dbUser!._id,
                name: profileData.name,
                email: dbUser!.email,
                role: dbUser!.role,
                designation: profileData.designation || dbUser!.designation,
                employeeId: formatEmpId(profileData.employeeId),
                phone: profileData.phone,
                image: profileData.image,
                bloodGroup: profileData.bloodGroup,
                emergencyContact: profileData.emergencyContact,
              }
              
              const profileUrl = profileData.image
                ? await convex.query(api.users.getUserProfileImageUrl, { storageId: profileData.image })
                : null
              const frontUrl = idCardTemplate?.frontStorageId
                ? await convex.query(api.users.getUserProfileImageUrl, { storageId: idCardTemplate.frontStorageId })
                : null
              const backUrl = idCardTemplate?.backStorageId
                ? await convex.query(api.users.getUserProfileImageUrl, { storageId: idCardTemplate.backStorageId })
                : null

              await handleRegenerateIdCard({
                user: updatedUser,
                profileImageUrl: profileUrl || null,
                frontTemplateUrl: frontUrl || null,
                backTemplateUrl: backUrl || null,
                requestorEmail: dbUser!.email,
                generateUploadUrlFn: (args) => generateDocUploadUrl(args),
                saveOfficeIdCardFn: (args) => saveOfficeIdCard(args),
              })
              toast.success("Office ID Card regenerated.")
            } catch (err: any) {
              console.error("Auto-regeneration of ID Card failed", err)
              toast.error("Profile updated, but failed to auto-regenerate ID Card: " + err.message)
            }
        } else {
            toast.error(result.error || "Failed to update profile.", { id: toastId })
        }
    } catch (e: any) {
        toast.error("An unexpected error occurred.", { id: toastId })
    } finally {
        setIsSavingProfile(false)
    }
  }

  // Document Operations

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const oversized = files.some(f => f.size > 10 * 1024 * 1024);
      if (oversized) {
        toast.error("One or more files exceed the 10MB limit.");
        return;
      }
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFileFromQueue = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUploadSubmit = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one document file.");
      return;
    }
    if (!uploadTitle.trim()) {
      toast.error("Document Title is required.");
      return;
    }
    if (!uploadType) {
      toast.error("Document Type is required.");
      return;
    }

    setIsUploadingFiles(true);
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadProgressMsg(`Uploading "${file.name}" (${i + 1}/${selectedFiles.length})...`);
        
        // 1. Get Convex upload storage URL
        const uploadUrl = await generateDocUploadUrl({ requestorEmail: dbUser!.email });
        
        // 2. HTTP POST file data to Convex
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload server responded with code ${res.status}`);
        const { storageId } = await res.json();

        // 3. Save User Document metadata record
        const docTitle = selectedFiles.length > 1 ? `${uploadTitle} (Part ${i + 1})` : uploadTitle;
        await saveUserDocument({
          userId: dbUser!._id,
          userName: dbUser!.name,
          documentTitle: docTitle,
          documentType: uploadType,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          storageId,
          notes: uploadNotes || undefined,
          visibility: uploadVisibility as any,
          requestorEmail: dbUser!.email,
        });
      }

      toast.success("Documents uploaded successfully!");
      setIsUploadModalOpen(false);
      setSelectedFiles([]);
      setUploadTitle("");
      setUploadNotes("");
      setUploadVisibility("private");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload one or more files.");
    } finally {
      setIsUploadingFiles(false);
      setUploadProgressMsg("");
    }
  };

  const handleOpenEditModal = (doc: any) => {
    setEditingDoc(doc);
    setEditTitle(doc.documentTitle);
    setEditType(doc.documentType);
    setEditNotes(doc.notes || "");
    setEditVisibility(doc.visibility || "private");
    setIsEditModalOpen(true);
  };

  const handleUpdateDocumentSubmit = async () => {
    if (!editingDoc) return;
    if (!editTitle.trim()) {
      toast.error("Document Title is required.");
      return;
    }
    if (!editType) {
      toast.error("Document Type is required.");
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateUserDocument({
        id: editingDoc._id,
        documentTitle: editTitle,
        documentType: editType,
        notes: editNotes || undefined,
        visibility: editVisibility as any,
        requestorEmail: dbUser!.email,
      });
      toast.success("Document updated successfully.");
      setIsEditModalOpen(false);
      setEditingDoc(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update document.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const triggerDocumentPreview = async (doc: any) => {
    setPreviewDoc(doc);
    setPreviewUrl(null);
    setIsPreviewOpen(true);
    setIsLoadingPreview(true);

    try {
      const url = await getDocumentDownloadUrl({ id: doc._id, action: "viewed", requestorEmail: dbUser!.email });
      setPreviewUrl(url);
    } catch (err: any) {
      toast.error("Failed to load document preview: " + err.message);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const triggerDocumentDownload = async (doc: any) => {
    const toastId = toast.loading(`Preparing "${doc.fileName}" for download...`);
    try {
      const url = await getDocumentDownloadUrl({ id: doc._id, action: "downloaded", requestorEmail: dbUser!.email });
      
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
      
      toast.success("Download started successfully", { id: toastId });
    } catch (err: any) {
      toast.error("Download failed: " + err.message, { id: toastId });
    }
  };

  const handleOpenConfirmDelete = (doc: any) => {
    setDocToDelete(doc);
    setIsConfirmDeleteOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);
    try {
      await deleteUserDocument({ id: docToDelete._id, requestorEmail: dbUser!.email });
      toast.success("Document removed successfully.");
      setIsConfirmDeleteOpen(false);
      setDocToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove document.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!dbUser) {
    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    )
  }

  // isAdmin and hasDocManagePermission are defined at the top level of the component

  // Filtered documents list for Team Documents
  const filteredTeamDocs = teamDocs?.filter(doc => {
    const userMatch = teamUserFilter === "ALL" || doc.userId === teamUserFilter;
    const typeMatch = teamTypeFilter === "ALL" || doc.documentType === teamTypeFilter;
    
    // Get owner details
    const ownerUser = teamUsers?.find(u => u._id === doc.userId);
    const roleMatch = teamRoleFilter === "ALL" || ownerUser?.role === teamRoleFilter;

    const queryLower = teamSearch.toLowerCase();
    const searchMatch = !teamSearch || 
      doc.documentTitle.toLowerCase().includes(queryLower) ||
      doc.fileName.toLowerCase().includes(queryLower) ||
      doc.userName.toLowerCase().includes(queryLower) ||
      ownerUser?.email?.toLowerCase().includes(queryLower);

    return userMatch && typeMatch && roleMatch && searchMatch;
  }).sort((a, b) => {
    return teamSortOrder === "desc" ? b.uploadedAt - a.uploadedAt : a.uploadedAt - b.uploadedAt;
  });

  const getDocTypeIcon = (type: string) => {
    switch (type) {
      case 'Resume': return <FileText className="h-6 w-6 text-indigo-500" />
      case 'ID Proof': case 'Address Proof': return <ShieldCheck className="h-6 w-6 text-blue-500" />
      case 'Certificate': return <Shield className="h-6 w-6 text-amber-500" />
      case 'Agreement': return <Building2 className="h-6 w-6 text-emerald-500" />
      default: return <FileText className="h-6 w-6 text-slate-500" />
    }
  };

  return (
    <div className="space-y-8 pb-10 w-full max-w-full min-w-0 overflow-hidden mx-auto">
      <div className="text-center md:text-left">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic tracking-tighter">
            {isAdmin ? 'System Settings' : 'Account Settings'}
        </h1>
        <p className="text-muted-foreground mt-2 font-medium italic text-xs sm:text-sm">
            Manage your personal profile, credentials, and digital documents database.
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl h-auto flex flex-wrap gap-1 w-full max-w-3xl">
          <TabsTrigger value="profile" className="rounded-xl font-bold h-11 px-4 sm:px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex-1">
            <UserIcon className="h-4 w-4 mr-2" />
            Profile Identity
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl font-bold h-11 px-4 sm:px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex-1">
            <Lock className="h-4 w-4 mr-2" />
            Security Suite
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-xl font-bold h-11 px-4 sm:px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex-1">
            <FileText className="h-4 w-4 mr-2" />
            My Documents
          </TabsTrigger>
          {hasDocManagePermission && (
            <TabsTrigger value="team_documents" className="rounded-xl font-bold h-11 px-4 sm:px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex-1">
              <Building2 className="h-4 w-4 mr-2" />
              Team Documents
            </TabsTrigger>
          )}
          <TabsTrigger value="id_card" className="rounded-xl font-bold h-11 px-4 sm:px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex-1">
            <ShieldCheck className="h-4 w-4 mr-2" />
            ID Card
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile Identity */}
        <TabsContent value="profile" className="m-0 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="lg:col-span-2 space-y-6 sm:space-y-8">
                <Card className="border-none shadow-2xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b p-6 sm:p-8">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-primary/10 text-primary flex items-center justify-center overflow-hidden border border-primary/10">
                                {profileImageUrl ? (
                                    <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                                )}
                            </div>
                            <div>
                                <CardTitle className="text-lg sm:text-xl font-black uppercase">My Profile</CardTitle>
                                <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">General information & Identity</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 sm:p-8 space-y-8">
                        {/* Profile Photo Section */}
                        <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                            <div className="relative group">
                                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-xl relative z-10">
                                    {profileImageUrl ? (
                                        <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex flex-col items-center gap-1 text-slate-400">
                                            <UserIcon className="h-10 w-10 sm:h-12 sm:w-12" />
                                            <span className="text-[10px] font-black uppercase tracking-tighter">No Photo</span>
                                        </div>
                                    )}
                                    {isUploading && (
                                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-20">
                                            <Loader2 className="h-8 w-8 animate-spin text-white" />
                                        </div>
                                    )}
                                </div>
                                <label 
                                    htmlFor="photo-upload" 
                                    className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 active:scale-95 transition-all z-30"
                                >
                                    <Camera className="h-5 w-5" />
                                    <input 
                                        id="photo-upload" 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={handleImageUpload}
                                        disabled={isUploading}
                                    />
                                </label>
                            </div>
                            <div className="flex-1 text-center sm:text-left space-y-1">
                                <h3 className="text-xl font-black uppercase tracking-tight">Your Profile Photo</h3>
                                <p className="text-sm text-muted-foreground font-medium">
                                    This will be displayed across the platform on your transactions, attendance logs, and sidebar.
                                </p>
                                <div className="pt-2 flex flex-wrap justify-center sm:justify-start gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-9 px-4 rounded-xl border-slate-200 dark:border-slate-800 font-bold text-xs"
                                        onClick={() => document.getElementById('photo-upload')?.click()}
                                        disabled={isUploading}
                                    >
                                        <Upload className="h-3.5 w-3.5 mr-2" />
                                        Change Photo
                                    </Button>
                                    {profileData.image && (
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-9 px-4 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 font-bold text-xs"
                                            onClick={() => setProfileData(prev => ({ ...prev, image: '' }))}
                                            disabled={isUploading}
                                        >
                                            Remove
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <UserIcon className="h-3 w-3" /> Full Name
                                </label>
                                <Input 
                                    value={profileData.name} 
                                    onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold px-4"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Mail className="h-3 w-3" /> Email Address
                                </label>
                                <Input 
                                    value={dbUser.email} 
                                    disabled 
                                    className="h-12 bg-slate-100 dark:bg-slate-950 border-none rounded-xl font-bold px-4 text-muted-foreground cursor-not-allowed" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Shield className="h-3 w-3" /> Access Role
                                </label>
                                <div className="h-12 bg-slate-100 dark:bg-slate-950 rounded-xl font-black text-slate-500 dark:text-slate-400 px-4 flex items-center uppercase tracking-tighter text-sm">
                                    {dbUser.role}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <ShieldCheck className="h-3 w-3" /> Designation
                                </label>
                                <Input 
                                    value={profileData.designation} 
                                    onChange={(e) => setProfileData({...profileData, designation: e.target.value})}
                                    placeholder="e.g. Senior Designer"
                                    disabled={!isAdmin}
                                    className={cn(
                                        "h-12 border-none rounded-xl font-bold px-4",
                                        !isAdmin ? "bg-slate-100 dark:bg-slate-950 text-muted-foreground cursor-not-allowed shadow-none" : "bg-slate-50 dark:bg-slate-800"
                                    )}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    🆔 Employee ID
                                </label>
                                <Input 
                                    value={profileData.employeeId} 
                                    onChange={(e) => setProfileData({...profileData, employeeId: e.target.value})}
                                    placeholder="e.g. EMP-001"
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold px-4"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Phone className="h-3 w-3" /> Contact Number
                                </label>
                                <Input 
                                    value={profileData.phone} 
                                    onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                                    placeholder="+91 00000 00000"
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold px-4"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Calendar className="h-3 w-3" /> Starting Date
                                </label>
                                <div className="h-12 bg-slate-100 dark:bg-slate-950 rounded-xl font-black text-slate-500 dark:text-slate-400 px-4 flex items-center tabular-nums">
                                    {dbUser.joiningDate ? new Date(dbUser.joiningDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    🚻 Gender
                                </label>
                                <Select 
                                    value={profileData.gender} 
                                    onValueChange={(value) => setProfileData({...profileData, gender: value})}
                                >
                                    <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold px-4">
                                        <SelectValue placeholder="Select Gender" />
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
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    📅 Date of Birth
                                </label>
                                <Input 
                                    type="date"
                                    value={profileData.dob} 
                                    onChange={(e) => setProfileData({...profileData, dob: e.target.value})}
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold px-4"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    🩸 Blood Group
                                </label>
                                <Input 
                                    value={profileData.bloodGroup} 
                                    onChange={(e) => setProfileData({...profileData, bloodGroup: e.target.value})}
                                    placeholder="e.g. O+ / B+"
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold px-4"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    🚨 Emergency Contact
                                </label>
                                <Input 
                                    value={profileData.emergencyContact} 
                                    onChange={(e) => setProfileData({...profileData, emergencyContact: e.target.value})}
                                    placeholder="Emergency Contact"
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold px-4"
                                />
                            </div>
                        </div>
                        <div className="pt-4 flex justify-end">
                            <Button 
                                onClick={handleUpdateProfile} 
                                disabled={isSavingProfile}
                                className="h-12 px-8 bg-slate-900 dark:bg-white dark:text-slate-900 font-black rounded-xl shadow-xl transition-all active:scale-95"
                            >
                                {isSavingProfile ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                Update Profile
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {isAdmin && (
                    <Card className="border-none shadow-2xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b p-6 sm:p-8">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                    <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg sm:text-xl font-black uppercase">Company Settings</CardTitle>
                                    <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Global system configurations</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 sm:p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Company Name</label>
                                <Input 
                                    defaultValue="Acme Interiors" 
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold px-4"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Currency Symbol</label>
                                    <Input value="₹ (INR)" disabled className="h-12 bg-slate-100 dark:bg-slate-950 border-none rounded-xl font-bold px-4" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Timezone</label>
                                    <Input value="Asia/Kolkata (IST)" disabled className="h-12 bg-slate-100 dark:bg-slate-950 border-none rounded-xl font-bold px-4" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Security Suite */}
        <TabsContent value="security" className="m-0 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="lg:col-span-2 space-y-6 sm:space-y-8">
                <Card className="border-none shadow-2xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                    <CardHeader className="bg-rose-500/5 border-b p-6 sm:p-8">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                                <Lock className="h-5 w-5 sm:h-6 sm:w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-lg sm:text-xl font-black uppercase">Security</CardTitle>
                                <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-rose-500/60">Update Credentials</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 sm:p-8 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Lock className="h-3 w-3" /> New Password
                                </label>
                                <PasswordInput 
                                    value={credentials.password}
                                    onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                                    placeholder="••••••••"
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold px-4"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Lock className="h-3 w-3" /> Confirm Password
                                </label>
                                <PasswordInput 
                                    value={credentials.confirmPassword}
                                    onChange={(e) => setCredentials({...credentials, confirmPassword: e.target.value})}
                                    placeholder="••••••••"
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold px-4"
                                />
                            </div>
                            <Button 
                                onClick={handleUpdatePassword} 
                                disabled={isUpdatingPassword}
                                className="w-full h-12 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl shadow-lg shadow-rose-500/20 transition-all active:scale-95"
                            >
                                {isUpdatingPassword ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                                Update Password
                            </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-bold italic text-center px-2">
                            For security reasons, your password is encrypted and cannot be recovered by administrators.
                        </p>
                    </CardContent>
                </Card>

                {isAdmin && (
                    <Card className="border-none shadow-2xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                        <CardHeader className="bg-amber-500/5 border-b p-6 sm:p-8">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                                    <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg sm:text-xl font-black uppercase">Alerts</CardTitle>
                                    <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-amber-500/60">Notification Center</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 space-y-4">
                            {[
                                { label: "New Requests", checked: true },
                                { label: "Wallet Alerts", checked: true },
                                { label: "Attendance Reports", checked: false },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <span className="font-bold text-xs uppercase tracking-tight">{item.label}</span>
                                    <input type="checkbox" defaultChecked={item.checked} className="h-4 w-4 accent-amber-500" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: My Documents */}
        <TabsContent value="documents" className="m-0 space-y-6">
          <Card className="border-none shadow-2xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg sm:text-xl font-black uppercase">My Personal Documents</CardTitle>
                  <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Upload and manage your credentials, certificates, and files securely</CardDescription>
                </div>
              </div>
              <Button 
                onClick={() => setIsUploadModalOpen(true)}
                className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Upload Document
              </Button>
            </CardHeader>

            <CardContent className="p-6 sm:p-8">
              {myDocs === undefined ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm font-bold text-slate-400 italic">Decrypting file database...</p>
                </div>
              ) : myDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-20 max-w-md mx-auto space-y-5">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <FileText className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-black uppercase tracking-tight">No Documents Uploaded</h3>
                    <p className="text-xs font-medium text-slate-400 italic leading-relaxed">
                      You haven't uploaded any files yet. Keep all your certificates, ID cards, and work agreements safe in one premium digital vault.
                    </p>
                  </div>
                  <Button 
                    onClick={() => setIsUploadModalOpen(true)}
                    className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl px-6"
                  >
                    Upload First Document
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myDocs.map((doc) => (
                    <Card key={doc._id} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 rounded-2xl overflow-hidden hover:shadow-lg transition-all group flex flex-col justify-between">
                      <div className="p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                            {getDocTypeIcon(doc.documentType)}
                          </div>
                          <Badge className="bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 border-none font-bold uppercase tracking-widest text-[9px] px-2 py-0.5">
                            {doc.documentType}
                          </Badge>
                        </div>
                        <div className="space-y-1.5 min-w-0">
                          <h4 className="font-black text-sm uppercase tracking-tight text-slate-900 dark:text-white truncate" title={doc.documentTitle}>
                            {doc.documentTitle}
                          </h4>
                          <p className="text-slate-400 font-bold uppercase tracking-tighter text-[9px] truncate">
                            📁 {doc.fileName} ({formatBytes(doc.fileSize)})
                          </p>
                        </div>
                        {doc.notes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-white/40 dark:bg-slate-950/20 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/30 line-clamp-2">
                            {doc.notes}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                          <Calendar className="h-3.5 w-3.5" />
                          Uploaded {new Date(doc.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>

                      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => triggerDocumentPreview(doc)}
                          className="h-9 px-3 rounded-lg border-slate-200 dark:border-slate-700 hover:bg-indigo-50 hover:text-indigo-600 font-bold text-xs flex-1"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => triggerDocumentDownload(doc)}
                          className="h-9 px-3 rounded-lg border-slate-200 dark:border-slate-700 hover:bg-emerald-50 hover:text-emerald-600 font-bold text-xs flex-1"
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleOpenEditModal(doc)}
                          className="h-9 w-9 p-0 rounded-lg border-slate-200 dark:border-slate-700 hover:bg-amber-50 hover:text-amber-600"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleOpenConfirmDelete(doc)}
                          className="h-9 w-9 p-0 rounded-lg border-slate-200 dark:border-slate-700 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Team Documents */}
        {hasDocManagePermission && (
          <TabsContent value="team_documents" className="m-0 space-y-6">
            <Card className="border-none shadow-2xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b p-6 sm:p-8">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-black uppercase">Team Documents Registry</CardTitle>
                    <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Admin/Manager view to audit and download team files and credentials</CardDescription>
                  </div>
                </div>
              </CardHeader>

              {/* Filtering Controls */}
              <div className="p-6 sm:p-8 pb-4 grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-950/10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search by name, file..." 
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    className="pl-10 h-12 bg-white dark:bg-slate-800 border-none rounded-xl text-xs font-bold"
                  />
                </div>
                
                <Select value={teamTypeFilter} onValueChange={setTeamTypeFilter}>
                  <SelectTrigger className="h-12 bg-white dark:bg-slate-800 border-none rounded-xl text-xs font-bold">
                    <Filter className="h-3.5 w-3.5 mr-2 text-slate-400" />
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 text-white border-slate-800">
                    <SelectItem value="ALL">All Document Types</SelectItem>
                    {DOCUMENT_TYPES.map(t => (
                      <SelectItem key={t} value={t} className="focus:bg-primary/20 py-2.5 font-bold uppercase tracking-widest text-[9px]">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={teamUserFilter} onValueChange={setTeamUserFilter}>
                  <SelectTrigger className="h-12 bg-white dark:bg-slate-800 border-none rounded-xl text-xs font-bold">
                    <UserIcon className="h-3.5 w-3.5 mr-2 text-slate-400" />
                    <SelectValue placeholder="All Operatives" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 text-white border-slate-800">
                    <SelectItem value="ALL">All Team Members</SelectItem>
                    {teamUsers?.map(user => (
                      <SelectItem key={user._id} value={user._id} className="focus:bg-primary/20 py-2.5 font-bold uppercase tracking-widest text-[9px]">{user.name} ({user.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={teamRoleFilter} onValueChange={setTeamRoleFilter}>
                  <SelectTrigger className="h-12 bg-white dark:bg-slate-800 border-none rounded-xl text-xs font-bold">
                    <Shield className="h-3.5 w-3.5 mr-2 text-slate-400" />
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 text-white border-slate-800">
                    <SelectItem value="ALL">All Roles</SelectItem>
                    {Array.from(new Set(teamUsers?.map(u => u.role) || [])).map(roleName => (
                      <SelectItem key={roleName} value={roleName} className="focus:bg-primary/20 py-2.5 font-bold uppercase tracking-widest text-[9px]">{roleName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <CardContent className="p-0">
                {filteredTeamDocs === undefined ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-bold text-slate-400 italic">Querying admin records...</p>
                  </div>
                ) : filteredTeamDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-20 max-w-md mx-auto space-y-4">
                    <Info className="h-10 w-10 text-slate-400" />
                    <h4 className="text-lg font-black uppercase tracking-tight">No Documents Found</h4>
                    <p className="text-xs font-medium text-slate-400 italic">
                      We couldn't find any team documents matching the current search parameters or filters.
                    </p>
                  </div>
                                ) : (
                  <>
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-slate-800">
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Operative</th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Document Title</th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Type</th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">File Details</th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Uploaded At</th>
                            <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredTeamDocs.map((doc) => {
                            const ownerUser = teamUsers?.find(u => u._id === doc.userId);
                            return (
                              <tr key={doc._id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                <td className="px-8 py-5">
                                  <div className="flex flex-col">
                                    <span className="font-black italic uppercase tracking-tight text-slate-900 dark:text-white leading-none">{doc.userName}</span>
                                    <span className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wider">{ownerUser?.role || "Staff"}</span>
                                  </div>
                                </td>
                                <td className="px-8 py-5">
                                  <span className="font-bold text-slate-800 dark:text-slate-200">{doc.documentTitle}</span>
                                </td>
                                <td className="px-8 py-5">
                                  <Badge className="bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 border-none font-bold uppercase tracking-widest text-[9px]">
                                    {doc.documentType}
                                  </Badge>
                                </td>
                                <td className="px-8 py-5">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-xs truncate max-w-[200px]" title={doc.fileName}>{doc.fileName}</span>
                                    <span className="text-[9px] font-bold text-slate-500 mt-0.5 tabular-nums">{formatBytes(doc.fileSize)}</span>
                                  </div>
                                </td>
                                <td className="px-8 py-5">
                                  <span className="text-xs font-medium tabular-nums">{new Date(doc.uploadedAt).toLocaleDateString('en-GB')}</span>
                                </td>
                                <td className="px-8 py-5 text-right space-x-1.5 whitespace-nowrap">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => triggerDocumentPreview(doc)}
                                    className="h-9 px-3 rounded-lg border-slate-200 dark:border-slate-800 hover:bg-indigo-50 hover:text-indigo-600 font-bold text-xs"
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                    View
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => triggerDocumentDownload(doc)}
                                    className="h-9 px-3 rounded-lg border-slate-200 dark:border-slate-800 hover:bg-emerald-50 hover:text-emerald-600 font-bold text-xs"
                                  >
                                    <Download className="h-3.5 w-3.5 mr-1" />
                                    Download
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleOpenConfirmDelete(doc)}
                                    className="h-9 w-9 p-0 rounded-lg border-slate-200 dark:border-slate-800 hover:bg-rose-50 hover:text-rose-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredTeamDocs.map((doc) => {
                        const ownerUser = teamUsers?.find(u => u._id === doc.userId);
                        return (
                          <div key={doc._id} className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="font-black italic uppercase tracking-tight text-slate-900 dark:text-white leading-none">
                                  {doc.userName}
                                </span>
                                <span className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
                                  {ownerUser?.role || "Staff"}
                                </span>
                              </div>
                              <Badge className="bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 border-none font-bold uppercase tracking-widest text-[9px] px-2 py-0.5">
                                {doc.documentType}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                              <div className="flex flex-col gap-1 col-span-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Document Title</span>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{doc.documentTitle}</span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">File Details</span>
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={doc.fileName}>{doc.fileName}</span>
                                <span className="text-[9px] font-bold text-slate-500 mt-0.5 tabular-nums">{formatBytes(doc.fileSize)}</span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Uploaded At</span>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5 text-slate-400" /> {new Date(doc.uploadedAt).toLocaleDateString('en-GB')}
                                </span>
                              </div>
                            </div>

                            <div className="pt-2 flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => triggerDocumentPreview(doc)}
                                className="flex-1 h-10 border-slate-200 dark:border-slate-800 hover:bg-indigo-50 hover:text-indigo-600 font-bold text-[9px] rounded-xl flex items-center justify-center gap-1.5"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => triggerDocumentDownload(doc)}
                                className="flex-1 h-10 border-slate-200 dark:border-slate-800 hover:bg-emerald-50 hover:text-emerald-600 font-bold text-[9px] rounded-xl flex items-center justify-center gap-1.5"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Download
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleOpenConfirmDelete(doc)}
                                className="h-10 px-3 text-rose-500 hover:bg-rose-500/10 font-bold text-[9px] rounded-xl border border-rose-500/20 flex items-center justify-center"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="id_card" className="m-0 space-y-6">
          {/* Employee self preview section */}
          <Card className="border-none shadow-2xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b p-6 sm:p-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-[#113f48]/10 text-[#113f48] dark:text-[#f7b28a] flex items-center justify-center border border-[#113f48]/20">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg sm:text-xl font-black uppercase">My Office ID Card</CardTitle>
                  <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Preview, download or regenerate your corporate identity credential</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              <IdCardSuite
                user={{
                  _id: dbUser._id,
                  name: dbUser.name,
                  email: dbUser.email,
                  role: dbUser.role,
                  designation: dbUser.designation,
                  employeeId: dbUser.employeeId,
                  phone: dbUser.phone,
                  image: dbUser.image,
                  bloodGroup: dbUser.bloodGroup,
                  emergencyContact: dbUser.emergencyContact,
                }}
                template={idCardTemplate || null}
                profileImageUrl={profileImageUrl}
                frontTemplateUrl={frontTemplateUrl}
                backTemplateUrl={backTemplateUrl}
                lastUpdated={myIdCardDoc?.updatedAt || myIdCardDoc?.uploadedAt}
                onRegenerate={async () => {
                  const toastId = toast.loading("Regenerating your ID card...")
                  try {
                    await handleRegenerateIdCard({
                      user: {
                        _id: dbUser._id,
                        name: dbUser.name,
                        email: dbUser.email,
                        role: dbUser.role,
                        designation: dbUser.designation,
                        employeeId: dbUser.employeeId,
                        phone: dbUser.phone,
                        image: dbUser.image,
                        bloodGroup: dbUser.bloodGroup,
                        emergencyContact: dbUser.emergencyContact,
                      },
                      profileImageUrl: profileImageUrl || null,
                      frontTemplateUrl: frontTemplateUrl || null,
                      backTemplateUrl: backTemplateUrl || null,
                      requestorEmail: dbUser.email,
                      generateUploadUrlFn: (args) => generateDocUploadUrl(args),
                      saveOfficeIdCardFn: (args) => saveOfficeIdCard(args),
                    })
                    toast.success("ID Card successfully regenerated.", { id: toastId })
                  } catch (e: any) {
                    toast.error("Regeneration failed: " + e.message, { id: toastId })
                  }
                }}
              />
            </CardContent>
          </Card>

          {/* Admin template upload & user compilation settings */}
          {isAdmin && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Front Template Upload */}
                <Card className="border-none shadow-2xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                  <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b p-6 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-black uppercase">Front ID Template Background</CardTitle>
                      <CardDescription className="text-[9px] uppercase tracking-wider font-bold">Standard background template image (320px x 500px, Max 5MB)</CardDescription>
                    </div>
                    {frontTemplateUrl && (
                      <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-none font-black uppercase text-[9px] tracking-wider px-2.5">
                        Active
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="relative aspect-[320/500] max-w-[200px] mx-auto rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 bg-[#113f48] shadow-lg">
                      <img src={frontTemplateUrl || '/id_card_front_default.png'} alt="Front Preview" className="w-full h-full object-cover" />
                      {isUploadingFrontTemplate && (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex justify-center">
                      <label className="cursor-pointer">
                        <span className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md">
                          <Upload className="h-4 w-4 mr-2" /> Upload Front Template
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleTemplateUpload(e, 'front')} disabled={isUploadingFrontTemplate} />
                      </label>
                    </div>
                  </CardContent>
                </Card>

                {/* Back Template Upload */}
                <Card className="border-none shadow-2xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                  <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b p-6 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-black uppercase">Back ID Template Background</CardTitle>
                      <CardDescription className="text-[9px] uppercase tracking-wider font-bold">Standard background template image (320px x 500px, Max 5MB)</CardDescription>
                    </div>
                    {backTemplateUrl && (
                      <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-none font-black uppercase text-[9px] tracking-wider px-2.5">
                        Active
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="relative aspect-[320/500] max-w-[200px] mx-auto rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 bg-[#113f48] shadow-lg">
                      <img src={backTemplateUrl || '/id_card_back_default.png'} alt="Back Preview" className="w-full h-full object-cover" />
                      {isUploadingBackTemplate && (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex justify-center">
                      <label className="cursor-pointer">
                        <span className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md">
                          <Upload className="h-4 w-4 mr-2" /> Upload Back Template
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleTemplateUpload(e, 'back')} disabled={isUploadingBackTemplate} />
                      </label>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Employees Registry Table for ID Card Management */}
              <Card className="border-none shadow-2xl bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-black uppercase">Employee ID Card Registry</CardTitle>
                    <CardDescription className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Admin suite to compile, preview, and download ID cards for the entire team</CardDescription>
                  </div>
                  <Button 
                    onClick={handleRegenerateAllIdCards} 
                    disabled={isRegeneratingAll || !teamUsers || teamUsers.length === 0} 
                    className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2"
                  >
                    {isRegeneratingAll ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Batch Generating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" /> Batch Generate All Cards
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-slate-800">
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Employee</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Designation</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">ID Card Status</th>
                          <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {teamUsers?.map((user) => {
                          return (
                            <tr key={user._id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                              <td className="px-8 py-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
                                    {user.name[0]?.toUpperCase()}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-black italic uppercase tracking-tight text-slate-900 dark:text-white leading-none">{user.name}</span>
                                    <span className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wider">{user.email}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-5 text-xs font-semibold">
                                {user.designation || user.role}
                              </td>
                              <td className="px-8 py-5 text-xs">
                                <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-bold uppercase tracking-widest text-[9px]">
                                  Active / Ready
                                </Badge>
                              </td>
                              <td className="px-8 py-5 text-right space-x-1.5 whitespace-nowrap">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => {
                                    setSelectedUserForIdCardPreview(user);
                                    setIsIdCardPreviewModalOpen(true);
                                  }}
                                  className="h-9 px-3 rounded-lg border-slate-200 dark:border-slate-800 hover:bg-indigo-50 hover:text-indigo-600 font-bold text-xs"
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" />
                                  Preview Suite
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleRegenerateEmployeeIdCard(user)}
                                  className="h-9 px-3 rounded-lg border-slate-200 dark:border-slate-800 hover:bg-emerald-50 hover:text-emerald-600 font-bold text-xs"
                                >
                                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                  Regenerate
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {teamUsers?.map((user) => {
                      return (
                        <div key={user._id} className="p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
                                {user.name[0]?.toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-black italic uppercase tracking-tight text-slate-900 dark:text-white leading-none">{user.name}</span>
                                <span className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wider">{user.email}</span>
                              </div>
                            </div>
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-bold uppercase tracking-widest text-[9px] px-2 py-0.5">
                              Active / Ready
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Designation</span>
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                {user.designation || user.role}
                              </span>
                            </div>
                          </div>

                          <div className="pt-2 flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                setSelectedUserForIdCardPreview(user);
                                setIsIdCardPreviewModalOpen(true);
                              }}
                              className="flex-1 h-10 border-slate-200 dark:border-slate-800 hover:bg-indigo-50 hover:text-indigo-600 font-bold text-[9px] rounded-xl flex items-center justify-center gap-1.5"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Preview Suite
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleRegenerateEmployeeIdCard(user)}
                              className="flex-1 h-10 border-slate-200 dark:border-slate-800 hover:bg-emerald-50 hover:text-emerald-600 font-bold text-[9px] rounded-xl flex items-center justify-center gap-1.5"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Regenerate
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Admin Employee ID Card Preview Modal */}
      <Dialog open={isIdCardPreviewModalOpen} onOpenChange={setIsIdCardPreviewModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl bg-slate-950 text-white border-slate-800 rounded-3xl p-0 max-h-[92vh] overflow-y-auto">
          {selectedUserForIdCardPreview && (
            <div className="p-6 sm:p-8 space-y-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  ID Card Suite: {selectedUserForIdCardPreview.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 font-medium italic mt-1">
                  Preview and export identity documents for this operative.
                </DialogDescription>
              </DialogHeader>

              <IdCardSuite
                user={{
                  _id: selectedUserForIdCardPreview._id,
                  name: selectedUserForIdCardPreview.name,
                  email: selectedUserForIdCardPreview.email,
                  role: selectedUserForIdCardPreview.role,
                  designation: selectedUserForIdCardPreview.designation,
                  employeeId: selectedUserForIdCardPreview.employeeId,
                  phone: selectedUserForIdCardPreview.phone,
                  image: selectedUserForIdCardPreview.image,
                  bloodGroup: selectedUserForIdCardPreview.bloodGroup,
                  emergencyContact: selectedUserForIdCardPreview.emergencyContact,
                }}
                template={idCardTemplate || null}
                profileImageUrl={previewUserProfileImageUrl}
                frontTemplateUrl={frontTemplateUrl}
                backTemplateUrl={backTemplateUrl}
                lastUpdated={previewUserIdCardDoc?.updatedAt || previewUserIdCardDoc?.uploadedAt}
                onRegenerate={async () => {
                  await handleRegenerateEmployeeIdCard(selectedUserForIdCardPreview)
                }}
              />

              <DialogFooter className="pt-4 border-t border-slate-800/80">
                <Button 
                  variant="ghost"
                  onClick={() => { setIsIdCardPreviewModalOpen(false); setSelectedUserForIdCardPreview(null); }}
                  className="h-12 px-6 rounded-xl hover:bg-slate-800 text-slate-400 font-bold"
                >
                  Close Preview
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog 1: Upload Document Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-xl bg-slate-900 text-white border-slate-800 rounded-3xl p-0 max-h-[92vh] overflow-y-auto">
          <div className="p-6 sm:p-8 space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <Upload className="h-5 w-5" />
                </div>
                Upload New Document
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-medium italic mt-1">
                Upload your digital credentials or certificates to your personal database folder.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="doc-title" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Document Title *</Label>
                <Input 
                  id="doc-title"
                  placeholder="e.g. Current CV / PAN Card"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="h-12 bg-slate-800 border-none rounded-xl px-4 text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doc-type" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Document Type *</Label>
                  <Select value={uploadType} onValueChange={setUploadType}>
                    <SelectTrigger id="doc-type" className="h-12 bg-slate-800 border-none rounded-xl text-xs font-bold text-white">
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                      {DOCUMENT_TYPES.map(t => (
                        <SelectItem key={t} value={t} className="focus:bg-primary/20 py-2.5 font-bold uppercase tracking-widest text-[9px]">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doc-visibility" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visibility Profile</Label>
                  <Select value={uploadVisibility} onValueChange={setUploadVisibility}>
                    <SelectTrigger id="doc-visibility" className="h-12 bg-slate-800 border-none rounded-xl text-xs font-bold text-white">
                      <SelectValue placeholder="Select Visibility" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                      {VISIBILITY_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="focus:bg-primary/20 py-2.5 font-bold uppercase tracking-widest text-[9px]">{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="doc-notes" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Explanatory Notes</Label>
                <Textarea 
                  id="doc-notes"
                  placeholder="Optional brief notes or descriptions..."
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  className="bg-slate-800 border-none min-h-[80px] rounded-xl text-sm font-medium"
                />
              </div>

              {/* Upload Drop Zone / Input */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Files to Upload (PDF, ID Images, Word - Max 10MB) *</Label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-950/40 hover:bg-slate-950/70 transition-all flex flex-col items-center justify-center gap-2 group"
                >
                  <Upload className="h-8 w-8 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400 group-hover:text-slate-300">Click to Browse Local Files</span>
                  <span className="text-[10px] text-slate-500 italic">Supports multiple file selection</span>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    multiple 
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*" 
                    onChange={handleFileSelection}
                    className="hidden" 
                  />
                </div>
              </div>

              {/* Selected Files Queue */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 max-h-[140px] overflow-y-auto custom-scrollbar">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Upload Queue ({selectedFiles.length})</div>
                  <div className="space-y-2">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3 text-xs bg-slate-900 p-2 rounded-xl border border-slate-800/50">
                        <div className="flex items-center gap-2 truncate">
                          {file.type.startsWith("image/") ? <FileImage className="h-4 w-4 text-indigo-400 flex-shrink-0" /> : <File className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                          <span className="font-bold truncate" title={file.name}>{file.name}</span>
                          <span className="text-[9px] font-black text-slate-500 tabular-nums">({formatBytes(file.size)})</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => removeFileFromQueue(idx)}
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 border-t border-slate-800/80 gap-2 sm:gap-0">
              <Button 
                variant="ghost"
                onClick={() => { setIsUploadModalOpen(false); setSelectedFiles([]); }}
                className="h-12 px-6 rounded-xl hover:bg-slate-800 text-slate-400 font-bold"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUploadSubmit}
                disabled={isUploadingFiles || selectedFiles.length === 0}
                className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700 font-black italic uppercase tracking-widest rounded-xl flex items-center justify-center"
              >
                {isUploadingFiles ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>Initiate Upload</span>
                )}
              </Button>
            </DialogFooter>

            {isUploadingFiles && uploadProgressMsg && (
              <div className="text-[10px] text-center font-bold text-indigo-400 animate-pulse italic pb-2">
                {uploadProgressMsg}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog 2: Edit Document Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg bg-slate-900 text-white border-slate-800 rounded-3xl p-0">
          <div className="p-6 sm:p-8 space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Edit2 className="h-5 w-5" />
                </div>
                Edit Document Blueprint
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-medium italic mt-1">
                Modify document titles, access properties, or descriptive instructions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Document Title *</Label>
                <Input 
                  id="edit-title"
                  placeholder="e.g. Current CV / PAN Card"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="h-12 bg-slate-800 border-none rounded-xl px-4 text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-type" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Document Type *</Label>
                  <Select value={editType} onValueChange={setEditType}>
                    <SelectTrigger id="edit-type" className="h-12 bg-slate-800 border-none rounded-xl text-xs font-bold text-white">
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                      {DOCUMENT_TYPES.map(t => (
                        <SelectItem key={t} value={t} className="focus:bg-primary/20 py-2.5 font-bold uppercase tracking-widest text-[9px]">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-visibility" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visibility Profile</Label>
                  <Select value={editVisibility} onValueChange={setEditVisibility}>
                    <SelectTrigger id="edit-visibility" className="h-12 bg-slate-800 border-none rounded-xl text-xs font-bold text-white">
                      <SelectValue placeholder="Select Visibility" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                      {VISIBILITY_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="focus:bg-primary/20 py-2.5 font-bold uppercase tracking-widest text-[9px]">{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Explanatory Notes</Label>
                <Textarea 
                  id="edit-notes"
                  placeholder="Optional brief notes or descriptions..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="bg-slate-800 border-none min-h-[80px] rounded-xl text-sm font-medium"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-800/80 gap-2 sm:gap-0">
              <Button 
                variant="ghost"
                onClick={() => { setIsEditModalOpen(false); setEditingDoc(null); }}
                className="h-12 px-6 rounded-xl hover:bg-slate-800 text-slate-400 font-bold"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateDocumentSubmit}
                disabled={isSavingEdit}
                className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700 font-black italic uppercase tracking-widest rounded-xl"
              >
                {isSavingEdit ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog 3: Confirmation Dialog */}
      <Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md bg-slate-900 text-white border-slate-800 rounded-3xl p-0">
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
                onClick={() => { setIsConfirmDeleteOpen(false); setDocToDelete(null); }}
                className="h-12 px-6 rounded-xl hover:bg-slate-800 text-slate-400 font-bold"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleDeleteSubmit}
                disabled={isDeleting}
                className="h-12 px-6 bg-rose-500 hover:bg-rose-600 text-white font-black italic uppercase tracking-widest rounded-xl"
              >
                {isDeleting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Confirm Removal"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog 4: Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl bg-slate-900 text-white border-slate-800 rounded-3xl p-0 max-h-[92vh] overflow-y-auto">
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
              <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-xl text-xs border border-slate-800/60">
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
                  <p className="text-xs text-slate-400 italic bg-slate-950/20 p-3 rounded-xl border border-slate-800/30">
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
                        <span className="font-bold truncate max-w-[70%]">{previewDoc.fileName}</span>
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

            <DialogFooter className="pt-4 border-t border-slate-800/80 gap-2 sm:gap-0">
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

      <ImageCropperModal
        isOpen={isCropModalOpen}
        onClose={() => {
          setIsCropModalOpen(false)
          setImageToCrop(null)
        }}
        imageSrc={imageToCrop}
        onCropComplete={handleCropComplete}
        isUploading={isUploading}
      />
    </div>
  )
}
