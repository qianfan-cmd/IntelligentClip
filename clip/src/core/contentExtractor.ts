/**
 * 统一内容抽取层
 * 三层流水线：特定 Handler → Readability → Fallback → PostProcess
 */

import { extractByReadability } from "./extractors/readability"
import { extractByFallback } from "./extractors/fallback"
import { youtubeHandler } from "./handlers/youtube"
import { bilibiliHandler } from "./handlers/bilibili"
import { baikeHandler } from "./handlers/baike"
import { docsHandler, isDocsPage } from "./handlers/docs"
import { extractImagesFromDocument, extractImagesFromSelection } from "./imageExtractor"
import { postProcessExtractedContent } from "./post-process"

// Re-export types from types.ts
export type { ExtractedContent, ContentMetadata, SiteHandler, SiteHandlerConfig } from "./types"
import type { ExtractedContent, SiteHandler, SiteHandlerConfig } from "./types"

/**
 * 站点特定处理器列表
 * 按优先级排序，匹配到第一个就返回
 */
const siteHandlers: SiteHandlerConfig[] = [
  { pattern: /youtube\.com/, handler: youtubeHandler, name: "YouTube" },
  { pattern: /bilibili\.com/, handler: bilibiliHandler, name: "Bilibili" },
  { pattern: /baike\.baidu\.com/, handler: baikeHandler, name: "Baidu Baike" },
  { pattern: /developer\.mozilla\.org|developer\.chrome\.com|docs\.microsoft\.com|learn\.microsoft\.com/, handler: docsHandler, name: "Docs" },
]

/**
 * 智能检测是否需要使用文档处理器
 */
function shouldUseDocsHandler(url: string): boolean {
  // 先检查静态规则
  const staticDocsPattern = /developer\.mozilla\.org|developer\.chrome\.com|docs\.microsoft\.com|learn\.microsoft\.com/
  if (staticDocsPattern.test(url)) {
    return true
  }
  // 动态检测
  return isDocsPage()
}

/**
 * 规范化提取结果
 * @param content - 原始提取内容
 * @param includeImages - 是否提取图片
 */
function normalize(content: ExtractedContent, includeImages: boolean = true): ExtractedContent {
  const maxSnippetLength = 500
  
  // 清洗文本
  const cleanText = content.text
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\t+/g, " ")
    .trim()

  // 生成 snippet
  const snippet = content.snippet || (
    cleanText.length > maxSnippetLength
      ? cleanText.slice(0, maxSnippetLength) + "..."
      : cleanText
  )

  // 提取图片（如果还没有）
  let images = content.images
  if (includeImages && (!images || images.length === 0)) {
    images = extractImagesFromDocument()
  }

  return {
    ...content,
    title: content.title || document.title || "Untitled",
    url: content.url || location.href,
    text: cleanText,
    snippet,
    html: content.html || "",
    metadata: content.metadata || {},
    images
  }
}

/**
 * 检测内容来源类型
 */
export function detectSourceType(url: string): "youtube" | "bilibili" | "webpage" | "other" {
  if (/youtube\.com/.test(url)) return "youtube"
  if (/bilibili\.com/.test(url)) return "bilibili"
  return "webpage"
}

/**
 * 主入口：统一内容提取
 * 四层流水线：特定 Handler → Readability → Fallback → PostProcess（字符串清洗）
 */
