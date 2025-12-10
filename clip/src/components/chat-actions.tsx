/**
 * ChatActions - 聊天区顶部操作栏
 * 包含模型选择、保存对话、新建对话等功能
 */
import { models, type Model } from "@/lib/constants"
// prettier-ignore
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button"
import { TooltipWrapper } from "@/components/ui/tooltip-wrapper"
import { useChat } from "@/contexts/chat-context"
import { useExtension } from "@/contexts/extension-context"
import { cn } from "@/lib/utils"
import { Plus, Save, Loader2 } from "lucide-react"
import { ClipStore } from "@/lib/clip-store"
import { useI18n } from "@/lib/use-i18n"

interface ChatActionProps {
  className?: string
  theme?: 'dark' | 'light'
}

export default function ChatAction({ className, theme }: ChatActionProps) {
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
  const { t } = useI18n()

  // 重置对话
  function resetChat() {
    setChatMessages([])
    setChatIsGenerating(false)
    setChatIsError(false)
  }

  // 保存对话到剪藏
  async function handleSaveChat() {
    if (!chatMessages || chatMessages.length === 0) {
      // alert("没有可保存的对话内容")
      alert(t("chatActionsChatNoContentToSave"))
      return
    }
    
    const chatContent = chatMessages
      .map(m => `**${m.role === "user" ? "我" : "AI"}**: ${m.content}`)
      .join("\n\n")
    
    try {
      await ClipStore.add({
        source: "youtube",
        url: window.location.href,
        title: `对话: ${document.title}`,
        rawTextSnippet: chatContent.slice(0, 500),
        summary: chatContent,
        keyPoints: [],
        tags: ["youtube", "chat", "ai"]
      })
      
      // 通知其他页面刷新
      chrome.runtime.sendMessage({ action: 'clips-updated' }).catch(() => {})
      
      // alert("✅ 对话已保存到剪藏!")
      alert(t("chatActionsChatSaveSuccess"))
    } catch (e) {
      console.error(e)
      // alert("保存失败，请重试")
      alert(t("chatActionsChatSaveFailed"))
    }
  }


  const hasMessages = chatMessages && chatMessages.length > 0

  return (
    <div
      data-theme={theme}
      className={cn(
        "flex flex-row w-full justify-between items-center bg-white dark:bg-[#0f0f0f] py-3 px-4",
        className
      )}
    >
      {/* 左侧：模型选择 */}
      <Select
        value={chatModel.value}
        onValueChange={(value) =>
          setChatModel(models.find((model) => model.value === value))
        }
      >
        <SelectTrigger className="w-auto min-w-[140px] h-9 text-xs bg-white text-black dark:bg-black border-gray-200 dark:border-zinc-700 dark:text-white dark:hover:bg-black-10">
          {/** placeholder="选择模型" */}
          <SelectValue placeholder={t("chatActionsChatSelectModel")} />
        </SelectTrigger>
        <SelectContent>
          {models.map((model: Model) => (
            <SelectItem key={model.value} value={model.value}>
              <div className="flex flex-row items-center text-xs">
                <div className="mr-2 opacity-60">{model.icon}</div>
                {model.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 右侧：操作按钮 */}
      <div className="flex flex-row items-center gap-1">
        {/* 保存按钮 */}
        {/** text=保存对话 */}
        <TooltipWrapper text={t("chatActionsChatSaveTooltip")}>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSaveChat}
            disabled={chatIsGenerating || !hasMessages}
            className="h-8 w-8"
          >
            <Save className="h-4 w-4 text-gray-500" />
          </Button>
        </TooltipWrapper>

        {/* 新建对话按钮 */}
        {/** text=新建对话 */}
        <TooltipWrapper text={t("chatActionsChatNewTooltip")}>
          <Button
            variant="outline"
            onClick={resetChat}
            disabled={chatIsGenerating || extensionLoading}
            className="h-8 gap-1.5 px-3 text-xs"
          >
            {chatIsGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {/** text=新对话 */}
            <span>{t("chatActionsChatNewText")}</span>
          </Button>
        </TooltipWrapper>
      </div>
    </div>
  )
}
