"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useAppTheme } from "@/components/Providers"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useAppTheme()

  return (
    <Sonner
      theme={resolvedTheme as "light" | "dark" | "system" | undefined}
      className="toaster group font-sans text-xs"
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl group-[.toaster]:p-3.5 group-[.toaster]:gap-2.5",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:text-xs group-[.toast]:font-semibold group-[.toast]:rounded-lg",
          cancelButton:
            "group-[.toast]:bg-secondary group-[.toast]:text-muted-foreground group-[.toast]:text-xs group-[.toast]:rounded-lg",
          closeButton:
            "group-[.toast]:border-border group-[.toast]:bg-secondary/80 group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
