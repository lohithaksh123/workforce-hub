'use client'

import { useState, useContext } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { UserContext } from '@/components/dashboard/UserContext'
import { 
  Plus, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  Calendar, 
  User as UserIcon, 
  Briefcase, 
  MapPin,
  MoreVertical,
  PlayCircle,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from '@/components/ui/use-toast'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function TasksPage() {
  const { user } = useContext(UserContext)
  const isOwner = user?.role === 'Owner'
  const { toast } = useToast()
  
  const tasks = useQuery(isOwner ? api.tasks.getTasks : api.tasks.getMyTasks, user ? { userId: user.name } : "skip")
  const sites = useQuery(api.sites.getSites)
  const users = useQuery(api.users.getUsers)
  const createTask = useMutation(api.tasks.createTask)
  const updateStatus = useMutation(api.tasks.updateTaskStatus)

  const [open, setOpen] = useState(false)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<any>(null)
  const [completionRemark, setCompletionRemark] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    siteId: '',
    assignedTo: '',
    priority: 'Medium' as any,
    dueDate: ''
  })

  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.assignedTo) {
      toast({ 
        title: "Information Required", 
        description: "Please provide a Title and assign an Operative to proceed.", 
        variant: "destructive" 
      })
      return
    }

    setIsSaving(true)
    try {
      await createTask({
        title: newTask.title,
        description: newTask.description,
        siteId: (newTask.siteId && newTask.siteId !== 'none') ? newTask.siteId as any : undefined,
        assignedTo: newTask.assignedTo,
        assignedBy: user?.name || 'Owner',
        priority: newTask.priority,
        dueDate: newTask.dueDate || undefined
      })
      setOpen(false)
      setNewTask({ title: '', description: '', siteId: '', assignedTo: '', priority: 'Medium', dueDate: '' })
      toast({ title: "Task Initialized", description: "Assignment has been registered and operative notified." })
    } catch (e: any) {
      toast({ title: "Assignment Failed", description: e.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateStatus = async (taskId: any, status: any) => {
    if (status === 'Completed') {
      setSelectedTaskId(taskId)
      setCompleteDialogOpen(true)
      return
    }

    try {
      await updateStatus({ id: taskId, status, performedBy: user?.name })
      toast({ title: "Intelligence Updated", description: `Task status marked as ${status}.` })
    } catch (e: any) {
      toast({ title: "Synchronization Error", description: e.message, variant: "destructive" })
    }
  }

  const handleCompleteWithRemark = async () => {
    setIsSaving(true)
    try {
      await updateStatus({ 
        id: selectedTaskId, 
        status: 'Completed', 
        remarks: completionRemark,
        performedBy: user?.name
      })
      setCompleteDialogOpen(false)
      setCompletionRemark('')
      setSelectedTaskId(null)
      toast({ title: "Intelligence Updated", description: "Objective concluded with feedback." })
    } catch (e: any) {
      toast({ title: "Synchronization Error", description: e.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const filteredTasks = tasks?.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         t.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  })

  const getPriorityColor = (p: string) => {
    switch(p) {
      case 'High': return 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20'
      case 'Medium': return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20'
      case 'Low': return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20'
      default: return 'text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-500/10 border-slate-100 dark:border-slate-500/20'
    }
  }

  const getStatusIcon = (s: string) => {
    switch(s) {
      case 'Completed': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case 'In Progress': return <Clock className="h-4 w-4 text-amber-500" />
      default: return <AlertCircle className="h-4 w-4 text-slate-400" />
    }
  }

  return (
    <div className="space-y-8 pb-20 w-full max-w-full min-w-0 overflow-hidden mx-auto animate-in fade-in duration-700">
      {/* Header - COMPACT & ELEGANT */}
      <div className="relative px-6 sm:px-8 py-6 sm:py-8 rounded-2xl sm:rounded-3xl bg-slate-900 dark:bg-slate-950 text-white overflow-hidden shadow-2xl border border-slate-800 dark:border-white/5 mx-0 sm:mx-0">
        <div className="absolute top-[-50%] right-[-10%] w-[40%] h-[200%] bg-primary/10 rounded-full blur-[100px] opacity-50" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8">
          <div className="space-y-2 text-center md:text-left w-full sm:w-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 mb-1">
              Operational Logistics
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight italic uppercase leading-tight tracking-tighter">
              Task <span className="text-primary italic">Allocation</span>
            </h1>
            <p className="text-slate-400 font-medium text-xs md:text-sm max-w-md opacity-80 mt-2 italic leading-relaxed mx-auto md:mx-0">
              {isOwner 
                ? "Oversee and assign operational objectives to your team operatives with precision auditing."
                : "Manage your assigned operational tasks and update progress in real-time."
              }
            </p>
          </div>

          {isOwner && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="w-full md:w-auto h-11 px-6 bg-primary text-white hover:bg-primary/90 border border-white/10 rounded-xl font-black italic uppercase tracking-widest text-[10px] shadow-lg shadow-primary/10 transition-all active:scale-95 group">
                  <Plus className="mr-2.5 h-4 w-4" />
                  Initialize Task
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-xl bg-slate-950 border-slate-800 text-white p-0 max-h-[90vh] overflow-y-auto rounded-3xl">
                <div className="p-6 sm:p-8 bg-gradient-to-br from-indigo-500/20 to-transparent">
                  <DialogHeader>
                    <DialogTitle className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter">New Objective</DialogTitle>
                    <DialogDescription className="text-slate-400 font-medium italic">Define and assign a new operational task.</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 sm:space-y-6 py-6 sm:py-8">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Task Title</Label>
                      <Input
                        placeholder="e.g. Interior Site Measurement"
                        className="h-12 sm:h-14 bg-white/5 border-white/10 rounded-xl sm:rounded-2xl font-bold"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Description</Label>
                      <Input
                        placeholder="Detailed objectives..."
                        className="h-12 sm:h-14 bg-white/5 border-white/10 rounded-xl sm:rounded-2xl font-bold"
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Site/Project</Label>
                        <Select onValueChange={(v) => setNewTask({ ...newTask, siteId: v })} value={newTask.siteId}>
                          <SelectTrigger className="h-12 sm:h-14 bg-white/5 border-white/10 rounded-xl sm:rounded-2xl font-bold">
                            <SelectValue placeholder="Select Site" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-white">
                            <SelectItem value="none" className="font-bold italic text-slate-400">🌐 General / No Site</SelectItem>
                            {sites === undefined ? (
                                <div className="flex items-center justify-center p-4">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                </div>
                            ) : sites.length === 0 ? (
                                <div className="p-4 text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">No Projects Found</p>
                                    <Link href="/dashboard/sites">
                                        <Button size="sm" className="h-8 text-[9px] font-black uppercase">Create Project</Button>
                                    </Link>
                                </div>
                            ) : (
                                sites.map(s => (
                                    <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                                ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Assign To</Label>
                        <Select onValueChange={(v) => setNewTask({ ...newTask, assignedTo: v })} value={newTask.assignedTo}>
                          <SelectTrigger className="h-12 sm:h-14 bg-white/5 border-white/10 rounded-xl sm:rounded-2xl font-bold">
                            <SelectValue placeholder="Select Staff" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-white">
                            <SelectItem value="Everyone" className="font-bold text-primary">📢 Everyone (Broadcast)</SelectItem>
                            {users === undefined ? (
                                <div className="flex items-center justify-center p-4">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                </div>
                            ) : users.filter(u => u.role !== 'Owner' && u.status === 'active').length === 0 ? (
                                <div className="p-4 text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">No Operatives Available</p>
                                </div>
                            ) : (
                                users.filter(u => u.role !== 'Owner' && u.status === 'active').map(u => (
                                    <SelectItem key={u._id} value={u.name}>{u.name}</SelectItem>
                                ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Priority</Label>
                        <Select onValueChange={(v) => setNewTask({ ...newTask, priority: v })} value={newTask.priority}>
                          <SelectTrigger className="h-12 sm:h-14 bg-white/5 border-white/10 rounded-xl sm:rounded-2xl font-bold">
                            <SelectValue placeholder="Select Priority" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-white">
                            <SelectItem value="Low">Low</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="High">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Due Date</Label>
                        <Input
                          type="date"
                          className="h-12 sm:h-14 bg-white/5 border-white/10 rounded-xl sm:rounded-2xl font-bold"
                          value={newTask.dueDate}
                          onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                        />
                      </div>
                    </div>

                    <Button 
                      className="w-full h-14 sm:h-16 bg-primary text-white hover:bg-primary/90 rounded-xl sm:rounded-2xl font-black italic uppercase tracking-[0.2em] text-base sm:text-lg shadow-xl shadow-primary/20 mt-4"
                      onClick={handleCreateTask}
                      disabled={isSaving}
                    >
                      {isSaving ? "Finalizing..." : "Assign Objective"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar - REFINED */}
        <div className="space-y-6">
          <Card className="bg-white dark:bg-slate-950/40 backdrop-blur-2xl border-slate-200 dark:border-white/5 rounded-xl shadow-xl overflow-hidden">
            <CardContent className="p-4 space-y-6">
              <div className="space-y-3">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500 ml-1">Search Registry</Label>
                <div className="relative group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="Task name..." 
                    className="h-10 pl-10 bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-white/5 rounded-lg font-bold text-[11px]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500 ml-1">Status Protocol</Label>
                <div className="flex flex-col gap-1.5">
                  {['all', 'Pending', 'In Progress', 'Completed'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        statusFilter === s 
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-md scale-[1.02]" 
                          : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500 ml-1">Priority Level</Label>
                <div className="flex flex-wrap gap-1.5">
                  {['all', 'Low', 'Medium', 'High'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriorityFilter(p)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                        priorityFilter === p 
                          ? "bg-slate-800 dark:bg-white text-white dark:text-slate-950 border-transparent" 
                          : "bg-transparent border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-white/20"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Task List - FLATTENED HIERARCHY */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-900 dark:bg-white rounded-lg">
                <FileText className="h-4 w-4 text-white dark:text-slate-950" />
              </div>
              <div>
                <h2 className="text-xl font-black italic uppercase tracking-tighter">Objective Registry</h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Live operational status</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 px-2.5 py-1 rounded-lg font-black italic uppercase tracking-widest text-[8px]">
              {filteredTasks?.length || 0} Objectives
            </Badge>
          </div>

          <div className="space-y-3">
            {!filteredTasks || filteredTasks.length === 0 ? (
              <Card className="bg-white/40 dark:bg-slate-950/20 border-slate-100 dark:border-white/5 rounded-xl border-dashed py-20 text-center space-y-4">
                <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto opacity-40">
                  <FileText className="h-6 w-6" />
                </div>
                <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No objectives found in this sector</p>
              </Card>
            ) : (
              <AnimatePresence>
                {filteredTasks.map((task: any) => (
                  <motion.div
                    key={task._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="group relative p-5 bg-white dark:bg-slate-950/40 border border-slate-200/60 dark:border-white/5 rounded-xl hover:border-slate-300 dark:hover:border-white/10 transition-all shadow-sm hover:shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div className="flex items-start sm:items-center gap-4 sm:gap-5 flex-1">
                        {/* Avatar/Status Cluster */}
                        <div className="relative shrink-0">
                          <div className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-sm border border-white/10 shadow-sm transition-transform",
                            task.status === 'Completed' ? "bg-emerald-500" : "bg-slate-800 dark:bg-slate-800"
                          )}>
                            {task.assignedTo === 'Everyone' ? '👥' : task.assignedTo[0].toUpperCase()}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 rounded-full border-2 border-white dark:border-slate-900 bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
                            {getStatusIcon(task.status)}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h3 className="text-base font-black italic uppercase tracking-tight text-slate-900 dark:text-slate-100 leading-none">{task.title}</h3>
                            <span className={cn("px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border", 
                              task.priority === 'High' ? "text-rose-600 border-rose-200 bg-rose-50 dark:text-rose-400 dark:border-rose-500/20 dark:bg-rose-500/5" :
                              task.priority === 'Medium' ? "text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-500/20 dark:bg-amber-500/5" :
                              "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-500/20 dark:bg-emerald-500/5"
                            )}>
                              {task.priority}
                            </span>
                          </div>
                          
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-1 max-w-2xl opacity-90">{task.description}</p>
                          
                          {/* Metadata Row */}
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pt-2">
                            <span className="flex items-center gap-1.5"><MapPin className="h-2.5 w-2.5 opacity-70" /> {sites?.find(s => s._id === task.siteId)?.name || 'Central Unit'}</span>
                            <span className="flex items-center gap-1.5"><UserIcon className="h-2.5 w-2.5 opacity-70" /> {task.assignedTo}</span>
                            <span className="flex items-center gap-1.5"><Calendar className="h-2.5 w-2.5 opacity-70" /> {task.dueDate ? format(new Date(task.dueDate), 'dd MMM') : 'No Due Date'}</span>
                          </div>

                          {/* Feedback - SMALL SECONDARY TEXT */}
                          {task.remarks && (
                            <div className="mt-2.5 flex items-start gap-2.5 text-emerald-600 dark:text-emerald-500/80">
                              <span className="text-[8px] font-black uppercase tracking-[0.2em] pt-0.5 opacity-60">Feedback</span>
                              <p className="text-[11px] font-bold italic leading-tight opacity-90 max-w-xl">
                                "{task.remarks}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 shrink-0 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0">
                        {task.status !== 'Completed' && !isOwner && (
                          <div className="flex items-center gap-1.5 w-full sm:w-auto">
                            {task.status === 'Pending' && (
                              <Button 
                                size="sm"
                                className="flex-1 sm:flex-none h-8 px-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-950 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all"
                                onClick={() => handleUpdateStatus(task._id, 'In Progress')}
                              >
                                <PlayCircle className="mr-2 h-3 w-3" />
                                Initiate
                              </Button>
                            )}
                            <Button 
                              size="sm"
                              className="flex-1 sm:flex-none h-8 px-4 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/10"
                              onClick={() => handleUpdateStatus(task._id, 'Completed')}
                            >
                              <CheckCircle2 className="mr-2 h-3 w-3" />
                              Conclude
                            </Button>
                          </div>
                        )}
                        
                        {task.status === 'Completed' && task.completedAt && (
                          <div className="text-right">
                            <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Objective Concluded</div>
                            <div className="text-[10px] font-bold text-emerald-500">
                                {format(task.completedAt, 'dd MMM yyyy')}
                                {task.completedBy && task.assignedTo === 'Everyone' && (
                                    <span className="block text-[8px] text-slate-400 font-bold uppercase mt-0.5 tracking-tight italic">by {task.completedBy}</span>
                                )}
                                {task.completedBy && task.assignedTo !== 'Everyone' && task.completedBy !== task.assignedTo && (
                                    <span className="block text-[8px] text-slate-400 font-bold uppercase mt-0.5 tracking-tight italic text-rose-500">Manual by {task.completedBy}</span>
                                )}
                            </div>
                          </div>
                        )}

                        {isOwner && (
                           <div className={cn(
                             "text-[8px] px-2 py-0.5 font-black uppercase tracking-widest rounded border",
                             task.status === 'Completed' ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/20" :
                             task.status === 'In Progress' ? "bg-amber-500/5 text-amber-500 border-amber-500/20" :
                             "bg-slate-500/5 text-slate-500 border-slate-500/20"
                           )}>
                             {task.status}
                           </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* Completion Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md bg-slate-950 border-slate-800 text-white p-0 max-h-[90vh] overflow-y-auto rounded-3xl">
          <div className="p-6 sm:p-8 bg-gradient-to-br from-emerald-500/20 to-transparent">
            <DialogHeader>
              <DialogTitle className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter">Conclude Objective</DialogTitle>
              <DialogDescription className="text-slate-400 font-medium italic">Provide your final remarks or updates for this mission.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 sm:space-y-6 py-6 sm:py-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Final Intelligence Report</Label>
                <Input
                  placeholder="e.g. Site measurements verified to scale. All clear."
                  className="h-12 sm:h-14 bg-white/5 border-white/10 rounded-xl sm:rounded-2xl font-bold"
                  value={completionRemark}
                  onChange={(e) => setCompletionRemark(e.target.value)}
                />
              </div>

              <Button 
                className="w-full h-14 sm:h-16 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl sm:rounded-2xl font-black italic uppercase tracking-[0.2em] text-base sm:text-lg shadow-xl shadow-emerald-500/20 mt-4"
                onClick={handleCompleteWithRemark}
                disabled={isSaving}
              >
                {isSaving ? "Finalizing Report..." : "Submit & Conclude"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
