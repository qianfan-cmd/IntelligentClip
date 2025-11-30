import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip"

export function TooltipWrapper({ children, text, side = "bottom", offset = 6 }) {
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
          <span>{text}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
