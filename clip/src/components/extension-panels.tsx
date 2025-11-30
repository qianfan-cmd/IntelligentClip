/**
 * ExtensionPanels - 主内容面板容器
 * 根据当前选中的面板显示 Summary/Transcript/Chat
 */
import Chat from "@/components/chat"
import Summary from "@/components/summary"
import Transcript from "@/components/transcript"
import { useExtension } from "@/contexts/extension-context"
import { openAIKeyAtom } from "@/lib/atoms/openai"
import { useAtomValue } from "jotai"

import OpenAISetup from "./openai-setup"

interface ExtensionPanelsProps {}

export default function ExtensionPanels({}: ExtensionPanelsProps) {
  const { extensionPanel } = useExtension()
  const openAIKey = useAtomValue(openAIKeyAtom)

  // 未配置 API Key 时显示设置界面
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
