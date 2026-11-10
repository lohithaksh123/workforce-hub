'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Upload, 
  User, 
  Lock, 
  Phone, 
  Mail, 
  MapPin, 
  HeartHandshake, 
  Trash2, 
  Plus, 
  Paperclip,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function PublicJoinPage() {
  const params = useParams()
  const router = useRouter()
  const inviteCode = params.inviteCode as string

  // Queries & Mutations
  const validationResult = useQuery(api.invites.validateInviteCode, { inviteCode })
  const generateUploadUrl = useMutation(api.users.generateUploadUrl)
  const submitOnboarding = useAction(api.joinRequests.submitJoinRequest)

  // Current Step (1: Account, 2: Documents, 3: Personal & Emergency)
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form State - Account
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [designation, setDesignation] = useState('')

  // Form State - Personal & Emergency
  const [bloodGroup, setBloodGroup] = useState('')
  const [address, setAddress] = useState('')
  const [emergencyContactName, setEmergencyContactName] = useState('')
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('')
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('')
  const [gender, setGender] = useState('')
  const [dob, setDob] = useState('')

  // Form State - Uploads (stores file objects and metadata)
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null)
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null)
  const [resume, setResume] = useState<File | null>(null)

  // Additional Supporting Documents
  const [supportingDocs, setSupportingDocs] = useState<Array<{
    id: string
    title: string
    type: string
    file: File | null
    uploading: boolean
    uploaded: boolean
    storageId?: string
  }>>([
    { id: '1', title: 'ID Proof (Aadhar/PAN/Passport)', type: 'ID Proof', file: null, uploading: false, uploaded: false }
  ])

  // Clean previews on unmount
  useEffect(() => {
    return () => {
      if (profilePhotoPreview) URL.revokeObjectURL(profilePhotoPreview)
    }
  }, [profilePhotoPreview])

  if (validationResult === undefined) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white gap-4">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Checking credentials gateway...</p>
      </div>
    )
  }

  if (!validationResult.valid) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <Card className="w-full max-w-md border-slate-800 bg-slate-900/90 text-white shadow-2xl relative z-10 rounded-2xl">
          <CardHeader className="text-center pb-6 border-b border-slate-800">
            <XCircleIcon className="h-14 w-14 text-rose-500 mx-auto mb-4" />
            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">Invite Code Invalid</CardTitle>
            <CardDescription className="text-slate-400 text-xs mt-1 italic">The security handshake failed or link is no longer active.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4 text-center">
            <p className="text-slate-400 text-xs leading-relaxed italic">
              "{validationResult.error || 'This invite link is invalid, expired, or revoked. Please contact the company owner.'}"
            </p>
            <div className="pt-4">
              <Button 
                onClick={() => router.push('/login')}
                className="w-full h-12 bg-white text-slate-950 hover:bg-slate-200 font-black italic uppercase text-xs rounded-xl"
              >
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const invite = validationResult.invite!

  // Allowed file extensions
  const ALLOWED_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/webp']
  const MAX_SIZE = 10 * 1024 * 1024 // 10MB

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Only PDF, Word, and Image files (JPG, PNG, WEBP) are supported.')
      return
    }
    if (file.size > MAX_SIZE) {
      alert('File size exceeds 10MB limit.')
      return
    }
    setProfilePhoto(file)
    if (profilePhotoPreview) URL.revokeObjectURL(profilePhotoPreview)
    setProfilePhotoPreview(URL.createObjectURL(file))
  }

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Only PDF, Word, and Image files (JPG, PNG, WEBP) are supported.')
      return
    }
    if (file.size > MAX_SIZE) {
      alert('File size exceeds 10MB limit.')
      return
    }
    setResume(file)
  }

  const uploadFileToStorage = async (file: File): Promise<string> => {
    const postUrl = await generateUploadUrl()
    const result = await fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file
    })
    const { storageId } = await result.json()
    return storageId
  }

  // Handle Form Submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (step < 3) return
    setErrorMsg(null)
    setIsSubmitting(true)

    try {
      // 1. Upload Profile Photo if present
      let profilePhotoStorageId = undefined
      if (profilePhoto) {
        profilePhotoStorageId = await uploadFileToStorage(profilePhoto)
      }

      // 2. Upload Resume if present
      let resumeStorageId = undefined
      if (resume) {
        resumeStorageId = await uploadFileToStorage(resume)
      }

      // 3. Upload Supporting Documents
      const uploadedDocs = []
      for (const doc of supportingDocs) {
        if (doc.file) {
          const storageId = await uploadFileToStorage(doc.file)
          uploadedDocs.push({
            documentTitle: doc.title,
            documentType: doc.type,
            fileName: doc.file.name,
            fileType: doc.file.type,
            fileSize: doc.file.size,
            storageId
          })
        }
      }

      // 4. Submit to Convex Action
      const res = await submitOnboarding({
        inviteCode,
        fullName,
        email,
        phone,
        password,
        designation: designation || undefined,
        requestedRoleId: invite.intendedRoleId || undefined,
        requestedRoleName: invite.intendedRoleName || undefined,
        siteId: invite.intendedSiteId || undefined,
        siteName: invite.intendedSiteName || undefined,
        bloodGroup: bloodGroup || undefined,
        address: address || undefined,
        emergencyContactName: emergencyContactName || undefined,
        emergencyContactPhone: emergencyContactPhone || undefined,
        emergencyContactRelationship: emergencyContactRelationship || undefined,
        gender: gender || undefined,
        dob: dob || undefined,
        profilePhotoStorageId,
        resumeStorageId,
        documents: uploadedDocs
      })

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to submit onboarding request.')
      } else {
        setSuccess(true)
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'An unexpected error occurred during submission.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Validate Step 1
  const isStep1Valid = () => {
    if (!fullName.trim()) return false
    if (!email.trim() || !email.includes('@')) return false
    if (!phone.trim() || phone.length < 8) return false
    if (!password || password.length < 6) return false
    if (password !== confirmPassword) return false
    return true
  }

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <Card className="w-full max-w-lg border-slate-800 bg-slate-900/90 text-white shadow-2xl relative z-10 rounded-2xl animate-in zoom-in-95 duration-350">
          <CardHeader className="text-center pb-6 border-b border-white/5">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <CardTitle className="text-3xl font-black italic uppercase tracking-tighter text-emerald-400">Application Submitted</CardTitle>
            <CardDescription className="text-slate-400 text-xs mt-1 italic uppercase tracking-widest">Acme Interiors Onboarding Gateway</CardDescription>
          </CardHeader>
          <CardContent className="pt-8 space-y-6 text-center">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-200">Onboarding request completed!</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto italic">
                Your profile, resume, and credentials have been submitted for owner approval. 
                Once approved, your account will be activated, and you can log in to the portal using your credentials.
              </p>
            </div>
            <div className="pt-6 border-t border-white/5">
              <Button 
                onClick={() => router.push('/login')}
                className="w-full h-12 bg-white text-slate-950 hover:bg-slate-200 font-black italic uppercase text-xs rounded-xl"
              >
                Go to Portal Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 py-12 relative overflow-hidden text-white">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      
      <div className="w-full max-w-xl relative z-10 space-y-6">
        <div className="text-center space-y-3">
          <img src="/logo.png" alt="Acme Interiors" className="h-20 w-auto mx-auto brightness-0 invert drop-shadow-lg" />
          <h1 className="text-xl font-black tracking-widest uppercase italic text-primary mt-4">Candidate Onboarding</h1>
          {invite.inviteTitle && (
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Campaign: {invite.inviteTitle}</p>
          )}
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <Card className="border-slate-800 bg-slate-900/90 text-white shadow-2xl rounded-3xl overflow-hidden">
          {/* Progress Header */}
          <div className="bg-slate-950 p-6 border-b border-slate-800 flex items-center justify-between text-xs font-black uppercase tracking-widest text-slate-400">
            <span className={cn(step >= 1 && "text-primary font-black")}>1. Credentials</span>
            <span className="text-slate-700">|</span>
            <span className={cn(step >= 2 && "text-primary font-black")}>2. Documents</span>
            <span className="text-slate-700">|</span>
            <span className={cn(step >= 3 && "text-primary font-black")}>3. Personal</span>
          </div>

          <form onSubmit={(e) => e.preventDefault()}>
            <CardContent className="p-6 sm:p-8 space-y-6">
              {/* STEP 1: CREDENTIALS */}
              {step === 1 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 text-primary border-b border-white/5 pb-2">
                    <User className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Account Identification</span>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</Label>
                    <Input 
                      required
                      placeholder="Enter your full name" 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-12 bg-white/5 border-white/10 rounded-xl text-xs font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address</Label>
                      <Input 
                        type="email"
                        required
                        placeholder="name@company.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 bg-white/5 border-white/10 rounded-xl text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</Label>
                      <Input 
                        required
                        placeholder="e.g. 9876543210" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-12 bg-white/5 border-white/10 rounded-xl text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Applying Designation / Job Title</Label>
                    <Input 
                      placeholder="e.g. Interior Designer associate" 
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="h-12 bg-white/5 border-white/10 rounded-xl text-xs font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Portal Password</Label>
                      <PasswordInput 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 bg-white/5 border-white/10 rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Confirm Password</Label>
                      <PasswordInput 
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-12 bg-white/5 border-white/10 rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: DOCUMENTS UPLOADS */}
              {step === 2 && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 text-primary border-b border-white/5 pb-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Document Verification</span>
                  </div>

                  {/* Profile Photo */}
                  <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-950 rounded-2xl border border-white/5">
                    <div className="shrink-0">
                      {profilePhotoPreview ? (
                        <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary">
                          <img src={profilePhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                          <button 
                            type="button"
                            onClick={() => { setProfilePhoto(null); setProfilePhotoPreview(null) }}
                            className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-black text-rose-400 uppercase tracking-tighter"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-dashed border-white/10 flex items-center justify-center text-slate-500">
                          <User className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 text-center sm:text-left flex-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Profile Photo (Optional)</span>
                      <p className="text-[9px] text-slate-500 leading-normal italic">JPEG, PNG, or WEBP. Max size: 10MB.</p>
                      <input 
                        type="file" 
                        id="profilePhotoInput" 
                        accept="image/*"
                        className="hidden" 
                        onChange={handleProfilePhotoChange}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('profilePhotoInput')?.click()}
                        className="h-9 px-4 border-slate-800 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-900"
                      >
                        Upload Photo
                      </Button>
                    </div>
                  </div>

                  {/* Resume Upload */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Candidate Resume (Required)</Label>
                    <div className="p-6 bg-slate-950 border border-dashed border-white/10 rounded-2xl text-center space-y-3">
                      <FileText className="h-8 w-8 text-primary/40 mx-auto" />
                      {resume ? (
                        <div className="flex items-center justify-center gap-2 bg-slate-900 p-2.5 rounded-xl max-w-sm mx-auto border border-slate-800">
                          <Paperclip className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span className="text-xs font-bold text-slate-200 truncate flex-1 text-left">{resume.name}</span>
                          <button 
                            type="button" 
                            onClick={() => setResume(null)}
                            className="text-rose-400 hover:text-rose-300 text-xs font-black uppercase px-2"
                          >
                            Clear
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-slate-400 italic">Select PDF, DOC, or DOCX resume document</p>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider">Max file size: 10MB</p>
                        </>
                      )}
                      <input 
                        type="file" 
                        id="resumeInput" 
                        accept=".pdf,.doc,.docx"
                        className="hidden" 
                        onChange={handleResumeChange}
                      />
                      {!resume && (
                        <Button
                          type="button"
                          onClick={() => document.getElementById('resumeInput')?.click()}
                          className="h-10 px-5 bg-white/5 border border-white/10 hover:bg-slate-900 text-xs font-black uppercase tracking-widest rounded-xl text-white"
                        >
                          Choose Resume File
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Additional supporting docs */}
                  <div className="space-y-3 pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Additional Supporting Documents</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setSupportingDocs([...supportingDocs, {
                          id: String(Date.now()),
                          title: '',
                          type: 'Certificate',
                          file: null,
                          uploading: false,
                          uploaded: false
                        }])}
                        className="h-8 px-3 text-primary text-[10px] font-black uppercase tracking-widest rounded-lg"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Document
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {supportingDocs.map((doc, index) => (
                        <div key={doc.id} className="p-4 bg-slate-950 rounded-xl border border-white/5 space-y-3 animate-in slide-in-from-top-2 duration-200">
                          <div className="flex gap-3">
                            <div className="flex-1 space-y-1">
                              <Input 
                                placeholder="Document Title (e.g. Aadhar Card)" 
                                value={doc.title}
                                onChange={(e) => {
                                  const updated = [...supportingDocs]
                                  updated[index].title = e.target.value
                                  setSupportingDocs(updated)
                                }}
                                className="h-10 bg-white/5 border-white/10 rounded-lg text-xs"
                              />
                            </div>
                            <div className="w-32">
                              <Select 
                                value={doc.type} 
                                onValueChange={(val) => {
                                  const updated = [...supportingDocs]
                                  updated[index].type = val
                                  setSupportingDocs(updated)
                                }}
                              >
                                <SelectTrigger className="h-10 bg-white/5 border-white/10 rounded-lg text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-lg">
                                  <SelectItem value="ID Proof" className="text-xs">ID Proof</SelectItem>
                                  <SelectItem value="Address Proof" className="text-xs">Address Proof</SelectItem>
                                  <SelectItem value="Certificate" className="text-xs">Certificate</SelectItem>
                                  <SelectItem value="Other" className="text-xs">Other File</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setSupportingDocs(supportingDocs.filter(d => d.id !== doc.id))
                              }}
                              className="h-10 w-10 p-0 text-rose-500 hover:bg-rose-500/10 rounded-lg shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-3">
                            <input 
                              type="file" 
                              id={`file-input-${doc.id}`}
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                if (file.size > MAX_SIZE) {
                                  alert('File exceeds 10MB limit')
                                  return
                                }
                                const updated = [...supportingDocs]
                                updated[index].file = file
                                updated[index].title = doc.title || file.name.split('.')[0]
                                setSupportingDocs(updated)
                              }}
                            />
                            {doc.file ? (
                              <div className="flex-1 flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-slate-850">
                                <span className="text-[10px] font-bold text-slate-300 truncate max-w-[200px]">{doc.file.name}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...supportingDocs]
                                    updated[index].file = null
                                    setSupportingDocs(updated)
                                  }}
                                  className="text-[9px] font-black uppercase text-rose-400 px-2"
                                >
                                  Clear
                                </button>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => document.getElementById(`file-input-${doc.id}`)?.click()}
                                className="h-9 px-4 border-slate-800 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-900 flex items-center gap-2"
                              >
                                <Upload className="h-3.5 w-3.5" /> Attach File
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: PERSONAL & EMERGENCY CONTACTS */}
              {step === 3 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 text-primary border-b border-white/5 pb-2">
                    <HeartHandshake className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Personal & Emergency Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gender</Label>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl text-xs font-bold">
                          <SelectValue placeholder="Select Gender" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                          <SelectItem value="Male" className="text-xs">Male</SelectItem>
                          <SelectItem value="Female" className="text-xs">Female</SelectItem>
                          <SelectItem value="Other" className="text-xs">Other</SelectItem>
                          <SelectItem value="Prefer not to say" className="text-xs">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date of Birth</Label>
                      <Input 
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="h-12 bg-white/5 border-white/10 rounded-xl text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Blood Group</Label>
                    <Select value={bloodGroup} onValueChange={setBloodGroup}>
                      <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl text-xs font-bold">
                        <SelectValue placeholder="Select Blood Group (Optional)" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                        <SelectItem value="A+" className="text-xs">A+</SelectItem>
                        <SelectItem value="A-" className="text-xs">A-</SelectItem>
                        <SelectItem value="B+" className="text-xs">B+</SelectItem>
                        <SelectItem value="B-" className="text-xs">B-</SelectItem>
                        <SelectItem value="O+" className="text-xs">O+</SelectItem>
                        <SelectItem value="O-" className="text-xs">O-</SelectItem>
                        <SelectItem value="AB+" className="text-xs">AB+</SelectItem>
                        <SelectItem value="AB-" className="text-xs">AB-</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Residential Address</Label>
                    <Textarea 
                      placeholder="Enter your current residential address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="bg-white/5 border-white/10 rounded-xl text-xs font-medium min-h-[90px]"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Emergency Contact Name</Label>
                      <Input 
                        placeholder="e.g. Ramesh Kumar" 
                        value={emergencyContactName}
                        onChange={(e) => setEmergencyContactName(e.target.value)}
                        className="h-12 bg-white/5 border-white/10 rounded-xl text-xs font-bold"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Relationship</Label>
                        <Input 
                          placeholder="e.g. Father / Spouse" 
                          value={emergencyContactRelationship}
                          onChange={(e) => setEmergencyContactRelationship(e.target.value)}
                          className="h-12 bg-white/5 border-white/10 rounded-xl text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Emergency Phone Number</Label>
                        <Input 
                          placeholder="e.g. 9876543211" 
                          value={emergencyContactPhone}
                          onChange={(e) => setEmergencyContactPhone(e.target.value)}
                          className="h-12 bg-white/5 border-white/10 rounded-xl text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>

            {/* Actions Footer */}
            <div className="bg-slate-950 p-6 border-t border-slate-800 flex items-center justify-between gap-4">
              {step > 1 ? (
                <Button 
                  type="button" 
                  onClick={() => setStep(step - 1)}
                  variant="ghost" 
                  disabled={isSubmitting}
                  className="h-12 text-slate-400 hover:text-white font-bold uppercase text-xs px-5 rounded-xl"
                >
                  Previous Step
                </Button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <Button 
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={step === 1 && !isStep1Valid()}
                  className="h-12 px-6 bg-primary hover:bg-indigo-650 font-black italic uppercase tracking-widest text-xs rounded-xl"
                >
                  Next Step
                </Button>
              ) : (
                <Button 
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={isSubmitting || !resume}
                  className="h-12 px-6 bg-emerald-600 hover:bg-emerald-500 font-black italic uppercase tracking-widest text-xs rounded-xl flex items-center gap-2 text-white shadow-lg shadow-emerald-500/10"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-1 shrink-0" />
                      Uploading & Submitting...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 shrink-0" /> Submit Application
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}
