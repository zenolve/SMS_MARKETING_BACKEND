'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Restaurant {
    id: string
    name: string
    status: string
}

export function RestaurantSwitcher() {
    const { setSelectedRestaurantId, selectedRestaurantId, profile } = useAuth()
    const [open, setOpen] = useState(false)
    const [restaurants, setRestaurants] = useState<Restaurant[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        async function fetchRestaurants() {
            if (profile?.role !== 'agency_admin') return

            setIsLoading(true)
            try {
                // Fetch all restaurants (Agency Admin should have access via RLS or specific query)
                // Assuming RLS allows agency admin to view all restaurants
                const { data, error } = await supabase
                    .from('restaurants')
                    .select('id, name, status')
                    .order('name')

                if (error) throw error
                setRestaurants(data || [])
            } catch (error) {
                console.error('Error fetching restaurants:', error)
                toast.error('Failed to load restaurants')
            } finally {
                setIsLoading(false)
            }
        }

        fetchRestaurants()
    }, [profile, supabase])

    const selectedRestaurant = restaurants.find(r => r.id === selectedRestaurantId)

    if (profile?.role !== 'agency_admin') return null

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-[200px] justify-between"
                >
                    <Building2 className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    {selectedRestaurant ? selectedRestaurant.name : "Select Restaurant..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandInput placeholder="Search restaurant..." />
                    <CommandList>
                        <CommandEmpty>No restaurant found.</CommandEmpty>
                        <CommandGroup heading="Restaurants">
                            {restaurants.map((restaurant) => (
                                <CommandItem
                                    key={restaurant.id}
                                    value={restaurant.name}
                                    onSelect={() => {
                                        setSelectedRestaurantId(restaurant.id === selectedRestaurantId ? null : restaurant.id)
                                        setOpen(false)

                                        // Optional: Redirect to restaurant dashboard on switch
                                        if (restaurant.id !== selectedRestaurantId) {
                                            router.push('/restaurant/dashboard')
                                            toast.success(`Switched to ${restaurant.name}`)
                                        }
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedRestaurantId === restaurant.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {restaurant.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
