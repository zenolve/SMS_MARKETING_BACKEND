'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const TwilioNumberPicker = dynamic(
    async () => {
        try {
            const mod = await import('@/components/agency/twilio-number-picker')
            return { default: mod.TwilioNumberPicker }
        } catch {
            return { default: () => <p className="text-destructive">Failed to load. Please refresh.</p> }
        }
    },
    {
        ssr: false,
        loading: () => <Loader2 className="h-6 w-6 animate-spin" />,
    }
)

export default function PhoneNumbersPage() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">Phone Numbers</h1>
                <p className="text-muted-foreground mt-1">Search and purchase Twilio phone numbers for your restaurants</p>
            </div>

            <TwilioNumberPicker />
        </div>
    )
}
