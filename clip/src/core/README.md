# 内容提取层 (Content Extraction Layer)

## 概述

统一的内容提取层，用于从各种网页中提取结构化内容。采用三层流水线架构：

```
特定站点 Handler → Readability 提取器 → Fallback 提取器
```

## 目录结构

```
src/core/
├── index.ts              # 入口文件，导出所有 API
├── types.ts              # 类型定义
├── contentExtractor.ts   # 主提取逻辑
├── extractors/
│   ├── readability.ts    # Readability 算法提取器
│   └── fallback.ts       # 兜底提取器（body.innerText）
└── handlers/
    ├── youtube.ts        # YouTube 专用处理器
    ├── bilibili.ts       # Bilibili 专用处理器
    ├── baike.ts          # 百度百科专用处理器
    └── docs.ts           # 文档站点处理器（MDN 等）
```

## 主要 API

### `extractContent(): Promise<ExtractedContent>`

异步提取当前页面的内容。自动检测站点类型并选择最佳提取策略。

```typescript
import { extractContent } from "@/core/index"

const content = await extractContent()
console.log(content.title)    // 页面标题
console.log(content.text)     // 纯文本内容
console.log(content.snippet)  // 预览片段（前 500 字）
console.log(content.metadata) // 元数据（作者、发布时间等）
```

### `extractContentSync(): ExtractedContent`

同步版本，用于某些需要立即返回的场景。

### `extractSelectedContent(): ExtractedContent | null`

提取用户选中的文本内容。

```typescript
import { extractSelectedContent } from "@/core/index"

const content = extractSelectedContent()
if (content) {
  console.log("用户选中了:", content.text)
}
```

### `detectSourceType(url: string): "youtube" | "bilibili" | "webpage" | "other"`

检测 URL 对应的内容来源类型。

## 类型定义

```typescript
interface ExtractedContent {
  title: string       // 页面标题
  url: string         // 页面 URL
  html: string        // 清洗后的 HTML（可选）
  text: string        // 纯文本内容（用于 LLM）
  snippet: string     // 预览片段（前 500 字）
  metadata?: ContentMetadata
}

interface ContentMetadata {
  author?: string       // 作者
  publishTime?: string  // 发布时间
  viewCount?: number    // 播放/阅读量
  platform?: string     // 平台名称
  duration?: string     // 视频时长
  description?: string  // 描述
  [key: string]: any    // 其他扩展字段
}
```

## 站点处理器

### YouTube Handler
- 提取视频标题、频道、描述
- 提取字幕/转录文本（如果有）
- 提取播放量、发布时间

### Bilibili Handler  
- 提取视频标题、UP 主
- 提取视频简介、标签
- 提取播放量、发布时间

### 百度百科 Handler
- 提取词条标题和摘要
- 提取词条正文内容
- 按章节结构化

### 文档站点 Handler
- 自动检测 MDN、Microsoft Docs 等
- 提取文章内容，保留代码块
- 移除导航、侧边栏等干扰

## 扩展新站点

创建新的处理器：

```typescript
// src/core/handlers/mysite.ts
import type { ExtractedContent, ContentMetadata } from "../types"

export function mySiteHandler(): ExtractedContent | null {
  // 检查是否匹配
  if (!location.hostname.includes("mysite.com")) {
    return null
  }

  // 提取内容
  const title = document.querySelector("h1")?.innerText || ""
  const content = document.querySelector(".article")?.innerText || ""

  if (content.length < 100) {
    return null
  }

  return {
    title,
    url: location.href,
    html: "",
    text: content,
    snippet: content.slice(0, 500),
    metadata: {
      platform: "MySite"
    }
  }
}
```

然后在 `contentExtractor.ts` 中注册：

```typescript
import { mySiteHandler } from "./handlers/mysite"

const siteHandlers: SiteHandlerConfig[] = [
  // ... 其他处理器
  { pattern: /mysite\.com/, handler: mySiteHandler, name: "MySite" },
]
```
