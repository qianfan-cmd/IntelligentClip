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

interface ChatListProps {
  className?: string
}

export default function ChatList({ className }: ChatListProps) {
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
    <div className={cn("flex-1 overflow-hidden", className)}>
      {!hasMessages ? (
        <EmptyScreen setPromptInput={setChatPrompt} />
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
