/**
 * Chat - 聊天面板主组件
 * 
 * 结构：
 * - ChatActions: 顶部操作栏（模型选择、新建对话、保存）
 * - ClipTagsPanel: AI 标注展示区域（分类/评分/标签）
 * - ChatList: 消息列表区域（自动滚动）
 * - 打标提示: 引导用户使用打标功能
 * - PromptForm: 底部输入区域（Enter 发送）
 */
import ChatActions from "./chat-actions"
import ChatList from "./chat-list"
import PromptForm from "./chat-prompt-form"
import ClipTagsPanel from "./clip-tags-panel"
import { cn } from "@/lib/utils"
import { useExtension } from "@/contexts/extension-context"
import { ClipStore, type Clip } from "@/lib/clip-store"
import { Sparkles } from "lucide-react"
import React, { useEffect, useState } from "react"

interface ChatProps {
  className?: string
}

export default function Chat({ className }: ChatProps) {
  const { currentClipId } = useExtension()
  const [currentClip, setCurrentClip] = useState<Clip | null>(null)
  
  // 加载当前剪藏数据
  useEffect(() => {
    async function loadClip() {
      if (!currentClipId) {
        setCurrentClip(null)
        return
      }
      
      const clips = await ClipStore.getAll()
      const clip = clips.find(c => c.id === currentClipId)
      setCurrentClip(clip || null)
    }
    
    loadClip()
    
    // 监听存储变化，实时更新打标信息
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === "local" && changes.clips) {
        loadClip()
      }
    }
    
    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [currentClipId])
  
  return (
    <div className={cn(
      "w-full h-full min-h-[400px] relative bg-white dark:bg-[#0f0f0f] flex flex-col overflow-hidden",
      className
    )}>
      {/* 顶部操作栏 - 固定 */}
      <ChatActions className="flex-shrink-0 border-b border-gray-100 dark:border-zinc-800" />
      
      {/* AI 标注面板 - 仅在有剪藏时显示 */}
      {currentClipId && (
        <div className="flex-shrink-0 p-3 border-b border-gray-100 dark:border-zinc-800">
          <ClipTagsPanel clip={currentClip} compact />
        </div>
      )}
      
      {/* 消息列表 - 可滚动 */}
      <ChatList className="flex-1 min-h-0" />
      
      {/* 打标功能提示 */}
      {currentClipId && (
        <div className="flex-shrink-0 px-3 py-2 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 border-t border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <span>
              提示：你可以说
              <span className="text-indigo-600 dark:text-indigo-400 font-medium">"帮我打标签和评分"</span>
              来更新当前剪藏的标注
            </span>
          </div>
        </div>
      )}
      
      {/* 底部输入框 - 固定 */}
      <PromptForm className="flex-shrink-0 border-t border-gray-100 dark:border-zinc-800" />
    </div>
  )
}
