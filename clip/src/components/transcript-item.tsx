/**
 * TranscriptItem - 单条字幕组件
 * 支持时间跳转、复制和搜索高亮
 */
import { Button } from "@/components/ui/button"
import { TooltipWrapper } from "@/components/ui/tooltip-wrapper"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"
import { Clock, Copy, Check } from "lucide-react"
import { memo } from "react"

type Transcript = {
  text: string
  startTime: number
  endTime: number
}

interface TranscriptItemProps {
  item: Transcript
  searchInput: string
}

function TranscriptItem({ item, searchInput }: TranscriptItemProps) {
  const player = document.querySelector("video")

  const { isCopied, copyToClipboard } = useCopyToClipboard({
    timeout: 2000
  })

  function CopySection() {
    if (isCopied) return
    copyToClipboard(item.text)
  }

  const startTime = new Date(item.startTime).toISOString().substr(14, 5)

  function JumpToTime() {
    if (player) {
      player.currentTime = item.startTime / 1000
    }
  }

  const highlightText = (text: string, search: string): JSX.Element => {
    if (!search) return <>{text}</>
    const parts = text.split(new RegExp(`(${search})`, "gi"))
    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === search.toLowerCase() ? (
            <mark key={index} className="bg-yellow-200 dark:bg-yellow-500/30 px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    )
  }

  return (
    <div
      data-start-time={item.startTime}
      data-end-time={item.endTime}
      className="group flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
    >
      {/* 时间戳 */}
      <button
        onClick={JumpToTime}
        className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
      >
        <Clock className="h-3 w-3" />
        <span>{startTime}</span>
      </button>

      {/* 字幕文本 */}
      <p className="flex-1 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        {highlightText(item.text, searchInput)}
      </p>

      {/* 复制按钮 - 悬停显示 */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <TooltipWrapper text={isCopied ? "已复制" : "复制"}>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={CopySection}
            className="h-7 w-7"
          >
            {isCopied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-gray-400" />
            )}
          </Button>
        </TooltipWrapper>
      </div>
    </div>
  )
}

export default memo(TranscriptItem)
