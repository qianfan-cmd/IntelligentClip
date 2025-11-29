/**
 * TranscriptContent - 字幕内容容器
 * 处理字幕加载状态和无字幕状态
 */
import { useExtension } from "@/contexts/extension-context"
import { useTranscript } from "@/contexts/transcript-context"
import React from "react"
import { FileText } from "lucide-react"

import TranscriptList from "./transcript-list"
import TranscriptSkeleton from "./transcript-skeleton"

interface TranscriptContentProps {}

const TranscriptContent = React.forwardRef<HTMLDivElement, TranscriptContentProps>(
  (props, ref) => {
    const { transcriptJson, transcriptSearch } = useTranscript()
    const { extensionLoading, extensionData } = useExtension()

    // 加载中状态
    if (extensionLoading || !extensionData) {
      return (
        <div className="flex-1 overflow-hidden p-3 bg-white dark:bg-[#0f0f0f]">
          <TranscriptSkeleton />
        </div>
      )
    }

    // 无字幕状态
    if (!transcriptJson || transcriptJson.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white dark:bg-[#0f0f0f]">
          <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <FileText className="h-7 w-7 text-gray-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            暂无字幕
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-[200px]">
            此视频没有可用的字幕，或字幕正在加载中
          </p>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className="flex-1 overflow-auto p-3 bg-white dark:bg-[#0f0f0f] scrollbar-thin"
      >
        <TranscriptList transcript={transcriptJson} searchInput={transcriptSearch} />
      </div>
    )
  }
)

TranscriptContent.displayName = "TranscriptContent"

export default TranscriptContent
