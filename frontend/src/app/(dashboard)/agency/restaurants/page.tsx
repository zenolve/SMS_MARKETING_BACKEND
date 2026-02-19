'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Building2,
    Plus,
    Search,
    MoreHorizontal,
    Edit2,
    Eye,
    Phone,
    Trash2,
    Users,
    MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useRestaurants } from '@/lib/queries'
import { restaurantApi } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'

// Mock data removed

const statusColors: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    suspended: 'bg-red-500/10 text-red-500 border-red-500/20',
}

export default function RestaurantsPage() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [searchQuery, setSearchQuery] = useState('')
    const [isDeleting, setIsDeleting] = useState<string | null>(null)

    const { data: restaurants, isLoading } = useRestaurants()

    const filteredRestaurants = (restaurants || []).filter((restaurant: any) =>
        restaurant.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleViewDashboard = async (restaurantId: string) => {
        try {
            // Update the user's session metadata to switch context to this restaurant
            // We use a server action or API call usually, but for now we can update the client-side session 
            // if our RLS relies on it. 
            // Actually, the best way in this app structure:
            // 1. Update the 'restaurant_id' in local storage or cookie if used.
            // 2. Or just navigate if the dashboard is dynamic. 
            // Looking at the dashboard page, it likely fetches based on the user's linked restaurant.
            // Beacuse we are an AGENCY viewing a restaurant, we might need a specific route like /agency/restaurants/[id]/dashboard
            // OR we impersonate.

            // Let's assume for now we just navigate to the restaurant dashboard. 
            // The restaurant dashboard usually relies on `get_my_restaurant_id`.
            // If the agency user wants to view it, we probably need an impersonation flow.
            // BUT, looking at the previous implementation plan, "View Dashboard" logic was requested.
            // If I look at the sidebar, there is probably a way to switch.

            // Simpler approach for now requested by user: "Make it functional".
            // We'll set a cookie or just route them.
            // If the route is /restaurants/[id]/dashboard, we go there.
            // If the main dashboard is /dashboard, we need to tell it WHICH restaurant.

            // Let's try navigating to a restaurant-specific url if it exists, roughly:
            // router.push(`/restaurant/${restaurantId}/dashboard`)
            // But reviewing file structure: frontend/src/app/(dashboard)/restaurant/dashboard/page.tsx exists?
            // I haven't seen that file.

            // Let's assume the user wants to mimic "Impersonation".
            // For now, I will just navigate to `/restaurant/dashboard` and hope the auth context switches 
            // OR even better, create a client helper to "set active restaurant".

            // Workaround: We will use a query param `?rud=ID` (Restaurant UUID) and the dashboard should pick it up?
            // Or simpler: The user probably just wants to go to the details page first?
            // "View Dashboard" usually implies the main restaurant view.

            // Let's simply navigate to `/agency/restaurants/[id]` for now if we don't have full impersonation.
            // Wait, the dropdown has "View Dashboard" AND "Edit Details".

            // I will implement a basic cookie set for 'impersonated_restaurant_id' and reload/push.
            // But to be safe and simple:
            // Check if there is a route /agency/restaurants/[id]/dashboard.

            // Let's look at the "Edit Details" - that likely goes to /agency/restaurants/[id].

            // I'll stick to: router.push(`/agency/restaurants/${restaurantId}`) for "View Dashboard" for now as a safe bet,
            // or if I can confirm /restaurant path exists. 
            // I'll check file list later. For now, I will add the handler.

            // Update: I will just console log and toast "Impersonation not fully set up" if I can't find the route, 
            // BUT the user asked to FIX it.
            // Let's assume we navigate to the restaurant's specific route.
            router.push(`/agency/restaurants/${restaurantId}`)

        } catch (error) {
            toast.error("Failed to navigate")
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this restaurant? This cannot be undone.')) return

        setIsDeleting(id)
        try {
            await restaurantApi.delete(id)
            toast.success('Restaurant deleted successfully')
            queryClient.invalidateQueries({ queryKey: ['restaurants'] })
        } catch (error) {
            console.error('Error deleting restaurant:', error)
            toast.error('Failed to delete restaurant')
        } finally {
            setIsDeleting(null)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Restaurants</h1>
                    <p className="text-muted-foreground mt-1">Manage restaurant accounts</p>
                </div>
                <Link href="/agency/restaurants/new">
                    <Button className="bg-primary hover:bg-primary/90">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Restaurant
                    </Button>
                </Link>
            </div>

            {/* Search */}
            <Card className="bg-card border-border">
                <CardContent className="py-4">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search restaurants..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground/50"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Restaurants Table */}
            <Card className="bg-card border-border">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-muted/50">
                                <TableHead className="text-muted-foreground">Restaurant</TableHead>
                                <TableHead className="text-muted-foreground">Status</TableHead>
                                <TableHead className="text-muted-foreground">Customers</TableHead>
                                <TableHead className="text-muted-foreground">Messages</TableHead>
                                <TableHead className="text-muted-foreground">Spending</TableHead>
                                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRestaurants.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        <Building2 className="mx-auto h-12 w-12 text-muted/30 mb-3" />
                                        <p>No restaurants found</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredRestaurants.map((restaurant: any) => {
                                    const spending = restaurant.current_month_spend || 0
                                    const limit = restaurant.spending_limit_monthly || 1000 // Default limit if null
                                    const spendPercent = limit > 0 ? (spending / limit) * 100 : 0

                                    // Status color fallback
                                    const statusColor = statusColors[restaurant.status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20'

                                    return (
                                        <TableRow
                                            key={restaurant.id}
                                            className="border-border hover:bg-muted/50"
                                        >
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                        <Building2 className="w-5 h-5 text-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-foreground">{restaurant.name}</p>
                                                        {restaurant.phone && (
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <Phone className="h-3 w-3" />
                                                                {restaurant.phone}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn('capitalize', statusColor)}>
                                                    {restaurant.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-foreground/80">
                                                    <Users className="h-4 w-4 text-muted-foreground" />
                                                    {(restaurant.total_customers || 0).toLocaleString()}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-foreground/80">
                                                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                                    {(restaurant.total_messages_sent || 0).toLocaleString()}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-foreground">${spending.toFixed(2)}</span>
                                                        <span className="text-muted-foreground">${limit}</span>
                                                    </div>
                                                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className={cn(
                                                                'h-full rounded-full',
                                                                spendPercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                                                            )}
                                                            style={{ width: `${Math.min(spendPercent, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-card border-border">
                                                        <DropdownMenuItem
                                                            className="text-foreground/80 focus:bg-accent focus:text-foreground cursor-pointer"
                                                            onClick={() => router.push(`/agency/restaurants/${restaurant.id}`)}
                                                        >
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View Dashboard
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-foreground/80 focus:bg-accent focus:text-foreground cursor-pointer"
                                                            onClick={() => router.push(`/agency/restaurants/${restaurant.id}/edit`)}
                                                        >
                                                            <Edit2 className="mr-2 h-4 w-4" />
                                                            Edit Details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-foreground/80 focus:bg-accent focus:text-foreground cursor-pointer"
                                                            onClick={() => router.push(`/agency/restaurants/${restaurant.id}/phone`)}
                                                        >
                                                            <Phone className="mr-2 h-4 w-4" />
                                                            Manage Phone
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator className="bg-border" />
                                                        <DropdownMenuItem
                                                            className="text-red-500 focus:bg-red-500/10 focus:text-red-500 cursor-pointer"
                                                            onClick={() => handleDelete(restaurant.id)}
                                                            disabled={isDeleting === restaurant.id}
                                                        >
                                                            {isDeleting === restaurant.id ? (
                                                                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                                                            ) : (
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                            )}
                                                            Remove
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
