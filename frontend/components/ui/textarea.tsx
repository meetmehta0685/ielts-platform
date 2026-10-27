import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-[10px] border border-input bg-sheet px-3 py-2.5 text-[15px] leading-relaxed text-ink outline-none transition-[border-color] duration-[var(--duration-quick)] placeholder:text-soft/70 focus-visible:border-teal disabled:opacity-50 aria-invalid:border-bad",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
