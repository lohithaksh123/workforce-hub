'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Column<T> {
  key: Extract<keyof T, string> | string
  header: string
  className?: string
  cell?: (value: any, row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  onEdit,
  onDelete,
}: DataTableProps<T>) {
  return (
    <div className="space-y-4">
      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {data.length === 0 ? (
          <div className="text-center py-10 bg-white/30 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 font-bold italic">
            No data available.
          </div>
        ) : (
          data.map((row, idx) => (
            <div 
              key={row._id || row.id || idx}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 shadow-sm space-y-4 relative overflow-hidden"
            >
               {/* Accent Stripe */}
               <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/50" />
               
               <div className="grid grid-cols-2 gap-y-4">
                  {columns.map((column) => (
                    <div key={String(column.key)} className="flex flex-col gap-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {column.header}
                      </span>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {column.cell ? column.cell(row[column.key], row) : String(row[column.key])}
                      </div>
                    </div>
                  ))}
               </div>

               {(onEdit || onDelete) && (
                 <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                    {onEdit && (
                      <Button variant="ghost" size="sm" onClick={() => onEdit(row)} className="text-[10px] font-black uppercase tracking-widest h-8 px-3 bg-primary/5 text-primary">
                        Edit
                      </Button>
                    )}
                    {onDelete && (
                      <Button variant="ghost" size="sm" onClick={() => onDelete(row)} className="text-[10px] font-black uppercase tracking-widest h-8 px-3 bg-rose-500/5 text-rose-500">
                        Delete
                      </Button>
                    )}
                 </div>
               )}
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-x-auto bg-white/30 dark:bg-slate-900/30 backdrop-blur-xl transition-all duration-300 shadow-sm w-full min-w-0">
        <Table className="w-full border-collapse">
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-800/60">
              {columns.map((column) => (
                <TableHead key={String(column.key)} className={cn("font-black text-[10px] uppercase tracking-widest text-slate-400 py-5", column.className)}>
                  {column.header}
                </TableHead>
              ))}
              {(onEdit || onDelete) && (
                <TableHead className="w-12 text-right font-black text-[10px] uppercase tracking-widest text-slate-400 py-5">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                  className="text-center py-20 text-slate-400 italic font-bold"
                >
                  No data available in this vault.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, idx) => (
                <TableRow 
                  key={row._id || row.id || idx}
                  className="hover:bg-primary/5 transition-colors border-b border-slate-200/40 dark:border-slate-800/40 group"
                >
                  {columns.map((column) => (
                    <TableCell key={String(column.key)} className={cn("py-4", column.className)}>
                      <div className="transition-transform duration-300 group-hover:translate-x-1">
                        {column.cell ? column.cell(row[column.key], row) : String(row[column.key])}
                      </div>
                    </TableCell>
                  ))}
                  {(onEdit || onDelete) && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
