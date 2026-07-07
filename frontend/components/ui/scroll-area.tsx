"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

function ScrollArea({
  className,
  children,
  ref,
  ...props
}: React.ComponentPropsWithRef<"div">) {
  return (
    <div
      ref={ref}
      className={cn("overflow-auto scrollbar-thin", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function ScrollBar({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return null;
}

export { ScrollArea, ScrollBar }
