/**
 * Readability 提取器
 * 使用 Mozilla Readability 算法提取网页正文
 */

import type { ExtractedContent } from "../types"

/**
 * 简化版 Readability 实现
 * 基于 Mozilla Readability 的核心思想，但更轻量
 */
export function extractByReadability(): ExtractedContent | null {
  try {
    // 克隆文档以避免修改原始 DOM
    const doc = document.cloneNode(true) as Document

    // 移除干扰元素
    const removeSelectors = [
      "script", "style", "noscript", "iframe", "embed", "object",
      "nav", "header", "footer", "aside",
      ".sidebar", ".navigation", ".nav", ".menu", ".header", ".footer",
      ".advertisement", ".ad", ".ads", ".banner",
      ".social", ".share", ".comment", ".comments",
      "[role='navigation']", "[role='banner']", "[role='complementary']"
    ]

    removeSelectors.forEach(selector => {
      doc.querySelectorAll(selector).forEach(el => el.remove())
    })

    // 尝试找到主内容区域
    const contentSelectors = [
      "article",
      "[role='main']",
      "main",
      ".post-content",
      ".article-content",
      ".entry-content",
      ".content",
      "#content",
      ".post",
      ".article",
      "#article",
      ".main-content",
      "#main-content",
      ".body-content"
    ]

    let mainContent: HTMLElement | null = null
    for (const selector of contentSelectors) {
      const el = doc.querySelector(selector) as HTMLElement | null
      if (el && el.innerText.trim().length > 200) {
        mainContent = el
        break
      }
    }

    // 如果没找到，尝试找最长的文本块
    if (!mainContent) {
      const candidates = Array.from(doc.querySelectorAll("div, section")) as HTMLElement[]
      const scored = candidates
        .map(el => ({
          el,
          score: scoreElement(el)
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)

      if (scored.length > 0) {
        mainContent = scored[0].el
      }
    }

    if (!mainContent) {
      return null
    }

    // 提取内容
    const html = mainContent.innerHTML
    const text = mainContent.innerText.trim()

    if (text.length < 100) {
      return null
    }

    // 提取标题
    const title = extractTitle(doc) || document.title

    // 提取元数据
    const metadata = extractMetadata(doc)

    return {
      title,
      url: location.href,
      html,
      text,
      snippet: text.slice(0, 500) + (text.length > 500 ? "..." : ""),
      metadata
    }

  } catch (e) {
    console.error("Readability extraction error:", e)
    return null
  }
}

/**
 * 给元素打分，用于判断是否是主内容区
 */
function scoreElement(el: HTMLElement): number {
  let score = 0

  // 文本长度得分
  const textLength = el.innerText.trim().length
  score += Math.min(textLength / 100, 50)

  // <p> 标签数量得分
  const paragraphs = el.querySelectorAll("p")
  score += paragraphs.length * 3

  // 链接密度惩罚
  const links = el.querySelectorAll("a")
  const linkText = Array.from(links).reduce((acc, a) => acc + a.innerText.length, 0)
  const linkDensity = textLength > 0 ? linkText / textLength : 1
  if (linkDensity > 0.5) {
    score *= 0.5
  }

  // 特定类名加分
  const className = el.className.toLowerCase()
  const id = el.id.toLowerCase()
  const positive = ["article", "content", "post", "text", "body", "entry"]
  const negative = ["comment", "meta", "footer", "nav", "sidebar", "ad", "share"]

  positive.forEach(term => {
    if (className.includes(term) || id.includes(term)) score += 10
  })

  negative.forEach(term => {
    if (className.includes(term) || id.includes(term)) score -= 15
  })

  return score
}

/**
 * 提取页面标题
 */
function extractTitle(doc: Document): string {
  // 优先使用 h1
  const h1 = doc.querySelector("h1")
  if (h1 && h1.innerText.trim().length > 5) {
    return h1.innerText.trim()
  }

  // 使用 og:title
  const ogTitle = doc.querySelector('meta[property="og:title"]')
  if (ogTitle) {
    const content = ogTitle.getAttribute("content")
    if (content) return content
  }

  // 使用 twitter:title
  const twitterTitle = doc.querySelector('meta[name="twitter:title"]')
  if (twitterTitle) {
    const content = twitterTitle.getAttribute("content")
    if (content) return content
  }

  return ""
}

/**
 * 提取页面元数据
 */
function extractMetadata(doc: Document): Record<string, any> {
  const metadata: Record<string, any> = {}

  // 作者
  const authorMeta = doc.querySelector('meta[name="author"]') ||
                     doc.querySelector('meta[property="article:author"]')
  if (authorMeta) {
    metadata.author = authorMeta.getAttribute("content")
  }

  // 发布时间
  const timeMeta = doc.querySelector('meta[property="article:published_time"]') ||
                   doc.querySelector('meta[name="publish_date"]') ||
                   doc.querySelector('time[datetime]')
  if (timeMeta) {
    metadata.publishTime = timeMeta.getAttribute("content") || timeMeta.getAttribute("datetime")
  }

  // 描述
  const descMeta = doc.querySelector('meta[name="description"]') ||
                   doc.querySelector('meta[property="og:description"]')
  if (descMeta) {
    metadata.description = descMeta.getAttribute("content")
  }

  // 站点名称
  const siteMeta = doc.querySelector('meta[property="og:site_name"]')
  if (siteMeta) {
    metadata.platform = siteMeta.getAttribute("content")
  }

  return metadata
}
