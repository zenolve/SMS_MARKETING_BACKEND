'use client'

import { useQuery } from '@tanstack/react-query'
import { transactionApi } from '@/lib/api'
import { useAgencies } from '@/lib/queries'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Receipt } from 'lucide-react'
import { format } from 'date-fns'

const txTypeColors: Record<string, string> = {
    budget_allocation: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    sms_charge: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    number_purchase: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
}

export default function AgencyTransactionsPage() {
    const { data: agencies } = useAgencies()
    const agencyId = agencies?.[0]?.id

    const { data: transactions = [], isLoading } = useQuery({
        queryKey: ['agency-transactions', agencyId],
        queryFn: async () => {
            const { data } = await transactionApi.getAgencyTransactions(agencyId!)
            return data
        },
        enabled: !!agencyId
    })

    if (isLoading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    )

    // Separate agency-level budget deposits vs restaurant spend
    const budgetDeposits = transactions.filter((tx: any) => tx.agency_id && !tx.restaurant_id)
    const restaurantSpend = transactions.filter((tx: any) => !!tx.restaurant_id)
    const totalDeposited = budgetDeposits.reduce((sum: number, tx: any) => sum + (tx.amount_gbp || 0), 0)
    const totalSpent = restaurantSpend.reduce((sum: number, tx: any) => sum + Math.abs(tx.amount_gbp || 0), 0)
    const agencyBudget = agencies?.[0]?.budget_monthly_gbp || 0
    const agencySpend = agencies?.[0]?.current_spend_gbp || 0
    const remainingBudget = Math.max(0, agencyBudget - agencySpend)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Transaction History</h1>
                <p className="text-muted-foreground mt-1">All budget allocations and restaurant billing events</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-card border-border">
                    <CardContent className="p-5">
                        <p className="text-sm text-muted-foreground">Monthly Budget</p>
                        <p className="text-2xl font-bold text-foreground mt-1">£{agencyBudget.toFixed(2)}</p>
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="p-5">
                        <p className="text-sm text-muted-foreground">Total Spent</p>
                        <p className="text-2xl font-bold text-red-400 mt-1">£{agencySpend.toFixed(2)}</p>
                    </CardContent>
                </Card>
                <Card className="bg-emerald-500/10 border-emerald-500/20">
                    <CardContent className="p-5">
                        <p className="text-sm text-emerald-600 dark:text-emerald-400">Remaining Budget</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">£{remainingBudget.toFixed(2)}</p>
                        {agencyBudget > 0 && (
                            <div className="mt-2 h-1.5 w-full rounded-full bg-emerald-200 dark:bg-emerald-900/50">
                                <div
                                    className="h-full rounded-full bg-emerald-500 transition-all"
                                    style={{ width: `${Math.min(100, (remainingBudget / agencyBudget) * 100)}%` }}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card className="bg-card border-border">
                    <CardContent className="p-5">
                        <p className="text-sm text-muted-foreground">Total Transactions</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{transactions.length}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Full Ledger Table */}
            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="text-foreground">Full Ledger</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Budget deposits from Admin and all restaurant charges
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Source</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Restaurant</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Description</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Amount (£)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center">
                                            <Receipt className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                                            <p className="text-muted-foreground">No transactions recorded yet.</p>
                                            <p className="text-sm text-muted-foreground mt-1">Transactions appear when Admin allocates budget or your restaurants incur charges.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((tx: any) => {
                                        const isAgencyLevel = tx.agency_id && !tx.restaurant_id
                                        return (
                                            <tr key={tx.id} className="border-b border-border hover:bg-muted/50">
                                                <td className="py-3 px-4 text-sm text-foreground whitespace-nowrap">
                                                    {format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')}
                                                </td>
                                                <td className="py-3 px-4 text-sm">
                                                    {isAgencyLevel ? (
                                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                                                            Admin → Agency
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20">
                                                            Restaurant
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-sm">
                                                    {tx.restaurant_name ? (
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-foreground">{tx.restaurant_name}</span>
                                                            <span className="text-xs text-muted-foreground">{tx.restaurant_email}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge variant="outline" className={txTypeColors[tx.transaction_type] || 'bg-muted text-muted-foreground'}>
                                                        {tx.transaction_type.replace(/_/g, ' ')}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-foreground">{tx.description || '—'}</td>
                                                <td className="py-3 px-4 text-sm text-right font-mono font-medium">
                                                    {isAgencyLevel ? (
                                                        // Admin -> Agency: + is budget increase, - is budget reduction
                                                        tx.amount_gbp >= 0 ? (
                                                            <span className="text-emerald-500">+£{tx.amount_gbp.toFixed(2)}</span>
                                                        ) : (
                                                            <span className="text-red-400">-£{Math.abs(tx.amount_gbp).toFixed(2)}</span>
                                                        )
                                                    ) : (
                                                        // Restaurant: budget allocations are debits from agency pool
                                                        tx.transaction_type === 'budget_allocation' ? (
                                                            <span className="text-amber-400">-£{Math.abs(tx.amount_gbp).toFixed(2)}</span>
                                                        ) : (
                                                            <span className="text-foreground">£{Math.abs(tx.amount_gbp).toFixed(2)}</span>
                                                        )
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
