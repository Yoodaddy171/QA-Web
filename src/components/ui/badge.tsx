import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[background-color,border-color,color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        success:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 shadow-[0_0_10px_rgba(16,185,129,0.12)] dark:text-emerald-400",
        warning:
          "border-amber-500/30 bg-amber-500/10 text-amber-700 shadow-[0_0_10px_rgba(245,158,11,0.12)] dark:text-amber-400",
        failed:
          "border-rose-500/30 bg-rose-500/10 text-rose-700 shadow-[0_0_10px_rgba(244,63,94,0.12)] dark:text-rose-400",
        info:
          "border-sky-500/30 bg-sky-500/10 text-sky-700 shadow-[0_0_10px_rgba(14,165,233,0.12)] dark:text-sky-400",
        notdone:
          "border-slate-400/30 bg-slate-300/50 text-slate-600 dark:text-slate-400",
        inprogress:
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        blocked:
          "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
        readyretest:
          "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
        verifiedfixed:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        tba:
          "border-purple-400/30 bg-purple-300/20 text-purple-700 dark:text-purple-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
