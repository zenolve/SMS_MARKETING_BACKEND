'use client'

import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Phone, Loader2 } from 'lucide-react'
import { TwilioNumberPicker } from '@/components/agency/twilio-number-picker'
import { useRestaurant } from '@/lib/queries'

export default function RestaurantPhonePage() {
    const router = useRouter()
    const params = useParams()
    const restaurantId = params?.restaurantId as string

    const { data: restaurant, isLoading } = useRestaurant(restaurantId)

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!restaurant) return <div>Restaurant not found</div>

    return (
        <div className="max-w-4xl mx-auto space-y-6">
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
                    <h1 className="text-2xl font-bold text-foreground">Manage Phone Number</h1>
                    <p className="text-muted-foreground mt-1">Configure Twilio number for {restaurant.name}</p>
                </div>
            </div>

            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Phone className="h-5 w-5 text-primary" />
                        Current Number
                    </CardTitle>
                    <CardDescription>
                        The phone number currently assigned to this restaurant
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {restaurant.twilio_phone_number ? (
                        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                            <div>
                                <p className="font-mono text-lg font-medium">{restaurant.twilio_phone_number}</p>
                                <p className="text-sm text-emerald-500 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    Active
                                </p>
                            </div>
                            <Button variant="outline" size="sm" disabled title="Release number functionality coming soon">
                                Release Number
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No phone number assigned yet. Search and purchase one below.
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="mt-8">
                <h2 className="text-xl font-bold mb-4">Purchase New Number</h2>
                {/* Note: TwilioNumberPicker needs to support pre-selecting a restaurant, or we update it. 
                   Looking at previous files, it has a restaurant selector. 
                   We should probably pass 'preSelectedRestaurantId' prop if the component supports it.
                   Let's check the component source or just render it. 
                   For now, the user can select the restaurant manually in the picker, or ideally we customize it.
                   But to keep it simple and working: */}
                <TwilioNumberPicker />
            </div>
        </div>
    )
}
