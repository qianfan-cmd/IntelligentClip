/**
 * Summary - 总结面板主组件
 * 包含操作栏和总结内容
 */
import SummaryActions from "@/components/summary-actions"
import SummaryContent from "@/components/summary-content"

interface SummaryProps {}

export default function Summary({}: SummaryProps) {
  return (
    <div className="flex flex-col h-full">
      <SummaryActions />
      <SummaryContent />
    </div>
  )
}
