'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
    LayoutDashboard,
    MessageSquare,
    Users,
    Calendar,
    Settings,
    LogOut,
    Menu,
    Building2,
    Phone,
    ChevronRight,
    BarChart3,
    Send,
} from 'lucide-react'
import { toast } from 'sonner'

import { ThemeToggle } from './ThemeToggle'

interface NavItem {
    title: string
    href: string
    icon: React.ElementType
}

const restaurantNavItems: NavItem[] = [
    { title: 'Dashboard', href: '/restaurant/dashboard', icon: LayoutDashboard },
    { title: 'Campaigns', href: '/restaurant/campaigns', icon: MessageSquare },
    { title: 'Messages', href: '/restaurant/messages', icon: Send },
    { title: 'Customers', href: '/restaurant/customers', icon: Users },
    { title: 'Schedule', href: '/restaurant/schedule', icon: Calendar },
    { title: 'Settings', href: '/restaurant/settings', icon: Settings },
]

const agencyNavItems: NavItem[] = [
    { title: 'Dashboard', href: '/agency/dashboard', icon: LayoutDashboard },
    { title: 'Restaurants', href: '/agency/restaurants', icon: Building2 },
    { title: 'Analytics', href: '/agency/analytics', icon: BarChart3 },
    { title: 'Phone Numbers', href: '/agency/phone-numbers', icon: Phone },
    { title: 'Settings', href: '/agency/settings', icon: Settings },
]

interface SidebarProps {
    userRole: 'agency_admin' | 'restaurant_admin'
    userEmail?: string
    businessName?: string
}

export function Sidebar({ userRole, userEmail, businessName }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const { selectedRestaurantId, setSelectedRestaurantId } = useAuth()
    const [isMobileOpen, setIsMobileOpen] = useState(false)

    const isImpersonating = !!selectedRestaurantId && userRole === 'agency_admin'
    const navItems = isImpersonating ? restaurantNavItems :
        userRole === 'agency_admin' ? agencyNavItems : restaurantNavItems

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/login')
        toast.success('Logged out successfully')
    }

    const handleStopManaging = () => {
        setSelectedRestaurantId(null)
        router.push('/agency/dashboard')
        toast.info('Stopped managing restaurant')
    }

    const NavContent = () => (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-sidebar-border/50">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-semibold text-foreground text-sm">SMS Marketing</h1>
                        <p className="text-xs text-muted-foreground">
                            {isImpersonating ? 'Managing Restaurant' : userRole === 'agency_admin' ? 'Agency' : 'Restaurant'}
                        </p>
                    </div>
                </div>
                <ThemeToggle />
            </div>

            {/* Impersonation Banner */}
            {isImpersonating && (
                <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-[10px] h-7 border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                        onClick={handleStopManaging}
                    >
                        <LogOut className="w-3 h-3 mr-1" />
                        Stop Managing
                    </Button>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsMobileOpen(false)}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all outline-none',
                                isActive
                                    ? 'bg-primary/10 text-primary border border-primary/30'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                            )}
                        >
                            <item.icon className={cn('w-5 h-5', isActive && 'text-primary')} />
                            {item.title}
                            {isActive && <ChevronRight className="w-4 h-4 ml-auto text-primary" />}
                        </Link>
                    )
                })}
            </nav>

            {/* User Profile */}
            <div className="p-3 border-t border-sidebar-border/50">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors outline-none">
                            <Avatar className="w-8 h-8">
                                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs">
                                    {userEmail?.charAt(0).toUpperCase() || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-medium text-foreground truncate">
                                    {businessName || 'User'}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                            </div>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => router.push(`/${userRole === 'agency_admin' ? 'agency' : 'restaurant'}/settings`)}
                        >
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={handleLogout}
                            className="text-destructive focus:text-destructive"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border/50 backdrop-blur-sm">
                <NavContent />
            </aside>

            {/* Mobile Sidebar */}
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden fixed top-4 left-4 z-40 bg-accent/80 backdrop-blur-sm"
                    >
                        <Menu className="h-5 w-5" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
                    <NavContent />
                </SheetContent>
            </Sheet>
        </>
    )
}
