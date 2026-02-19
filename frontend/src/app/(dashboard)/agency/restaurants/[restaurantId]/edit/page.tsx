'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
import { restaurantApi } from '@/lib/api'
import { useRestaurant } from '@/lib/queries'

const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'UTC', label: 'UTC' },
]

const formSchema = z.object({
    name: z.string().min(1, 'Restaurant name is required'),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
    timezone: z.string().min(1),
    spending_limit_monthly: z.string().optional().refine((val) => !val || !isNaN(parseFloat(val)), {
        message: "Must be a valid number"
    }),
    status: z.enum(['active', 'suspended', 'pending'])
})

type FormInput = z.infer<typeof formSchema>

export default function EditRestaurantPage() {
    const router = useRouter()
    const params = useParams()
    const restaurantId = params?.restaurantId as string

    const [isSubmitting, setIsSubmitting] = useState(false)
    const { data: restaurant, isLoading } = useRestaurant(restaurantId)

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<FormInput>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            timezone: 'America/New_York',
            status: 'active'
        },
    })

    const timezone = watch('timezone')
    const status = watch('status')

    // Pre-fill form
    useEffect(() => {
        if (restaurant) {
            reset({
                name: restaurant.name,
                email: restaurant.email || '',
                phone: restaurant.phone || '',
                address: restaurant.address || '',
                timezone: restaurant.timezone || 'America/New_York',
                spending_limit_monthly: restaurant.spending_limit_monthly?.toString() || '',
                status: restaurant.status as 'active' | 'suspended' | 'pending'
            })
        }
    }, [restaurant, reset])

    async function onSubmit(data: FormInput) {
        setIsSubmitting(true)
        try {
            const spendingLimit = data.spending_limit_monthly
                ? parseFloat(data.spending_limit_monthly)
                : null

            await restaurantApi.update(restaurantId, {
                ...data,
                spending_limit_monthly: spendingLimit,
            })

            toast.success('Restaurant updated successfully!')
            router.push(`/agency/restaurants/${restaurantId}`)
        } catch (error) {
            console.error('Error updating restaurant:', error)
            toast.error('Failed to update restaurant')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!restaurant) return <div>Restaurant not found</div>

    return (
        <div className="max-w-2xl mx-auto space-y-6">
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
                    <h1 className="text-2xl font-bold text-foreground">Edit Restaurant</h1>
                    <p className="text-muted-foreground mt-1">Update details for {restaurant.name}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle className="text-foreground flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-primary" />
                            Restaurant Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Restaurant Name *</Label>
                            <Input id="name" {...register('name')} />
                            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" {...register('email')} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input id="phone" type="tel" {...register('phone')} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            <Input id="address" {...register('address')} />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4 pt-4">
                            <div className="space-y-2">
                                <Label>Timezone</Label>
                                <Select value={timezone} onValueChange={(v) => setValue('timezone', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select timezone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {timezones.map((tz) => (
                                            <SelectItem key={tz.value} value={tz.value}>
                                                {tz.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={status} onValueChange={(v: any) => setValue('status', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="suspended">Suspended</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2 pt-2">
                            <Label htmlFor="spending_limit">Monthly Spending Limit</Label>
                            <Input
                                id="spending_limit"
                                type="number"
                                placeholder="e.g., 500"
                                {...register('spending_limit_monthly')}
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-3 mt-6">
                    <Button type="button" variant="ghost" onClick={() => router.back()}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-primary">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Changes
                    </Button>
                </div>
            </form>
        </div>
    )
}
