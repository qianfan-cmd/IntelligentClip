/**
 * Transcript - 字幕面板主组件
 * 包含操作栏和字幕内容列表，支持跳转到当前播放时间
 */
import { useRef } from "react"

import TranscriptActions from "./transcript-actions"
import TranscriptContent from "./transcript-content"

interface TranscriptProps {}

export default function Transcript({}: TranscriptProps) {
  const player = document.querySelector("video")
  const transcriptListRef = useRef<HTMLDivElement>(null)

  function jumpCurrentTime(): void {
    if (!player || !transcriptListRef.current) return
    const time = Math.round(player.currentTime * 1000)

    const itemsContainer = transcriptListRef.current.firstElementChild as HTMLElement
    if (itemsContainer) {
      const children = Array.from(itemsContainer.children) as HTMLElement[]
      const targetElement = children.find((child: HTMLElement) => {
        const startTime = parseInt(child.getAttribute("data-start-time") || "0", 10)
        const endTime = parseInt(child.getAttribute("data-end-time") || "0", 10)
        return startTime <= time && endTime >= time
      })

      if (targetElement) {
        targetElement.scrollIntoView({
          behavior: "smooth",
          block: "center"
        })

        // 高亮动画
        targetElement.classList.add("bg-indigo-50", "dark:bg-indigo-900/30", "ring-1", "ring-indigo-200", "dark:ring-indigo-700")
        setTimeout(() => {
          targetElement.classList.remove("bg-indigo-50", "dark:bg-indigo-900/30", "ring-1", "ring-indigo-200", "dark:ring-indigo-700")
        }, 3000)
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TranscriptActions jumpCurrentTime={jumpCurrentTime} />
      <TranscriptContent ref={transcriptListRef} />
    </div>
  )
}
