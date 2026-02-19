'use client'

import { cn } from '@/lib/utils'
import { calculateSegments } from '@/lib/sms-utils'

interface SMSPreviewerProps {
    message: string
    senderName?: string
    className?: string
}

export function SMSPreviewer({ message, senderName = 'Restaurant', className }: SMSPreviewerProps) {
    const { segments, charCount, encoding, perSegmentLimit } = calculateSegments(message)
    const remainingChars = (segments * perSegmentLimit) - charCount

    // Estimate cost based on standard rate (can be passed in props if dynamic)
    const costPerMessage = segments * 0.0079

    return (
        <div className={cn('flex flex-col items-center', className)}>
            {/* Phone Frame */}
            <div className="relative w-[280px] h-[580px] bg-gradient-to-b from-slate-700 to-slate-800 rounded-[3rem] p-3 shadow-2xl">
                {/* Phone Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-slate-900 rounded-b-2xl" />

                {/* Screen */}
                <div className="relative h-full bg-gradient-to-b from-slate-900 to-slate-950 rounded-[2.5rem] overflow-hidden">
                    {/* Status Bar */}
                    <div className="flex items-center justify-between px-8 pt-3 pb-2">
                        <span className="text-xs text-slate-400">9:41</span>
                        <div className="flex items-center gap-1">
                            <div className="flex gap-0.5">
                                <div className="w-1 h-1 rounded-full bg-slate-400" />
                                <div className="w-1 h-1 rounded-full bg-slate-400" />
                                <div className="w-1 h-1 rounded-full bg-slate-400" />
                                <div className="w-1 h-1 rounded-full bg-slate-500" />
                            </div>
                            <svg className="w-4 h-3 text-slate-400" viewBox="0 0 24 18" fill="currentColor">
                                <path d="M2 14h20v4H2zM6 9h16v4H6zM10 4h12v4H10z" />
                            </svg>
                        </div>
                    </div>

                    {/* Messages Header */}
                    <div className="px-4 py-3 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                <span className="text-white text-sm font-bold">
                                    {senderName.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div>
                                <p className="text-white text-sm font-medium">{senderName}</p>
                                <p className="text-slate-500 text-xs">SMS</p>
                            </div>
                        </div>
                    </div>

                    {/* Message Thread */}
                    <div className="flex-1 p-4 overflow-y-auto">
                        {message ? (
                            <div className="flex justify-start">
                                <div className="max-w-[85%] bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg">
                                    <p className="text-white text-sm whitespace-pre-wrap break-words">
                                        {message}
                                    </p>
                                    <p className="text-slate-500 text-xs mt-2 text-right">Now</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
                                Your message preview will appear here
                            </div>
                        )}
                    </div>

                    {/* Bottom Safe Area */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-slate-700 rounded-full mb-2" />
                </div>
            </div>

            {/* Character Count */}
            <div className="mt-4 text-center">
                <div className="flex items-center justify-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Characters:</span>
                        <span className={cn(
                            'font-mono font-medium',
                            charCount > 1600 ? 'text-destructive' :
                                charCount > 1000 ? 'text-amber-500' : 'text-emerald-500'
                        )}>
                            {charCount}
                        </span>
                    </div>
                    <div className="w-px h-4 bg-border" />
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Segments:</span>
                        <span className={cn(
                            'font-mono font-medium',
                            segments > 10 ? 'text-amber-500' : 'text-primary'
                        )}>
                            {segments}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col gap-1 mt-2">
                    <p className="text-xs text-muted-foreground">
                        {remainingChars} chars until next segment • {encoding} encoding
                    </p>
                    <p className="text-xs font-medium text-foreground">
                        ~${costPerMessage.toFixed(4)} est. per message
                    </p>
                </div>
            </div>
        </div>
    )
}
