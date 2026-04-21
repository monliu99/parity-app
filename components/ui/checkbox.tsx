"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { checked?: boolean }
>(({ className, checked = false, onClick, ...props }, ref) => (
  <button
    type="button"
    ref={ref}
    role="checkbox"
    aria-checked={checked}
    onClick={onClick}
    className={cn(
      "h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center",
      checked ? "bg-primary text-primary-foreground" : "bg-background",
      className
    )}
    {...props}
  >
    {checked && (
      <svg
        width="10"
        height="7"
        viewBox="0 0 10 7"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="stroke-current"
      >
        <path
          d="M1 3.5L3.5 6L9 1"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )}
  </button>
))
Checkbox.displayName = "Checkbox"

export { Checkbox }
