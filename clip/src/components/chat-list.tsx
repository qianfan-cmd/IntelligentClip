/**
 * ChatList - 聊天消息列表组件
 * 
 * 功能：
 * - 显示消息列表或空状态
 * - 新消息时自动滚动到底部
 * - 使用 ref 管理滚动容器
 */
import { useChat } from "@/contexts/chat-context"
import type { Message } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { useEffect, useRef, useCallback } from "react"
import { MessageBubble } from "./message-bubble"
import EmptyScreen from "./chat-empty-screen"

// 组件入参：
// - onRequestFocusPrompt: 当需要让底部输入框获取焦点时触发的回调（由父组件实现具体聚焦逻辑）
interface ChatListProps {
  className?: string
  theme?: 'dark' | 'light'
  onRequestFocusPrompt?: () => void
}

// ChatList：消息列表或空态
// 这里不直接持有输入框的 ref，而是通过回调把“请求聚焦”的意图传给父组件
export default function ChatList({ className, theme, onRequestFocusPrompt }: ChatListProps) {
  const { chatMessages, chatIsGenerating, setChatPrompt } = useChat()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 滚动到底部的函数
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: "end" })
    }
  }, [])

  // 当消息变化时自动滚动到底部
  useEffect(() => {
    // 使用 requestAnimationFrame 确保在 DOM 更新后滚动
    requestAnimationFrame(() => {
      scrollToBottom("smooth")
    })
  }, [chatMessages, scrollToBottom])

  // 组件挂载时立即滚动到底部（无动画）
  useEffect(() => {
    scrollToBottom("instant" as ScrollBehavior)
  }, [])

  const hasMessages = chatMessages && chatMessages.length > 0

  return (
    <div data-theme={theme} className={cn("flex-1 min-h-0", className)}>
      {!hasMessages ? (
        // 空态场景也使用滚动容器，避免在小屏幕下被底部输入框遮挡
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto custom-scrollbar px-4 py-4"
        >
          {/* 为空态预设增加底部留白（在 EmptyScreen 中），确保在小屏幕下不会被输入框覆盖 */}
          <EmptyScreen setPromptInput={setChatPrompt} onRequestFocusPrompt={onRequestFocusPrompt} />
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto custom-scrollbar px-4 py-4"
        >
          {chatMessages.map((message: Message, index: number) => {
            const isLastAssistantMessage = 
              index === chatMessages.length - 1 && 
              message.role === "assistant"
            
            return (
              <MessageBubble
                key={index}
                role={message.role}
                content={message.content}
                isLoading={isLastAssistantMessage && chatIsGenerating && !message.content}
              />
            )
          })}
          
          {/* 滚动锚点 */}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      )}
    </div>
  )
}
