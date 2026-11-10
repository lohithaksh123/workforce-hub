'use client'

import { useState, useContext } from 'react'
import { UserContext } from '@/components/dashboard/UserContext'
import { 
  Plus, 
  Search, 
  Building2, 
  MapPin, 
  User, 
  Calendar, 
  MoreVertical, 
  Edit2, 
  Archive, 
  Trash2, 
  Eye, 
  Wallet, 
  TrendingUp, 
  AlertCircle,
  Users as UsersIcon,
  ChevronRight,
  Loader2,
  Camera
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter 
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function SitesPage() {
  const { user: loggedInUser } = useContext(UserContext)
  const sites = useQuery(api.sites.getSites)
  const users = useQuery(api.users.getUsers)
  
  const createSite = useMutation(api.sites.createSite)
  const updateSite = useMutation(api.sites.updateSite)
  const deleteSite = useMutation(api.sites.deleteSite)

  const [searchQuery, setSearchQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    location: '',
    status: 'Active' as const,
    startDate: new Date().toISOString().split('T')[0],
    projectType: 'Residential' as any,
    managerId: '',
    clientName: '',
    teamMembers: [] as string[],
    notes: '',
    requiresAttendancePhoto: false
  })

  const hasPermission = (name: string) => {
    if (loggedInUser?.role === 'Owner') return true
    if (!loggedInUser || !Array.isArray(loggedInUser.permissions)) return false
    return loggedInUser.permissions.find((p: any) => p.key === name || p.name === name)?.allowed || false
  }

  const filteredSites = sites?.filter(site => 
    site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.location.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateSite = async () => {
    if (!formData.name || !formData.code) {
      toast({ title: "Error", variant: "destructive", description: "Name and Code are required" })
      return
    }
    
    setIsSaving(true)
    try {
      const result = await createSite(formData as any)
      if (result.success) {
        setOpen(false)
        setFormData({
            name: '',
            code: '',
            location: '',
            status: 'Active',
            startDate: new Date().toISOString().split('T')[0],
            projectType: 'Residential',
            managerId: '',
            clientName: '',
            teamMembers: [],
            notes: '',
            requiresAttendancePhoto: false
        })
        toast({ title: "Success", description: "Site created successfully" })
      } else {
        toast({ title: "Error", variant: "destructive", description: result.error })
      }
    } catch (e: any) {
      toast({ title: "Error", variant: "destructive", description: "Failed to create site" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSite = async (id: any) => {
    if (!confirm("Are you sure you want to delete this site? This action cannot be undone and only works if the site has no balance or transactions.")) return
    
    try {
        const result = await deleteSite({ id })
        if (result.success) {
            toast({ title: "Site Deleted", description: "Project site has been permanently removed." })
        } else {
            toast({ title: "Deletion Blocked", variant: "destructive", description: result.error })
        }
    } catch (e: any) {
        toast({ title: "Error", variant: "destructive", description: e.message })
    }
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Active': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400'
      case 'On Hold': return 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400'
      case 'Completed': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-400'
      case 'Archived': return 'bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-slate-400'
      default: return 'bg-slate-100 text-slate-800'
    }
  }

  return (
    <div className="space-y-8 w-full max-w-full min-w-0 overflow-hidden mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full min-w-0 pr-0 md:pr-10">
        <div className="text-center md:text-left">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic tracking-tighter">Project Sites</h1>
          <p className="text-muted-foreground mt-1 font-medium italic text-xs sm:text-sm md:text-base">Manage multi-site operations and financial allocations</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search sites..." 
              className="pl-12 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs uppercase tracking-widest"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {hasPermission('manage_sites') && (
            <Dialog open={open} onOpenChange={setOpen}>
              <Button className="w-full sm:w-auto h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl shadow-xl transition-all active:scale-95 px-6 italic uppercase tracking-widest text-xs" onClick={() => {
                setFormData(prev => ({...prev, code: `SITE-${Math.floor(Math.random() * 9000 + 1000)}`}))
                setOpen(true)
              }}>
                <Plus className="mr-2 h-5 w-5" />
                NEW SITE
              </Button>
              <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl p-0">
                <div className="p-6 sm:p-8">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Create New Project Site</DialogTitle>
                  <DialogDescription className="font-medium italic">Initialize a new project site with a dedicated wallet</DialogDescription>
                </DialogHeader>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Client Name</Label>
                    <Input 
                      placeholder="e.g. Rahul" 
                      className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold italic"
                      value={formData.clientName}
                      onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Location</Label>
                    <Input 
                      placeholder="e.g. Jubilee Hills, Hyderabad" 
                      className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold italic"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Site Name</Label>
                    <Input 
                      placeholder="e.g. Skyline Residency" 
                      className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold italic"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Site Code (Auto-generated)</Label>
                    <Input 
                      value={formData.code}
                      disabled
                      className="h-12 rounded-xl bg-slate-100 dark:bg-slate-900 border-none font-mono text-slate-400 font-bold"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Type of Project</Label>
                    <Select value={formData.projectType} onValueChange={(v) => setFormData({...formData, projectType: v as any})}>
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold italic">
                        <SelectValue placeholder="Select Project Type" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="Commercial">Commercial</SelectItem>
                        <SelectItem value="Residential">Residential</SelectItem>
                        <SelectItem value="Villa">Villa</SelectItem>
                        <SelectItem value="Apartments">Apartments</SelectItem>
                        <SelectItem value="Others">Others</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Start Date</Label>
                    <Input 
                      type="date" 
                      className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Site Manager / Supervisor <span className="font-normal">(Optional)</span></Label>
                    <Select value={formData.managerId} onValueChange={(v) => setFormData({...formData, managerId: v})}>
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold italic">
                        <SelectValue placeholder="Select Manager" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        {users?.map(u => <SelectItem key={u._id} value={u.name}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Notes / Description <span className="font-normal">(Optional)</span></Label>
                    <Input 
                        placeholder="Brief site overview..." 
                        className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold italic"
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 italic">Site Photo Proof</Label>
                    <button 
                      onClick={() => setFormData({ ...formData, requiresAttendancePhoto: !formData.requiresAttendancePhoto })}
                      className={cn(
                        "flex items-center gap-4 w-full p-4 rounded-2xl transition-all border-2",
                        formData.requiresAttendancePhoto 
                          ? "bg-rose-500/5 border-rose-500/20 text-rose-500 shadow-xl shadow-rose-500/5" 
                          : "bg-slate-50 dark:bg-slate-800 border-transparent text-slate-400"
                      )}
                    >
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                        formData.requiresAttendancePhoto ? "bg-rose-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                      )}>
                        <Camera className="h-5 w-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black uppercase tracking-widest leading-none">
                          {formData.requiresAttendancePhoto ? "Mandatory Photo Proof" : "Photo Proof Optional"}
                        </p>
                        <p className="text-[10px] font-bold mt-1 opacity-70 italic">
                          {formData.requiresAttendancePhoto ? "Employees MUST upload a site photo to check-in" : "Standard check-in without mandatory photo proof"}
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
                
                <DialogFooter className="gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" className="h-12 rounded-xl font-black uppercase tracking-widest text-xs" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateSite} className="h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl shadow-xl transition-all active:scale-95 px-8 italic uppercase tracking-widest text-xs" disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Create Site"}
                  </Button>
                </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {!sites && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
          <p className="text-muted-foreground font-medium">Loading project sites...</p>
        </div>
      )}

      {sites && sites.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl gap-4">
          <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
            <Building2 className="h-8 w-8 text-slate-400" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-bold text-slate-900">No sites found</h3>
            <p className="text-muted-foreground mt-1">Start by creating your first project site.</p>
          </div>
          <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add New Site
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSites?.map((site) => (
          <Link href={`/dashboard/sites/${site._id}`} key={site._id} className="block group">
            <Card className="h-full border-none shadow-md hover:shadow-2xl transition-all duration-300 relative overflow-hidden bg-white dark:bg-slate-900 group-hover:-translate-y-1">
              <div className={cn("absolute top-0 left-0 w-1.5 h-full", 
                site.status === 'Active' ? 'bg-green-500' : 
                site.status === 'On Hold' ? 'bg-amber-500' : 'bg-slate-300'
              )} />
              
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <Badge className={cn("mb-2 border-none font-bold", getStatusColor(site.status))}>
                    {site.status}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded tracking-widest leading-none">
                      {site.code}
                    </span>
                    {loggedInUser?.role === 'Owner' && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem 
                                    className="text-rose-600 font-bold" 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteSite(site._id);
                                    }}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Site
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                  </div>
                </div>
                <CardTitle className="text-xl font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                  {site.name}
                </CardTitle>
                <CardDescription className="flex items-center gap-1.5 font-medium">
                  <MapPin className="h-3.5 w-3.5" />
                  {site.location}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Financial Summary */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-500">Total Funds</p>
                    <p className="text-lg font-black text-indigo-600 leading-none">
                      ₹{(site.wallet?.calculated_allocated ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-500">Spent</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white leading-none">
                      ₹{(site.wallet?.calculated_spent ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-500">Remaining Balance</p>
                    <p className={cn(
                        "text-lg font-black leading-none",
                        (site.wallet?.calculated_balance || 0) < 5000 ? "text-rose-600" : "text-emerald-600"
                    )}>
                      ₹{(site.wallet?.calculated_balance ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Client</span>
                            <span className="text-[11px] font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1">
                                <User className="h-3 w-3" /> {site.clientName}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Manager</span>
                            <span className="text-[11px] font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1">
                                <User className="h-3 w-3" /> {site.managerId}
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Team</span>
                            <span className="text-[11px] font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1">
                                <UsersIcon className="h-3 w-3" /> {site.teamMembers.length}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1 text-indigo-600 font-bold text-[10px] bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 rounded-xl sm:opacity-0 sm:group-hover:opacity-100 transition-all sm:transform sm:translate-x-2 sm:group-hover:translate-x-0 w-fit">
                        DETAILS <ChevronRight className="h-3 w-3" />
                    </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
