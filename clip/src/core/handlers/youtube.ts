/**
 * YouTube 站点处理器
 * 提取视频标题、描述、字幕等信息
 */

import type { ExtractedContent, ContentMetadata } from "../types"

export function youtubeHandler(): ExtractedContent | null {
  try {
    // 获取视频标题
    const titleEl = document.querySelector(
      "h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata yt-formatted-string"
    ) as HTMLElement | null
    const title = titleEl?.innerText?.trim() || document.title

    // 获取视频描述
    const descriptionEl = document.querySelector(
      "#description-inline-expander, #description ytd-text-inline-expander, ytd-text-inline-expander"
    ) as HTMLElement | null
    const description = descriptionEl?.innerText?.trim() || ""

    // 获取频道名称
    const channelEl = document.querySelector(
      "#channel-name a, ytd-channel-name a"
    ) as HTMLElement | null
    const channel = channelEl?.innerText?.trim() || ""

    // 获取观看次数
    const viewCountEl = document.querySelector(
      "#info-strings yt-formatted-string, .view-count"
    ) as HTMLElement | null
    const viewCount = viewCountEl?.innerText?.trim() || ""

    // 获取发布时间
    const publishTimeEl = document.querySelector(
      "#info-strings yt-formatted-string:last-child"
    ) as HTMLElement | null
    const publishTime = publishTimeEl?.innerText?.trim() || ""

    // 尝试获取字幕内容
    let transcriptText = ""
    const transcriptItems = document.querySelectorAll("ytd-transcript-segment-renderer")
    if (transcriptItems.length > 0) {
      transcriptText = Array.from(transcriptItems)
        .map(item => {
          const textEl = item.querySelector(".segment-text, #text, yt-formatted-string")
          return textEl?.textContent?.trim() || ""
        })
        .filter(t => t.length > 0)
        .join(" ")
    }

    // 组合文本内容
    let text = `${title}\n\n`
    if (channel) text += `频道: ${channel}\n`
    if (viewCount) text += `播放: ${viewCount}\n`
    if (publishTime) text += `时间: ${publishTime}\n`
    text += `\n---\n\n`

    if (description) {
      text += `视频简介:\n${description}\n\n`
    }

    if (transcriptText) {
      text += `字幕内容:\n${transcriptText}\n`
    }

    if (text.length < 100 && !transcriptText) {
      // 内容太少，返回 null 让其他提取器处理
      return null
    }

    const metadata: ContentMetadata = {
      platform: "YouTube",
      author: channel,
      publishTime,
      description
    }

    if (viewCount) {
      const match = viewCount.match(/[\d,]+/)
      if (match) {
        metadata.viewCount = parseInt(match[0].replace(/,/g, ""))
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
    console.error("YouTube handler error:", e)
    return null
  }
}
