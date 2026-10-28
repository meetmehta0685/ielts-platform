import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] font-medium whitespace-nowrap select-none outline-none transition-[background-color,color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-45 aria-invalid:text-bad [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-ink text-white hover:bg-ink-hover",
        accent: "bg-brand text-brand-ink hover:bg-brand-hover",
        outline: "bg-sheet text-ink shadow-[inset_0_0_0_1px_var(--input)] hover:bg-panel hover:shadow-[inset_0_0_0_1px_var(--line-strong)]",
        secondary: "bg-panel-strong text-ink hover:bg-panel-hover",
        ghost: "text-ink hover:bg-panel-strong",
        destructive: "bg-bad-tint text-bad hover:bg-bad-tint-hover",
        link: "rounded-none text-ink underline decoration-1 underline-offset-4 hover:decoration-2",
      },
      size: {
        default: "h-10 px-5 text-[15px]",
        xs: "h-7 rounded-[8px] px-3 text-[13px]",
        sm: "h-8 rounded-[8px] px-3.5 text-sm",
        lg: "h-12 rounded-[12px] px-6 text-base",
        icon: "size-10",
        "icon-xs": "size-7 rounded-[8px]",
        "icon-sm": "size-8 rounded-[8px]",
        "icon-lg": "size-12 rounded-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
