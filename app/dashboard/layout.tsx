'use client'

import { useState, useEffect, useContext, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  Home,
  Users,
  UserCheck,
  DollarSign,
  TrendingUp,
  FileText,
  AlertCircle,
  Settings,
  Menu,
  X,
  LogOut,
  Wallet,
  Shield,
  ShieldCheck,
  Clock,
  XCircle,
  Building2,
  ListTodo,
  FileCheck,
  ClipboardList,
  Loader2,
  Megaphone,
  User as UserIcon,
  UserPlus,
  ArrowUp,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { DarkModeToggle } from '@/components/dark-mode-toggle'
import { cn } from '@/lib/utils'

import { NotificationPopover } from '@/components/dashboard/LiveNotifications'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

import { UserContext } from '@/components/dashboard/UserContext'


interface NavItem {
  title: string
  href: string
  icon: React.ReactNode
  badge?: string
  requiredPermission?: string
  requiredRole?: string
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: <Home className="h-5 w-5" />,
  },
  {
    title: 'Company Wallet',
    href: '/dashboard/wallet',
    icon: <Wallet className="h-5 w-5" />,
    requiredPermission: 'manage_company_wallet'
  },
  {
    title: 'Wallets',
    href: '/dashboard/wallets',
    icon: <Wallet className="h-5 w-5" />,
    requiredRole: 'Owner'
  },
  {
    title: 'Sites',
    href: '/dashboard/sites',
    icon: <Building2 className="h-5 w-5" />,
    requiredPermission: 'manage_sites'
  },
  {
    title: 'Estimation',
    href: '/dashboard/estimation',
    icon: <ClipboardList className="h-5 w-5" />,
    requiredPermission: 'create_estimates'
  },
  {
    title: 'Notice',
    href: '/dashboard/notice',
    icon: <Megaphone className="h-5 w-5" />,
  },
  {
    title: 'Attendance',
    href: '/dashboard/attendance',
    icon: <Clock className="h-5 w-5" />,
  },
  {
    title: 'Requirements',
    href: '/dashboard/requirements',
    icon: <ClipboardList className="h-5 w-5" />,
    requiredPermission: 'manage_requirements'
  },
  {
    title: 'Transactions',
    href: '/dashboard/transactions',
    icon: <DollarSign className="h-5 w-5" />,
  },
  {
    title: 'Vendors',
    href: '/dashboard/vendors',
    icon: <UserCheck className="h-5 w-5" />,
  },
  {
    title: 'Transaction Requests',
    href: '/dashboard/requests',
    icon: <AlertCircle className="h-5 w-5" />,
  },
  {
    title: 'Tasks',
    href: '/dashboard/tasks',
    icon: <ListTodo className="h-5 w-5" />,
  },
  {
    title: 'Approvals',
    href: '/dashboard/approvals',
    icon: <FileCheck className="h-5 w-5" />,
    requiredPermission: 'approve_transactions'
  },
  {
    title: 'Reports',
    href: '/dashboard/reports',
    icon: <TrendingUp className="h-5 w-5" />,
    requiredPermission: 'view_reports'
  },
  {
    title: 'Users',
    href: '/dashboard/users',
    icon: <Users className="h-5 w-5" />,
    requiredPermission: 'manage_users'
  },
  {
    title: 'Invite',
    href: '/dashboard/invite',
    icon: <UserPlus className="h-5 w-5" />,
    requiredPermission: 'manage_invites'
  },
  {
    title: 'Roles',
    href: '/dashboard/roles',
    icon: <ShieldCheck className="h-5 w-5" />,
    requiredPermission: 'manage_roles'
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: <Settings className="h-5 w-5" />,
  },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  const [showScrollTop, setShowScrollTop] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        setShowScrollTop(scrollRef.current.scrollTop > 300)
      }
    }
    const container = scrollRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
    }
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll)
      }
    }
  }, [])

  const scrollToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
  const { data: session, status: sessionStatus } = useSession()
  const userEmail = session?.user?.email
  const dbUser = useQuery(api.users.getUserFromEmail, userEmail ? { email: userEmail } : "skip")
  const myWallet = useQuery(api.wallets.getMyWallet, dbUser?.name ? { userId: dbUser.name } : "skip")

  const [currentUser, setCurrentUser] = useState<any>({ name: '', email: '', role: '', status: '', permissions: [], image: '' })
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    if (dbUser) {
      setCurrentUser({
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        status: dbUser.status || 'active',
        permissions: dbUser.permissions || [],
        image: dbUser.image || '',
      })
    }
  }, [dbUser])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await signOut({ callbackUrl: '/login' })
  }

  // Show premium loading spinner while fetching the session or user data from Convex to avoid dashboard flash
  if (sessionStatus === 'loading' || (sessionStatus === 'authenticated' && dbUser === undefined)) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
            Verifying secure session...
          </span>
        </div>
      </div>
    )
  }

  // Reactive enforcement of disabled / deleted status
  if (dbUser && (dbUser.status === 'disabled' || dbUser.status === 'deleted')) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 sm:p-10 text-white relative overflow-hidden">
        {/* Background gradients */}
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-md bg-white/5 border border-white/10 p-10 rounded-3xl backdrop-blur-2xl shadow-2xl text-center space-y-8">
          
          <div className="space-y-4">
            <div className="mx-auto flex items-center justify-center mb-2">
              <img src="/logo.png" alt="Acme Interiors" className="h-16 w-auto dark:brightness-0 dark:invert" />
            </div>
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Acme Interiors</h2>
              <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">Access Suspended</h1>
            </div>
          </div>

          <div className="p-6 bg-black/20 rounded-2xl border border-white/5">
            <p className="text-sm font-medium text-slate-300 leading-relaxed">
              This account has been deactivated. Please contact the system administrator or management to restore your operational access.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center"
            >
              {isLoggingOut ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogOut className="h-4 w-4 mr-2" />} End Session & Logout
            </Button>
          </div>

        </div>

        <div className="mt-12 text-center text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] relative z-10">
          Acme Interiors © {new Date().getFullYear()}
        </div>
      </div>
    )
  }

  // Reactive enforcement of inactive status
  if (dbUser && dbUser.status === 'inactive') {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-6 shadow-2xl relative z-10">
          <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-rose-500/20">
            <XCircle className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Account Inactive</h1>
          <p className="text-slate-400 font-medium leading-relaxed">
            Your access to <span className="text-slate-300 font-bold">Acme Interiors</span> has been suspended by the administrator. 
            Please contact support to restore access.
          </p>
          <div className="pt-4">
            <Button 
              className="w-full h-12 bg-white text-slate-900 hover:bg-slate-200 font-black text-lg transition-all shadow-md"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogOut className="mr-2 h-5 w-5" />} Sign Out
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(href)
  }

  const filteredNavItems = [...navItems.filter(item => {
    if (item.requiredRole && currentUser?.role !== item.requiredRole) return false
    if (!item.requiredPermission) return true
    if (currentUser?.role === 'Owner') return true
    if (!Array.isArray(currentUser.permissions)) return false
    return currentUser.permissions.find((p: any) => p.key === item.requiredPermission)?.allowed || false
  })]

  // Add "My Wallet" for non-owners if they have a name
  if (currentUser?.role !== 'Owner' && currentUser?.name) {
    // Find index of Company Wallet to insert after it, or insert as 3rd item
    let insertIndex = filteredNavItems.findIndex(item => item.title === 'Company Wallet')
    if (insertIndex === -1) {
      // If Company Wallet is not visible, insert after Dashboard (index 1)
      insertIndex = 0
    }
    
    filteredNavItems.splice(insertIndex + 1, 0, {
      title: 'My Wallet',
      href: myWallet ? `/dashboard/wallets/${myWallet._id}` : `/dashboard/wallets/personal?userId=${currentUser.name}`,
      icon: <Wallet className="h-5 w-5" />,
      badge: 'PERSONAL'
    })
  }

  return (
    <UserContext.Provider value={{ user: currentUser, setUser: setCurrentUser }}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar - Mobile */}
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-64 transform bg-background transition-transform duration-300 ease-in-out md:hidden',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
            'flex md:hidden'
          )}
        >
          <div className="flex h-full flex-col border-r bg-background shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Acme Interiors" className="h-10 w-auto dark:brightness-0 dark:invert" />
                <span className="font-black italic uppercase tracking-tighter text-lg">ACME</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl hover:bg-rose-500/10 hover:text-rose-500"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <ScrollArea className="flex-1 px-3 py-4">
              <div className="space-y-2">
                {filteredNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'bg-primary/10 text-primary border-l-4 border-primary'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span>{item.title}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </ScrollArea>

            <div className="p-4 border-t">
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span className="truncate">{currentUser.role}</span>
              </div>
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-3 mt-4 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 px-3"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                <span className="font-bold text-sm">Logout</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar - Desktop */}
        <div
          className={cn(
            'hidden md:flex md:flex-col md:border-r md:bg-background md:transition-[width] md:duration-300',
            sidebarOpen ? 'w-64' : 'w-20'
          )}
        >
          <div className="flex items-center h-[73px] px-4 border-b overflow-hidden">
            <AnimatePresence mode="wait">
              {sidebarOpen && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center gap-3 px-2 flex-1"
                >
                  <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="Logo" className="h-10 w-auto dark:brightness-0 dark:invert" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={cn("shrink-0", !sidebarOpen && "mx-auto")}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          <ScrollArea className="flex-1 px-3 py-4">
            <div className="space-y-2">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all group relative overflow-hidden h-10',
                    isActive(item.href)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                  title={!sidebarOpen ? item.title : undefined}
                >
                  {isActive(item.href) && (
                    <motion.div 
                      layoutId="active-indicator"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-primary/80"
                    />
                  )}
                  <div className="flex items-center gap-3 shrink-0">
                    {item.icon}
                  </div>
                  <AnimatePresence initial={false}>
                    {sidebarOpen && (
                      <motion.span 
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="ml-3 whitespace-nowrap overflow-hidden font-bold tracking-tight"
                      >
                        {item.title}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  
                  {item.badge && sidebarOpen && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter border border-slate-200 dark:border-slate-700">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </ScrollArea>

          <div className="border-t p-4 flex flex-col gap-2 overflow-hidden">
            <div className={cn(
                "flex items-center gap-3 px-2 mb-2",
                !sidebarOpen && "justify-center px-0"
            )}>
                <ProfileAvatar user={currentUser} />
                {sidebarOpen && (
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold truncate">{currentUser.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{currentUser.role}</span>
                    </div>
                )}
            </div>
            <Button 
              variant="ghost" 
              className={cn(
                "w-full h-10 px-3 transition-all text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 group relative",
                !sidebarOpen ? "justify-center px-0" : "justify-start gap-3"
              )}
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : <LogOut className="h-5 w-5 shrink-0" />}
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.span 
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="ml-0 whitespace-nowrap overflow-hidden font-bold tracking-tight text-sm"
                  >
                    Logout
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex h-screen flex-1 flex-col overflow-hidden min-w-0 bg-slate-50/50 dark:bg-slate-950/50">
          {/* Top bar - Mobile */}
          <div className="flex items-center justify-between border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 py-3 md:hidden sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-xl"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <img src="/logo.png" alt="Logo" className="h-7 w-auto dark:brightness-0 dark:invert" />
            </div>
            <div className="flex items-center gap-2">
              <DarkModeToggle />
              <NotificationPopover />
            </div>
          </div>

          {/* Top bar - Desktop - Refined & Subtle */}
          <div className="hidden md:flex items-center justify-between border-b border-white/10 dark:border-slate-800/50 bg-white/30 dark:bg-slate-900/40 backdrop-blur-md px-6 lg:px-10 py-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-4 lg:gap-6 shrink-0">
              <div className="flex flex-col">
                <h1 className="text-base lg:text-lg font-black italic tracking-tighter uppercase leading-none text-slate-900 dark:text-white">Interior</h1>
                <span className="text-[8px] lg:text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1 whitespace-nowrap">Financial Intelligence Unit</span>
              </div>
              <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block" />
              <div className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-black text-[7px] lg:text-[8px] uppercase tracking-widest whitespace-nowrap">
                Secure Access: {currentUser.role}
              </div>
            </div>
            <div className="flex items-center gap-4 lg:gap-6 shrink-0 ml-4">
              <div className="flex items-center gap-2 bg-slate-500/5 p-1 rounded-xl border border-white/5">
                <DarkModeToggle />
              </div>
              <NotificationPopover />
            </div>
          </div>

          {/* Content area */}
          <div 
            ref={scrollRef} 
            className="flex-1 h-full w-full min-w-0 overflow-y-auto relative custom-scrollbar"
          >
            <main className="flex-1 p-4 md:p-6 lg:p-8 w-full max-w-full min-w-0 overflow-x-hidden">
              <div className="w-full max-w-full min-w-0">
                {children}
              </div>
            </main>

            {/* Floating Scroll to Top button */}
            <AnimatePresence>
              {showScrollTop && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 20 }}
                  transition={{ duration: 0.2 }}
                  onClick={scrollToTop}
                  className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-xl hover:bg-primary/95 transition-all hover:scale-110 active:scale-95 border border-primary/20 cursor-pointer"
                  aria-label="Scroll to top"
                >
                  <ArrowUp className="h-5 w-5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </UserContext.Provider>
  )
}

function ProfileAvatar({ user }: { user: any }) {
  const imageUrl = useQuery(api.users.getUserProfileImageUrl, { storageId: user.image || undefined })
  
  if (imageUrl) {
    return (
      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-800">
        <img src={imageUrl} alt={user.name} className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 uppercase tracking-tighter">
        {user.name?.[0]?.toUpperCase() || <UserIcon className="h-4 w-4" />}
    </div>
  )
}

function Badge({ children, variant, className }: any) {
  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
      variant === "outline" ? "border" : "bg-primary text-primary-foreground",
      className
    )}>
      {children}
    </span>
  )
}
