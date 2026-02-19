'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Phone, Search, Loader2, Check, MapPin, DollarSign, Store } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { twilioApi, restaurantApi } from '@/lib/api'

interface TwilioNumberPickerProps {
    onSelect?: (number: string) => void
}

interface AvailableNumber {
    phone_number: string
    friendly_name: string
    locality: string
    region: string
    iso_country: string
    monthly_cost: number
}

interface Restaurant {
    id: string
    name: string
}

export function TwilioNumberPicker({ onSelect }: TwilioNumberPickerProps) {
    const [areaCode, setAreaCode] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [numbers, setNumbers] = useState<AvailableNumber[]>([])
    const [selectedNumber, setSelectedNumber] = useState<string | null>(null)

    // Purchase flow
    const [isPurchasing, setIsPurchasing] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    // Restaurant selection
    const [restaurants, setRestaurants] = useState<Restaurant[]>([])
    const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>('')
    const [isLoadingRestaurants, setIsLoadingRestaurants] = useState(false)

    useEffect(() => {
        loadRestaurants()
    }, [])

    async function loadRestaurants() {
        setIsLoadingRestaurants(true)
        try {
            const { data } = await restaurantApi.list()
            setRestaurants(data || [])
        } catch (error) {
            console.error('Error loading restaurants:', error)
            toast.error('Failed to load restaurants')
        } finally {
            setIsLoadingRestaurants(false)
        }
    }

    async function handleSearch() {
        if (!areaCode || areaCode.length < 3) {
            toast.error('Please enter a valid 3-digit area code')
            return
        }

        setIsSearching(true)
        setNumbers([])
        try {
            const { data } = await twilioApi.search(areaCode)
            setNumbers(data)
            if (data.length === 0) {
                toast.info('No numbers found for this area code')
            }
        } catch (error) {
            console.error('Error searching numbers:', error)
            toast.error('Failed to search phone numbers')
        } finally {
            setIsSearching(false)
        }
    }

    async function handlePurchase() {
        if (!selectedNumber) return
        if (!selectedRestaurantId) {
            toast.error('Please select a restaurant to assign this number to')
            return
        }

        setIsPurchasing(true)
        try {
            await twilioApi.buy({
                phone_number: selectedNumber,
                restaurant_id: selectedRestaurantId
            })

            toast.success('Phone number purchased and assigned successfully!')
            setShowConfirm(false)
            onSelect?.(selectedNumber)

            // Clear search results to prevent double purchase
            setNumbers([])
            setSelectedNumber(null)

        } catch (error) {
            console.error('Error purchasing number:', error)
            toast.error('Failed to purchase phone number. It may be unavailable.')
        } finally {
            setIsPurchasing(false)
        }
    }

    const selectedNumberData = numbers.find((n) => n.phone_number === selectedNumber)

    return (
        <div className="space-y-6">
            {/* Search */}
            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                        <Phone className="h-5 w-5 text-primary" />
                        Search Phone Numbers
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Enter an area code to find available Twilio phone numbers
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Enter area code (e.g., 202)"
                                value={areaCode}
                                onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground/50"
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <Button
                            onClick={handleSearch}
                            disabled={isSearching}
                            className="bg-primary hover:bg-primary/90"
                        >
                            {isSearching ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Searching...
                                </>
                            ) : (
                                'Search'
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Results */}
            {numbers.length > 0 && (
                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle className="text-foreground">Available Numbers</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Select a number to purchase
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3">
                            {numbers.map((phone) => (
                                <button
                                    key={phone.phone_number}
                                    onClick={() => {
                                        setSelectedNumber(phone.phone_number)
                                        setShowConfirm(true)
                                    }}
                                    className={cn(
                                        'w-full flex items-center justify-between p-4 rounded-lg border transition-all text-left',
                                        'border-border bg-card/50 hover:border-primary/50 hover:bg-accent'
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                                            <Phone className="w-6 h-6 text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className="font-mono font-medium text-foreground text-lg">{phone.phone_number}</p>
                                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {phone.locality}, {phone.region}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                        <DollarSign className="h-3 w-3 mr-1" />
                                        {phone.monthly_cost.toFixed(2)}/mo
                                    </Badge>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Confirm Dialog */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent className="bg-card border-border sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Confirm Purchase</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Assign this number to a restaurant
                        </DialogDescription>
                    </DialogHeader>

                    {selectedNumberData && (
                        <div className="space-y-4">
                            {/* Number Details */}
                            <div className="p-4 rounded-lg bg-muted/50 border border-border">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                        <Phone className="w-6 h-6 text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="font-mono font-medium text-foreground text-lg">{selectedNumberData.phone_number}</p>
                                        <p className="text-sm text-muted-foreground">{selectedNumberData.locality}, {selectedNumberData.region}</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-border flex justify-between">
                                    <span className="text-muted-foreground">Monthly cost</span>
                                    <span className="text-foreground font-medium">${selectedNumberData.monthly_cost.toFixed(2)}/month</span>
                                </div>
                            </div>

                            {/* Restaurant Selection */}
                            <div className="space-y-2">
                                <Label className="text-foreground">Assign to Restaurant</Label>
                                <Select value={selectedRestaurantId} onValueChange={setSelectedRestaurantId}>
                                    <SelectTrigger className="bg-background border-border text-foreground">
                                        <SelectValue placeholder="Select a restaurant" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground">
                                        {restaurants.map((r) => (
                                            <SelectItem key={r.id} value={r.id} className="focus:bg-accent focus:text-foreground">
                                                {r.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    <Store className="inline h-3 w-3 mr-1" />
                                    The number will be used for this restaurant's campaigns.
                                </p>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="mt-4">
                        <Button
                            variant="ghost"
                            onClick={() => setShowConfirm(false)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handlePurchase}
                            disabled={isPurchasing || !selectedRestaurantId}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {isPurchasing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Purchasing...
                                </>
                            ) : (
                                <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Buy & Assign
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
