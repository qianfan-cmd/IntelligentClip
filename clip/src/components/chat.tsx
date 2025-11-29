/**
 * Chat - 聊天面板主组件
 * 
 * 结构：
 * - ChatActions: 顶部操作栏（模型选择、新建对话、保存）
 * - ChatList: 消息列表区域（自动滚动）
 * - PromptForm: 底部输入区域（Enter 发送）
 */
import ChatActions from "./chat-actions"
import ChatList from "./chat-list"
import PromptForm from "./chat-prompt-form"
import { cn } from "@/lib/utils"

interface ChatProps {
  className?: string
}

export default function Chat({ className }: ChatProps) {
  return (
    <div className={cn(
      "w-full h-full min-h-[400px] relative bg-white dark:bg-[#0f0f0f] flex flex-col overflow-hidden",
      className
    )}>
      {/* 顶部操作栏 - 固定 */}
      <ChatActions className="flex-shrink-0 border-b border-gray-100 dark:border-zinc-800" />
      
      {/* 消息列表 - 可滚动 */}
      <ChatList className="flex-1 min-h-0" />
      
      {/* 底部输入框 - 固定 */}
      <PromptForm className="flex-shrink-0 border-t border-gray-100 dark:border-zinc-800" />
    </div>
  )
}
