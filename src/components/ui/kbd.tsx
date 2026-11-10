import * as React from "react"
import { cn } from "@/lib/utils"

export interface KbdProps extends React.ComponentProps<"kbd"> {
  size?: "sm" | "default"
}

export function Kbd({ className, size = "default", children, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex select-none items-center justify-center font-mono font-medium",
        "rounded-md border border-border/80 bg-secondary/80 text-muted-foreground shadow-2xs",
        size === "sm" ? "h-5 min-w-5 px-1 text-[10px]" : "h-5.5 min-w-5.5 px-1.5 text-xs",
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  )
}
