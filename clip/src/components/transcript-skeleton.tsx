/**
 * TranscriptSkeleton - 字幕加载骨架屏
 */
import { Skeleton } from "@/components/ui/skeleton"

export default function TranscriptSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <div 
          key={index} 
          className="flex items-start gap-3 p-3"
        >
          <Skeleton className="h-6 w-16 rounded-md flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
