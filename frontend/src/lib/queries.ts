'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agencyApi, restaurantApi, customerApi, campaignApi, transactionApi, statsApi } from './api'

// ============ Agency Queries ============
export function useAgencies() {
    return useQuery({
        queryKey: ['agencies'],
        queryFn: async () => {
            const { data } = await agencyApi.list()
            return data
        },
    })
}

export function useAgency(id: string) {
    return useQuery({
        queryKey: ['agencies', id],
        queryFn: async () => {
            const { data } = await agencyApi.get(id)
            return data
        },
        enabled: !!id,
    })
}

export function useAgencyRestaurants(agencyId: string) {
    return useQuery({
        queryKey: ['agencies', agencyId, 'restaurants'],
        queryFn: async () => {
            const { data } = await agencyApi.getRestaurants(agencyId)
            return data
        },
        enabled: !!agencyId,
    })
}

// ============ Restaurant Queries ============
export function useRestaurants(params?: { agency_id?: string; status?: string }) {
    return useQuery({
        queryKey: ['restaurants', params],
        queryFn: async () => {
            const { data } = await restaurantApi.list(params)
            return data
        },
    })
}

export function useRestaurant(id: string) {
    return useQuery({
        queryKey: ['restaurants', id],
        queryFn: async () => {
            const { data } = await restaurantApi.get(id)
            return data
        },
        enabled: !!id,
    })
}

export function useRestaurantUsage(id: string) {
    return useQuery({
        queryKey: ['restaurants', id, 'usage'],
        queryFn: async () => {
            const { data } = await restaurantApi.getUsage(id)
            return data
        },
        enabled: !!id,
    })
}

export function useRestaurantStats(id: string | null) {
    return useQuery({
        queryKey: ['restaurants', id, 'stats'],
        queryFn: async () => {
            if (!id) return null
            const { data } = await restaurantApi.getStats(id)
            return data
        },
        enabled: !!id,
        staleTime: 5 * 60 * 1000, // 5 minutes — stats change infrequently
    })
}

export function useRestaurantTags(id: string | null) {
    return useQuery({
        queryKey: ['restaurants', id, 'tags'],
        queryFn: async () => {
            if (!id) return []
            const { data } = await restaurantApi.getTags(id)
            return data as string[]
        },
        enabled: !!id,
    })
}

export function useRestaurantMessages(id: string | null, limit = 50) {
    return useQuery({
        queryKey: ['restaurants', id, 'messages', limit],
        queryFn: async () => {
            if (!id) return []
            const { data } = await restaurantApi.getMessages(id, limit)
            return data
        },
        enabled: !!id,
        staleTime: 30 * 1000, // 30 seconds — messages are near-real-time
    })
}

// ============ Customer Queries ============
export interface Customer {
    id: string
    restaurant_id: string
    phone: string
    first_name?: string
    last_name?: string
    email?: string
    tags?: string[]
    opt_in_status: 'opted_in' | 'opted_out' | 'pending'
    opt_in_date?: string
    opt_out_date?: string
    created_at: string
    updated_at: string
}

export function useCustomers(restaurantId: string | null, filters?: { opt_in_status?: string; tag?: string }) {
    return useQuery({
        queryKey: ['customers', restaurantId, filters],
        queryFn: async () => {
            if (!restaurantId) return []
            const { data } = await customerApi.list({ restaurant_id: restaurantId, ...filters })
            return data as Customer[]
        },
        enabled: !!restaurantId,
    })
}

export function useCustomer(id: string) {
    return useQuery({
        queryKey: ['customers', id],
        queryFn: async () => {
            const { data } = await customerApi.get(id)
            return data as Customer
        },
        enabled: !!id,
    })
}

export function useImportCustomers() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ restaurantId, file }: { restaurantId: string; file: File }) =>
            customerApi.importCsv(restaurantId, file),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] })
        },
    })
}

export function useCreateCustomer() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => customerApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] })
        },
    })
}

export function useUpdateCustomer() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
            customerApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] })
        },
    })
}

export function useDeleteCustomer() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string) => customerApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] })
        },
    })
}

// ============ Campaign Queries ============
export interface Campaign {
    id: string
    restaurant_id: string
    name: string
    message_template: string
    segment_criteria?: Record<string, unknown>
    schedule_type: 'one_time' | 'recurring'
    scheduled_at?: string
    recurrence_rule?: Record<string, unknown>
    timezone?: string
    status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed'
    total_recipients: number
    total_sent: number
    total_delivered: number
    total_failed: number
    total_cost: number
    sent_at?: string
    created_at: string
    updated_at: string
}

export function useCampaigns(restaurantId: string | null, status?: string) {
    return useQuery({
        queryKey: ['campaigns', restaurantId, status],
        queryFn: async () => {
            if (!restaurantId) return []
            const { data } = await campaignApi.list({ restaurant_id: restaurantId, status })
            return data as Campaign[]
        },
        enabled: !!restaurantId,
    })
}

export function useCampaign(id: string) {
    return useQuery({
        queryKey: ['campaigns', id],
        queryFn: async () => {
            const { data } = await campaignApi.get(id)
            return data as Campaign
        },
        enabled: !!id,
    })
}

export function useCampaignPreview(id: string) {
    return useQuery({
        queryKey: ['campaigns', id, 'preview'],
        queryFn: async () => {
            const { data } = await campaignApi.preview(id)
            return data
        },
        enabled: !!id,
    })
}

export function useCreateCampaign() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: Record<string, unknown>) => campaignApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaigns'] })
        },
    })
}

export function useUpdateCampaign() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
            campaignApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaigns'] })
        },
    })
}

export function useDeleteCampaign() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string) => campaignApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaigns'] })
        },
    })
}

export function useSendCampaign() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string) => campaignApi.send(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaigns'] })
        },
    })
}

export function useCancelCampaign() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string) => campaignApi.cancel(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaigns'] })
        },
    })
}

// ============ Transaction Queries ============
export interface Transaction {
    id: string
    restaurant_id: string
    amount_gbp: number
    transaction_type: 'campaign_send' | 'number_purchase' | 'subscription_fee' | 'budget_allocation'
    description: string
    created_at: string
}

export function useRestaurantTransactions(restaurantId: string | null) {
    return useQuery({
        queryKey: ['transactions', restaurantId],
        queryFn: async () => {
            if (!restaurantId) return []
            const { data } = await transactionApi.getRestaurantTransactions(restaurantId)
            return data as Transaction[]
        },
        enabled: !!restaurantId,
    })
}

// ============ Agency Dashboard Combined Query ============
export function useAgencyDashboardData(agencyId: string | undefined) {
    return useQuery({
        queryKey: ['agency-dashboard', agencyId],
        queryFn: async () => {
            if (!agencyId) return null
            const [restaurants, stats, transactions] = await Promise.all([
                agencyApi.getRestaurants(agencyId),
                statsApi.getAgencyStats(agencyId),
                transactionApi.getAgencyTransactions(agencyId),
            ])
            return {
                restaurants: restaurants.data,
                stats: stats.data,
                transactions: transactions.data,
            }
        },
        staleTime: 3 * 60 * 1000, // 3 minutes
        enabled: !!agencyId,
    })
}
