/**
 * ExtensionActions - 顶部导航操作栏
 * 包含面板切换按钮、历史记录、复制链接等功能
 */
import { Button } from "@/components/ui/button"
import { CollapsibleTrigger } from "@/components/ui/collapsible"
import { TooltipWrapper } from "@/components/ui/tooltip-wrapper"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"
import { History, FileText, MessageCircle, AlignLeft, Check, Link2, ChevronDown, ChevronUp, Sparkles } from "lucide-react"
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
        chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") })
      } else {
        console.log("✅ History page opened:", response)
      }
    })
  }

  // 面板配置
  const panels = [
    { id: "Summary", label: "总结", icon: FileText },
    { id: "Transcript", label: "字幕", icon: AlignLeft },
    { id: "Chat", label: "对话", icon: MessageCircle }
  ]

  return (
    <div className="p-3 dark:bg-[#0f0f0f] bg-white dark:text-white rounded-xl flex items-center justify-between border border-gray-200 dark:border-zinc-800 shadow-sm">
      {/* 左侧 Logo */}
      <div className="flex items-center gap-2 pl-1">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-sm">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">
          AI 助手
        </span>
      </div>

      {/* 中间：面板切换 */}
      <div className="flex items-center">
        <div className="flex bg-gray-100 dark:bg-zinc-800 rounded-lg p-1">
          {panels.map((panel) => {
            const Icon = panel.icon
            const isActive = extensionPanel === panel.id
            return (
              <button
                key={panel.id}
                onClick={() => {
                  setExtensionPanel(panel.id)
                  if (!extensionIsOpen) setExtensionIsOpen(true)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{panel.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 右侧：工具按钮 */}
      <div className="flex items-center gap-1">
        <TooltipWrapper text="剪藏历史">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={openHistoryPage}
            className="h-8 w-8"
          >
            <History className="h-4 w-4 text-gray-500" />
          </Button>
        </TooltipWrapper>

        <TooltipWrapper text={isCopied ? "已复制" : "复制链接"}>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={CopyVideoURL}
            className="h-8 w-8"
          >
            {isCopied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Link2 className="h-4 w-4 text-gray-500" />
            )}
          </Button>
        </TooltipWrapper>

        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            {extensionIsOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </Button>
        </CollapsibleTrigger>
      </div>
    </div>
  )
}
