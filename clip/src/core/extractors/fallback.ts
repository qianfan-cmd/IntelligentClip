/**
 * Fallback 提取器
 * 当其他方法都失败时的兜底方案
 */

import type { ExtractedContent } from "../types"

/**
 * 尝试找到页面主要内容区域
 */
function getMainLikeTextCandidate(): string {
  // 1. 尝试常见的主内容选择器
  const mainSelectors = [
    "article",
    "main",
    "[role='main']",
    "#content",
    ".content",
    "#main-content",
    ".main-content",
    ".post-content",
    ".article-content",
    ".entry-content",
    ".body-content"
  ]
  
  for (const selector of mainSelectors) {
    const main = document.querySelector(selector) as HTMLElement | null
    if (main && main.innerText.trim().length > 200) {
      console.log(`📄 Fallback: Found main content via selector: ${selector}`)
      return main.innerText
    }
  }

  // 2. Fallback：找最长的 <p> 聚合
  const paragraphs = Array.from(document.querySelectorAll("p"))
  if (paragraphs.length > 0) {
    const sorted = paragraphs
      .map(p => p.innerText.trim())
      .filter(t => t.length > 30)
      .sort((a, b) => b.length - a.length)
    
    if (sorted.length > 0 && sorted.slice(0, 20).join("").length > 200) {
      console.log(`📄 Fallback: Extracted ${sorted.length} paragraphs as main content`)
      return sorted.slice(0, 30).join("\n\n")
    }
  }

  // 3. 最后兜底：整页文本
  console.log("📄 Fallback: Using full body text")
  return document.body.innerText || document.documentElement.innerText || ""
}

/**
 * Fallback 提取器主函数
 */
export function extractByFallback(): ExtractedContent {
  const title = document.title || ""
  const url = location.href

  // 获取文本
  let text = getMainLikeTextCandidate()

  // 清洗文本
  text = text
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\t+/g, " ")
    .trim()

  // 生成 snippet
  const maxSnippetLength = 500
  const snippet = text.length > maxSnippetLength
    ? text.slice(0, maxSnippetLength) + "..."
    : text

  // 提取基本元数据
  const metadata: Record<string, any> = {}
  
  const descMeta = document.querySelector('meta[name="description"]')
  if (descMeta) {
    metadata.description = descMeta.getAttribute("content")
  }

  const authorMeta = document.querySelector('meta[name="author"]')
  if (authorMeta) {
    metadata.author = authorMeta.getAttribute("content")
  }

  return {
    title,
    url,
    html: "",  // Fallback 不生成 HTML
    text,
    snippet,
    metadata
  }
}
