'use client'

import { useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DataTable } from '@/components/dashboard/data-table'
import { Badge } from '@/components/ui/badge'

interface ExpenseRequest {
  id: string
  amount: number
  vendor: string
  purpose: string
  paymentMethod: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  requestedBy: string
  date: string
}

const sampleExpenses: ExpenseRequest[] = [
  {
    id: 'EXP001',
    amount: 500,
    vendor: 'Office Supplies Co',
    purpose: 'Office stationery and supplies',
    paymentMethod: 'Bank Transfer',
    status: 'PENDING',
    requestedBy: 'Sarah Smith',
    date: '2025-03-11',
  },
  {
    id: 'EXP002',
    amount: 1500,
    vendor: 'Tech Equipment Ltd',
    purpose: 'Laptop for new employee',
    paymentMethod: 'Credit Card',
    status: 'APPROVED',
    requestedBy: 'Mike Johnson',
    date: '2025-03-10',
  },
  {
    id: 'EXP003',
    amount: 200,
    vendor: 'Utility Services',
    purpose: 'Monthly internet bill',
    paymentMethod: 'Automated Payment',
    status: 'APPROVED',
    requestedBy: 'John Doe',
    date: '2025-03-09',
  },
  {
    id: 'EXP004',
    amount: 750,
    vendor: 'Software Vendor',
    purpose: 'Project management software license',
    paymentMethod: 'Bank Transfer',
    status: 'PENDING',
    requestedBy: 'Sarah Smith',
    date: '2025-03-08',
  },
  {
    id: 'EXP005',
    amount: 300,
    vendor: 'Maintenance Services',
    purpose: 'Office cleaning and maintenance',
    paymentMethod: 'Check',
    status: 'REJECTED',
    requestedBy: 'Mike Johnson',
    date: '2025-03-07',
  },
]

export default function ExpenseRequestsPage() {
  const [expenses, setExpenses] = useState(sampleExpenses)
  const [open, setOpen] = useState(false)
  const [newExpense, setNewExpense] = useState({
    amount: '',
    vendor: '',
    purpose: '',
    paymentMethod: 'Bank Transfer',
  })

  const handleAddExpense = () => {
    if (newExpense.amount && newExpense.vendor && newExpense.purpose) {
      const expense: ExpenseRequest = {
        id: `EXP${String(expenses.length + 1).padStart(3, '0')}`,
        amount: parseFloat(newExpense.amount),
        vendor: newExpense.vendor,
        purpose: newExpense.purpose,
        paymentMethod: newExpense.paymentMethod,
        status: 'PENDING',
        requestedBy: 'John Doe',
        date: new Date().toISOString().split('T')[0],
      }
      setExpenses([...expenses, expense])
      setNewExpense({ amount: '', vendor: '', purpose: '', paymentMethod: 'Bank Transfer' })
      setOpen(false)
    }
  }

  const pendingCount = expenses.filter((e) => e.status === 'PENDING').length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expense Requests</h1>
          <p className="text-muted-foreground mt-2">
            Request and track expense approvals
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Expense Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Submit Expense Request</DialogTitle>
              <DialogDescription>
                Submit a new expense request for approval
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={newExpense.amount}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, amount: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor">Vendor</Label>
                  <Input
                    id="vendor"
                    placeholder="Vendor name"
                    value={newExpense.vendor}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, vendor: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="purpose">Purpose</Label>
                <Textarea
                  id="purpose"
                  placeholder="Describe the expense purpose"
                  value={newExpense.purpose}
                  onChange={(e) =>
                    setNewExpense({ ...newExpense, purpose: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select
                  value={newExpense.paymentMethod}
                  onValueChange={(value) =>
                    setNewExpense({ ...newExpense, paymentMethod: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Check">Check</SelectItem>
                    <SelectItem value="Automated Payment">Automated Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="receipt">Receipt Upload</Label>
                <Button variant="outline" className="w-full">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Receipt
                </Button>
              </div>
              <Button onClick={handleAddExpense} className="w-full">
                Submit Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹
              {expenses
                .filter((e) => e.status === 'APPROVED')
                .reduce((sum, e) => sum + e.amount, 0)
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Rejected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹
              {expenses
                .filter((e) => e.status === 'REJECTED')
                .reduce((sum, e) => sum + e.amount, 0)
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Requests</CardTitle>
          <CardDescription>
            Total requests: {expenses.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              {
                key: 'id',
                header: 'Request ID',
              },
              {
                key: 'amount',
                header: 'Amount',
                cell: (value) => `₹${value.toLocaleString()}`,
              },
              {
                key: 'vendor',
                header: 'Vendor',
              },
              {
                key: 'purpose',
                header: 'Purpose',
              },
              {
                key: 'paymentMethod',
                header: 'Payment Method',
              },
              {
                key: 'status',
                header: 'Status',
                cell: (value) => {
                  const variant =
                    value === 'APPROVED'
                      ? 'default'
                      : value === 'PENDING'
                        ? 'outline'
                        : 'secondary'
                  return <Badge variant={variant}>{value}</Badge>
                },
              },
              {
                key: 'date',
                header: 'Date',
              },
            ]}
            data={expenses}
          />
        </CardContent>
      </Card>
    </div>
  )
}
