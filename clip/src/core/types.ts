/**
 * 内容提取层类型定义
 */

export interface ExtractedContent {
  title: string
  url: string
  html: string           // Readability 清洗后的 HTML（可选）
  text: string           // 纯文本（给 LLM 用）
  snippet: string        // 前 N 字的预览
  metadata?: ContentMetadata
}

export interface ContentMetadata {
  author?: string
  publishTime?: string
  viewCount?: number
  platform?: string
  duration?: string
  description?: string
  [key: string]: any
}

export type SiteHandler = () => ExtractedContent | null

export interface SiteHandlerConfig {
  pattern: RegExp
  handler: SiteHandler
  name: string
}
