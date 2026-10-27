import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-[10px] border border-input bg-sheet px-3 text-[15px] text-ink transition-[border-color] duration-[var(--duration-quick)] outline-none placeholder:text-soft/70 focus-visible:border-teal disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-bad",
        className
      )}
      {...props}
    />
  )
}

export { Input }
