import { Button } from "@/components/ui/button"
import { CollapsibleTrigger } from "@/components/ui/collapsible"
import { TooltipWrapper } from "@/components/ui/tooltip-wrapper"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"

// prettier-ignore
import { ActivityLogIcon, CaretSortIcon, ChatBubbleIcon, CheckIcon, Link2Icon, Pencil2Icon } from "@radix-ui/react-icons";
import { History } from "lucide-react"

import { IconOpenAI } from "@/components/ui/icons"
import { useExtension } from "@/contexts/extension-context"

interface ExtensionActionsProps {}

export default function ExtensionActions({}: ExtensionActionsProps) {
  const { extensionIsOpen, extensionPanel, setExtensionIsOpen, setExtensionPanel } =
    useExtension()

  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 })

  function CopyVideoURL() {
    if (isCopied) return
    copyToClipboard(window.location.href)
  }

  function openHistoryPage() {
    console.log("📜 Opening history page...")
    chrome.runtime.sendMessage({ action: "openHistory" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Message error:", chrome.runtime.lastError)
        // Fallback: try opening directly
        chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") })
      } else {
        console.log("✅ History page opened:", response)
      }
    })
  }

  return (
    <div className="p-2.5 px-3 dark:bg-[#0f0f0f] dark:text-white rounded-md flex items-center justify-between border border-zinc-200 dark:border-zinc-800">
      <IconOpenAI className="h-6 w-6 opacity-50 ml-2" />
      <div className="flex justify-center items-center space-x-2">
        <div className="flex -space-x-px">
          <Button
            variant="outline"
            onClick={() => {
              setExtensionPanel("Summary")
              if (!extensionIsOpen) setExtensionIsOpen(true)
            }}
            className="rounded-r-none focus:z-10 bg-transparent dark:bg-transparent space-x-2 items-center">
            <Pencil2Icon className="h-4 w-4 opacity-60" />
            <span className="opacity-90">Summary</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setExtensionPanel("Transcript")
              if (!extensionIsOpen) setExtensionIsOpen(true)
            }}
            className="rounded-none focus:z-10 bg-transparent dark:bg-transparent space-x-2 items-center">
            <ActivityLogIcon className="h-4 w-4 opacity-60" />
            <span className="opacity-90">Transcript</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setExtensionPanel("Chat")
              if (!extensionIsOpen) setExtensionIsOpen(true)
            }}
            className="rounded-l-none focus:z-10 bg-transparent dark:bg-transparent space-x-2 items-center">
            <ChatBubbleIcon className="h-4 w-4 opacity-60" />
            <span className="opacity-90">Chat</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <TooltipWrapper text="View Clip History">
          <Button variant="outline" size="icon" onClick={openHistoryPage}>
            <History className="h-4 w-4 opacity-60" />
          </Button>
        </TooltipWrapper>

        <TooltipWrapper text="Copy Video URL">
          <Button variant="outline" size="icon" onClick={() => CopyVideoURL()}>
            {isCopied ? (
              <CheckIcon className="h-4.5 w-4.5 opacity-60" />
            ) : (
              <Link2Icon className="h-4.5 w-4.5 opacity-60" />
            )}
          </Button>
        </TooltipWrapper>

        <CollapsibleTrigger asChild>
          <Button variant="outline" size="icon">
            <CaretSortIcon className="h-4.5 w-4.5 opacity-60" />
          </Button>
        </CollapsibleTrigger>
      </div>
    </div>
  )
}
