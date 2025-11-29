/**
 * SectionCard - 通用的卡片式区块组件
 * 用于包装 Summary、Chat 等区域，提供一致的视觉层次
 */
import { cn } from "@/lib/utils"
import React from "react"

interface SectionCardProps {
  title?: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  headerClassName?: string
  bodyClassName?: string
  headerRight?: React.ReactNode
  noPadding?: boolean
}

export function SectionCard({
  title,
  icon,
  children,
  className,
  headerClassName,
  bodyClassName,
  headerRight,
  noPadding = false
}: SectionCardProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-zinc-900/50 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden",
        className
      )}
    >
      {title && (
        <div
          className={cn(
            "flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/80",
            headerClassName
          )}
        >
          <div className="flex items-center gap-2">
            {icon && (
              <span className="text-gray-500 dark:text-gray-400">{icon}</span>
            )}
            <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">
              {title}
            </h3>
          </div>
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </div>
      )}
      <div className={cn(!noPadding && "p-4", bodyClassName)}>{children}</div>
    </div>
  )
}
