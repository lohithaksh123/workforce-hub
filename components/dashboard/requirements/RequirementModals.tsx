'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'

// --- Requirement Modal ---
export function RequirementModal({ 
    isOpen, 
    onClose, 
    requirement 
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    requirement?: any 
}) {
    const create = useMutation(api.requirements.createRequirement)
    const update = useMutation(api.requirements.updateRequirement)
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')

    useEffect(() => {
        if (requirement) {
            setName(requirement.name)
            setDescription(requirement.description || '')
        } else {
            setName('')
            setDescription('')
        }
    }, [requirement, isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name) return toast.error("Name is required")
        
        try {
            setLoading(true)
            if (requirement) {
                await update({ id: requirement._id, name, description })
                toast.success("Requirement updated")
            } else {
                await create({ name, description })
                toast.success("Requirement created")
            }
            onClose()
        } catch (error) {
            toast.error("Operation failed")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:max-w-md bg-slate-900 border-slate-800 text-white rounded-3xl max-h-[90vh] overflow-y-auto p-0">
                <div className="p-6 sm:p-8">
                <DialogHeader>
                    <DialogTitle>{requirement ? 'Edit Requirement' : 'Add Requirement'}</DialogTitle>
                    <DialogDescription className="text-xs text-slate-400">
                        {requirement ? 'Update existing requirement details.' : 'Define a new requirement category for your projects.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Labour" className="bg-slate-800 border-none" />
                    </div>
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description..." className="bg-slate-800 border-none min-h-[100px]" />
                    </div>
                    <DialogFooter className="pt-6 flex flex-col-reverse sm:flex-row gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} className="w-full sm:w-auto h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest text-slate-400 hover:text-white hover:bg-white/5">Cancel</Button>
                        <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 bg-white text-slate-900 hover:bg-slate-200 rounded-xl font-black italic uppercase tracking-widest text-[10px] shadow-lg shadow-white/10 transition-all active:scale-95">
                            {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            {requirement ? 'Update Requirement' : 'Create Requirement'}
                        </Button>
                    </DialogFooter>
                </form>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// --- Category Modal ---
export function CategoryModal({ 
    isOpen, 
    onClose, 
    requirementId,
    category 
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    requirementId: any,
    category?: any 
}) {
    const create = useMutation(api.requirements.createCategory)
    const update = useMutation(api.requirements.updateCategory)
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState('')

    useEffect(() => {
        if (category) setName(category.name)
        else setName('')
    }, [category, isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name) return toast.error("Name is required")
        
        try {
            setLoading(true)
            if (category) {
                await update({ id: category._id, name })
                toast.success("Category updated")
            } else {
                await create({ requirementId, name })
                toast.success("Category created")
            }
            onClose()
        } catch (error) {
            toast.error("Operation failed")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:max-w-md bg-slate-900 border-slate-800 text-white rounded-3xl max-h-[90vh] overflow-y-auto p-0">
                <div className="p-6 sm:p-8">
                <DialogHeader>
                    <DialogTitle>{category ? 'Edit Category' : 'Add Category'}</DialogTitle>
                    <DialogDescription className="text-xs text-slate-400">
                        {category ? 'Modify category name.' : 'Create a sub-category under this requirement.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label>Category Name</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Painters" className="bg-slate-800 border-none" />
                    </div>
                    <DialogFooter className="pt-6 flex flex-col-reverse sm:flex-row gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} className="w-full sm:w-auto h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest text-slate-400 hover:text-white hover:bg-white/5">Cancel</Button>
                        <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 bg-white text-slate-900 hover:bg-slate-200 rounded-xl font-black italic uppercase tracking-widest text-[10px] shadow-lg shadow-white/10 transition-all active:scale-95">
                            {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            {category ? 'Update Category' : 'Create Category'}
                        </Button>
                    </DialogFooter>
                </form>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// --- Person Modal ---
export function PersonModal({ 
    isOpen, 
    onClose, 
    requirementId,
    categoryId,
    person 
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    requirementId: any,
    categoryId?: any,
    person?: any 
}) {
    const create = useMutation(api.requirements.createPerson)
    const update = useMutation(api.requirements.updatePerson)
    const sites = useQuery(api.sites.getSites)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        role: '',
        siteId: undefined as any,
        availability: 'Available',
    })

    useEffect(() => {
        if (person) {
            setFormData({
                name: person.name,
                phone: person.phone,
                role: person.role,
                siteId: person.siteId || undefined,
                availability: person.availability || 'Available',
            })
        } else {
            setFormData({
                name: '',
                phone: '',
                role: '',
                siteId: undefined,
                availability: 'Available',
            })
        }
    }, [person, isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name || !formData.phone || !formData.role) return toast.error("Please fill required fields")
        
        try {
            setLoading(true)
            if (person) {
                await update({ 
                    id: person._id, 
                    ...formData,
                    categoryId: person.categoryId // preserve category if editing
                })
                toast.success("Record updated")
            } else {
                await create({ 
                    requirementId, 
                    categoryId, 
                    ...formData 
                })
                toast.success("Person added")
            }
            onClose()
        } catch (error: any) {
            toast.error(error.message || "Operation failed")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:max-w-lg bg-slate-900 border-slate-800 text-white rounded-3xl max-h-[90vh] overflow-y-auto p-0">
                <div className="p-6 sm:p-8">
                <DialogHeader>
                    <DialogTitle>{person ? 'Edit Record' : 'Add Person'}</DialogTitle>
                    <DialogDescription className="text-xs text-slate-400">
                        {person ? 'Update contact and assignment details.' : 'Register a new person in this category.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Full name" className="bg-slate-800 border-none" />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="e.g. 919876543210" className="bg-slate-800 border-none" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Role / Skill</Label>
                        <Input value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} placeholder="e.g. Senior Painter" className="bg-slate-800 border-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Site (Optional)</Label>
                            <Select value={formData.siteId} onValueChange={v => setFormData({...formData, siteId: v})}>
                                <SelectTrigger className="bg-slate-800 border-none">
                                    <SelectValue placeholder="Select Site" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {sites?.map(s => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Availability</Label>
                            <Select value={formData.availability} onValueChange={v => setFormData({...formData, availability: v})}>
                                <SelectTrigger className="bg-slate-800 border-none">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Available">Available</SelectItem>
                                    <SelectItem value="Busy">Busy</SelectItem>
                                    <SelectItem value="On Leave">On Leave</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="pt-6 flex flex-col-reverse sm:flex-row gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} className="w-full sm:w-auto h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest text-slate-400 hover:text-white hover:bg-white/5">Cancel</Button>
                        <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 bg-white text-slate-900 hover:bg-slate-200 rounded-xl font-black italic uppercase tracking-widest text-[10px] shadow-lg shadow-white/10 transition-all active:scale-95">
                            {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            {person ? 'Update Record' : 'Add Person'}
                        </Button>
                    </DialogFooter>
                </form>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// --- Bulk Message Modal ---
export function MessageModal({ 
    isOpen, 
    onClose, 
    selectedPeople,
    appliedFilters,
    filterOptions
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    selectedPeople: any[],
    appliedFilters?: any,
    filterOptions?: {
        sites: any[],
        categories: any[]
    }
}) {
    const [message, setMessage] = useState('')

    const getFilterSummary = () => {
        if (!appliedFilters) return null
        const parts = []
        if (appliedFilters.role !== 'ALL') parts.push(`Role: ${appliedFilters.role}`)
        if (appliedFilters.availability !== 'ALL') parts.push(`Status: ${appliedFilters.availability}`)
        if (appliedFilters.siteId !== 'ALL') {
            const site = filterOptions?.sites?.find(s => s._id === appliedFilters.siteId)
            parts.push(`Site: ${site?.name || 'Unknown'}`)
        }
        if (appliedFilters.categoryId !== 'ALL') {
            const cat = filterOptions?.categories?.find(c => c._id === appliedFilters.categoryId)
            parts.push(`Category: ${cat?.name || 'Unknown'}`)
        }
        return parts.length > 0 ? parts.join(", ") : "No filters applied"
    }
    
    const generateLinks = () => {
        return selectedPeople.map(p => {
            const encodedText = encodeURIComponent(message)
            return {
                name: p.name,
                phone: p.phone,
                url: `https://wa.me/${p.phone.replace(/\+/g, '')}?text=${encodedText}`
            }
        })
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(message)
        toast.success("Message copied to clipboard")
    }

    const openWhatsApp = () => {
        if (selectedPeople.length === 1) {
            const link = generateLinks()[0].url
            window.open(link, '_blank')
        } else if (selectedPeople.length > 1) {
            // For multiple, we show the list in the modal state or just open the first one with a warning
            toast.info("Opening list of WhatsApp links...")
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:max-w-xl bg-slate-900 border-slate-800 text-white rounded-3xl max-h-[90vh] overflow-y-auto p-0">
                <div className="p-6 sm:p-8">
                <DialogHeader>
                    <DialogTitle>Send Message to {selectedPeople.length} people</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        {appliedFilters && (
                            <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md inline-block">
                                Filters: {getFilterSummary()}
                            </div>
                        )}
                        <p className="mt-2">Compose your message and generate WhatsApp links.</p>
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label>Message Body</Label>
                        <Textarea 
                            value={message} 
                            onChange={e => setMessage(e.target.value)} 
                            placeholder="Type your message here..." 
                            className="bg-slate-800 border-none min-h-[150px] font-medium"
                        />
                    </div>

                    {selectedPeople.length > 1 && (
                        <div className="p-4 bg-slate-800/50 rounded-xl space-y-2 max-h-[200px] overflow-y-auto">
                            <Label className="text-xs uppercase font-black tracking-widest text-slate-500">Recipients List</Label>
                            {selectedPeople.map(p => (
                                <div key={p._id} className="flex items-center justify-between py-1 text-sm">
                                    <span className="font-bold">{p.name}</span>
                                    <span className="text-slate-400 tabular-nums">{p.phone}</span>
                                    <Button 
                                        variant="link" 
                                        className="h-auto p-0 text-emerald-500 font-bold"
                                        onClick={() => {
                                            const url = `https://wa.me/${p.phone.replace(/\+/g, '')}?text=${encodeURIComponent(message)}`
                                            window.open(url, '_blank')
                                        }}
                                    >
                                        Chat
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-slate-800">
                        <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest text-slate-400 hover:text-white hover:bg-white/5">Cancel</Button>
                        <Button variant="outline" onClick={copyToClipboard} className="w-full sm:flex-1 h-12 rounded-xl font-black italic uppercase tracking-widest text-[10px] border-slate-700 hover:bg-slate-800 transition-all">Copy Message</Button>
                        {selectedPeople.length === 1 && (
                            <Button onClick={openWhatsApp} className="w-full sm:flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black italic uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/10 transition-all active:scale-95">
                                Open WhatsApp
                            </Button>
                        )}
                    </div>
                </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
