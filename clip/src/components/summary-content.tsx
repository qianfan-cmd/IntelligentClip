/**
 * SummaryContent - AI 总结内容展示组件
 * 
 * 状态说明：
 * 1. extensionLoading=true: 正在加载视频数据，显示加载状态
 * 2. !hasTranscript && !extensionLoading: 视频无字幕，显示无字幕提示
 * 3. summaryIsError: 生成总结失败，显示错误状态和重试按钮
 * 4. summaryIsGenerating && !summaryContent: 正在生成总结，显示骨架屏
 * 5. !summaryContent && !summaryIsGenerating: 尚未生成，显示生成按钮
 * 6. summaryContent: 正常显示总结内容
 */
import Markdown from "@/components/markdown"
import { Button } from "@/components/ui/button"
import { useSummary } from "@/contexts/summary-context"
import { useExtension } from "@/contexts/extension-context"
import { cn } from "@/lib/utils"
import { Sparkles, Loader2 } from "lucide-react"
import { LoadingState, ErrorState, NoTranscriptState, SkeletonLoader } from "./ui/state-views"

export default function SummaryContent() {
  const { 
    summaryIsGenerating, 
    summaryContent, 
    summaryIsError, 
    summaryErrorMessage, 
    generateSummary 
  } = useSummary()
  const { extensionData, extensionLoading } = useExtension()

  // 检查是否有字幕数据
  const hasTranscript = extensionData?.transcript?.events && extensionData.transcript.events.length > 0

  // 状态1: 正在加载视频数据
  if (extensionLoading) {
    return (
      <div className="p-6 bg-white dark:bg-[#0f0f0f]">
        <LoadingState message="正在获取视频信息..." />
      </div>
    )
  }

  // 状态2: 视频无字幕
  if (!hasTranscript) {
    return (
      <div className="p-6 bg-white dark:bg-[#0f0f0f]">
        <NoTranscriptState />
      </div>
    )
  }

  // 状态3: 生成总结失败
  if (summaryIsError) {
    return (
      <div className="p-6 bg-white dark:bg-[#0f0f0f]">
        <ErrorState
          title="生成失败"
          message={summaryErrorMessage || "请检查 API 密钥是否正确配置"}
          onRetry={generateSummary}
          retryText="重新生成"
        />
      </div>
    )
  }

  // 状态4: 正在生成总结（显示骨架屏）
  if (summaryIsGenerating && !summaryContent) {
    return (
      <div className="p-6 bg-white dark:bg-[#0f0f0f]">
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          <span>AI 正在分析视频内容...</span>
        </div>
        <SkeletonLoader lines={8} />
      </div>
    )
  }

  // 状态5: 尚未生成总结
  if (!summaryContent) {
    return (
      <div className="p-6 bg-white dark:bg-[#0f0f0f]">
        <div className="flex flex-col items-center py-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-indigo-500" />
          </div>
          <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
            准备就绪
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6 max-w-[240px]">
            点击下方按钮，让 AI 为你总结这个视频的核心内容
          </p>
          <Button
            onClick={generateSummary}
            className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30"
          >
            <Sparkles className="h-4 w-4" />
            生成 AI 总结
          </Button>
        </div>
      </div>
    )
  }

  // 状态6: 正常显示总结内容
  return (
    <div className="bg-white dark:bg-[#0f0f0f]">
      {/* 如果正在流式生成，显示提示 */}
      {summaryIsGenerating && (
        <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/30 flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在生成中...</span>
        </div>
      )}
      
      {/* 内容区域 - 可滚动 */}
      <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
        <div className="p-4 md:p-5">
          <div className="prose prose-sm dark:prose-invert max-w-none 
            prose-headings:text-gray-800 dark:prose-headings:text-gray-100
            prose-p:text-gray-600 dark:prose-p:text-gray-300
            prose-li:text-gray-600 dark:prose-li:text-gray-300
            prose-strong:text-gray-800 dark:prose-strong:text-gray-200
            prose-h2:text-base prose-h2:font-semibold prose-h2:mt-5 prose-h2:mb-2
            prose-h3:text-sm prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-2
            prose-ul:my-2 prose-li:my-0.5
            leading-relaxed
          ">
            <Markdown markdown={summaryContent} />
          </div>
        </div>
      </div>
    </div>
  )
}

