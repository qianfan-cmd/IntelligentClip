/**
 * SummaryActions - 总结区域的操作栏
 * 包含模型选择、重新生成、复制、保存等功能
 */
// prettier-ignore
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useSummary } from "@/contexts/summary-context"
import { models, prompts, type Model, type Prompt } from "@/lib/constants"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"
import { Check, Copy, RefreshCw, Save, Loader2 } from "lucide-react"
import { ClipStore } from "@/lib/clip-store"

import { Button } from "./ui/button"
import { TooltipWrapper } from "./ui/tooltip-wrapper"

interface SummaryActionsProps {}

export default function SummaryActions({}: SummaryActionsProps) {
  const {
    summaryPrompt,
    summaryIsGenerating,
    summaryModel,
    summaryContent,
    setSummaryPrompt,
    setSummaryModel,
    generateSummary
  } = useSummary()

  const { isCopied, copyToClipboard } = useCopyToClipboard({
    timeout: 2000
  })

  function CopySummary() {
    if (isCopied || !summaryContent || summaryIsGenerating) return
    copyToClipboard(summaryContent)
  }

  async function handleSaveSummary() {
    if (!summaryContent || summaryIsGenerating) return
    
    try {
      await ClipStore.add({
        source: "youtube",
        url: window.location.href,
        title: document.title,
        rawTextSnippet: summaryContent.slice(0, 500),
        summary: summaryContent,
        keyPoints: [],
        tags: ["youtube", "summary"]
      })
      alert("✅ 总结已保存到剪藏!")
    } catch (e) {
      console.error(e)
      alert("保存失败，请重试")
    }
  }

  return (
    <div className="flex flex-row w-full justify-between items-center sticky top-0 z-10 bg-white dark:bg-[#0f0f0f] py-3 px-4 border-b border-gray-100 dark:border-zinc-800">
      {/* 左侧：模型选择 */}
      <Select
        value={summaryModel.value}
        onValueChange={(value) =>
          setSummaryModel(models.find((model) => model.value === value))
        }
      >
        <SelectTrigger className="w-auto min-w-[140px] h-9 text-xs bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
          <SelectValue placeholder="选择模型" />
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

      {/* 右侧：操作按钮组 */}
      <div className="flex flex-row items-center gap-1">
        {/* 保存按钮 */}
        <TooltipWrapper text="保存到剪藏">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSaveSummary}
            disabled={summaryIsGenerating || !summaryContent}
            className="h-8 w-8"
          >
            <Save className="h-4 w-4 text-gray-500" />
          </Button>
        </TooltipWrapper>

        {/* 重新生成按钮 */}
        <TooltipWrapper text="重新生成">
          <Button
            variant="ghost"
            size="icon"
            onClick={generateSummary}
            disabled={summaryIsGenerating}
            className="h-8 w-8"
          >
            {summaryIsGenerating ? (
              <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 text-gray-500" />
            )}
          </Button>
        </TooltipWrapper>

        {/* 复制按钮 */}
        <TooltipWrapper text={isCopied ? "已复制" : "复制内容"}>
          <Button
            variant="ghost"
            size="icon"
            onClick={CopySummary}
            disabled={summaryIsGenerating || !summaryContent}
            className="h-8 w-8"
          >
            {isCopied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-gray-500" />
            )}
          </Button>
        </TooltipWrapper>

        {/* Prompt 选择 */}
        <Select
          value={summaryPrompt.value}
          onValueChange={(value) =>
            setSummaryPrompt(prompts.find((prompt) => prompt.value === value))
          }
        >
          <SelectTrigger className="w-auto min-w-[100px] h-8 text-xs bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 ml-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {prompts.map((prompt: Prompt) => (
              <SelectItem key={prompt.value} value={prompt.value} className="text-xs">
                {prompt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
