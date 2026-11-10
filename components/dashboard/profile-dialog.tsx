'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from '@/hooks/use-toast'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Loader2 } from 'lucide-react'


export function ProfileDialog() {
  const user = useQuery(api.users.currentUser)
  const updateProfile = useMutation(api.users.updateProfile)
  
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setEmail(user.email || '')
      setPhone(user.phone || '')
    }
  }, [user])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateProfile({
        name,
        phone,
      })
      toast({
        title: 'Profile Updated',
        description: 'Your changes have been saved successfully.',
      })
      setOpen(false)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (user === undefined) return <Loader2 className="h-4 w-4 animate-spin" />
  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Avatar className="h-8 w-8 cursor-pointer hover:opacity-80 transition-opacity">
          <AvatarImage src={user.image} alt={name} />
          <AvatarFallback>{name.split(' ').map(n => n[0]).join('') || 'U'}</AvatarFallback>
        </Avatar>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="flex flex-col items-center gap-4 border-b pb-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.image} alt={name} />
              <AvatarFallback className="text-xl">
                {name.split(' ').map(n => n[0]).join('') || 'U'}
              </AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm">Change Avatar</Button>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Input id="role" value={user.role} disabled className="bg-muted" />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 mt-2">
          <Button onClick={handleSave} className="w-full" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : 'Save Changes'}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} className="w-full" disabled={isSaving}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
