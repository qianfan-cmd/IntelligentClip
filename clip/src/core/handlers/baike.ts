/**
 * 百度百科站点处理器
 * 提取词条内容
 */

import type { ExtractedContent, ContentMetadata } from "../types"

export function baikeHandler(): ExtractedContent | null {
  try {
    // 获取词条标题
    const titleEl = document.querySelector(
      "h1, .lemmaWgt-lemmaTitle-title h1, .lemma-title h1, .lemma-main-header-title"
    ) as HTMLElement | null
    const title = titleEl?.innerText?.trim() || document.title.replace(/_百度百科$/, "")

    // 获取词条摘要
    const summaryEl = document.querySelector(
      ".lemma-summary, .lemmaWgt-lemmaSummary, .J-summary"
    ) as HTMLElement | null
    const summary = summaryEl?.innerText?.trim() || ""

    // 获取主体内容区域
    const mainContentEl = document.querySelector(
      ".main-content, .lemma-main .para-title, .content-wrapper"
    ) as HTMLElement | null

    // 收集所有段落内容
    const contentParts: string[] = []
    
    // 添加摘要
    if (summary) {
      contentParts.push(`摘要:\n${summary}`)
    }

    // 收集各个模块的内容
    const sectionEls = document.querySelectorAll(
      ".para-title, .para, .lemma-main .para"
    )
    
    let currentSectionTitle = ""
    sectionEls.forEach(el => {
      const className = el.className || ""
      
      // 如果是标题
      if (className.includes("para-title") || className.includes("title-text")) {
        const titleText = (el as HTMLElement).innerText?.trim()
        if (titleText) {
          currentSectionTitle = titleText
          contentParts.push(`\n## ${titleText}\n`)
        }
      } else if (className.includes("para")) {
        // 如果是段落
        const paraText = (el as HTMLElement).innerText?.trim()
        if (paraText && paraText.length > 10) {
          contentParts.push(paraText)
        }
      }
    })

    // 如果没有收集到内容，尝试获取整个主内容区
    if (contentParts.length < 2) {
      const lemmaMain = document.querySelector(
        ".lemma-main-content, .lemmaWgt-lemmaCatalog-list, .main-content"
      ) as HTMLElement | null
      
      if (lemmaMain) {
        contentParts.push(lemmaMain.innerText)
      }
    }

    let text = `# ${title}\n\n${contentParts.join("\n\n")}`

    // 清理文本
    text = text
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\[编辑\]/g, "")
      .replace(/收起$/gm, "")
      .replace(/展开全部$/gm, "")
      .trim()

    if (text.length < 100) {
      return null
    }

    const metadata: ContentMetadata = {
      platform: "百度百科",
      description: summary.slice(0, 300)
    }

    return {
      title,
      url: location.href,
      html: mainContentEl?.innerHTML || "",
      text,
      snippet: summary || text.slice(0, 500),
      metadata
    }

  } catch (e) {
    console.error("Baike handler error:", e)
    return null
  }
}
