/**
 * 页面内容提取函数
 * 用于统一提取网页的标题、URL、全文和摘要片段
 */

export interface PageContent {
  title: string
  url: string
  fullText: string
  snippet: string
}

/**
 * 尝试获取页面主要内容区域的文本
 * 优先使用语义化标签，避免导航/菜单等干扰
 */
function getMainLikeTextCandidate(): string {
  // 1. 尝试常见的主内容选择器
  const mainSelectors = [
    "article",
    "main",
    "#content",
    ".content",
    "#main-content",
    ".main-content",
    "[role='main']",
    ".post-content",
    ".article-content",
    ".entry-content"
  ]
  
  for (const selector of mainSelectors) {
    const main = document.querySelector(selector) as HTMLElement | null
    if (main && main.innerText.trim().length > 200) {
      console.log(`📄 Found main content via selector: ${selector}`)
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
    
    if (sorted.length > 0) {
      console.log(`📄 Extracted ${sorted.length} paragraphs as main content`)
      // 取前若干个长段落拼起来
      return sorted.slice(0, 20).join("\n\n")
    }
  }

  // 3. 最后兜底：整页文本
  console.log("📄 Fallback to full body text")
  return document.body.innerText || ""
}

/**
 * 提取页面内容
 * @param useSmartExtraction 是否使用智能内容提取（优先提取正文，过滤导航）
 * @returns PageContent 包含标题、URL、全文和摘要片段
 */
export function extractPageContent(useSmartExtraction = true): PageContent {
  const title = document.title || ""
  const url = location.href

  // 获取原始文本
  let raw: string
  if (useSmartExtraction) {
    raw = getMainLikeTextCandidate()
  } else {
    raw = document.body.innerText || document.documentElement.innerText || ""
  }

  // 简单清洗
  raw = raw
    .replace(/\s+\n/g, "\n")        // 空白+换行压缩为换行
    .replace(/\n{2,}/g, "\n\n")     // 连续空行压缩为双换行
    .replace(/\t+/g, " ")           // Tab 转空格
    .trim()

  // 前 500 个字符做 snippet（只用于预览）
  const maxSnippetLength = 500
  const snippet = raw.length > maxSnippetLength
    ? raw.slice(0, maxSnippetLength) + "..."
    : raw

  console.log(`📄 Page content extracted:`)
  console.log(`   - Title: ${title.slice(0, 50)}...`)
  console.log(`   - Full text length: ${raw.length}`)
  console.log(`   - Snippet length: ${snippet.length}`)

  return {
    title,
    url,
    fullText: raw,
    snippet
  }
}

/**
 * 提取用户选中的文本内容
 * @returns PageContent 或 null（如果没有选中内容）
 */
export function extractSelectedContent(): PageContent | null {
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

  return {
    title,
    url,
    fullText: selectedText,
    snippet
  }
}
