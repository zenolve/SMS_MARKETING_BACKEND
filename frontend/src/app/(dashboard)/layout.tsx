import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { AuthProvider } from '@/contexts/auth-context'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // No user = not authenticated, redirect to login
    if (!user || authError) {
        redirect('/login')
    }

    // Use admin client to query profile (bypasses RLS)
    const adminClient = createAdminClient()
    const { data: profile, error: profileError } = await adminClient
        .from('user_profiles')
        .select('id, role, is_verified, business_name, restaurant_id')
        .eq('id', user.id)
        .single()

    // If profile query fails or no profile, redirect to pending
    if (profileError || !profile) {
        console.error('[Dashboard Layout] Profile error:', profileError)
        redirect('/pending-approval')
    }

    // If not verified, redirect to pending
    if (!profile.is_verified) {
        redirect('/pending-approval')
    }

    const userRole = profile.role || 'restaurant_admin'

    return (
        <AuthProvider initialUser={user} initialProfile={profile}>
            <div className="flex h-screen bg-background">
                <Sidebar
                    userRole={userRole}
                    userEmail={user.email}
                    businessName={profile.business_name}
                />
                <main className="flex-1 overflow-auto">
                    <div className="p-6 lg:p-8">
                        {children}
                    </div>
                </main>
            </div>
        </AuthProvider>
    )
}
