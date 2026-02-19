'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { SMSPreviewer } from '@/components/campaigns/sms-previewer'
import { DeadHourScheduler } from '@/components/campaigns/dead-hour-scheduler'
import { SchedulerHeatmap } from '@/components/campaigns/scheduler-heatmap'
import { campaignSchema, type CampaignInput } from '@/lib/validations'
import { cn } from '@/lib/utils'
import { calculateSegments } from '@/lib/sms-utils'
import { useAuth } from '@/contexts/auth-context'
import { useCreateCampaign, useSendCampaign, useCampaigns, useCustomers } from '@/lib/queries'
import {
    MessageSquare,
    Users,
    Clock,
    Send,
    ArrowLeft,
    ArrowRight,
    Check,
    Loader2,
    AlertCircle,
} from 'lucide-react'

const steps = [
    { id: 1, title: 'Message', icon: MessageSquare },
    { id: 2, title: 'Audience', icon: Users },
    { id: 3, title: 'Schedule', icon: Clock },
    { id: 4, title: 'Review', icon: Check },
]

interface Segment {
    id: string
    name: string
    count: number
    criteria?: Record<string, unknown>
}

export default function NewCampaignPage() {
    const router = useRouter()
    const { restaurantId, isLoading: authLoading } = useAuth()
    const [currentStep, setCurrentStep] = useState(1)
    const [selectedSegment, setSelectedSegment] = useState('all')
    const [scheduleDate, setScheduleDate] = useState<Date>()
    const [scheduleTime, setScheduleTime] = useState('')
    const [timezone, setTimezone] = useState('GMT')
    const [scheduleType, setScheduleType] = useState<'now' | 'scheduled'>('scheduled')

    // API hooks
    const createCampaign = useCreateCampaign()
    const sendCampaign = useSendCampaign()

    // Fetch existing campaigns for heatmap
    const { data: existingCampaigns = [] } = useCampaigns(restaurantId)

    // Fetch customers to build segments
    const { data: customers = [] } = useCustomers(restaurantId)

    // Build segments from customer data
    const segments: Segment[] = useMemo(() => {
        const optedInCustomers = customers.filter(c => c.opt_in_status === 'opted_in')

        // Get unique tags from customers
        const tagCounts = new Map<string, number>()
        optedInCustomers.forEach(customer => {
            customer.tags?.forEach(tag => {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
            })
        })

        const tagSegments: Segment[] = Array.from(tagCounts.entries()).map(([tag, count]) => ({
            id: `tag:${tag}`,
            name: tag,
            count,
            criteria: { tags: [tag] }
        }))

        return [
            { id: 'all', name: 'All Opted-In Customers', count: optedInCustomers.length, criteria: {} },
            ...tagSegments.sort((a, b) => b.count - a.count).slice(0, 10) // Top 10 tags
        ]
    }, [customers])

    // Format campaigns for heatmap
    const heatmapCampaigns = existingCampaigns
        .filter(c => c.status === 'scheduled')
        .map(c => ({
            id: c.id,
            name: c.name,
            scheduled_at: c.scheduled_at || null,
            status: c.status,
        }))

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<CampaignInput>({
        resolver: zodResolver(campaignSchema),
        defaultValues: {
            name: '',
            message_template: '',
            schedule_type: 'one_time',
        },
    })

    const message = watch('message_template', '')
    const campaignName = watch('name', '')

    function nextStep() {
        setCurrentStep((s) => Math.min(s + 1, 4))
    }

    function prevStep() {
        setCurrentStep((s) => Math.max(s - 1, 1))
    }

    async function onSubmit() {
        if (!restaurantId) {
            toast.error('No restaurant ID found')
            return
        }

        try {
            const selectedSegmentData = segments.find((s) => s.id === selectedSegment)

            // Build scheduled_at datetime
            let scheduled_at: string | undefined
            if (scheduleType === 'scheduled' && scheduleDate && scheduleTime) {
                const [hours, minutes] = scheduleTime.split(':').map(Number)
                const scheduledDate = new Date(scheduleDate)
                scheduledDate.setHours(hours, minutes, 0, 0)

                // LEAD TIME VALIDATION (15 Minutes)
                const now = new Date()
                const minLeadTime = new Date(now.getTime() + 15 * 60 * 1000)

                if (scheduledDate < minLeadTime) {
                    toast.error('Schedule Error', {
                        description: 'Campaigns must be scheduled at least 15 minutes in the future.'
                    })
                    return
                }

                scheduled_at = scheduledDate.toISOString()
            }

            // Create the campaign
            const campaignData = {
                restaurant_id: restaurantId,
                name: campaignName,
                message_template: message,
                segment_criteria: selectedSegmentData?.criteria || {},
                schedule_type: 'one_time',
                scheduled_at,
                timezone,
            }

            const result = await createCampaign.mutateAsync(campaignData)
            const newCampaignId = result.data.id

            // If sending immediately or scheduled, trigger send
            await sendCampaign.mutateAsync(newCampaignId)

            toast.success(
                scheduleType === 'now'
                    ? 'Campaign sending started!'
                    : 'Campaign scheduled successfully!'
            )
            router.push('/restaurant/campaigns')
        } catch (error) {
            console.error('Campaign creation error:', error)
            toast.error('Failed to create campaign')
        }
    }

    const selectedSegmentData = segments.find((s) => s.id === selectedSegment)
    const isSubmitting = createCampaign.isPending || sendCampaign.isPending

    // Loading state
    if (authLoading) {
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
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Create Campaign</h1>
                    <p className="text-muted-foreground mt-1">Build and schedule your SMS campaign</p>
                </div>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-between">
                {steps.map((step, i) => (
                    <div key={step.id} className="flex items-center flex-1">
                        <button
                            onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
                                currentStep === step.id && 'bg-primary/20 text-primary border border-primary/30',
                                currentStep > step.id && 'text-emerald-400 cursor-pointer hover:bg-emerald-500/10',
                                currentStep < step.id && 'text-muted-foreground opacity-50'
                            )}
                        >
                            <div className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                                currentStep === step.id && 'bg-primary text-primary-foreground',
                                currentStep > step.id && 'bg-emerald-500 text-white',
                                currentStep < step.id && 'bg-muted text-muted-foreground'
                            )}>
                                {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                            </div>
                            <span className="hidden sm:inline font-medium">{step.title}</span>
                        </button>
                        {i < steps.length - 1 && (
                            <div className={cn(
                                'flex-1 h-px mx-4',
                                currentStep > step.id ? 'bg-emerald-500' : 'bg-border'
                            )} />
                        )}
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Form Panel */}
                <Card className="bg-card border-border">
                    <CardContent className="p-6">
                        {/* Step 1: Message */}
                        {currentStep === 1 && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-foreground">Campaign Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g., Weekend Special Promo"
                                        className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                                        {...register('name')}
                                    />
                                    {errors.name && (
                                        <p className="text-sm text-destructive">{errors.name.message}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="message" className="text-foreground">Message</Label>
                                    <Textarea
                                        id="message"
                                        placeholder="Type your SMS message here..."
                                        rows={6}
                                        className="bg-background border-border text-foreground placeholder:text-muted-foreground resize-none"
                                        {...register('message_template')}
                                    />
                                    {errors.message_template && (
                                        <p className="text-sm text-destructive">{errors.message_template.message}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        Tip: Keep messages under 160 characters for a single SMS segment. Use {'{first_name}'} for personalization.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Audience */}
                        {currentStep === 2 && (
                            <div className="space-y-4">
                                <Label className="text-foreground">Select Audience Segment</Label>
                                {segments.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                                        <p>No customers found</p>
                                        <p className="text-sm text-muted-foreground/70 mt-1">
                                            Import customers first to create campaigns
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {segments.map((segment) => (
                                            <button
                                                key={segment.id}
                                                type="button"
                                                onClick={() => setSelectedSegment(segment.id)}
                                                className={cn(
                                                    'w-full flex items-center justify-between p-4 rounded-lg border transition-all text-left',
                                                    selectedSegment === segment.id
                                                        ? 'border-primary bg-primary/10'
                                                        : 'border-border bg-background hover:border-border/80 hover:bg-accent/50'
                                                )}
                                            >
                                                <div>
                                                    <p className="font-medium text-foreground">{segment.name}</p>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        selectedSegment === segment.id
                                                            ? 'bg-primary/20 text-primary border-primary/30'
                                                            : 'bg-muted text-muted-foreground border-border'
                                                    )}
                                                >
                                                    {segment.count.toLocaleString()} customers
                                                </Badge>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 3: Schedule */}
                        {currentStep === 3 && (
                            <div className="space-y-6">
                                <Tabs value={scheduleType} onValueChange={(v) => setScheduleType(v as 'now' | 'scheduled')}>
                                    <TabsList className="w-full bg-muted border border-border">
                                        <TabsTrigger value="now" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                            Send Now
                                        </TabsTrigger>
                                        <TabsTrigger value="scheduled" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                            Schedule
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="now" className="mt-4">
                                        <div className="text-center py-8 text-muted-foreground">
                                            <Send className="mx-auto h-12 w-12 text-primary mb-3" />
                                            <p className="font-medium text-foreground">Send Immediately</p>
                                            <p className="text-sm mt-1">
                                                Your campaign will be sent as soon as you confirm
                                            </p>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="scheduled" className="mt-4">
                                        <DeadHourScheduler
                                            date={scheduleDate}
                                            onDateChange={setScheduleDate}
                                            time={scheduleTime}
                                            onTimeChange={setScheduleTime}
                                            timezone={timezone}
                                            onTimezoneChange={setTimezone}
                                        />
                                    </TabsContent>
                                </Tabs>

                                <SchedulerHeatmap campaigns={heatmapCampaigns} />
                            </div>
                        )}

                        {/* Step 4: Review */}
                        {currentStep === 4 && (
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <div className="p-4 rounded-lg bg-accent/50 border border-border">
                                        <p className="text-xs text-muted-foreground uppercase mb-1">Campaign Name</p>
                                        <p className="text-foreground font-medium">{campaignName || 'Untitled Campaign'}</p>
                                    </div>

                                    <div className="p-4 rounded-lg bg-accent/50 border border-border">
                                        <p className="text-xs text-muted-foreground uppercase mb-1">Audience</p>
                                        <p className="text-foreground font-medium">{selectedSegmentData?.name}</p>
                                        <p className="text-sm text-primary">
                                            {selectedSegmentData?.count.toLocaleString()} recipients
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-lg bg-accent/50 border border-border">
                                        <p className="text-xs text-muted-foreground uppercase mb-1">Schedule</p>
                                        <p className="text-foreground font-medium">
                                            {scheduleType === 'now' ? 'Send Immediately' :
                                                scheduleDate && scheduleTime ?
                                                    `${scheduleDate.toLocaleDateString()} at ${scheduleTime}` :
                                                    'Not scheduled'}
                                        </p>
                                        <p className="text-sm text-muted-foreground">{timezone}</p>
                                    </div>

                                    <div className="p-4 rounded-lg bg-accent/50 border border-border">
                                        <p className="text-xs text-muted-foreground uppercase mb-1">Estimated Cost</p>
                                        <p className="text-2xl font-bold text-foreground">
                                            ${((selectedSegmentData?.count || 0) * (calculateSegments(message).segments * 0.0079)).toFixed(2)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Based on {calculateSegments(message).segments} segment(s) per message ({calculateSegments(message).encoding})
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="flex justify-between mt-8 pt-6 border-t border-border">
                            <Button
                                variant="ghost"
                                onClick={prevStep}
                                disabled={currentStep === 1}
                                className="text-muted-foreground hover:text-foreground hover:bg-accent"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Button>

                            {currentStep < 4 ? (
                                <Button
                                    onClick={nextStep}
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                >
                                    Continue
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={onSubmit}
                                    disabled={isSubmitting}
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="mr-2 h-4 w-4" />
                                            {scheduleType === 'now' ? 'Send Campaign' : 'Schedule Campaign'}
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Preview Panel */}
                <div className="lg:sticky lg:top-8">
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">Preview</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                How your message will appear
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SMSPreviewer message={message} senderName="Your Restaurant" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
