import axios from 'axios'
import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Add auth header to requests
api.interceptors.request.use(async (config) => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`
    }

    return config
})

// API Endpoints

// Agencies
export const agencyApi = {
    list: () => api.get('/agencies'),
    get: (id: string) => api.get(`/agencies/${id}`),
    create: (data: { name: string; email: string; phone?: string }) => api.post('/agencies', data),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/agencies/${id}`, data),
    delete: (id: string) => api.delete(`/agencies/${id}`),
    getRestaurants: (id: string) => api.get(`/agencies/${id}/restaurants`),
}

export const twilioApi = {
    search: (areaCode: string) => api.get(`/twilio/available-numbers?area_code=${areaCode}&limit=10`),
    buy: (data: { phone_number: string, restaurant_id: string }) => api.post('/twilio/buy-number', data),
}

export const statsApi = {
    getAgencyStats: (agencyId: string) => api.get(`/stats/agency/${agencyId}`),
}

// Restaurants
export const restaurantApi = {
    list: (params?: { agency_id?: string; status?: string }) => api.get('/restaurants', { params }),
    get: (id: string) => api.get(`/restaurants/${id}`),
    create: (data: any) => api.post('/restaurants', data),
    signup: (data: any) => api.post('/restaurants/signup', data),
    update: (id: string, data: any) => api.patch(`/restaurants/${id}`, data),
    delete: (id: string) => api.delete(`/restaurants/${id}`),
    getUsage: (id: string) => api.get(`/restaurants/${id}/usage`),
    getMessages: (id: string, limit = 50) => api.get(`/restaurants/${id}/messages`, { params: { limit } }),
    getStats: (id: string) => api.get(`/restaurants/${id}/stats`),
    getTags: (id: string) => api.get(`/restaurants/${id}/tags`),
}

// Customers
export const customerApi = {
    list: (params: { restaurant_id: string; opt_in_status?: string; tag?: string }) =>
        api.get('/customers', { params }),
    get: (id: string) => api.get(`/customers/${id}`),
    create: (data: Record<string, unknown>) => api.post('/customers', data),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/customers/${id}`, data),
    delete: (id: string) => api.delete(`/customers/${id}`),
    importCsv: (restaurantId: string, file: File) => {
        const formData = new FormData()
        formData.append('file', file)
        return api.post(`/customers/import?restaurant_id=${restaurantId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
    },
}

// Campaigns
export const campaignApi = {
    list: (params: { restaurant_id: string; status?: string }) =>
        api.get('/campaigns', { params }),
    get: (id: string) => api.get(`/campaigns/${id}`),
    create: (data: Record<string, unknown>) => api.post('/campaigns', data),
    update: (id: string, data: Record<string, unknown>) => api.patch(`/campaigns/${id}`, data),
    delete: (id: string) => api.delete(`/campaigns/${id}`),
    preview: (id: string) => api.get(`/campaigns/${id}/preview`),
    send: (id: string) => api.post(`/campaigns/${id}/send`),
    cancel: (id: string) => api.post(`/campaigns/${id}/cancel`),
}

export default api
