/**
 * VideoHeader - 视频信息头部组件
 * 显示视频缩略图、标题、频道等信息
 */
import { cn } from "@/lib/utils"
import { ExternalLink, Play } from "lucide-react"
import { Button } from "./ui/button"
import { TooltipWrapper } from "./ui/tooltip-wrapper"

interface VideoHeaderProps {
  videoId?: string
  title?: string
  channelName?: string
  className?: string
}

export function VideoHeader({ videoId, title, channelName, className }: VideoHeaderProps) {
  const thumbnailUrl = videoId 
    ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    : undefined

  const videoUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined

  // 如果没有视频信息，显示占位符
  if (!videoId || !videoUrl) {
    return (
      <div className={cn("p-4 bg-gray-50 dark:bg-zinc-900/50 rounded-xl", className)}>
        <div className="flex items-center gap-3">
          <div className="w-24 h-14 bg-gray-200 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
            <Play className="h-6 w-6 text-gray-400 dark:text-zinc-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse mt-2" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("p-4 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-zinc-900/50 dark:to-slate-900/50 rounded-xl border border-gray-100 dark:border-zinc-800", className)}>
      <div className="flex items-start gap-3">
        {/* 缩略图 */}
        <a
          href={videoUrl}
          target="_blank"
          rel="noreferrer"
          className="relative flex-shrink-0 group"
        >
          <img
            src={thumbnailUrl}
            alt={title || "Video thumbnail"}
            className="w-28 h-16 object-cover rounded-lg shadow-sm group-hover:shadow-md transition-shadow"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
            <Play className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" fill="white" />
          </div>
        </a>

        {/* 视频信息 */}
        <div className="flex-1 min-w-0 py-0.5">
          <h2 
            className="font-semibold text-sm text-gray-800 dark:text-gray-100 line-clamp-2 leading-snug"
            title={title}
          >
            {title || "Loading video info..."}
          </h2>
          {channelName && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
              {channelName}
            </p>
          )}
        </div>

        {/* 外链按钮 */}
        <TooltipWrapper text="在 YouTube 中打开">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={() => window.open(videoUrl, "_blank")}
          >
            <ExternalLink className="h-4 w-4 text-gray-400" />
          </Button>
        </TooltipWrapper>
      </div>
    </div>
  )
}
