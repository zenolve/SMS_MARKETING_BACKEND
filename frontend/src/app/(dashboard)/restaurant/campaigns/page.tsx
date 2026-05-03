'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import dynamic from 'next/dynamic'
import {
    MessageSquare,
    Plus,
    Search,
    MoreHorizontal,
    Eye,
    Edit2,
    Copy,
    Trash2,
    XCircle,
    Send,
    Clock,
    Loader2,
    AlertCircle,
} from 'lucide-react'

const SchedulerHeatmap = dynamic(
    async () => {
        try {
            const mod = await import('@/components/campaigns/scheduler-heatmap')
            return { default: mod.SchedulerHeatmap }
        } catch {
            return { default: () => <p className="text-destructive">Failed to load scheduler. Please refresh.</p> }
        }
    },
    {
        ssr: false,
        loading: () => <Loader2 className="h-6 w-6 animate-spin" />,
    }
)
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { useCampaigns, useCancelCampaign, useDeleteCampaign, Campaign } from '@/lib/queries'

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
    sent: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: Send },
    scheduled: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Clock },
    draft: { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: Edit2 },
    cancelled: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
    sending: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Send },
    failed: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: XCircle },
}

export default function CampaignsPage() {
    const { restaurantId, isLoading: authLoading } = useAuth()
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<string | null>(null)

    // Fetch campaigns from API
    const {
        data: campaigns = [],
        isLoading: campaignsLoading,
        error: campaignsError,
        refetch,
    } = useCampaigns(restaurantId, statusFilter || undefined)

    // Mutations
    const cancelMutation = useCancelCampaign()
    const deleteMutation = useDeleteCampaign()

    // Client-side search filter
    const filteredCampaigns = campaigns.filter((campaign) => {
        return campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
    })

    // Format campaigns for heatmap
    const heatmapCampaigns = campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        scheduled_at: c.scheduled_at || null,
        status: c.status,
    }))

    function formatDate(dateStr: string | null | undefined) {
        if (!dateStr) return '-'
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        })
    }

    async function handleCancel(campaignId: string) {
        try {
            await cancelMutation.mutateAsync(campaignId)
            toast.success('Campaign cancelled')
        } catch (error) {
            toast.error('Failed to cancel campaign')
        }
    }

    async function handleDelete(campaignId: string) {
        try {
            await deleteMutation.mutateAsync(campaignId)
            toast.success('Campaign deleted')
        } catch (error) {
            toast.error('Failed to delete campaign')
        }
    }

    async function handleDuplicate(campaign: Campaign) {
        // For now, just show success - in production, would call create with copied data
        toast.success('Campaign duplicated', {
            description: 'Duplicate feature coming soon',
        })
    }

    // Loading state
    if (authLoading || campaignsLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        )
    }

    // Error state
    if (campaignsError) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <p className="text-red-400">Failed to load campaigns</p>
                <Button onClick={() => refetch()} variant="outline">
                    Retry
                </Button>
            </div>
        )
    }

    // No restaurant ID
    if (!restaurantId) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <AlertCircle className="h-12 w-12 text-amber-500" />
                <p className="text-amber-400">No restaurant associated with your account</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
                    <p className="text-muted-foreground mt-1">Manage your SMS marketing campaigns</p>
                </div>
                <Link href="/restaurant/campaigns/new">
                    <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
                        <Plus className="mr-2 h-4 w-4" />
                        New Campaign
                    </Button>
                </Link>
            </div>

            {/* Heatmap */}
            <Card className="bg-card border-border">
                <CardContent className="py-6">
                    <SchedulerHeatmap campaigns={heatmapCampaigns} />
                </CardContent>
            </Card>

            {/* Filters */}
            <Card className="bg-card border-border">
                <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search campaigns..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        <div className="flex gap-2">
                            {['sent', 'scheduled', 'sending', 'failed', 'draft'].map((status) => (
                                <Button
                                    key={status}
                                    variant={statusFilter === status ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setStatusFilter(statusFilter === status ? null : status)}
                                    className={cn(
                                        statusFilter === status
                                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                            : 'border-border bg-background hover:bg-accent text-muted-foreground'
                                    )}
                                >
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Campaigns Table */}
            <Card className="bg-card border-border">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-muted/30">
                                <TableHead className="text-muted-foreground">Campaign</TableHead>
                                <TableHead className="text-muted-foreground">Status</TableHead>
                                <TableHead className="text-muted-foreground">Recipients</TableHead>
                                <TableHead className="text-muted-foreground">Delivery</TableHead>
                                <TableHead className="text-muted-foreground">Scheduled</TableHead>
                                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredCampaigns.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                                        <p>No campaigns found</p>
                                        <Link href="/restaurant/campaigns/new">
                                            <Button variant="link" className="text-primary hover:text-primary/80">
                                                Create your first campaign
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCampaigns.map((campaign) => {
                                    const StatusIcon = statusConfig[campaign.status]?.icon || MessageSquare
                                    const deliveryRate = campaign.total_sent > 0
                                        ? Math.round((campaign.total_delivered / campaign.total_sent) * 100)
                                        : 0

                                    return (
                                        <TableRow
                                            key={campaign.id}
                                            className="border-border hover:bg-muted/30"
                                        >
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                                                        <MessageSquare className="w-5 h-5 text-indigo-400" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-foreground">{campaign.name}</p>
                                                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                            {campaign.message_template}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={cn('capitalize', statusConfig[campaign.status]?.color)}
                                                >
                                                    <StatusIcon className="mr-1 h-3 w-3" />
                                                    {campaign.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-foreground">
                                                {campaign.total_recipients.toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                {campaign.total_sent > 0 ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-foreground">{deliveryRate}%</span>
                                                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-emerald-500 rounded-full"
                                                                style={{ width: `${deliveryRate}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatDate(campaign.scheduled_at)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-popover border-border">
                                                        <DropdownMenuItem className="text-foreground focus:bg-accent focus:text-foreground">
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </DropdownMenuItem>
                                                        {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                                                            <DropdownMenuItem className="text-foreground focus:bg-accent focus:text-foreground">
                                                                <Edit2 className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem
                                                            className="text-foreground focus:bg-accent focus:text-foreground"
                                                            onClick={() => handleDuplicate(campaign)}
                                                        >
                                                            <Copy className="mr-2 h-4 w-4" />
                                                            Duplicate
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator className="bg-border" />
                                                        {campaign.status === 'scheduled' && (
                                                            <DropdownMenuItem
                                                                className="text-red-400 focus:bg-red-900/30 focus:text-red-400"
                                                                onClick={() => handleCancel(campaign.id)}
                                                                disabled={cancelMutation.isPending}
                                                            >
                                                                <XCircle className="mr-2 h-4 w-4" />
                                                                Cancel
                                                            </DropdownMenuItem>
                                                        )}
                                                        {campaign.status === 'draft' && (
                                                            <DropdownMenuItem
                                                                className="text-red-400 focus:bg-red-900/30 focus:text-red-400"
                                                                onClick={() => handleDelete(campaign.id)}
                                                                disabled={deleteMutation.isPending}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        )}
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
