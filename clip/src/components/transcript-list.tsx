/**
 * TranscriptList - 字幕列表组件
 * 显示过滤后的字幕条目
 */
import TranscriptItem from "@/components/transcript-item"
import { memo, useMemo } from "react"
import { Search } from "lucide-react"

type Transcript = {
  text: string
  startTime: number
  endTime: number
}

interface TranscriptListProps {
  transcript: Transcript[]
  searchInput: string
}

function TranscriptList({
  transcript,
  searchInput
}: TranscriptListProps) {
  const filteredTranscripts = useMemo(() => {
    return searchInput
      ? transcript.filter((item) =>
          item.text.toLowerCase().includes(searchInput.toLowerCase())
        )
      : transcript
  }, [transcript, searchInput])

  // 搜索无结果
  if (searchInput && filteredTranscripts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
          <Search className="h-5 w-5 text-gray-400 dark:text-zinc-500" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          未找到匹配 "{searchInput}" 的结果
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {filteredTranscripts.map((item: Transcript) => (
        <TranscriptItem
          key={item.startTime}
          item={item}
          searchInput={searchInput}
        />
      ))}
    </div>
  )
}

export default memo(TranscriptList, (prevProps, nextProps) => {
  return (
    prevProps.transcript === nextProps.transcript &&
    prevProps.searchInput === nextProps.searchInput
  )
})
