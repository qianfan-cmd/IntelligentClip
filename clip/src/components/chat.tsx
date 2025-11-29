import ChatActions from "./chat-actions"
import ChatList from "./chat-list"
import PromptForm from "./chat-prompt-form"
import { cn } from "@/lib/utils"

interface ChatProps {
  className?: string
}

export default function Chat({ className }: ChatProps) {
  return (
    <div className={cn("w-full h-[498px] relative bg-white dark:bg-[#0f0f0f] flex flex-col", className)}>
      <ChatActions className="relative top-0 border-b border-gray-100 dark:border-zinc-800" />
      <ChatList className="flex-1" />
      <PromptForm className="relative bottom-0 border-t border-gray-100 dark:border-zinc-800" />
    </div>
  )
}
