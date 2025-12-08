/**
 * ClipTagsPanel - AI 标注展示组件
 * 
 * 显示当前剪藏的：
 * - 分类 (categories)
 * - 适用场景 (scenarios)
 * - 评分 (rating) - 星形图标
 * - 标签 (tags)
 * - 个人感想 (personalComment)
 */
import { Star, Tag, FolderOpen, Target, MessageCircle, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Clip } from "@/lib/clip-store"

interface ClipTagsPanelProps {
  clip: Partial<Clip> | null
  className?: string
  compact?: boolean
  theme?: 'dark' | 'light'
}

/**
 * 星级评分展示组件
 */
function RatingStars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const sizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
  
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            sizeClass,
            "transition-colors",
            star <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-gray-300 dark:text-zinc-600"
          )}
        />
      ))}
      <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">
        {rating}/5
      </span>
    </div>
  )
}

/**
 * 标签/分类芯片组件
 */
function Chip({ 
  children, 
  variant = "default" 
}: { 
  children: React.ReactNode
  variant?: "default" | "category" | "scenario" | "tag"
}) {
  const variantStyles = {
    default: "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300",
    category: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
    scenario: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
    tag: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
  }
  
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
      variantStyles[variant]
    )}>
      {children}
    </span>
  )
}

/**
 * 标注区块组件
 */
function TagSection({ 
  icon: Icon, 
  title, 
  children,
  isEmpty = false
}: { 
  icon: React.ElementType
  title: string
  children: React.ReactNode
  isEmpty?: boolean
}) {
  if (isEmpty) return null
  
  return (
    <div className="space-y-1 flex flex-wrap gap-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
        <Icon className="h-3.5 w-3.5" />
        <span>{title}:</span>
      </div>
      <div>{children}</div>
    </div>
  )
}

export default function ClipTagsPanel({ clip, className, compact = false, theme }: ClipTagsPanelProps) {
  // 检查是否有任何标注数据
  const hasCategories = clip?.categories && clip.categories.length > 0
  const hasScenarios = clip?.scenarios && clip.scenarios.length > 0
  const hasRating = clip?.rating && clip.rating > 0
  const hasTags = clip?.tags && clip.tags.length > 0
  const hasComment = clip?.personalComment && clip.personalComment.trim() !== ""
  
  const hasAnyTags = hasCategories || hasScenarios || hasRating || hasTags || hasComment
  
  if (!hasAnyTags) {
    // 无标注时显示提示
    return (
      <div className={cn(
        "rounded-xl border border-dashed border-gray-200 dark:border-zinc-700 p-4",
        className
      )}>
        <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm">暂无 AI 标注</span>
        </div>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          在对话中说"帮我打几个标签和评分"来添加标注
        </p>
      </div>
    )
  }
  
  return (
    <div data-theme={theme} className={cn(
      "rounded-xl border border-gray-200 dark:border-zinc-700 bg-gradient-to-br from-gray-50/50 to-slate-50/50 dark:from-zinc-900/50 dark:to-slate-900/50",
      compact ? "p-3 space-y-3" : "p-4 space-y-4",
      className
    )}>
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200">AI 标注</h4>
      </div>
      
      {/* 评分 */}
      {hasRating && (
        <TagSection icon={Star} title="评分" isEmpty={!hasRating}>
          <RatingStars rating={clip.rating!} size={compact ? "sm" : "md"} />
        </TagSection>
      )}
      
      {/* 分类 */}
      {hasCategories && (
        <TagSection icon={FolderOpen} title="分类" isEmpty={!hasCategories}>
          <div className="flex flex-wrap gap-1.5">
            {clip.categories!.map((cat, i) => (
              <Chip key={i} variant="category">{cat}</Chip>
            ))}
          </div>
        </TagSection>
      )}
      
      {/* 适用场景 */}
      {hasScenarios && (
        <TagSection icon={Target} title="适用场景" isEmpty={!hasScenarios}>
          <div className="flex flex-wrap gap-1.5">
            {clip.scenarios!.map((scenario, i) => (
              <Chip key={i} variant="scenario">{scenario}</Chip>
            ))}
          </div>
        </TagSection>
      )}
      
      {/* 标签 */}
      {hasTags && (
        <TagSection icon={Tag} title="标签" isEmpty={!hasTags}>
          <div className="flex flex-wrap gap-1.5">
            {clip.tags!.map((tag, i) => (
              <Chip key={i} variant="tag">#{tag}</Chip>
            ))}
          </div>
        </TagSection>
      )}
      
      {/* 个人感想 */}
      {hasComment && (
        <TagSection icon={MessageCircle} title="个人感想" isEmpty={!hasComment}>
          <p className="text-sm text-gray-600 dark:text-gray-300 italic leading-relaxed bg-white/50 dark:bg-zinc-800/50 rounded-lg p-2">
            "{clip.personalComment}"
          </p>
        </TagSection>
      )}
    </div>
  )
}
