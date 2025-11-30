/**
 * 状态组件 - 统一的加载、错误、空状态展示
 * 提供一致的视觉风格和用户体验
 */
import { cn } from "@/lib/utils"
import { AlertCircle, FileQuestion, Loader2, RefreshCw, WifiOff } from "lucide-react"
import { Button } from "./button"

// ============ Loading State ============
interface LoadingStateProps {
  message?: string
  className?: string
  size?: "sm" | "md" | "lg"
}

export function LoadingState({ 
  message = "加载中...", 
  className,
  size = "md" 
}: LoadingStateProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8"
  }
  
  return (
    <div className={cn("flex flex-col items-center justify-center py-8 px-4", className)}>
      <Loader2 className={cn("animate-spin text-indigo-500", sizeClasses[size])} />
      {message && (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 text-center">
          {message}
        </p>
      )}
    </div>
  )
}

// ============ Error State ============
interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  retryText?: string
  className?: string
}

export function ErrorState({
  title = "出错了",
  message = "请稍后重试或检查网络连接",
  onRetry,
  retryText = "重试",
  className
}: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-8 px-4", className)}>
      <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-3">
        <AlertCircle className="h-6 w-6 text-red-500 dark:text-red-400" />
      </div>
      <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">{title}</h4>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-[240px] mb-4">
        {message}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          {retryText}
        </Button>
      )}
    </div>
  )
}

// ============ Empty State (无字幕/无内容) ============
interface EmptyStateProps {
  icon?: React.ReactNode
  title?: string
  message?: string
  className?: string
  action?: React.ReactNode
}

export function EmptyState({
  icon,
  title = "暂无内容",
  message,
  className,
  action
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-8 px-4", className)}>
      <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-3">
        {icon || <FileQuestion className="h-6 w-6 text-amber-500 dark:text-amber-400" />}
      </div>
      <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-1">{title}</h4>
      {message && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-[260px]">
          {message}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ============ No Transcript State (专门用于无字幕提示) ============
interface NoTranscriptStateProps {
  className?: string
}

export function NoTranscriptState({ className }: NoTranscriptStateProps) {
  return (
    <EmptyState
      icon={<WifiOff className="h-6 w-6 text-amber-500 dark:text-amber-400" />}
      title="无法获取字幕"
      message="当前视频没有可用的字幕/CC。AI 总结和对话功能需要字幕才能工作。"
      className={className}
    />
  )
}

// ============ Skeleton Loader ============
interface SkeletonLoaderProps {
  lines?: number
  className?: string
}

export function SkeletonLoader({ lines = 6, className }: SkeletonLoaderProps) {
  return (
    <div className={cn("space-y-3 animate-pulse", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-4 bg-gray-200 dark:bg-zinc-700 rounded",
            i === lines - 1 && "w-3/4" // 最后一行短一点
          )}
        />
      ))}
    </div>
  )
}
