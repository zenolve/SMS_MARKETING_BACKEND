'use client'

import React, { useState, useCallback } from 'react'
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
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
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
    CreditCard,
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
    { title: 'Transactions', href: '/restaurant/transactions', icon: CreditCard },
    { title: 'Settings', href: '/restaurant/settings', icon: Settings },
]

const agencyNavItems: NavItem[] = [
    { title: 'Dashboard', href: '/agency/dashboard', icon: LayoutDashboard },
    { title: 'Restaurants', href: '/agency/restaurants', icon: Building2 },
    { title: 'Analytics', href: '/agency/analytics', icon: BarChart3 },
    { title: 'Phone Numbers', href: '/agency/phone-numbers', icon: Phone },
    { title: 'Transactions', href: '/agency/transactions', icon: CreditCard },
    { title: 'Settings', href: '/agency/settings', icon: Settings },
]

interface SidebarProps {
    userRole: 'agency_admin' | 'restaurant_admin'
    userEmail?: string
    businessName?: string
}

interface SidebarNavContentProps {
    navItems: NavItem[]
    pathname: string
    isImpersonating: boolean
    userEmail?: string
    businessName?: string
    userRole: 'agency_admin' | 'restaurant_admin'
    onMobileClose: () => void
    onLogout: () => void
    onStopManaging: () => void
}

const SidebarNavContent = React.memo(function SidebarNavContent({
    navItems,
    pathname,
    isImpersonating,
    userEmail,
    businessName,
    userRole,
    onMobileClose,
    onLogout,
    onStopManaging,
}: SidebarNavContentProps) {
    const router = useRouter()

    return (
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
                        onClick={onStopManaging}
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
                            prefetch={true}
                            onClick={onMobileClose}
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
                <div className="mt-4 pt-4 border-t border-sidebar-border/30">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all outline-none text-destructive hover:bg-destructive/10"
                    >
                        <LogOut className="w-5 h-5" />
                        Log out
                    </button>
                </div>
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
                            onClick={onLogout}
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
})

export function Sidebar({ userRole, userEmail, businessName }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const { selectedRestaurantId, setSelectedRestaurantId } = useAuth()
    const [isMobileOpen, setIsMobileOpen] = useState(false)

    const isImpersonating = !!selectedRestaurantId && userRole === 'agency_admin'
    const navItems = isImpersonating ? restaurantNavItems :
        userRole === 'agency_admin' ? agencyNavItems : restaurantNavItems

    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut()
        router.push('/login')
        toast.success('Logged out successfully')
    }, [supabase, router])

    const handleStopManaging = useCallback(() => {
        setSelectedRestaurantId(null)
        router.push('/agency/dashboard')
        toast.info('Stopped managing restaurant')
    }, [setSelectedRestaurantId, router])

    const handleMobileClose = useCallback(() => {
        setIsMobileOpen(false)
    }, [])

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-64 bg-sidebar border-r border-sidebar-border/50 backdrop-blur-sm">
                <SidebarNavContent
                    navItems={navItems}
                    pathname={pathname}
                    isImpersonating={isImpersonating}
                    userEmail={userEmail}
                    businessName={businessName}
                    userRole={userRole}
                    onMobileClose={handleMobileClose}
                    onLogout={handleLogout}
                    onStopManaging={handleStopManaging}
                />
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
                    <SheetTitle className="sr-only">Menu</SheetTitle>
                    <SidebarNavContent
                        navItems={navItems}
                        pathname={pathname}
                        isImpersonating={isImpersonating}
                        userEmail={userEmail}
                        businessName={businessName}
                        userRole={userRole}
                        onMobileClose={handleMobileClose}
                        onLogout={handleLogout}
                        onStopManaging={handleStopManaging}
                    />
                </SheetContent>
            </Sheet>
        </>
    )
}
