'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Shield,
    Users,
    CheckCircle,
    XCircle,
    Clock,
    LogOut,
    Loader2,
    Building2,
    Store,
    Search,
    RefreshCw,
    Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

interface UserProfile {
    id: string
    role: string
    is_verified: boolean
    business_name: string | null
    created_at: string
    restaurant_id?: string
    email?: string
}

export default function AdminDashboardPage() {
    const router = useRouter()
    const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([])
    const [approvedUsers, setApprovedUsers] = useState<UserProfile[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [actionUser, setActionUser] = useState<UserProfile | null>(null)
    const [actionType, setActionType] = useState<'approve' | 'reject' | 'delete' | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [activeTab, setActiveTab] = useState('pending')

    useEffect(() => {
        loadUsers()
    }, [])

    async function loadUsers() {
        setIsLoading(true)
        try {
            const supabase = createClient()

            // Check if current user is superadmin
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            const { data: profile } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            if (profile?.role !== 'superadmin') {
                toast.error('Access denied. Superadmin role required.')
                router.push('/login')
                return
            }

            // We fetch the users from our new admin endpoint which has the service key 
            // and can join auth.users to provide the email.
            const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '/api';
            const response = await fetch(`${apiUrl}/admin/users`, {
                headers: {
                    // Send auth token if we needed to secure the backend route, though our backend
                    // currently doesn't check it unless we add a dependency. 
                    // Let's pass it anyway for good measure.
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                }
            })

            if (!response.ok) {
                throw new Error(`Failed to fetch users from backend admin API: ${response.status}`)
            }

            const usersWithEmail = await response.json()

            setPendingUsers(usersWithEmail.filter((u: UserProfile) => !u.is_verified))
            setApprovedUsers(usersWithEmail.filter((u: UserProfile) => u.is_verified))
        } catch (err) {
            console.error('Error loading users:', err)
            toast.error('Failed to load users')
        } finally {
            setIsLoading(false)
        }
    }

    async function handleApprove() {
        if (!actionUser) return
        setIsSubmitting(true)

        try {
            const supabase = createClient()

            const { error } = await supabase
                .from('user_profiles')
                .update({ is_verified: true })
                .eq('id', actionUser.id)

            if (error) throw error

            toast.success('User approved successfully!')

            // Move user from pending to approved
            setPendingUsers(prev => prev.filter(u => u.id !== actionUser.id))
            setApprovedUsers(prev => [{ ...actionUser, is_verified: true }, ...prev])

            setActionUser(null)
            setActionType(null)
        } catch (err) {
            toast.error('Failed to approve user')
        } finally {
            setIsSubmitting(false)
        }
    }

    async function handleReject() {
        if (!actionUser) return
        setIsSubmitting(true)

        try {
            const supabase = createClient()

            // Delete the profile
            const { error } = await supabase
                .from('user_profiles')
                .delete()
                .eq('id', actionUser.id)

            if (error) throw error

            toast.success('User rejected and removed')
            setPendingUsers(prev => prev.filter(u => u.id !== actionUser.id))
            setActionUser(null)
            setActionType(null)
        } catch (err) {
            toast.error('Failed to reject user')
        } finally {
            setIsSubmitting(false)
        }
    }

    async function handleRevoke(user: UserProfile) {
        try {
            const supabase = createClient()

            const { error } = await supabase
                .from('user_profiles')
                .update({ is_verified: false })
                .eq('id', user.id)

            if (error) throw error

            toast.success('Access revoked')

            // Move user from approved to pending
            setApprovedUsers(prev => prev.filter(u => u.id !== user.id))
            setPendingUsers(prev => [{ ...user, is_verified: false }, ...prev])
        } catch (err) {
            toast.error('Failed to revoke access')
        }
    }

    async function handleDelete() {
        if (!actionUser) return
        setIsSubmitting(true)
        try {
            const supabase = createClient()
            const session = (await supabase.auth.getSession()).data.session
            const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '/api'

            const res = await fetch(`${apiUrl}/admin/users/${actionUser.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                },
            })

            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.detail || 'Delete failed')
            }

            toast.success(`${actionUser.business_name || 'User'} permanently deleted`)
            setPendingUsers(prev => prev.filter(u => u.id !== actionUser.id))
            setApprovedUsers(prev => prev.filter(u => u.id !== actionUser.id))
            setActionUser(null)
            setActionType(null)
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete user')
        } finally {
            setIsSubmitting(false)
        }
    }

    async function handleLogout() {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        })
    }

    // Filter users based on search
    const filteredPending = pendingUsers.filter(u =>
        u.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.id.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const filteredApproved = approvedUsers.filter(u =>
        u.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.id.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">User Approvals</h2>
                    <p className="text-muted-foreground">Manage and verify new signups.</p>
                </div>
                <Button variant="outline" size="sm" onClick={loadUsers} disabled={isLoading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>
            
            <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-card border-border">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-amber-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-foreground">{pendingUsers.length}</p>
                                    <p className="text-sm text-muted-foreground">Pending Approvals</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-foreground">{approvedUsers.length}</p>
                                    <p className="text-sm text-muted-foreground">Approved Users</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border-border">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Users className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-foreground">
                                        {pendingUsers.length + approvedUsers.length}
                                    </p>
                                    <p className="text-sm text-muted-foreground">Total Users</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* User Management */}
                <Card className="bg-card border-border">
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <CardTitle className="text-foreground flex items-center gap-2">
                                    <Users className="h-5 w-5 text-primary" />
                                    User Management
                                </CardTitle>
                                <CardDescription className="text-muted-foreground">
                                    Approve or reject user signups
                                </CardDescription>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search users..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 bg-background border-border text-foreground"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="bg-muted border border-border">
                                <TabsTrigger value="pending" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                                    Pending ({pendingUsers.length})
                                </TabsTrigger>
                                <TabsTrigger value="approved" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                                    Approved ({approvedUsers.length})
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="pending" className="mt-4">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : filteredPending.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <CheckCircle className="mx-auto h-12 w-12 text-emerald-500 mb-3" />
                                        <p>No pending approvals</p>
                                        <p className="text-sm text-muted-foreground/60 mt-1">
                                            All signup requests have been processed
                                        </p>
                                    </div>
                                ) : (
                                    <UserTable
                                        users={filteredPending}
                                        onApprove={(user) => {
                                            setActionUser(user)
                                            setActionType('approve')
                                        }}
                                        onReject={(user) => {
                                            setActionUser(user)
                                            setActionType('reject')
                                        }}
                                        onDelete={(user) => {
                                            setActionUser(user)
                                            setActionType('delete')
                                        }}
                                        isPending={true}
                                        formatDate={formatDate}
                                    />
                                )}
                            </TabsContent>

                            <TabsContent value="approved" className="mt-4">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : filteredApproved.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <Users className="mx-auto h-12 w-12 text-muted/30 mb-3" />
                                        <p>No approved users yet</p>
                                    </div>
                                ) : (
                                    <UserTable
                                        users={filteredApproved}
                                        onRevoke={handleRevoke}
                                        onDelete={(user) => {
                                            setActionUser(user)
                                            setActionType('delete')
                                        }}
                                        isPending={false}
                                        formatDate={formatDate}
                                    />
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>

            {/* Confirmation Dialog */}
            <Dialog open={!!actionUser && !!actionType} onOpenChange={() => {
                setActionUser(null)
                setActionType(null)
            }}>
                <DialogContent className="bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">
                            {actionType === 'approve' ? 'Approve User'
                                : actionType === 'reject' ? 'Reject User'
                                : 'Permanently Delete User'}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {actionType === 'approve' ? (
                                <>
                                    Are you sure you want to approve{' '}
                                    <span className="text-foreground font-medium">
                                        {actionUser?.business_name || 'this user'}
                                    </span>
                                    ? They will be able to access the platform.
                                </>
                            ) : actionType === 'reject' ? (
                                <>
                                    Are you sure you want to reject{' '}
                                    <span className="text-foreground font-medium">
                                        {actionUser?.business_name || 'this user'}
                                    </span>
                                    ? Their profile will be removed.
                                </>
                            ) : (
                                <span className="text-destructive">
                                    This will <strong>permanently delete</strong>{' '}
                                    <span className="text-foreground font-medium">
                                        {actionUser?.business_name || 'this user'}
                                    </span>{' '}
                                    and ALL their data — restaurants, campaigns, customers, messages, and transactions.
                                    This cannot be undone.
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setActionUser(null)
                                setActionType(null)
                            }}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={
                                actionType === 'approve' ? handleApprove
                                : actionType === 'reject' ? handleReject
                                : handleDelete
                            }
                            disabled={isSubmitting}
                            className={
                                actionType === 'approve'
                                    ? 'bg-emerald-600 hover:bg-emerald-700'
                                    : 'bg-red-600 hover:bg-red-700'
                            }
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : actionType === 'approve' ? (
                                <>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Approve
                                </>
                            ) : actionType === 'reject' ? (
                                <>
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Reject
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Permanently
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// Separate component for the user table
function UserTable({
    users,
    onApprove,
    onReject,
    onRevoke,
    onDelete,
    isPending,
    formatDate,
}: {
    users: UserProfile[]
    onApprove?: (user: UserProfile) => void
    onReject?: (user: UserProfile) => void
    onRevoke?: (user: UserProfile) => void
    onDelete?: (user: UserProfile) => void
    isPending: boolean
    formatDate: (date: string) => string
}) {
    return (
        <Table>
            <TableHeader>
                <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Business & Email</TableHead>
                    <TableHead className="text-muted-foreground">Role</TableHead>
                    <TableHead className="text-muted-foreground">
                        {isPending ? 'Requested' : 'Approved'}
                    </TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {users.map((user) => (
                    <TableRow key={user.id} className="border-border hover:bg-muted/50">
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    {user.role === 'agency_admin' ? (
                                        <Building2 className="w-5 h-5 text-primary" />
                                    ) : (
                                        <Store className="w-5 h-5 text-purple-500" />
                                    )}
                                </div>
                                <div>
                                    <p className="font-medium text-foreground">
                                        {user.business_name || 'No business name'}
                                    </p>
                                    {user.email && user.email !== 'N/A (Agency or No Rest)' && (
                                        <p className="text-xs text-muted-foreground">
                                            {user.email}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground/50">
                                        ID: {user.id.slice(0, 8)}...
                                    </p>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge
                                variant="outline"
                                className={
                                    user.role === 'agency_admin'
                                        ? 'bg-primary/10 text-primary border-primary/30'
                                        : 'bg-purple-500/10 text-purple-500 border-purple-500/30'
                                }
                            >
                                {user.role === 'agency_admin' ? 'Agency' : 'Restaurant'}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                            {formatDate(user.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                                {isPending ? (
                                    <>
                                        <Button
                                            size="sm"
                                            onClick={() => onApprove?.(user)}
                                            className="bg-emerald-600 hover:bg-emerald-700"
                                        >
                                            <CheckCircle className="mr-1 h-4 w-4" />
                                            Approve
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => onReject?.(user)}
                                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        >
                                            <XCircle className="mr-1 h-4 w-4" />
                                            Reject
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => onRevoke?.(user)}
                                        className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                    >
                                        Revoke Access
                                    </Button>
                                )}
                                {/* Delete button — always visible for both pending and approved */}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => onDelete?.(user)}
                                    className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                    title="Permanently delete user and all data"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
