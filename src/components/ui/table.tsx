"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { SimpleTooltip } from "@/components/ui/tooltip"

type TableTooltipProps = {
  tooltip?: React.ReactNode | false
}

function TableTooltip({ content, children }: { content: React.ReactNode; children: React.ReactElement }) {
  if (!content) return children
  return <SimpleTooltip content={content} contentClassName="z-[120] max-w-[min(28rem,calc(100vw-2rem))] whitespace-pre-wrap break-words text-left">{children}</SimpleTooltip>
}

function Table({ className, containerClassName, containerProps, ...props }: React.ComponentProps<"table"> & {
  containerClassName?: string
  containerProps?: React.ComponentProps<"div">
}) {
  return (
    <div
      data-slot="table-container"
      data-lenis-prevent
      className={cn("relative w-full overflow-x-auto", containerClassName)}
      {...containerProps}
    >
      <table
        data-slot="table"
        className={cn("w-full table-fixed caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-accent border-b transition-colors duration-[var(--motion-fast)]",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, title, tooltip, ...props }: React.ComponentProps<"th"> & TableTooltipProps) {
  return (
    <TableTooltip content={tooltip === false ? null : tooltip ?? title}>
    <th
      data-slot="table-head"
      className={cn(
        "text-muted-foreground h-11 px-3 text-left align-middle text-xs font-semibold whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
    </TableTooltip>
  )
}

function TableCell({ className, title, tooltip, ...props }: React.ComponentProps<"td"> & TableTooltipProps) {
  return (
    <TableTooltip content={tooltip === false ? null : tooltip ?? title}>
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-normal break-words [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
    </TableTooltip>
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
