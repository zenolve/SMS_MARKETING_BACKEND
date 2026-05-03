'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import {
    Settings,
    Building2,
    Phone,
    Bell,
    Shield,
    Loader2,
    Save,
    ExternalLink,
} from 'lucide-react'

const TwilioNumberPicker = dynamic(
    async () => {
        try {
            const mod = await import('@/components/agency/twilio-number-picker')
            return { default: mod.TwilioNumberPicker }
        } catch {
            return { default: () => <p className="text-destructive">Failed to load. Please refresh.</p> }
        }
    },
    {
        ssr: false,
        loading: () => <Loader2 className="h-6 w-6 animate-spin" />,
    }
)

interface RestaurantSettings {
    name: string
    email: string
    phone: string
    address: string
    timezone: string
    twilio_phone_number: string
    twilio_subaccount_sid?: string
    monthly_sms_limit: number
}

export default function SettingsPage() {
    const { restaurantId, isLoading: authLoading } = useAuth()
    const supabase = createClient()
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isInitializing, setIsInitializing] = useState(false)
    const [settings, setSettings] = useState<RestaurantSettings | null>(null)

    const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<RestaurantSettings>()

    useEffect(() => {
        if (restaurantId) {
            loadSettings()
        }
    }, [restaurantId])

    async function loadSettings() {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('restaurants')
                .select('name, email, phone, address, timezone, twilio_phone_number, twilio_subaccount_sid, monthly_sms_limit')
                .eq('id', restaurantId)
                .single()

            if (error) throw error

            setSettings(data)
            reset(data)
        } catch (error) {
            console.error('Error loading settings:', error)
            toast.error('Failed to load settings')
        } finally {
            setIsLoading(false)
        }
    }

    async function handleInitializeTwilio() {
        if (!restaurantId) return
        
        setIsInitializing(true)
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/restaurants/${restaurantId}/initialize-twilio`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.detail || 'Failed to initialize Twilio')
            }

            const updatedRestaurant = await response.json()
            toast.success('Twilio account initialized successfully!')
            
            // Refresh settings
            loadSettings()
        } catch (error: any) {
            console.error('Error initializing Twilio:', error)
            toast.error(error.message || 'Failed to initialize Twilio. Your agency may have reached its subaccount limit.')
        } finally {
            setIsInitializing(false)
        }
    }

    async function onSubmit(data: RestaurantSettings) {
        if (!restaurantId) return

        setIsSaving(true)
        try {
            const { error } = await supabase
                .from('restaurants')
                .update({
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    address: data.address,
                    timezone: data.timezone,
                })
                .eq('id', restaurantId)

            if (error) throw error

            toast.success('Settings saved successfully')
            setSettings({ ...settings, ...data } as RestaurantSettings)
            reset({ ...settings, ...data } as RestaurantSettings)
        } catch (error) {
            console.error('Error saving settings:', error)
            toast.error('Failed to save settings')
        } finally {
            setIsSaving(false)
        }
    }

    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-indido-500" />
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Settings className="h-6 w-6 text-primary" />
                    Settings
                </h1>
                <p className="text-muted-foreground mt-1">Manage your restaurant and account settings</p>
            </div>

            <Tabs defaultValue="business" className="space-y-6">
                <TabsList className="bg-muted border border-border">
                    <TabsTrigger value="business" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Building2 className="h-4 w-4 mr-2" />
                        Business
                    </TabsTrigger>
                    <TabsTrigger value="sms" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Phone className="h-4 w-4 mr-2" />
                        SMS Settings
                    </TabsTrigger>
                    <TabsTrigger value="notifications" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Bell className="h-4 w-4 mr-2" />
                        Notifications
                    </TabsTrigger>
                </TabsList>

                {/* Business Settings */}
                <TabsContent value="business">
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">Business Information</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Update your restaurant details
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name" className="text-foreground">Business Name</Label>
                                        <Input
                                            id="name"
                                            {...register('name', { required: 'Business name is required' })}
                                            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                                        />
                                        {errors.name && (
                                            <p className="text-sm text-destructive">{errors.name.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-foreground">Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            {...register('email')}
                                            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="phone" className="text-foreground">Phone Number</Label>
                                        <Input
                                            id="phone"
                                            {...register('phone')}
                                            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="timezone" className="text-foreground">Timezone</Label>
                                        <Input
                                            id="timezone"
                                            {...register('timezone')}
                                            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="address" className="text-foreground">Address</Label>
                                    <Input
                                        id="address"
                                        {...register('address')}
                                        className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                                    />
                                </div>

                                <div className="flex justify-end pt-4">
                                    <Button
                                        type="submit"
                                        disabled={isSaving || !isDirty}
                                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="mr-2 h-4 w-4" />
                                                Save Changes
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* SMS Settings */}
                <TabsContent value="sms">
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">SMS Configuration</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                View and manage your SMS sending settings
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Subaccount Status */}
                            <div className="p-4 rounded-lg bg-accent/50 border border-border">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-foreground">Twilio Subaccount</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {settings?.twilio_subaccount_sid 
                                                ? `Configured (${settings.twilio_subaccount_sid})` 
                                                : 'Not Initialized'}
                                        </p>
                                    </div>
                                    {settings?.twilio_subaccount_sid ? (
                                        <div className="bg-green-500/20 text-green-500 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">
                                            Connected
                                        </div>
                                    ) : (
                                        <Button 
                                            size="sm" 
                                            onClick={handleInitializeTwilio}
                                            disabled={isInitializing}
                                            className="bg-amber-600 hover:bg-amber-700 text-white"
                                        >
                                            {isInitializing ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                'Initialize Now'
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-accent/50 border border-border">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-foreground">Twilio Phone Number</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {settings?.twilio_phone_number || 'No dedicated number assigned'}
                                        </p>
                                    </div>
                                    <Phone className="h-5 w-5 text-primary" />
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-accent/50 border border-border">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-foreground">Monthly SMS Limit</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {settings?.monthly_sms_limit?.toLocaleString() || 'Unlimited'} messages per month
                                        </p>
                                    </div>
                                    <Shield className="h-5 w-5 text-amber-500" />
                                </div>
                            </div>

                            {!settings?.twilio_subaccount_sid ? (
                                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                    <p className="text-sm text-amber-300">
                                        <strong>Subaccount Required:</strong> You must initialize your Twilio account before you can send messages or buy a phone number.
                                    </p>
                                </div>
                            ) : !settings?.twilio_phone_number && (
                                <div className="mt-8 border-t border-border pt-8">
                                    <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
                                        <ExternalLink className="w-5 h-5 text-indigo-500" />
                                        Get a Dedicated Number
                                    </h3>
                                    <TwilioNumberPicker
                                        restaurantId={restaurantId || undefined}
                                        onSelect={(number: string) => {
                                            if (settings) {
                                                setSettings({ ...settings, twilio_phone_number: number })
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Notifications Settings */}
                <TabsContent value="notifications">
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">Notification Preferences</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Choose what notifications you want to receive
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-accent/50 border border-border">
                                <div>
                                    <p className="font-medium text-foreground">Campaign Completion</p>
                                    <p className="text-sm text-muted-foreground">Get notified when a campaign finishes sending</p>
                                </div>
                                <Switch defaultChecked />
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg bg-accent/50 border border-border">
                                <div>
                                    <p className="font-medium text-foreground">Low Balance Warning</p>
                                    <p className="text-sm text-muted-foreground">Alert when approaching monthly SMS limit</p>
                                </div>
                                <Switch defaultChecked />
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg bg-accent/50 border border-border">
                                <div>
                                    <p className="font-medium text-foreground">New Customer Opt-ins</p>
                                    <p className="text-sm text-muted-foreground">Notify when customers opt-in to receive messages</p>
                                </div>
                                <Switch />
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg bg-accent/50 border border-border">
                                <div>
                                    <p className="font-medium text-foreground">Weekly Summary</p>
                                    <p className="text-sm text-muted-foreground">Receive weekly performance reports</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
