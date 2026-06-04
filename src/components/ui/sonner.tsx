"use client"

import { Toaster as Sonner, ToasterProps } from "sonner"
import { useAppTheme } from "@/components/Providers"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useAppTheme()

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
