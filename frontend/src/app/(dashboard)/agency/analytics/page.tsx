'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRestaurants } from '@/lib/queries'
import { BarChart3, TrendingUp, Users, MessageSquare, DollarSign } from 'lucide-react'

export default function AgencyAnalyticsPage() {
    const { data: restaurants = [], isLoading } = useRestaurants()

    // Aggregate data
    const totalCustomers = restaurants.reduce((acc: number, r: any) => acc + (r.total_customers || 0), 0)
    const totalMessages = restaurants.reduce((acc: number, r: any) => acc + (r.total_messages_sent || 0), 0)
    const totalSpend = restaurants.reduce((acc: number, r: any) => acc + (r.current_month_spend || 0), 0)

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Agency Analytics</h1>
                <p className="text-muted-foreground mt-1">Overview of performance across all restaurants</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalCustomers.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            Across {restaurants.length} restaurants
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Messages Sent</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalMessages.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            Lifetime messages
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Current Month Spend</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${totalSpend.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">
                            Aggregate spending
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle>Restaurant Performance</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {restaurants.map((restaurant: any) => (
                            <div key={restaurant.id} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
                                <div>
                                    <p className="font-medium text-foreground">{restaurant.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {restaurant.total_customers.toLocaleString()} customers
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-foreground">
                                        {restaurant.total_messages_sent.toLocaleString()} msgs
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        ${(restaurant.current_month_spend || 0).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
