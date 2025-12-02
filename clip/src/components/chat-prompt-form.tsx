/**
 * PromptForm - 聊天输入表单组件
 * 
 * 交互：
 * - Enter 发送消息
 * - Shift+Enter 换行
 * - 空输入时禁用发送按钮
 * - 发送后自动聚焦输入框
 * 
 * AI 打标功能：
 * - 解析 AI 回复中的 <clip_tags> JSON
 * - 自动更新当前剪藏的标注信息
 */
import { Button } from "@/components/ui/button"
import { TooltipWrapper } from "@/components/ui/tooltip-wrapper"
import { useChat } from "@/contexts/chat-context"
import { useExtension } from "@/contexts/extension-context"
// 【修复】使用统一的 API 配置模块，解决跨页面不同步问题
import { useApiConfig } from "@/lib/api-config-store"
import { cn } from "@/lib/utils"
import { ClipStore } from "@/lib/clip-store"
import { extractClipTags, removeClipTagsFromResponse, mergeClipTags } from "@/lib/clip-tagging"
import { Send, Loader2 } from "lucide-react"
import React, { useEffect, useRef, useCallback } from "react"
import Textarea from "react-textarea-autosize"

import { usePort } from "@plasmohq/messaging/hook"

interface PromptFormProps {
  className?: string
  theme?: 'dark' | 'light'
}