export async function extractContent(): Promise<ExtractedContent> {
  const url = location.href
  console.log("🔍 Starting content extraction for:", url)

  let rawContent: ExtractedContent | null = null

  // 1. 尝试站点特定处理器
  for (const { pattern, handler, name } of siteHandlers) {
    if (pattern.test(url)) {
      console.log(`📄 Trying site handler: ${name}`)
      try {
        const result = handler()
        if (result && result.text && result.text.length > 50) {
          console.log(`✅ Site handler ${name} succeeded, text length: ${result.text.length}`)
          rawContent = normalize(result)
          break
        }
        console.log(`⚠️ Site handler ${name} returned insufficient content`)
      } catch (e) {
        console.warn(`⚠️ Site handler ${name} failed:`, e)
      }
    }
  }

  // 1.5 智能检测文档类站点
  if (!rawContent && shouldUseDocsHandler(url)) {
    console.log("📄 Detected docs-like page, trying docs handler...")
    try {
      const result = docsHandler()
      if (result && result.text && result.text.length > 100) {
        console.log(`✅ Docs handler succeeded, text length: ${result.text.length}`)
        rawContent = normalize(result)
      }
    } catch (e) {
      console.warn("⚠️ Docs handler failed:", e)
    }
  }

  // 2. 尝试 Readability
  if (!rawContent) {
    console.log("📄 Trying Readability extractor...")
    try {
      const readabilityResult = extractByReadability()
      if (readabilityResult && readabilityResult.text && readabilityResult.text.length > 100) {
        console.log(`✅ Readability succeeded, text length: ${readabilityResult.text.length}`)
        rawContent = normalize(readabilityResult)
      } else {
        console.log("⚠️ Readability returned insufficient content")
      }
    } catch (e) {
      console.warn("⚠️ Readability failed:", e)
    }
  }

  // 3. Fallback 到 body.innerText
  if (!rawContent) {
    console.log("📄 Using fallback extractor...")
    const fallbackResult = extractByFallback()
    console.log(`✅ Fallback extractor, text length: ${fallbackResult.text.length}`)
    rawContent = normalize(fallbackResult)
  }

  // 4. 后处理：纯字符串级别的清洗（不影响 DOM 提取逻辑）
  return postProcessExtractedContent(rawContent)
}

/**
 * 同步版本（用于某些场景）
 */
export function extractContentSync(): ExtractedContent {
  const url = location.href

  let rawContent: ExtractedContent | null = null

  // 1. 尝试站点特定处理器
  for (const { pattern, handler, name } of siteHandlers) {
    if (pattern.test(url)) {
      try {
        const result = handler()
        if (result && result.text && result.text.length > 50) {
          rawContent = normalize(result)
          break
        }
      } catch (e) {
        console.warn(`Site handler ${name} failed:`, e)
      }
    }
  }

  // 1.5 智能检测文档类站点
  if (!rawContent && shouldUseDocsHandler(url)) {
    try {
      const result = docsHandler()
      if (result && result.text && result.text.length > 100) {
        rawContent = normalize(result)
      }
    } catch (e) {
      console.warn("Docs handler failed:", e)
    }
  }

  // 2. 尝试 Readability
  if (!rawContent) {
    try {
      const readabilityResult = extractByReadability()
      if (readabilityResult && readabilityResult.text && readabilityResult.text.length > 100) {
        rawContent = normalize(readabilityResult)
      }
    } catch (e) {
      console.warn("Readability failed:", e)
    }
  }

  // 3. Fallback
  if (!rawContent) {
    rawContent = normalize(extractByFallback())
  }

  // 4. 后处理：纯字符串级别的清洗
  return postProcessExtractedContent(rawContent)
}

/**
 * 提取用户选中的文本内容
 * @returns ExtractedContent 或 null（如果没有选中内容）
 */
export function extractSelectedContent(): ExtractedContent | null {
  const selection = window.getSelection()
  const selectedText = selection?.toString().trim()

  if (!selectedText || selectedText.length < 10) {
    return null
  }

  const title = document.title || ""
  const url = location.href

  const maxSnippetLength = 500
  const snippet = selectedText.length > maxSnippetLength
    ? selectedText.slice(0, maxSnippetLength) + "..."
    : selectedText

  // 提取选中内容中的图片
  const images = extractImagesFromSelection(selection)

  return {
    title,
    url,
    html: "",
    text: selectedText,
    snippet,
    metadata: {},
    images
  }
}
