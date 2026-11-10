"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePickerWithRange({
  className,
  date,
  setDate,
}: {
  className?: string
  date: DateRange | undefined
  setDate: (date: DateRange | undefined) => void
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-bold h-11 bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl transition-all hover:bg-slate-200 dark:hover:bg-white/10 text-xs",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-3 h-4 w-4 text-primary" />
            <div className="flex-1 truncate">
                {date?.from ? (
                    date.to ? (
                        <span className="uppercase tracking-tight">
                            {format(date.from, "MMM dd, yyyy")} - {format(date.to, "MMM dd, yyyy")}
                        </span>
                    ) : (
                        <span className="uppercase tracking-tight">{format(date.from, "MMM dd, yyyy")}</span>
                    )
                ) : (
                    <span className="uppercase tracking-widest text-[10px] font-black opacity-60">Select Audit Range</span>
                )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-3xl shadow-3xl" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            className="rounded-2xl"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
