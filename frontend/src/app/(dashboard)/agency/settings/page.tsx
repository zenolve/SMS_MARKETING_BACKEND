'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/auth-context'
import { agencyApi } from '@/lib/api'
import {
    Settings,
    Building2,
    Phone,
    Loader2,
    Save,
} from 'lucide-react'

interface AgencySettings {
    name: string
    email: string
    phone: string
    twilio_account_sid: string
}

export default function AgencySettingsPage() {
    const { profile, isLoading: authLoading } = useAuth()
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<AgencySettings>()

    useEffect(() => {
        if (profile?.role === 'agency_admin' && profile.id) { // Agency ID is usually profile ID for simplified multi-tenant or linked differently
            // In this app structure, we might need to fetch the agency associated with the user
            // But for now, let's assume one agency per admin or similar relationship
            // The `useAuth` hook or `profile` might contain `agency_id`
            // Let's first try to list agencies (or get "my" agency if endpoint exists)
            loadSettings() // We need to know WHICH agency
        }
    }, [profile])


    async function loadSettings() {
        setIsLoading(true)
        try {
            // TODO: Ideally we have an endpoint `GET /agencies/me` or similar.
            // For now, assuming first agency or we list them.
            // Let's try to get the agency linked to the user.
            // Since we don't have direct link in profile in `useAuth` context usually (it has restaurant_id),
            // we might need to fetch agencies where this user is admin.
            // For simplicity in this fix, we will assume we can fetch the first agency or use a known ID if stored.

            // FIXME: Checking `agencies` table for this user?
            // UserProfile has `restaurant_id`, but for agency_admin it might be null.
            const { data } = await agencyApi.list()
            if (data && data.length > 0) {
                // Assuming single agency for now as per typical starter SaaS
                const agency = data[0]
                reset({
                    name: agency.name,
                    email: agency.email,
                    phone: agency.phone || '',
                    twilio_account_sid: agency.twilio_account_sid || '',
                })
            }

        } catch (error) {
            console.error('Error loading settings:', error)
            toast.error('Failed to load agency settings')
        } finally {
            setIsLoading(false)
        }
    }

    async function onSubmit(data: AgencySettings) {
        setIsSaving(true)
        try {
            // Again, need Agency ID. Using list to find it again is inefficient but safe for now.
            const { data: agencies } = await agencyApi.list()
            if (!agencies || agencies.length === 0) throw new Error("No agency found")

            const agencyId = agencies[0].id

            await agencyApi.update(agencyId, {
                name: data.name,
                email: data.email,
                phone: data.phone,
                twilio_account_sid: data.twilio_account_sid,
            })

            toast.success('Settings saved successfully')
            reset(data)
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
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Settings className="h-6 w-6 text-primary" />
                    Agency Settings
                </h1>
                <p className="text-muted-foreground mt-1">Manage your agency details and integrations</p>
            </div>

            <Tabs defaultValue="general" className="space-y-6">
                <TabsList className="bg-muted border border-border">
                    <TabsTrigger value="general" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Building2 className="h-4 w-4 mr-2" />
                        General
                    </TabsTrigger>
                    <TabsTrigger value="twilio" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Phone className="h-4 w-4 mr-2" />
                        Twilio Integration
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="general">
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <CardTitle>Agency Information</CardTitle>
                            <CardDescription>Update your agency's contact details</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Agency Name</Label>
                                        <Input id="name" {...register('name', { required: true })} />
                                        {errors.name && <span className="text-sm text-destructive">Required</span>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" type="email" {...register('email', { required: true })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Phone</Label>
                                        <Input id="phone" {...register('phone')} />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4">
                                    <Button type="submit" disabled={isSaving || !isDirty}>
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="twilio">
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <CardTitle>Twilio Configuration</CardTitle>
                            <CardDescription>Manage your main Twilio account connection</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="twilio_account_sid">Twilio Account SID</Label>
                                    <Input
                                        id="twilio_account_sid"
                                        type="password"
                                        placeholder="AC..."
                                        {...register('twilio_account_sid')}
                                    />
                                    <p className="text-xs text-muted-foreground">Your primary Twilio Account SID for subaccount management.</p>
                                </div>
                                <div className="flex justify-end pt-4">
                                    <Button type="submit" disabled={isSaving || !isDirty}>
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
