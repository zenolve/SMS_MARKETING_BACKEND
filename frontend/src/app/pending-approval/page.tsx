'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, LogOut, CheckCircle2, Shield } from 'lucide-react'

export default function PendingApprovalPage() {
    const router = useRouter()
    const supabase = createClient()

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/login')
        toast.success('Logged out successfully')
    }

    async function checkStatus() {
        // 1. Check current session
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error || !user) {
            window.location.href = '/login'
            return
        }

        // 2. Check Email Verification
        if (!user.email_confirmed_at) {
            toast.error('Please verify your email address first.')
            return
        }

        // 3. User is verified, check Admin Approval via Profile
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role, is_verified')
            .eq('id', user.id)
            .maybeSingle()

        if (profile?.is_verified === true) {
            toast.success('Your account has been approved!')

            setTimeout(() => {
                if (profile.role === 'superadmin') {
                    window.location.href = '/admin/dashboard'
                } else if (profile.role === 'agency_admin') {
                    window.location.href = '/agency/dashboard'
                } else {
                    window.location.href = '/restaurant/dashboard'
                }
            }, 500)
        } else {
            toast.info('Email verified! Waiting for admin approval.')
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-accent/5 to-background p-4">
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

            <Card className="w-full max-w-md relative backdrop-blur-sm bg-card/80 border-border">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
                        <Clock className="w-10 h-10 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                            Account Status
                        </CardTitle>
                        <CardDescription className="text-muted-foreground mt-2">
                            Complete the steps below to access your dashboard
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    <div className="bg-accent/50 rounded-lg p-4 space-y-4">

                        {/* Step 1: Email Verification */}
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                                {/* We can't easily access user state here without Context, 
                                    but the user will know by clicking 'Check Status' */}
                                <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">1. Verify Email</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Check your inbox and click the verification link.
                                </p>
                            </div>
                        </div>

                        {/* Step 2: Admin Approval */}
                        <div className="flex items-start gap-3">
                            <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-foreground">2. Admin Approval</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    An administrator will review and approve your account.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="text-center text-sm text-muted-foreground">
                        <p>Need help? Contact us at</p>
                        <a href="mailto:support@example.com" className="text-primary hover:text-primary/80">
                            support@example.com
                        </a>
                    </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-3">
                    <Button
                        onClick={checkStatus}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                    >
                        Check Status
                    </Button>

                    <Button
                        variant="ghost"
                        onClick={handleLogout}
                        className="w-full text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
