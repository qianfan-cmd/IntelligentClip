import { models, prompts, type Model, type Prompt } from "@/lib/constants"
import { useState } from "react"

// prettier-ignore
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Button } from "@/components/ui/button"
import { TooltipWrapper } from "@/components/ui/tooltip-wrapper"
import { useChat } from "@/contexts/chat-context"
import { useExtension } from "@/contexts/extension-context"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"
import { cn } from "@/lib/utils"
import { PlusIcon } from "@radix-ui/react-icons"
import { Save } from "lucide-react"
import { ClipStore } from "@/lib/clip-store"
import React from "react"

interface ChatActionProps {
  className?: string
}

export default function ChatAction({ className }: ChatActionProps) {
  const {
    chatModel,
    chatIsGenerating,
    chatMessages,
    setChatMessages,
    setChatIsGenerating,
    setChatIsError,
    setChatModel
  } = useChat()

  const { extensionLoading } = useExtension()

  // const [selectedModel, setSelectedModel] = useState<Model>(models[0])
  // const [isGeneratingChat, setIsGeneratingChat] = useState<any>(false)

  const { isCopied, copyToClipboard } = useCopyToClipboard({
    timeout: 2000
  })

  function resetChat() {
    setChatMessages([])
    setChatIsGenerating(false)
    setChatIsError(false)
  }

  async function handleSaveChat() {
    if (!chatMessages || chatMessages.length === 0) {
      alert("No chat messages to save.")
      return
    }
    
    const chatContent = chatMessages.map(m => `**${m.role.toUpperCase()}**: ${m.content}`).join("\n\n")
    
    try {
      await ClipStore.add({
        source: "youtube",
        url: window.location.href,
        title: `Chat: ${document.title}`,
        rawTextSnippet: chatContent.slice(0, 500),
        summary: chatContent,
        keyPoints: [],
        tags: ["youtube", "chat", "ai"]
      })
      alert("✅ Chat saved to clips!")
    } catch (e) {
      console.error(e)
      alert("Failed to save chat.")
    }
  }

  return (
    <div
      className={cn(
        "flex flex-row w-full justify-between items-center absolute top-0 z-10 bg-white dark:bg-[#0f0f0f] pt-3.5 pb-2 px-3",
        className
      )}>
      <Select
        value={chatModel.value}
        onValueChange={(value) =>
          setChatModel(models.find((model) => model.value === value))
        }>
        <SelectTrigger className="w-fit space-x-3">
          <SelectValue placeholder="Model" />
        </SelectTrigger>
        <SelectContent>
          {models.map((model: Model) => (
            <SelectItem key={model.value} value={model.value}>
              <div className="flex flex-row items-center">
                <div className="mr-2">{model.icon}</div>
                {model.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex flex-row space-x-2">
        <TooltipWrapper text="Save Chat">
          <Button
            variant="outline"
            size="icon"
            onClick={handleSaveChat}
            disabled={chatIsGenerating || !chatMessages || chatMessages.length === 0}>
            <Save className="h-4 w-4 opacity-60" />
          </Button>
        </TooltipWrapper>

        <TooltipWrapper text="New Chat">
          <Button
            variant="outline"
            onClick={resetChat}
            disabled={chatIsGenerating || extensionLoading}
            className="flex flex-row space-x-2">
            <PlusIcon className="h-4 w-4 opacity-60" />
            <span>New Chat</span>
          </Button>
        </TooltipWrapper>

        {/* <TooltipWrapper text="Copy Chats">
          <Button variant="outline" size="icon" disabled={chatIsGenerating}>
            {isCopied ? (
              <CheckIcon className="h-4.5 w-4.5 opacity-60" />
            ) : (
              <ClipboardCopyIcon className="h-4 w-4 opacity-60" />
            )}
          </Button>
        </TooltipWrapper> */}
      </div>
    </div>
  )
}
