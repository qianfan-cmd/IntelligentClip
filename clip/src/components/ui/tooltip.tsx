import { cn } from "@/lib/utils"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import * as React from "react"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, children, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn("", className)}
    style={{
      zIndex: 2147483647,
      background: "#ffffff",
      color: "#000000",
      borderRadius: 10,
      boxShadow: "0 6px 12px rgba(0,0,0,0.15)",
      padding: "6px 10px",
      fontSize: 12,
      lineHeight: "16px",
      whiteSpace: "nowrap"
    }}
    {...props}
  >
    {children}
    <TooltipPrimitive.Arrow
      offset={6}
      width={12}
      height={6}
      style={{ fill: "#ffffff", filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.12))" }}
    />
  </TooltipPrimitive.Content>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
