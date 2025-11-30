/**
 * EmptyScreen - 聊天区空状态组件
 * 显示欢迎信息和快捷问题建议
 */
import { Button } from "@/components/ui/button"
import { useExtension } from "@/contexts/extension-context"
import { cn } from "@/lib/utils"
import { MessageCircle, ArrowRight, WifiOff } from "lucide-react"

// 预设问题示例
const exampleMessages = [
  {
    heading: "📝 这个视频讲了什么？",
    message: "请简要概括这个视频的主要内容"
  },
  {
    heading: "💡 有哪些关键要点？",
    message: "这个视频有哪些关键要点和核心观点？"
  },
  {
    heading: "🎯 总结主要收获",
    message: "观看这个视频能获得哪些主要收获和启发？"
  },
  {
    heading: "❓ 深入某个话题",
    message: "能详细解释一下视频中提到的主要概念吗？"
  }
]

interface EmptyScreenProps {
  className?: string
  setPromptInput: (value: string) => void
}

export default function EmptyScreen({ className, setPromptInput }: EmptyScreenProps) {
  const { extensionData, extensionLoading } = useExtension()
  
  const hasTranscript = extensionData?.transcript?.events && extensionData.transcript.events.length > 0

  // 无字幕状态
  if (!hasTranscript && !extensionLoading) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full px-6 py-8", className)}>
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
          <WifiOff className="h-8 w-8 text-amber-500" />
        </div>
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
          无法获取字幕
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-[260px]">
          当前视频没有可用的字幕/CC，对话功能需要字幕才能工作。请选择一个有字幕的视频。
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
          AI 视频助手
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[240px] leading-relaxed">
          基于视频内容进行智能问答，帮助你快速理解和探索视频中的知识
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
            onClick={() => setPromptInput(item.message)}
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
