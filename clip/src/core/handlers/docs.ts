/**
 * 文档站点处理器
 * 适用于 MDN、DevDocs、技术文档等站点
 */

import type { ExtractedContent, ContentMetadata } from "../types"

/**
 * 检测当前页面是否是文档类站点
 */
export function isDocsPage(): boolean {
  const hostname = location.hostname.toLowerCase()
  const pathname = location.pathname.toLowerCase()

  const docsDomains = [
    "developer.mozilla.org",
    "devdocs.io",
    "docs.python.org",
    "docs.oracle.com",
    "docs.microsoft.com",
    "learn.microsoft.com",
    "docs.github.com",
    "reactjs.org",
    "vuejs.org",
    "angular.io",
    "nodejs.org",
    "typescriptlang.org",
    "rust-lang.org",
    "golang.org",
    "go.dev",
    "kotlinlang.org",
    "docs.swift.org",
    "docs.djangoproject.com",
    "flask.palletsprojects.com",
    "webpack.js.org",
    "tailwindcss.com",
    "nextjs.org",
    "nuxt.com",
    "plasmo.com",
    "readthedocs.io",
    "gitbook.io"
  ]

  const docsPathPatterns = [
    "/docs/",
    "/documentation/",
    "/reference/",
    "/api/",
    "/guide/",
    "/manual/",
    "/tutorial/",
    "/learn/"
  ]

  // 检查域名
  for (const domain of docsDomains) {
    if (hostname.includes(domain)) {
      return true
    }
  }

  // 检查路径
  for (const pattern of docsPathPatterns) {
    if (pathname.includes(pattern)) {
      return true
    }
  }

  return false
}

export function docsHandler(): ExtractedContent | null {
  try {
    // 获取文章标题
    const titleEl = document.querySelector(
      "h1, article h1, .article-title, main h1, .content h1, #title"
    ) as HTMLElement | null
    const title = titleEl?.innerText?.trim() || document.title

    // 尝试获取文章主体区域
    const articleSelectors = [
      "article",
      "main article",
      ".article-content",
      ".markdown-body",
      ".documentation-content",
      ".doc-content",
      ".content-body",
      "main .content",
      "#content",
      ".prose",
      "[role='main']"
    ]

    let articleEl: HTMLElement | null = null
    for (const selector of articleSelectors) {
      const el = document.querySelector(selector) as HTMLElement | null
      if (el && el.innerText.length > 200) {
        articleEl = el
        break
      }
    }

    // 如果没有找到文章区域，回退到 main 或 body
    if (!articleEl) {
      articleEl = document.querySelector("main") as HTMLElement || document.body
    }

    // 提取代码块（保留）
    const codeBlocks: string[] = []
    const codeEls = articleEl.querySelectorAll("pre, code")
    codeEls.forEach((el, index) => {
      const code = el.textContent?.trim()
      if (code && code.length > 20) {
        codeBlocks.push(`[代码块 ${index + 1}]\n${code}\n`)
      }
    })

    // 提取正文（克隆后移除不需要的元素）
    const clone = articleEl.cloneNode(true) as HTMLElement

    // 移除导航、侧边栏、页脚等
    const removeSelectors = [
      "nav",
      ".nav",
      ".navigation",
      ".sidebar",
      ".toc",
      ".table-of-contents",
      "footer",
      ".footer",
      ".breadcrumb",
      ".breadcrumbs",
      ".edit-page",
      ".edit-this-page",
      ".page-nav",
      ".prev-next",
      "script",
      "style",
      "noscript",
      "button",
      ".copy-button"
    ]

    removeSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove())
    })

    let text = clone.innerText
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s+/gm, "")
      .trim()

    // 如果代码块被截断了，尝试补充
    if (codeBlocks.length > 0 && text.length < 1000) {
      text += "\n\n---\n\n代码示例:\n" + codeBlocks.join("\n")
    }

    if (text.length < 100) {
      return null
    }

    // 尝试获取文档描述
    const descEl = document.querySelector(
      "meta[name='description']"
    ) as HTMLMetaElement | null
    const description = descEl?.content || ""

    // 检测是哪个文档站点
    let platform = "Documentation"
    const hostname = location.hostname
    if (hostname.includes("mozilla.org")) {
      platform = "MDN"
    } else if (hostname.includes("microsoft.com") || hostname.includes("learn.microsoft.com")) {
      platform = "Microsoft Docs"
    } else if (hostname.includes("github.com")) {
      platform = "GitHub Docs"
    } else if (hostname.includes("reactjs.org") || hostname.includes("react.dev")) {
      platform = "React Docs"
    } else if (hostname.includes("vuejs.org")) {
      platform = "Vue.js Docs"
    }

    const metadata: ContentMetadata = {
      platform,
      description
    }

    return {
      title,
      url: location.href,
      html: articleEl.innerHTML,
      text,
      snippet: description || text.slice(0, 500),
      metadata
    }

  } catch (e) {
    console.error("Docs handler error:", e)
    return null
  }
}
