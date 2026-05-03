'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

interface UserProfile {
    id: string
    role: 'superadmin' | 'agency_admin' | 'restaurant_admin'
    is_verified: boolean
    business_name: string | null
    restaurant_id: string | null
}

// ... imports

interface AuthContextType {
    user: User | null
    profile: UserProfile | null
    restaurantId: string | null
    isEmailVerified: boolean
    isLoading: boolean
    error: string | null
    refetch: () => Promise<void>
    // Agency features
    selectedRestaurantId: string | null
    setSelectedRestaurantId: (id: string | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
    children: ReactNode
    initialUser?: User | null
    initialProfile?: UserProfile | null
}

export function AuthProvider({ children, initialUser = null, initialProfile = null }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(initialUser)
    const [profile, setProfile] = useState<UserProfile | null>(initialProfile)
    const [isLoading, setIsLoading] = useState(!initialUser)
    const [error, setError] = useState<string | null>(null)

    // Agency impersonation state
    const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null)

    const supabase = useMemo(() => createClient(), [])

    const fetchProfile = useCallback(async () => {
        // ... existing fetchProfile logic ...
        try {
            setIsLoading(true)
            setError(null)

            const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()

            if (authError || !currentUser) {
                setUser(null)
                setProfile(null)
                return
            }

            setUser(currentUser)

            const { data: profileData, error: profileError } = await supabase
                .rpc('get_my_profile')
                .single()

            if (profileError) {
                console.error('Profile fetch error:', profileError)
                setError('Failed to load profile')
                return
            }

            setProfile(profileData as UserProfile)

            // If agency admin, we might auto-select first restaurant or keep it null
            // For now, keep it null until they select one

        } catch (err) {
            console.error('Auth context error:', err)
            setError('Authentication error')
        } finally {
            setIsLoading(false)
        }
    }, [supabase])

    useEffect(() => {
        // Skip the initial fetch when server-provided initial data is available.
        // The onAuthStateChange subscription handles all subsequent auth events.
        if (!initialUser) {
            fetchProfile()
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                await fetchProfile()
            } else if (event === 'SIGNED_OUT') {
                setUser(null)
                setProfile(null)
                setSelectedRestaurantId(null)
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [fetchProfile, supabase, initialUser])

    // Determine the active restaurant ID
    // 1. If impersonating (agency admin selected a restaurant), use that.
    // 2. Otherwise use the user's direct restaurant_id
    const activeRestaurantId = selectedRestaurantId || profile?.restaurant_id || null

    const value: AuthContextType = useMemo(() => ({
        user,
        profile,
        restaurantId: activeRestaurantId,
        isEmailVerified: user?.email_confirmed_at ? true : false,
        isLoading,
        error,
        refetch: fetchProfile,
        selectedRestaurantId,
        setSelectedRestaurantId
    }), [user, profile, activeRestaurantId, isLoading, error, fetchProfile, selectedRestaurantId, setSelectedRestaurantId])

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ... hooks

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

// Convenience hook for getting restaurant ID with loading state
export function useRestaurantId() {
    const { restaurantId, isLoading, error } = useAuth()
    return { restaurantId, isLoading, error }
}
