/**
 * EmptyScreen - 聊天区空状态组件
 * 显示欢迎信息和快捷问题建议
 */
import { Button } from "@/components/ui/button"
import { useExtension } from "@/contexts/extension-context"
import { cn } from "@/lib/utils"
import { MessageCircle, ArrowRight, WifiOff } from "lucide-react"
import { useState } from "react"
// 预设问题示例 - 使用通用表述，适用于各类剪藏内容（网页、视频、文章等）
const exampleMessages = [
  {
    heading: "📝 快速了解剪藏内容？",
    message: "请简要概括剪藏内容的主要信息"
  },
  {
    heading: "💡 有哪些关键要点？",
    message: "这篇剪藏内容有哪些关键要点和核心观点？"
  },
  {
    heading: "🎯 总结主要收获",
    message: "阅读这篇剪藏内容能获得哪些主要收获和启发？"
  },
  {
    heading: "❓ 深入某个话题",
    message: "能详细解释一下剪藏内容中提到的主要概念吗？"
  }
]

// EmptyScreen 组件入参：
// - setPromptInput: 由上层传入的设置输入框文本的方法
// - onRequestFocusPrompt: 点击预设问题后，通知上层让输入框获取焦点
interface EmptyScreenProps {
  className?: string
  setPromptInput: (value: string) => void
  onRequestFocusPrompt?: () => void
}

export default function EmptyScreen({ className, setPromptInput, onRequestFocusPrompt }: EmptyScreenProps) {
  const { extensionData, extensionLoading } = useExtension()
  
  const hasTranscript = extensionData?.transcript?.events && extensionData.transcript.events.length > 0

  // 无内容状态
  if (!hasTranscript && !extensionLoading) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full px-6 py-8", className)}>
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
          <WifiOff className="h-8 w-8 text-amber-500" />
        </div>
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
          无法获取内容
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-[260px]">
          当前剪藏没有可用的文本内容，对话功能需要内容才能工作。请选择一个有内容的剪藏。
        </p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full px-4 py-6", className)}>
      {/* 顶部欢迎区域 */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mb-4 shadow-sm">
          <MessageCircle className="h-7 w-7 text-indigo-500" />
        </div>
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">
          AI 剪藏助手
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[240px] leading-relaxed">
          基于剪藏内容进行智能问答，帮助你快速理解和探索其中的知识
        </p>
      </div>

      {/* 快捷问题列表 */}
      <div className="flex-1 space-y-2">
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 px-1">
          试试这些问题：
        </p>
        {exampleMessages.map((item, index) => (
          <Button
            key={index}
            variant="outline"
            // 点击示例：先把示例文案写入输入框，再请求聚焦
            onClick={() => { setPromptInput(item.message); onRequestFocusPrompt?.() }}
            className="w-full h-auto justify-between text-left p-3 bg-gray-50/50 dark:bg-zinc-800/50 border-gray-200/80 dark:border-zinc-700/80 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300 dark:hover:border-indigo-700 group transition-all"
          >
            <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
              {item.heading}
            </span>
            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
          </Button>
        ))}
      </div>
    </div>
  )
}
