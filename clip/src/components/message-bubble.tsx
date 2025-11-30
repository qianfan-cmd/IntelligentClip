/**
 * MessageBubble - 聊天消息气泡组件
 * 区分用户消息和 AI 回复的视觉样式
 */
import { cn } from "@/lib/utils"
import { Bot, User } from "lucide-react"
import Markdown from "./markdown"

interface MessageBubbleProps {
  role: "user" | "assistant" | string
  content: string
  isLoading?: boolean
  className?: string
}

export function MessageBubble({ role, content, isLoading, className }: MessageBubbleProps) {
  const isUser = role === "user"

  return (
    <div
      className={cn(
        "flex gap-3 mb-4 last:mb-0",
        isUser && "flex-row-reverse",
        className
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-indigo-100 dark:bg-indigo-900/40"
            : "bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "flex-1 min-w-0 max-w-[85%]",
          isUser && "flex justify-end"
        )}
      >
        <div
          className={cn(
            "inline-block rounded-2xl px-4 py-2.5",
            isUser
              ? "bg-indigo-500 text-white rounded-br-md"
              : "bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 rounded-bl-md"
          )}
        >
          {isLoading ? (
            <div className="flex items-center gap-1 py-1">
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          ) : isUser ? (
            <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
          ) : (
            <div className="text-sm prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <Markdown markdown={content} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
