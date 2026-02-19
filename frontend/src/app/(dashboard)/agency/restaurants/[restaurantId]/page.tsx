'use client'

import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Building2, Users, MessageSquare, DollarSign, LayoutDashboard, Edit2, Phone, TrendingUp } from 'lucide-react'
import { useRestaurant, useRestaurantStats } from '@/lib/queries'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function RestaurantAgencyViewPage() {
    const params = useParams()
    const router = useRouter()
    const restaurantId = params?.restaurantId as string

    const { data: restaurant, isLoading: isLoadingRestaurant } = useRestaurant(restaurantId)
    const { data: stats, isLoading: isLoadingStats } = useRestaurantStats(restaurantId)

    if (isLoadingRestaurant || isLoadingStats) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!restaurant) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <p className="text-muted-foreground">Restaurant not found</p>
                <Button variant="outline" onClick={() => router.push('/agency/restaurants')}>
                    Back to List
                </Button>
            </div>
        )
    }

    const statCards = [
        {
            title: 'Total Customers',
            value: stats?.customers?.total?.toLocaleString() || '0',
            icon: Users,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
        },
        {
            title: 'Messages Sent',
            value: stats?.messages?.total_sent?.toLocaleString() || '0',
            icon: MessageSquare,
            color: 'text-green-500',
            bg: 'bg-green-500/10',
        },
        {
            title: 'Delivery Rate',
            value: `${stats?.messages?.delivery_rate || 0}%`,
            icon: TrendingUp,
            color: 'text-purple-500',
            bg: 'bg-purple-500/10',
        },
        {
            title: 'Associated Cost',
            value: `$${stats?.cost?.total || '0.00'}`,
            icon: DollarSign,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
        },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/agency/restaurants')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Building2 className="h-6 w-6 text-primary" />
                            {restaurant.name}
                        </h1>
                        <p className="text-muted-foreground">Agency View</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link href={`/agency/restaurants/${restaurantId}/edit`}>
                        <Button variant="outline">
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit Details
                        </Button>
                    </Link>
                    <Link href={`/agency/restaurants/${restaurantId}/phone`}>
                        <Button variant="outline">
                            <Phone className="mr-2 h-4 w-4" />
                            Manage Phone
                        </Button>
                    </Link>
                    {/* Impersonation-like link if needed in future */}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat) => (
                    <Card key={stat.title}>
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                                <h3 className="text-2xl font-bold mt-2">{stat.value}</h3>
                            </div>
                            <div className={`p-3 rounded-full ${stat.bg}`}>
                                <stat.icon className={`h-6 w-6 ${stat.color}`} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Recent Activity or other details could go here */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Manage this restaurant&apos;s settings</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Button variant="outline" className="justify-start h-auto py-4 px-4" onClick={() => router.push(`/agency/restaurants/${restaurantId}/edit`)}>
                        <div className="flex flex-col items-start gap-1">
                            <span className="font-semibold flex items-center gap-2">
                                <Edit2 className="h-4 w-4" /> Edit Profile
                            </span>
                            <span className="text-xs text-muted-foreground">Update name, address, etc.</span>
                        </div>
                    </Button>
                    <Button variant="outline" className="justify-start h-auto py-4 px-4" onClick={() => router.push(`/agency/restaurants/${restaurantId}/phone`)}>
                        <div className="flex flex-col items-start gap-1">
                            <span className="font-semibold flex items-center gap-2">
                                <Phone className="h-4 w-4" /> Phone Number
                            </span>
                            <span className="text-xs text-muted-foreground">Purchase or configure Twilio number</span>
                        </div>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
