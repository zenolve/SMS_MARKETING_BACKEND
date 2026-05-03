'use client'

import React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    MessageSquare,
    Users,
    Send,
    TrendingUp,
    Plus,
    ArrowRight,
    Loader2,
    AlertCircle,
    Clock,
    CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useCampaigns, useCustomers, useRestaurantStats, useRestaurant, Campaign } from '@/lib/queries'
import { GetPhoneNumberCard } from './components/get-phone-number-card'

interface StatCardProps {
    title: string
    value: string | number
    change?: string
    changeType?: 'positive' | 'negative' | 'neutral'
    icon: React.ElementType
}

const StatCard = React.memo(function StatCard({ title, value, change, changeType = 'neutral', icon: Icon }: StatCardProps) {
    return (
        <Card className="bg-card border-border">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-sm text-slate-400">{title}</p>
                        <p className="text-2xl font-bold text-foreground">{value}</p>
                        {change && (
                            <p className={`text-xs ${changeType === 'positive' ? 'text-emerald-400' :
                                changeType === 'negative' ? 'text-red-400' :
                                    'text-slate-400'
                                }`}>
                                {change}
                            </p>
                        )}
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-indigo-400" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
})

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
    sent: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
    scheduled: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Clock },
    draft: { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: MessageSquare },
}

export default function DashboardPage() {
    const { restaurantId, profile, isLoading: authLoading } = useAuth()

    // Fetch real data from API
    const { data: restaurant, isLoading: restaurantLoading } = useRestaurant(restaurantId!)
    const { data: customers = [], isLoading: customersLoading } = useCustomers(restaurantId)
    const { data: campaigns = [], isLoading: campaignsLoading } = useCampaigns(restaurantId)
    const { data: stats, isLoading: statsLoading } = useRestaurantStats(restaurantId)

    // Calculate stats from real data
    const totalCustomers = customers.length
    const optedInCustomers = customers.filter(c => c.opt_in_status === 'opted_in').length
    const totalCampaigns = campaigns.length
    const sentCampaigns = campaigns.filter(c => c.status === 'sent')
    const scheduledCampaigns = campaigns.filter(c => c.status === 'scheduled')

    // Calculate delivery rate from sent campaigns
    const totalSent = sentCampaigns.reduce((sum, c) => sum + c.total_sent, 0)
    const totalDelivered = sentCampaigns.reduce((sum, c) => sum + c.total_delivered, 0)
    const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0

    // Recent campaigns (last 5)
    const recentCampaigns = campaigns.slice(0, 5)

    const isLoading = authLoading || customersLoading || campaignsLoading || restaurantLoading

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        )
    }

    // No restaurant ID
    if (!restaurantId) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <AlertCircle className="h-12 w-12 text-amber-500" />
                <p className="text-amber-400">No restaurant associated with your account</p>
                <p className="text-slate-500 text-sm">Please contact support to set up your restaurant.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        Welcome back, {profile?.business_name || 'Restaurant'}
                    </h1>
                    <p className="text-muted-foreground mt-1">Here's what's happening with your SMS campaigns</p>
                </div>
                <Link href="/restaurant/campaigns/new">
                    <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
                        <Plus className="mr-2 h-4 w-4" />
                        New Campaign
                    </Button>
                </Link>
            </div>

            {/* Check for Phone Number Setup */}
            {restaurant && !restaurant.twilio_phone_number && (
                <GetPhoneNumberCard restaurantId={restaurantId!} budget={restaurant.budget_monthly_gbp} spend={restaurant.current_spend_gbp} />
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Customers"
                    value={totalCustomers.toLocaleString()}
                    change={`${optedInCustomers.toLocaleString()} opted in`}
                    changeType="positive"
                    icon={Users}
                />
                <StatCard
                    title="Campaigns Sent"
                    value={sentCampaigns.length}
                    change={`${scheduledCampaigns.length} scheduled`}
                    changeType="neutral"
                    icon={Send}
                />
                <StatCard
                    title="Messages Delivered"
                    value={totalDelivered.toLocaleString()}
                    change={`${deliveryRate}% delivery rate`}
                    changeType="positive"
                    icon={MessageSquare}
                />
                <StatCard
                    title="Total Campaigns"
                    value={totalCampaigns}
                    change="All time"
                    changeType="neutral"
                    icon={TrendingUp}
                />
            </div>

            {/* Recent Campaigns */}
            <Card className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-foreground">Recent Campaigns</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Your latest SMS campaigns
                        </CardDescription>
                    </div>
                    <Link href="/restaurant/campaigns">
                        <Button variant="ghost" className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10">
                            View All
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </CardHeader>
                <CardContent>
                    {recentCampaigns.length === 0 ? (
                        <div className="text-center py-12">
                            <MessageSquare className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                            <p className="text-slate-400">No campaigns yet</p>
                            <p className="text-sm text-slate-500 mt-1">
                                Create your first campaign to start engaging customers
                            </p>
                            <Link href="/restaurant/campaigns/new">
                                <Button className="mt-4 bg-gradient-to-r from-indigo-600 to-purple-600">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Campaign
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recentCampaigns.map((campaign) => {
                                const StatusIcon = statusConfig[campaign.status]?.icon || MessageSquare
                                return (
                                    <div
                                        key={campaign.id}
                                        className="flex items-center justify-between p-4 rounded-lg bg-accent/50 border border-border"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                                                <MessageSquare className="w-5 h-5 text-indigo-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground">{campaign.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {campaign.total_recipients.toLocaleString()} recipients
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge
                                                variant="outline"
                                                className={statusConfig[campaign.status]?.color || statusConfig.draft.color}
                                            >
                                                <StatusIcon className="mr-1 h-3 w-3" />
                                                {campaign.status}
                                            </Badge>
                                            {campaign.sent_at && (
                                                <span className="text-xs text-slate-500">
                                                    {new Date(campaign.sent_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link href="/restaurant/customers">
                    <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                                    <Users className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-foreground">Manage Customers</p>
                                    <p className="text-sm text-muted-foreground">
                                        Import, view, and segment your customer base
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/restaurant/campaigns/new">
                    <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                                    <Send className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-foreground">Send a Campaign</p>
                                    <p className="text-sm text-muted-foreground">
                                        Create and schedule SMS marketing campaigns
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    )
}