export default function PromptForm({ className, theme }: PromptFormProps) {
  const port = usePort("chat")
  const { extensionData, currentClipId } = useExtension()
  // 【修复】使用统一的 API 配置模块，包含加载状态
  const { apiKey: openAIKey, isLoading: isApiKeyLoading } = useApiConfig()

  const {
    chatMessages,
    chatPrompt,
    chatIsGenerating,
    setChatPrompt,
    setChatMessages,
    setChatIsGenerating,
    setChatIsError,
    chatModel
  } = useChat()

  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 自动聚焦输入框
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // 处理键盘事件：Enter 发送，Shift+Enter 换行
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (chatPrompt.trim() && !chatIsGenerating) {
        formRef.current?.requestSubmit()
      }
    }
  }, [chatPrompt, chatIsGenerating])

  // 生成聊天回复
  async function generateChat(model: string, messages: any) {
    console.log("Function That Generates Chat Called")

    // 剪藏模式：有 summary 或 rawText 数据
    const isClipMode = extensionData?.summary || extensionData?.rawText
    
    // 验证字幕数据（仅视频模式需要）
    if (!isClipMode && (!extensionData?.transcript?.events || extensionData.transcript.events.length === 0)) {
      console.error("Cannot generate chat: No transcript data available")
      setChatIsError(true)
      setChatIsGenerating(false)
      setChatMessages([
        ...chatMessages,
        {
          role: "assistant",
          content: "❌ 当前视频没有字幕，无法进行对话。请选择一个有字幕的视频。"
        }
      ])
      return
    }

    // 【修复】正确区分"加载中"和"真正未设置"
    if (isApiKeyLoading) {
      console.log("API config is still loading, please wait...")
      setChatIsError(true)
      setChatIsGenerating(false)
      setChatMessages([
        ...chatMessages,
        {
          role: "assistant",
          content: "⏳ 正在加载 API 配置，请稍候重试..."
        }
      ])
      return
    }

    // 验证 API Key
    if (!openAIKey || openAIKey.trim() === "") {
      console.error("Cannot generate chat: No OpenAI API key")
      setChatIsError(true)
      setChatIsGenerating(false)
      setChatMessages([
        ...chatMessages,
        {
          role: "assistant",
          content: "❌ API 密钥未设置，请在设置中添加您的 API 密钥。"
        }
      ])
      return
    }

    setChatIsGenerating(true)
    setChatIsError(false)

    // 构建上下文，添加剪藏模式标记
    const context = { 
      ...extensionData, 
      openAIKey,
      clipMode: isClipMode  // 标记剪藏模式，让后台使用打标系统提示词
    }

    port.send({
      model: model,
      messages: messages,
      context
    })
  }

  /**
   * 处理 AI 回复中的打标信息
   * 从回复中提取 <clip_tags> JSON，更新当前剪藏
   */
  async function handleClipTagsUpdate(rawContent: string): Promise<string> {
    // 从 AI 回复中提取打标信息
    const clipTags = extractClipTags(rawContent)
    
    if (clipTags && clipTags.shouldUpdate && currentClipId) {
      console.log("[ClipTagging] Updating clip tags for:", currentClipId)
      console.log("[ClipTagging] Tags data:", clipTags)
      
      try {
        // 获取当前剪藏数据
        const clips = await ClipStore.getAll()
        const currentClip = clips.find(c => c.id === currentClipId)
        
        if (currentClip) {
          // 合并新的打标信息
          const mergedTags = mergeClipTags({
            categories: currentClip.categories,
            scenarios: currentClip.scenarios,
            personalComment: currentClip.personalComment,
            rating: currentClip.rating,
            tags: currentClip.tags
          }, clipTags)
          
          // 更新剪藏记录
          await ClipStore.update(currentClipId, {
            categories: mergedTags.categories,
            scenarios: mergedTags.scenarios,
            personalComment: mergedTags.personalComment,
            rating: mergedTags.rating,
            tags: mergedTags.tags,
            updatedAt: Date.now()
          })
          
          console.log("[ClipTagging] Successfully updated clip tags")
        }
      } catch (error) {
        console.error("[ClipTagging] Failed to update clip tags:", error)
      }
    }
    
    // 返回移除打标 JSON 后的纯文本回复（给用户显示）
    return removeClipTagsFromResponse(rawContent)
  }

  // 监听 port 消息
  React.useEffect(() => {
    if (!port.data) return

    if (port.data?.message !== undefined && port.data?.message !== null) {
      // 处理非流式响应（isEnd=true）
      if (port.data.isEnd === true) {
        const rawContent = port.data.message.replace(/\nEND$/, '').replace(/END$/, '')
        
        // 处理打标信息并获取清理后的内容
        handleClipTagsUpdate(rawContent).then(cleanContent => {
          if (chatMessages[chatMessages.length - 1]?.role === "user") {
            setChatMessages([
              ...chatMessages,
              { role: "assistant", content: cleanContent }
            ])
          } else {
            const newMessages = [...chatMessages]
            newMessages[newMessages.length - 1].content = cleanContent
            setChatMessages(newMessages)
          }
          
          setChatIsGenerating(false)
          setChatIsError(false)
          
          // 发送完成后重新聚焦输入框
          setTimeout(() => inputRef.current?.focus(), 100)
        })
      } 
      // 处理流式响应（显示原始内容，结束后再处理打标）
      else if (port.data.isEnd === false) {
        // 流式响应先显示原始内容（包含打标 JSON）
        const streamContent = port.data.message
        
        if (chatMessages[chatMessages.length - 1]?.role === "user") {
          setChatMessages([
            ...chatMessages,
            { role: "assistant", content: streamContent }
          ])
        } else {
          const newMessages = [...chatMessages]
          newMessages[newMessages.length - 1].content = streamContent
          setChatMessages(newMessages)
        }
        setChatIsError(false)
      }
    }
  }, [port.data?.message, port.data?.isEnd])

  // 表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const value = chatPrompt.trim()
    if (!value || chatIsGenerating) return

    setChatPrompt("")
    
    const newMessages = [
      ...chatMessages,
      { role: "user", content: value }
    ]
    
    setChatMessages(newMessages)
    await generateChat(chatModel.content, newMessages)
  }

  const isInputEmpty = !chatPrompt.trim()
  const isDisabled = isInputEmpty || chatIsGenerating

  return (
    <form
      ref={formRef}
      data-theme={theme}
      className={cn("p-3 bg-white dark:bg-[#0f0f0f]", className)}
      onSubmit={handleSubmit}
    >
      <div className="relative flex items-end gap-2 w-full bg-gray-50 text-black dark:text-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 focus-within:border-indigo-400 dark:focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900/30 transition-all">
        <Textarea
          ref={inputRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          placeholder="输入消息，Enter 发送..."
          className="flex-1 min-h-[44px] max-h-[120px] w-full resize-none bg-transparent px-4 py-3 focus:outline-none text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500"
          autoFocus
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          name="message"
          rows={1}
          value={chatPrompt}
          onChange={(e) => setChatPrompt(e.target.value)}
          disabled={chatIsGenerating}
        />

        <div className="flex-shrink-0 pr-2 pb-2">
          <TooltipWrapper text={chatIsGenerating ? "生成中..." : "发送消息"}>
            <Button
              type="submit"
              size="icon"
              disabled={isDisabled}
              className={cn(
                "h-9 w-9 rounded-lg transition-all",
                isDisabled
                  ? "bg-gray-200 dark:bg-zinc-700 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-md hover:shadow-lg"
              )}
            >
              {chatIsGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </TooltipWrapper>
        </div>
      </div>
      
      {/* 快捷键提示 */}
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">
        按 <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded text-[10px]">Enter</kbd> 发送，
        <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded text-[10px]">Shift+Enter</kbd> 换行
      </p>
    </form>
  )
}
