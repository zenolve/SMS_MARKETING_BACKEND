'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from 'next-themes'

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 2 * 60 * 1000, // 2 minutes
                        gcTime: 10 * 60 * 1000, // 10 minutes
                        retry: 1,
                        refetchOnWindowFocus: false,
                    },
                },
            })
    )

    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <QueryClientProvider client={queryClient}>
                {children}
                <Toaster position="top-right" richColors />
            </QueryClientProvider>
        </ThemeProvider>
    )
}
