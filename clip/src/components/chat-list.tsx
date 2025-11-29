import { useChat } from "@/contexts/chat-context"
import type { Message } from "@/lib/constants"
import { ChatScrollAnchor } from "@/lib/hooks/chat-scroll-anchor"
import { cn } from "@/lib/utils"
import { useEffect, useRef } from "react"

import EmptyScreen from "./chat-empty-screen"
import ChatItem from "./chat-item"

interface ChatListProps {
  className?: string
}

export default function ChatList({ className }: ChatListProps) {
  const { chatMessages, setChatPrompt } = useChat()
  const scrollContainerRef = useRef(null)

  useEffect(() => {
    // Scroll to the bottom of the scroll container
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight
    }
  }, [chatMessages])

  return (
    <div className={cn("flex-1 overflow-hidden", className)}>
      {!chatMessages || chatMessages.length === 0 ? (
        <EmptyScreen setPromptInput={setChatPrompt} />
      ) : (
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto no-scrollbar px-4 pb-4">
          {chatMessages.map((message: Message, index: number) => (
            <ChatItem key={index} message={message} />
          ))}
        </div>
      )}
    </div>
  )
}
