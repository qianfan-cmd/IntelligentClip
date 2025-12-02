/**
 * ExtensionPanels - 主内容面板容器
 * 根据当前选中的面板显示 Summary/Transcript/Chat
 * 
 * 【修复】使用统一的 API 配置模块，正确处理加载状态
 */
import Chat from "@/components/chat"
import Summary from "@/components/summary"
import Transcript from "@/components/transcript"
import { useExtension } from "@/contexts/extension-context"
import { useApiConfig } from "@/lib/api-config-store"
import { Loader2 } from "lucide-react"

import OpenAISetup from "./openai-setup"

interface ExtensionPanelsProps {}

export default function ExtensionPanels({}: ExtensionPanelsProps) {
  const { extensionPanel } = useExtension()
  // 【修复】使用统一的 API 配置模块，包含加载状态
  const { apiKey: openAIKey, isLoading } = useApiConfig()

  // 【修复】加载中时显示 loading 状态，而不是直接显示设置界面
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] p-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm text-gray-500">正在加载配置...</p>
      </div>
    )
  }

  // 【修复】只有在加载完成且确实没有 API Key 时才显示设置界面
  if (!openAIKey) {
    return (
      <div className="p-4">
        <OpenAISetup />
      </div>
    )
  }
  
  return (
    <div className="flex flex-col h-[450px] bg-white dark:bg-[#0f0f0f] rounded-lg overflow-hidden">
      {extensionPanel === "Summary" && <Summary />}
      {extensionPanel === "Transcript" && <Transcript />}
      {extensionPanel === "Chat" && <Chat />}
    </div>
  )
}
