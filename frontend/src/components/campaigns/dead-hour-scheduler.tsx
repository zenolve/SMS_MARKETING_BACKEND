'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { CalendarIcon, Clock, Moon, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeadHourSchedulerProps {
    date: Date | undefined
    onDateChange: (date: Date | undefined) => void
    time: string
    onTimeChange: (time: string) => void
    timezone: string
    onTimezoneChange: (tz: string) => void
}

const timezones = [
    { value: 'GMT', label: 'Greenwich Mean Time (GMT)' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'UTC', label: 'UTC' },
]

// Generate time slots in 30-minute intervals
const timeSlots = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2)
    const minute = i % 2 === 0 ? '00' : '30'
    const ampm = hour < 12 ? 'AM' : 'PM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    const value = `${hour.toString().padStart(2, '0')}:${minute}`
    const label = `${displayHour}:${minute} ${ampm}`
    return { value, label, hour }
})

// Dead hours are typically 2-5 PM for restaurants
const deadHours = [14, 15, 16, 17] // 2 PM - 5 PM

export function DeadHourScheduler({
    date,
    onDateChange,
    time,
    onTimeChange,
    timezone,
    onTimezoneChange,
}: DeadHourSchedulerProps) {
    const selectedHour = time ? parseInt(time.split(':')[0]) : null
    const isDeadHour = selectedHour !== null && deadHours.includes(selectedHour)

    return (
        <div className="space-y-4">
            {/* Timezone */}
            <div className="space-y-2">
                <Label className="text-foreground">Timezone</Label>
                <Select value={timezone} onValueChange={onTimezoneChange}>
                    <SelectTrigger className="bg-background border-border text-foreground">
                        <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                        {timezones.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value} className="text-foreground focus:bg-accent focus:text-foreground">
                                {tz.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Date Picker */}
            <div className="space-y-2">
                <Label className="text-foreground">Date</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className={cn(
                                'w-full justify-start text-left font-normal bg-background border-border hover:bg-accent text-foreground',
                                !date && 'text-muted-foreground'
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, 'PPP') : 'Pick a date'}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={onDateChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>

            {/* Time Picker */}
            <div className="space-y-2">
                <Label className="text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Time
                </Label>
                <Select value={time} onValueChange={onTimeChange}>
                    <SelectTrigger className="bg-background border-border text-foreground">
                        <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border max-h-[300px]">
                        {timeSlots.map((slot) => {
                            const isDeadHourSlot = deadHours.includes(slot.hour)
                            return (
                                <SelectItem
                                    key={slot.value}
                                    value={slot.value}
                                    className={cn(
                                        'text-foreground focus:bg-accent focus:text-foreground',
                                        isDeadHourSlot && 'text-primary'
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        {slot.label}
                                        {isDeadHourSlot && (
                                            <span className="ml-2 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                                Dead Hour
                                            </span>
                                        )}
                                    </div>
                                </SelectItem>
                            )
                        })}
                    </SelectContent>
                </Select>
            </div>

            {/* Dead Hour Indicator */}
            {isDeadHour && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/10 border border-primary/30">
                    <Moon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-primary">Dead Hour Selected</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            This time is typically slower for restaurants - perfect for SMS campaigns to drive traffic!
                        </p>
                    </div>
                </div>
            )}

            {!isDeadHour && time && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-amber-500">Consider Dead Hours</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            2-5 PM is typically slower for restaurants. Schedule during these hours to maximize impact!
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
