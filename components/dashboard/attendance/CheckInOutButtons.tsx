'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Clock, LogIn, LogOut, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Id } from '@/convex/_generated/dataModel'
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { MapPin, Camera, Upload, X, Image as ImageIcon } from 'lucide-react'
import { useRef } from 'react'

import { useSession } from 'next-auth/react'

export function CheckInOutButtons({ userId }: { userId: Id<"users"> }) {
  const { data: session } = useSession()
  const requestorEmail = session?.user?.email ?? undefined
  const attendance = useQuery(api.attendance.getMyTodayAttendance, { 
    employeeId: userId,
    requestorEmail: requestorEmail
  })
  const checkIn = useMutation(api.attendance.checkIn)
  const checkOut = useMutation(api.attendance.checkOut)
  const [loading, setLoading] = useState(false)
  const sites = useQuery(api.sites.getSites)
  const [selectedSiteId, setSelectedSiteId] = useState<string | undefined>()
  const [comment, setComment] = useState('')

  const photoRequirement = useQuery(api.attendance.getPhotoRequirement, {
    userId,
    siteId: selectedSiteId && selectedSiteId !== 'office' && selectedSiteId !== 'wfh' ? selectedSiteId as Id<"sites"> : undefined
  })
  const generateUploadUrl = useMutation(api.attendance.generateUploadUrl)
  
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB')
        return
      }
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setPhotoPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const clearPhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadPhoto = useMutation(api.attendance.uploadAttendancePhoto)

  const handleUploadAfterLogin = async () => {
    if (!photoFile || !attendance) return

    try {
      setLoading(true)
      const postUrl = await generateUploadUrl()
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": photoFile.type },
        body: photoFile,
      })
      const { storageId } = await result.json()

      await uploadPhoto({
        attendanceId: attendance._id,
        photoStorageId: storageId,
        requestorEmail: requestorEmail!
      })

      clearPhoto()
      toast.success('Photo proof uploaded successfully!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload photo')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckIn = async () => {
    if (!selectedSiteId) {
        toast.error('Please select a site before logging in.')
        return
    }

    try {
      setLoading(true)

      let photoStorageId: Id<"_storage"> | undefined

      // If photo is required or provided, upload it first
      if (photoFile) {
        const postUrl = await generateUploadUrl()
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": photoFile.type },
          body: photoFile,
        })
        const { storageId } = await result.json()
        photoStorageId = storageId
      }

      await checkIn({ 
        employeeId: userId,
        siteId: selectedSiteId === 'office' || selectedSiteId === 'wfh' ? undefined : selectedSiteId as Id<"sites">,
        siteName: selectedSiteId === 'office' ? 'Office (Main Branch)' : selectedSiteId === 'wfh' ? 'Work from Home' : undefined,
        notes: comment.trim() || (selectedSiteId === 'office' ? 'Office Attendance' : selectedSiteId === 'wfh' ? 'Working from Home' : undefined),
        requestorEmail: requestorEmail!,
        photoStorageId
      })
      
      clearPhoto()
      setComment('')
      toast.success('Successfully logged in!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to log in')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckOut = async () => {
    try {
      setLoading(true)
      await checkOut({ 
        employeeId: userId,
        requestorEmail: requestorEmail!
      })
      toast.success('Successfully logged out!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to log out')
    } finally {
      setLoading(false)
    }
  }

  if (attendance === undefined) return <div className="h-20 flex items-center justify-center"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-none">Attendance Terminal</h3>
              <p className="text-sm text-muted-foreground mt-1 font-medium italic">
                {attendance 
                  ? (attendance.checkOut ? 'You have completed your shift for today.' : 'You are currently logged in.') 
                  : 'Welcome! Please log in to start your workday.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-3 w-full md:w-auto">
            {!attendance && (
              <div className="flex flex-col sm:flex-row sm:items-end gap-3 w-full sm:w-auto">
                <div className="flex flex-col gap-1.5 w-full sm:w-64">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Select Site / Branch</span>
                    <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                        <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 focus:ring-primary">
                            <MapPin className="h-4 w-4 mr-2 text-primary" />
                            <SelectValue placeholder="Select Location" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl bg-white dark:bg-slate-900">
                            <SelectItem value="office" className="font-bold cursor-pointer">🏢 Office (Main Branch)</SelectItem>
                            <SelectItem value="wfh" className="font-bold cursor-pointer text-fuchsia-600 dark:text-fuchsia-400">🏠 Work from Home</SelectItem>
                            {sites?.map(site => (
                                <SelectItem key={site._id} value={site._id} className="font-medium cursor-pointer italic">
                                    📍 {site.name} ({site.location})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-1.5 w-full sm:w-64">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Comment / Note (Optional)</span>
                    <Input 
                      type="text" 
                      placeholder="Write comment/note here" 
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 focus:ring-primary"
                    />
                </div>

                {!attendance && selectedSiteId && (
                  <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center justify-between">
                      Site Photo Proof 
                      {photoRequirement?.required && <span className="text-rose-500 lowercase font-bold tracking-normal italic">(Required)</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      {photoPreview ? (
                        <div className="relative h-12 w-12 rounded-xl overflow-hidden ring-2 ring-primary/20 group">
                          <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                          <button 
                            onClick={clearPhoto}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-12 w-12 p-0 bg-slate-50 dark:bg-slate-800 border-dashed border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all"
                        >
                          <Camera className="h-5 w-5 text-muted-foreground" />
                        </Button>
                      )}
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept="image/*" 
                        capture="environment"
                        className="hidden" 
                      />
                      {!photoPreview && (
                        <p className="text-[9px] font-bold text-slate-400 italic leading-tight max-w-[100px]">
                          Click to capture or upload proof
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <Button 
                    onClick={handleCheckIn} 
                    disabled={loading || (photoRequirement?.required && !photoFile)}
                    className="w-full sm:w-auto h-12 px-10 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                >
                    {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <LogIn className="h-5 w-5 mr-2" />}
                    Log In
                </Button>
              </div>
            )}
            
            {attendance && !attendance.checkOut && (
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                {!attendance.photoStorageId && (photoRequirement?.required || true) && (
                  <div className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/10 p-2 pl-4 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black uppercase text-amber-500 tracking-widest">Verification Pending</span>
                      <p className="text-[8px] font-bold text-amber-600/80 italic">Site photo missing for this session</p>
                    </div>
                    
                    <div className="flex items-center gap-2 border-l border-amber-500/10 pl-3">
                      {photoPreview ? (
                        <div className="relative h-10 w-10 rounded-lg overflow-hidden ring-2 ring-primary/20 group">
                          <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                          <button 
                            onClick={clearPhoto}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-10 w-10 p-0 bg-white dark:bg-slate-800 border-dashed border border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-all"
                        >
                          <Camera className="h-4 w-4 text-amber-500" />
                        </Button>
                      )}
                      
                      {photoFile && (
                        <Button 
                          onClick={handleUploadAfterLogin}
                          disabled={loading}
                          size="sm"
                          className="h-8 bg-amber-500 hover:bg-amber-600 text-white font-black text-[9px] uppercase tracking-widest rounded-lg px-3 shadow-lg shadow-amber-500/10"
                        >
                          {loading ? <Loader2 className="animate-spin h-3 w-3" /> : "Upload"}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                
                <Button 
                  onClick={handleCheckOut} 
                  disabled={loading}
                  className="flex-1 md:flex-none h-12 px-8 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 border border-slate-700"
                >
                  {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <LogOut className="h-5 w-5 mr-2" />}
                  Log Out
                </Button>
              </div>
            )}

            {attendance && (
                <div className="flex flex-row md:flex-col justify-between items-center md:items-end w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Logged In At</span>
                        <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                            {new Date(attendance.checkIn!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    {attendance.checkOut && (
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Logged Out At</span>
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                                {new Date(attendance.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    )}
                </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
