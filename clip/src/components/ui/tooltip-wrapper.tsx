import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip"

type TooltipSide = "bottom" | "left" | "top" | "right"

interface TooltipWrapperProps {
  children: React.ReactNode
  text?: string
  content?: React.ReactNode
  side?: TooltipSide
  offset?: number
}

export function TooltipWrapper({ children, text, content, side = "bottom", offset = 6 }: TooltipWrapperProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          sideOffset={offset}
          style={{
            zIndex: 2147483647,
            background: '#ffffff',
            color: '#000000',
            borderRadius: 8,
            boxShadow: '0 6px 12px rgba(0,0,0,0.15)',
            padding: '3px 8px',
            fontSize: 11,
            lineHeight: '16px',
            whiteSpace: 'nowrap'
          }}
        >
          {content ? content : <span>{text}</span>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
