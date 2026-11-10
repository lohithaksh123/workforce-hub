'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { 
    Plus, 
    ChevronRight, 
    Search, 
    MoreHorizontal, 
    Edit2, 
    Trash2, 
    Users as UsersIcon,
    ArrowLeft,
    Filter,
    Send,
    Download,
    Loader2,
    CheckCircle2,
    Briefcase,
    Phone,
    X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select'
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table'
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { 
    RequirementModal, 
    CategoryModal, 
    PersonModal,
    MessageModal 
} from '@/components/dashboard/requirements/RequirementModals'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useContext } from 'react'
import { UserContext } from '@/components/dashboard/UserContext'
import AccessDeniedBoard from '@/components/dashboard/AccessDeniedBoard'

export default function RequirementsPage() {
    const { user } = useContext(UserContext)
    // View State
    const [view, setView] = useState<'requirements' | 'categories' | 'people'>('requirements')
    const [selectedReq, setSelectedReq] = useState<any>(null)

    const hasPermission = (key: string) => {
        if (user?.role === 'Owner') return true;
        if (!user || !Array.isArray(user.permissions)) return false
        return user.permissions.find((p: any) => p.key === key || p.name === key)?.allowed || false
    }

    if (user && !hasPermission('manage_requirements')) {
        return <AccessDeniedBoard />
    }
    const [selectedCat, setSelectedCat] = useState<any>(null)

    // Data Queries
    const requirements = useQuery(api.requirements.getRequirements)
    const categories = useQuery(api.requirements.getCategoriesByRequirement, selectedReq ? { requirementId: selectedReq._id } : "skip")
    
    // People Query - depends on whether we are in a category or just in a requirement
    const people = useQuery(
        selectedCat ? api.requirements.getPeopleByCategory : api.requirements.getPeopleByRequirement,
        selectedCat ? { categoryId: selectedCat._id } : selectedReq ? { requirementId: selectedReq._id } : "skip"
    )

    // Mutations
    const deleteReq = useMutation(api.requirements.deleteRequirement)
    const deleteCat = useMutation(api.requirements.deleteCategory)
    const deletePerson = useMutation(api.requirements.deletePerson)

    // UI States
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set())
    
    // Advanced Filters
    const [filters, setFilters] = useState({
        role: 'ALL',
        availability: 'ALL',
        siteId: 'ALL',
        categoryId: 'ALL'
    })
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
    
    // Modal States
    const [modalState, setModalState] = useState<{
        type: 'requirement' | 'category' | 'person' | 'message',
        isOpen: boolean,
        data?: any
    }>({ type: 'requirement', isOpen: false })

    // Actions
    const handleReqClick = (req: any) => {
        setSelectedReq(req)
        if (req.hasCategories) {
            setView('categories')
        } else {
            setView('people')
        }
    }

    const handleCatClick = (cat: any) => {
        setSelectedCat(cat)
        setView('people')
    }

    const handleBack = () => {
        if (view === 'people') {
            if (selectedCat) {
                setView('categories')
                setSelectedCat(null)
            } else {
                setView('requirements')
                setSelectedReq(null)
            }
        } else if (view === 'categories') {
            setView('requirements')
            setSelectedReq(null)
        }
    }

    const handleDelete = async (type: string, id: any) => {
        if (!confirm(`Are you sure you want to delete this ${type}?`)) return
        try {
            if (type === 'requirement') await deleteReq({ id })
            else if (type === 'category') await deleteCat({ id })
            else if (type === 'person') await deletePerson({ id })
            toast.success(`${type} deleted`)
        } catch (e) {
            toast.error("Failed to delete")
        }
    }

    const togglePersonSelection = (id: string) => {
        const next = new Set(selectedPeople)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedPeople(next)
    }

    const toggleAllSelection = () => {
        if (selectedPeople.size === (people?.length || 0)) {
            setSelectedPeople(new Set())
        } else {
            setSelectedPeople(new Set(people?.map(p => p._id) || []))
        }
    }

    const getSelectedPeopleObjects = () => {
        if (selectedPeople.size === 0) return filteredPeople || []
        return people?.filter(p => selectedPeople.has(p._id)) || []
    }

    const filteredPeople = people?.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.phone.includes(searchTerm)
        
        const matchesRole = filters.role === 'ALL' || p.role === filters.role
        const matchesAvailability = filters.availability === 'ALL' || p.availability === filters.availability
        const matchesSite = filters.siteId === 'ALL' || p.siteId === filters.siteId
        const matchesCategory = filters.categoryId === 'ALL' || p.categoryId === filters.categoryId

        return matchesSearch && matchesRole && matchesAvailability && matchesSite && matchesCategory
    })

    // Dynamic Filter Options
    const roles = Array.from(new Set(people?.map(p => p.role) || []))
    const availabilities = ['Available', 'Busy', 'On Leave']
    const sites = useQuery(api.sites.getSites)

    const activeFilterCount = Object.values(filters).filter(v => v !== 'ALL').length

    const clearFilters = () => {
        setFilters({
            role: 'ALL',
            availability: 'ALL',
            siteId: 'ALL',
            categoryId: 'ALL'
        })
        setSelectedPeople(new Set())
    }

    return (
        <div className="space-y-10">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full min-w-0 pr-0 md:pr-10">
                <div className="space-y-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                        {view !== 'requirements' && (
                            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        )}
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">Requirements</h1>
                    </div>
                    <p className="text-muted-foreground font-medium italic text-xs sm:text-sm md:text-base mx-auto md:mx-0 max-w-lg">
                        {view === 'requirements' && "Manage workforce, vendors, and communication"}
                        {view === 'categories' && `Categories for ${selectedReq?.name}`}
                        {view === 'people' && `People in ${selectedCat?.name || selectedReq?.name}`}
                    </p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    {view === 'requirements' && (
                        <Button onClick={() => setModalState({ type: 'requirement', isOpen: true })} className="w-full sm:w-auto bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl shadow-xl transition-all active:scale-95 px-6 h-12 text-xs">
                            <Plus className="mr-2 h-5 w-5" /> ADD REQUIREMENT
                        </Button>
                    )}
                    {view === 'categories' && (
                        <Button onClick={() => setModalState({ type: 'category', isOpen: true })} className="w-full sm:w-auto bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl shadow-xl transition-all active:scale-95 px-6 h-12 text-xs">
                            <Plus className="mr-2 h-5 w-5" /> ADD CATEGORY
                        </Button>
                    )}
                    {view === 'people' && (
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                             <Button 
                                variant="outline"
                                 onClick={() => setModalState({ type: 'message', isOpen: true })} 
                                 className="h-12 px-6 font-black rounded-xl border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10"
                             >
                                 <Send className="mr-2 h-5 w-5" /> 
                                 {selectedPeople.size > 0 
                                     ? `SEND TO ${selectedPeople.size} SELECTED` 
                                     : activeFilterCount > 0 
                                         ? `SEND TO ${filteredPeople?.length || 0} FILTERED` 
                                         : 'SEND TO ALL'
                                 }
                             </Button>
                            <Button onClick={() => setModalState({ type: 'person', isOpen: true })} className="w-full sm:w-auto bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl shadow-xl transition-all active:scale-95 px-6 h-12 text-xs">
                                <Plus className="mr-2 h-5 w-5" /> ADD PERSON
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Content Section */}
            {!requirements ? (
                <div className="flex h-[40vh] items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary opacity-30" />
                </div>
            ) : (
                <>
                    {/* View 1: Requirements Grid */}
                    {view === 'requirements' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {requirements.map((req) => (
                                <Card 
                                    key={req._id} 
                                    className="group relative bg-white dark:bg-slate-900 border-none shadow-sm hover:shadow-xl transition-all duration-300 rounded-3xl overflow-hidden cursor-pointer"
                                    onClick={() => handleReqClick(req)}
                                >
                                    <CardContent className="p-8">
                                        <div className="flex flex-col gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Briefcase className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{req.name}</h3>
                                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2 font-medium italic">{req.description || "No description provided"}</p>
                                            </div>
                                            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center gap-2">
                                                    <div className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black uppercase text-slate-500">
                                                        {req.peopleCount} {req.peopleCount === 1 ? 'Person' : 'People'}
                                                    </div>
                                                    {req.hasCategories && (
                                                        <div className="px-2 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[10px] font-black uppercase">Categorized</div>
                                                    )}
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                                        <DropdownMenuItem onClick={() => setModalState({ type: 'requirement', isOpen: true, data: req })} className="font-bold flex items-center gap-2 p-2">
                                                            <Edit2 className="h-4 w-4 text-amber-500" /> Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleDelete('requirement', req._id)} className="font-bold flex items-center gap-2 p-2 text-rose-500">
                                                            <Trash2 className="h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* View 2: Categories Grid */}
                    {view === 'categories' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {categories?.map((cat) => (
                                <Card 
                                    key={cat._id} 
                                    className="group relative bg-white dark:bg-slate-900 border-none shadow-sm hover:shadow-xl transition-all duration-300 rounded-3xl overflow-hidden cursor-pointer"
                                    onClick={() => handleCatClick(cat)}
                                >
                                    <CardContent className="p-8">
                                        <div className="flex flex-col gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <UsersIcon className="h-6 w-6" />
                                            </div>
                                            <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{cat.name}</h3>
                                            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                                <div className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black uppercase text-slate-500">
                                                    {cat.peopleCount} {cat.peopleCount === 1 ? 'Person' : 'People'}
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                                        <DropdownMenuItem onClick={() => setModalState({ type: 'category', isOpen: true, data: cat })} className="font-bold flex items-center gap-2 p-2">
                                                            <Edit2 className="h-4 w-4 text-amber-500" /> Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleDelete('category', cat._id)} className="font-bold flex items-center gap-2 p-2 text-rose-500">
                                                            <Trash2 className="h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            <Card 
                                className="border-2 border-dashed border-slate-200 dark:border-slate-800 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900 transition-all rounded-3xl cursor-pointer flex items-center justify-center p-8 min-h-[200px]"
                                onClick={() => setModalState({ type: 'category', isOpen: true })}
                            >
                                <div className="text-center">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                                        <Plus className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Add Category</span>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* View 3: People Table */}
                    {view === 'people' && (
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                {/* Desktop Table View */}
                                <div className="hidden lg:block">
                                    <Table>
                                        <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                                            <TableRow className="border-none">
                                                <TableHead className="w-12 px-6">
                                                    <Checkbox checked={selectedPeople.size === (filteredPeople?.length || 0) && (filteredPeople?.length || 0) > 0} onCheckedChange={toggleAllSelection} />
                                                </TableHead>
                                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Name</TableHead>
                                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Phone</TableHead>
                                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Role / Skill</TableHead>
                                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Current Site</TableHead>
                                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-14">Availability</TableHead>
                                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-14 text-right px-6">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredPeople?.map((person) => (
                                                <TableRow key={person._id} className="border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                    <TableCell className="px-6">
                                                        <Checkbox 
                                                            checked={selectedPeople.has(person._id)} 
                                                            onCheckedChange={() => togglePersonSelection(person._id)} 
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-5 font-bold text-slate-900 dark:text-white">
                                                        {person.name}
                                                    </TableCell>
                                                    <TableCell className="font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                                                        <div className="flex items-center gap-2">
                                                            <Phone className="h-3 w-3 text-slate-300" />
                                                            {person.phone}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-tight">
                                                            {person.role}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="font-semibold text-slate-600 dark:text-slate-300">
                                                        {person.siteName}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className={cn(
                                                            "flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-widest",
                                                            person.availability === 'Available' ? 'text-emerald-500' : 
                                                            person.availability === 'Busy' ? 'text-amber-500' : 'text-slate-400'
                                                        )}>
                                                            <div className={cn("h-1.5 w-1.5 rounded-full", 
                                                                person.availability === 'Available' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                                                                person.availability === 'Busy' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-slate-400'
                                                            )} />
                                                            {person.availability}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right px-6">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                                                <DropdownMenuItem onClick={() => setModalState({ type: 'person', isOpen: true, data: person })} className="font-bold flex items-center gap-2 p-2">
                                                                    <Edit2 className="h-4 w-4 text-amber-500" /> Edit
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleDelete('person', person._id)} className="font-bold flex items-center gap-2 p-2 text-rose-500">
                                                                    <Trash2 className="h-4 w-4" /> Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {filteredPeople?.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground font-medium italic">
                                                        No records found matching your search.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
                                    <div className="p-4 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Checkbox checked={selectedPeople.size === (filteredPeople?.length || 0) && (filteredPeople?.length || 0) > 0} onCheckedChange={toggleAllSelection} />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select All</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-primary">{filteredPeople?.length || 0} Total</span>
                                    </div>
                                    {filteredPeople?.map((person) => (
                                        <div key={person._id} className="p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Checkbox checked={selectedPeople.has(person._id)} onCheckedChange={() => togglePersonSelection(person._id)} />
                                                    <span className="font-bold text-slate-900 dark:text-white">{person.name}</span>
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                                        <DropdownMenuItem onClick={() => setModalState({ type: 'person', isOpen: true, data: person })} className="font-bold flex items-center gap-2 p-2">
                                                            <Edit2 className="h-4 w-4 text-amber-500" /> Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleDelete('person', person._id)} className="font-bold flex items-center gap-2 p-2 text-rose-500">
                                                            <Trash2 className="h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 pl-7">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[9px] font-black uppercase text-slate-400">Role</span>
                                                    <span className="text-[10px] font-black text-primary uppercase">{person.role}</span>
                                                </div>
                                                <div className="flex flex-col gap-1 text-right">
                                                    <span className="text-[9px] font-black uppercase text-slate-400">Availability</span>
                                                    <div className={cn(
                                                        "flex items-center justify-end gap-1 font-black text-[9px] uppercase",
                                                        person.availability === 'Available' ? 'text-emerald-500' : 'text-amber-500'
                                                    )}>
                                                        {person.availability}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[9px] font-black uppercase text-slate-400">Phone</span>
                                                    <span className="text-[10px] font-bold tabular-nums">{person.phone}</span>
                                                </div>
                                                <div className="flex flex-col gap-1 text-right">
                                                    <span className="text-[9px] font-black uppercase text-slate-400">Site</span>
                                                    <span className="text-[10px] font-bold italic">{person.siteName}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredPeople?.length === 0 && (
                                        <div className="py-20 text-center text-muted-foreground font-medium italic">
                                            No records found matching your search.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Modals */}
            <RequirementModal 
                isOpen={modalState.type === 'requirement' && modalState.isOpen} 
                onClose={() => setModalState({ ...modalState, isOpen: false })} 
                requirement={modalState.data}
            />
            <CategoryModal 
                isOpen={modalState.type === 'category' && modalState.isOpen} 
                onClose={() => setModalState({ ...modalState, isOpen: false })} 
                requirementId={selectedReq?._id}
                category={modalState.data}
            />
            <PersonModal 
                isOpen={modalState.type === 'person' && modalState.isOpen} 
                onClose={() => setModalState({ ...modalState, isOpen: false })} 
                requirementId={selectedReq?._id}
                categoryId={selectedCat?._id}
                person={modalState.data}
            />
            <MessageModal 
                isOpen={modalState.type === 'message' && modalState.isOpen} 
                onClose={() => setModalState({ ...modalState, isOpen: false })} 
                selectedPeople={getSelectedPeopleObjects()}
                appliedFilters={filters}
                filterOptions={{
                    sites: sites || [],
                    categories: categories || []
                }}
            />
        </div>
    )
}
