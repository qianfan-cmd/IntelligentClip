/**
 * TranscriptActions - 字幕操作栏
 * 包含搜索、跳转当前时间、复制等功能
 */
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TooltipWrapper } from "@/components/ui/tooltip-wrapper"
import { useExtension } from "@/contexts/extension-context"
import { useTranscript } from "@/contexts/transcript-context"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"
import { cleanTextTranscript } from "@/utils/functions"
import { Search, Crosshair, Copy, Check, FileText } from "lucide-react"

interface TranscriptActionsProps {
  jumpCurrentTime: () => void
}

export default function TranscriptActions({ jumpCurrentTime }: TranscriptActionsProps) {
  const { extensionLoading, extensionData } = useExtension()
  const { transcriptJson, transcriptSearch, setTranscriptSearch } = useTranscript()

  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 })

  const isDisabled = extensionLoading || transcriptJson.length === 0

  function CopyTranscript() {
    if (isCopied || !extensionData?.transcript) return
    const processed = cleanTextTranscript(extensionData.transcript)
    copyToClipboard(processed)
  }

  return (
    <div className="flex flex-row w-full justify-between items-center sticky top-0 z-10 bg-white dark:bg-[#0f0f0f] py-3 px-3 gap-3 border-b border-gray-100 dark:border-zinc-800">
      {/* 标题与计数 */}
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-indigo-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          字幕
        </span>
        {transcriptJson.length > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ({transcriptJson.length})
          </span>
        )}
      </div>

      {/* 右侧操作区 */}
      <div className="flex items-center gap-2">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            type="text"
            placeholder="搜索..."
            className="pl-8 h-8 w-32 text-sm bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 focus:w-40 transition-all"
            onChange={(e) => {
              e.preventDefault()
              setTranscriptSearch(e.currentTarget.value)
            }}
            disabled={isDisabled}
          />
        </div>

        {/* 跳转按钮 */}
        <TooltipWrapper text="跳转到当前播放位置">
          <Button
            variant="ghost"
            size="icon"
            onClick={jumpCurrentTime}
            disabled={isDisabled}
            className="h-8 w-8"
          >
            <Crosshair className="h-4 w-4 text-gray-500" />
          </Button>
        </TooltipWrapper>

        {/* 复制按钮 */}
        <TooltipWrapper text={isCopied ? "已复制" : "复制字幕"}>
          <Button
            variant="ghost"
            size="icon"
            onClick={CopyTranscript}
            disabled={isDisabled}
            className="h-8 w-8"
          >
            {isCopied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-gray-500" />
            )}
          </Button>
        </TooltipWrapper>
      </div>
    </div>
  )
}
