"use client"

import { CalendarDays, X } from "lucide-react"
import { format, isValid, parse } from "date-fns"
import { id } from "date-fns/locale"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const parseDate = (value?: string) => {
  if (!value) return undefined
  const date = parse(value, "yyyy-MM-dd", new Date())
  return isValid(date) ? date : undefined
}

const serializeDate = (date?: Date) => date ? format(date, "yyyy-MM-dd") : ""
const displayDate = (date?: Date) => date ? format(date, "d MMM yyyy", { locale: id }) : "Belum dipilih"

interface DateRangePickerProps {
  from?: string
  to?: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  className?: string
  label?: string
  disabled?: boolean
  required?: boolean
}

function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  className,
  label = "Rentang tanggal",
  disabled = false,
  required = false,
}: DateRangePickerProps) {
  const selected: DateRange | undefined = from || to
    ? { from: parseDate(from), to: parseDate(to) }
    : undefined

  const handleSelect = (range: DateRange | undefined) => {
    onFromChange(serializeDate(range?.from))
    onToChange(serializeDate(range?.to))
  }

  const clear = () => {
    onFromChange("")
    onToChange("")
  }

  return (
    <Popover>
      <div className={cn("relative min-w-0", className)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={`${label}: dari ${displayDate(selected?.from)}, sampai ${displayDate(selected?.to)}`}
            className={cn(
              "h-10 w-full justify-start gap-2 rounded-xl border-border/50 bg-secondary/35 px-3 text-left text-xs font-semibold shadow-xs",
              !selected?.from && "text-muted-foreground"
            )}
          >
            <CalendarDays data-icon="inline-start" />
            <span className="min-w-0 flex-1 truncate">
              {selected?.from
                ? selected.to
                  ? `${displayDate(selected.from)} – ${displayDate(selected.to)}`
                  : `Dari ${displayDate(selected.from)}`
                : label}
            </span>
          </Button>
        </PopoverTrigger>
        {(selected?.from || selected?.to) && !disabled && !required ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Hapus ${label.toLowerCase()}`}
            onClick={clear}
            className="absolute right-1 top-1/2 size-8 -translate-y-1/2 rounded-lg"
          >
            <X />
          </Button>
        ) : null}
      </div>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-0">
        <div className="grid grid-cols-2 gap-3 border-b border-border/60 px-4 py-3 text-xs">
          <div>
            <p className="font-medium text-muted-foreground">Dari tanggal</p>
            <p className="mt-1 font-semibold text-foreground">{displayDate(selected?.from)}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Sampai tanggal</p>
            <p className="mt-1 font-semibold text-foreground">{displayDate(selected?.to)}</p>
          </div>
        </div>
        <Calendar
          mode="range"
          selected={selected}
          onSelect={handleSelect}
          locale={id}
          defaultMonth={selected?.from || new Date()}
          startMonth={new Date(2000, 0)}
          endMonth={new Date(new Date().getFullYear() + 10, 11)}
          numberOfMonths={1}
          required={required}
          autoFocus
        />
        {!required ? <div className="flex justify-end border-t border-border/60 p-2"><Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!selected?.from && !selected?.to}>Hapus tanggal</Button></div> : null}
      </PopoverContent>
    </Popover>
  )
}

interface DatePickerProps {
  value?: string
  onChange: (value: string) => void
  className?: string
  label?: string
  disabled?: boolean
  required?: boolean
}

function DatePicker({ value, onChange, className, label = "Pilih tanggal", disabled = false, required = false }: DatePickerProps) {
  const selected = parseDate(value)

  return (
    <Popover>
      <div className={cn("relative min-w-0", className)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={`${label}: ${displayDate(selected)}`}
            className={cn("h-10 w-full justify-start gap-2 rounded-xl border-border/50 bg-secondary/35 px-3 text-left text-xs font-semibold shadow-xs", !selected && "text-muted-foreground")}
          >
            <CalendarDays data-icon="inline-start" />
            <span className="min-w-0 flex-1 truncate">{selected ? displayDate(selected) : label}</span>
          </Button>
        </PopoverTrigger>
        {selected && !disabled && !required ? (
          <Button type="button" variant="ghost" size="icon" aria-label={`Hapus ${label.toLowerCase()}`} onClick={() => onChange("")} className="absolute right-1 top-1/2 size-8 -translate-y-1/2 rounded-lg">
            <X />
          </Button>
        ) : null}
      </div>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => onChange(serializeDate(date))}
          locale={id}
          defaultMonth={selected || new Date()}
          startMonth={new Date(2000, 0)}
          endMonth={new Date(new Date().getFullYear() + 10, 11)}
          required={required}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker, DateRangePicker }
