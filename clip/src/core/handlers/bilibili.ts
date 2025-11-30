/**
 * Bilibili 站点处理器
 * 提取视频标题、UP主、简介等信息
 */

import type { ExtractedContent, ContentMetadata } from "../types"

export function bilibiliHandler(): ExtractedContent | null {
  try {
    // 获取视频标题
    const titleEl = document.querySelector(
      "h1.video-title, .video-title, .title"
    ) as HTMLElement | null
    const title = titleEl?.innerText?.trim() || document.title

    // 获取 UP 主名称
    const uploaderEl = document.querySelector(
      ".up-name, .username, a.up-name"
    ) as HTMLElement | null
    const uploader = uploaderEl?.innerText?.trim() || ""

    // 获取视频描述
    const descEl = document.querySelector(
      ".desc-info-text, .basic-desc-info, #v_desc"
    ) as HTMLElement | null
    const description = descEl?.innerText?.trim() || ""

    // 获取播放量
    const viewCountEl = document.querySelector(
      ".view-text, .video-data .view"
    ) as HTMLElement | null
    const viewCount = viewCountEl?.innerText?.trim() || ""

    // 获取发布时间
    const publishTimeEl = document.querySelector(
      ".pubdate-text, .pubdate, .video-data .pubdate"
    ) as HTMLElement | null
    const publishTime = publishTimeEl?.innerText?.trim() || ""

    // 获取标签
    const tagEls = document.querySelectorAll(".tag-link, .video-tag a, .tag")
    const tags = Array.from(tagEls)
      .map(el => el.textContent?.trim())
      .filter(t => t && t.length > 0)
      .slice(0, 10)

    // 组合文本内容
    let text = `${title}\n\n`
    if (uploader) text += `UP主: ${uploader}\n`
    if (viewCount) text += `播放: ${viewCount}\n`
    if (publishTime) text += `时间: ${publishTime}\n`
    
    if (tags.length > 0) {
      text += `标签: ${tags.join(", ")}\n`
    }
    
    text += `\n---\n\n`

    if (description) {
      text += `视频简介:\n${description}\n`
    }

    if (text.length < 50) {
      return null
    }

    const metadata: ContentMetadata = {
      platform: "Bilibili",
      author: uploader,
      publishTime,
      description
    }

    if (viewCount) {
      const match = viewCount.match(/[\d.]+/)
      if (match) {
        metadata.viewCount = parseFloat(match[0])
      }
    }

    return {
      title,
      url: location.href,
      html: "",
      text: text.trim(),
      snippet: text.slice(0, 500) + (text.length > 500 ? "..." : ""),
      metadata
    }

  } catch (e) {
    console.error("Bilibili handler error:", e)
    return null
  }
}
