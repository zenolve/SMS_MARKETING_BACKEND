'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Loader2, Building2, MapPin, Mail, Phone, Clock, DollarSign } from 'lucide-react'
import { z } from 'zod'
import { restaurantApi, agencyApi } from '@/lib/api'

const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'UTC', label: 'UTC' },
]

// Extended schema for the form
const formSchema = z.object({
    name: z.string().min(1, 'Restaurant name is required'),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
    timezone: z.string().min(1),
    spending_limit_monthly: z.string().optional().refine((val) => !val || !isNaN(parseFloat(val)), {
        message: "Must be a valid number"
    }),
    // New Admin Fields
    admin_email: z.string().email('Admin email is required'),
    admin_password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormInput = z.infer<typeof formSchema>

export default function NewRestaurantPage() {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [agencyId, setAgencyId] = useState<string | null>(null)
    const [isLoadingAgency, setIsLoadingAgency] = useState(true)

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<FormInput>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            timezone: 'America/New_York',
        },
    })

    const timezone = watch('timezone')

    // Fetch agency ID on mount
    useEffect(() => {
        async function fetchAgency() {
            try {
                const { data } = await agencyApi.list()
                if (data && data.length > 0) {
                    setAgencyId(data[0].id)
                } else {
                    // Fallback to Default Agency ID
                    console.warn('No agencies found, defaulting to system agency.')
                    setAgencyId('00000000-0000-0000-0000-000000000001')
                }
            } catch (error) {
                console.error('Error fetching agency:', error)
                // Fallback to Default Agency ID on error
                setAgencyId('00000000-0000-0000-0000-000000000001')
            } finally {
                setIsLoadingAgency(false)
            }
        }
        fetchAgency()
    }, [])

    async function onSubmit(data: FormInput) {
        if (!agencyId) {
            toast.error('Agency ID missing. Cannot create restaurant.')
            return
        }

        setIsSubmitting(true)
        try {
            // Convert spending limit to float or null
            const spendingLimit = data.spending_limit_monthly
                ? parseFloat(data.spending_limit_monthly)
                : null

            // Use the SIGNUP endpoint instead of create
            await restaurantApi.signup({
                ...data,
                // The backend signup expects 'name' (restaurant name) and admin fields
                // It also needs agency_id if we want to be strict, but current backend implementation might rely on default or user metadata
                // Wait, our backend endpoint doesn't strictly require agency_id in the Pydantic model for signup?
                // Actually RestaurantSignup inherits RestaurantBase which HAS agency_id.
                // So we MUST pass agency_id.
                agency_id: agencyId,
                spending_limit_monthly: spendingLimit,
                status: 'active'
            })

            toast.success('Restaurant and Admin User created successfully!')
            router.push('/agency/restaurants')
        } catch (error: any) {
            console.error('Error creating restaurant:', error)
            const msg = error.response?.data?.detail || 'Failed to create restaurant'
            toast.error(msg)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoadingAgency) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Add Restaurant</h1>
                    <p className="text-muted-foreground mt-1">Create a new restaurant and admin account</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                {/* Admin User Information */}
                <Card className="bg-card border-border mb-6">
                    <CardHeader>
                        <CardTitle className="text-foreground flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-primary" />
                            Admin User Account
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Credentials for the restaurant owner to log in
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="admin_email" className="text-foreground">Admin Email *</Label>
                            <Input
                                id="admin_email"
                                type="email"
                                placeholder="owner@restaurant.com"
                                className="bg-background border-border text-foreground placeholder:text-muted-foreground/50"
                                {...register('admin_email')}
                            />
                            {errors.admin_email && (
                                <p className="text-sm text-red-500">{errors.admin_email.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="admin_password" className="text-foreground">Password *</Label>
                            <Input
                                id="admin_password"
                                type="password"
                                placeholder="••••••••"
                                className="bg-background border-border text-foreground placeholder:text-muted-foreground/50"
                                {...register('admin_password')}
                            />
                            {errors.admin_password && (
                                <p className="text-sm text-red-500">{errors.admin_password.message}</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Basic Information */}
                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle className="text-foreground flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-primary" />
                            Basic Information
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Enter the restaurant details
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-foreground">Restaurant Name *</Label>
                            <Input
                                id="name"
                                placeholder="e.g., Mario's Pizza"
                                className="bg-background border-border text-foreground placeholder:text-muted-foreground/50"
                                {...register('name')}
                            />
                            {errors.name && (
                                <p className="text-sm text-red-500">{errors.name.message}</p>
                            )}
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-foreground flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    Email
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="contact@restaurant.com"
                                    className="bg-background border-border text-foreground placeholder:text-muted-foreground/50"
                                    {...register('email')}
                                />
                                {errors.email && (
                                    <p className="text-sm text-red-500">{errors.email.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-foreground flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    Phone
                                </Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="+1 (555) 123-4567"
                                    className="bg-background border-border text-foreground placeholder:text-muted-foreground/50"
                                    {...register('phone')}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="address" className="text-foreground flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                Address
                            </Label>
                            <Input
                                id="address"
                                placeholder="123 Main St, City, State ZIP"
                                className="bg-background border-border text-foreground placeholder:text-muted-foreground/50"
                                {...register('address')}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Settings */}
                <Card className="bg-card border-border mt-6">
                    <CardHeader>
                        <CardTitle className="text-foreground flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary" />
                            Settings
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Configure timezone and spending limits
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-foreground">Timezone</Label>
                                <Select value={timezone} onValueChange={(v) => setValue('timezone', v)}>
                                    <SelectTrigger className="bg-background border-border text-foreground">
                                        <SelectValue placeholder="Select timezone" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border">
                                        {timezones.map((tz) => (
                                            <SelectItem
                                                key={tz.value}
                                                value={tz.value}
                                                className="text-foreground/80 focus:bg-accent focus:text-foreground"
                                            >
                                                {tz.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="spending_limit" className="text-foreground flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                    Monthly Spending Limit
                                </Label>
                                <Input
                                    id="spending_limit"
                                    type="number"
                                    placeholder="e.g., 500"
                                    className="bg-background border-border text-foreground placeholder:text-muted-foreground/50"
                                    {...register('spending_limit_monthly')}
                                />
                                <p className="text-xs text-muted-foreground">Leave empty for no limit</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-6">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.back()}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Building2 className="mr-2 h-4 w-4" />
                                Create Restaurant
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    )
}
