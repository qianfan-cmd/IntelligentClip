import type { ContentMetadata } from "@/core/index"

/**
 * 剪藏的图片信息
 */
export interface ClipImage {
  /** 图片 URL（绝对路径） */
  src: string
  /** 图片描述 */
  alt?: string
  /** 图片宽度 */
  width?: number
  /** 图片高度 */
  height?: number
}

export interface Clip {
  id: string
  source: "youtube" | "bilibili" | "webpage" | "chat" | "other" | "screenshot"
  url: string
  title: string
  createdAt: number
  rawTextSnippet: string
  rawTextFull?: string  // Full page text for AI processing
  summary: string
  keyPoints?: string[]
  tags?: string[]
  rating?: number
  extra?: any
  meta?: ContentMetadata  // Platform-specific metadata (author, viewCount, etc.)
  syncedToFeishu?: boolean
  feishuRecordId?: string
  notes?: string  // User's personal notes and thoughts
  updatedAt?: number  // Last update timestamp
  
  // ===== AI 交互式打标字段 =====
  /** 内容分类，如"公司介绍""技术文档""教程"等 */
  categories?: string[]
  /** 适用场景，如"工作参考""备考复习""投资研究"等 */
  scenarios?: string[]
  /** 用户个人感想/评论 */
  personalComment?: string
  
  // ===== 图片剪藏 =====
  /** 剪藏的图片列表 */
  images?: ClipImage[]
}

/**
 * AI 打标结果的类型定义
 * 用于解析 <clip_tags> JSON 内容
 */
export interface ClipTagsResult {
  /** 是否需要更新数据库中的打标信息 */
  shouldUpdate: boolean
  /** 内容分类列表 */
  categories?: string[]
  /** 适用场景列表 */
  scenarios?: string[]
  /** 用户个人感想 */
  personalComment?: string
  /** 评分 1-5 星 */
  rating?: number
  /** 标签列表 */
  tags?: string[]
}

const STORAGE_KEY = "clips"

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 检查扩展上下文是否有效
 */
function isExtensionContextValid(): boolean {
  try {
    // 尝试访问 chrome.runtime.id，如果上下文失效会抛出错误
    return !!chrome.runtime?.id
  } catch {
    return false
  }
}

/**
 * 包装存储操作，处理扩展上下文失效的情况
 */
async function safeStorageOperation<T>(
  operation: () => Promise<T>,
  fallback: T
): Promise<T> {
  if (!isExtensionContextValid()) {
    console.warn("⚠️ Extension context invalidated. Please refresh the page.")
    throw new Error("Extension context invalidated. Please refresh the page to continue using the extension.")
  }
  
  try {
    return await operation()
  } catch (error) {
    if (error instanceof Error && error.message.includes("Extension context invalidated")) {
      console.warn("⚠️ Extension context invalidated during operation.")
      throw new Error("Extension context invalidated. Please refresh the page to continue using the extension.")
    }
    throw error
  }
}

export const ClipStore = {
  async getAll(): Promise<Clip[]> {
    return safeStorageOperation(async () => {
      const result = await chrome.storage.local.get(STORAGE_KEY)
      return result[STORAGE_KEY] || []
    }, [])
  },

  async add(clip: Omit<Clip, "id" | "createdAt">): Promise<Clip> {
    return safeStorageOperation(async () => {
      const clips = await this.getAll()
      const newClip: Clip = {
        ...clip,
        id: generateUUID(),
        createdAt: Date.now()
      }
      clips.unshift(newClip) // Add to top
      await chrome.storage.local.set({ [STORAGE_KEY]: clips })
      return newClip
    }, { ...clip, id: "", createdAt: 0 } as Clip)
  },

  async update(id: string, updates: Partial<Clip>): Promise<Clip | null> {
    return safeStorageOperation(async () => {
      const clips = await this.getAll()
      const index = clips.findIndex((c) => c.id === id)
      if (index === -1) return null

      const updatedClip = { ...clips[index], ...updates }
      clips[index] = updatedClip
      await chrome.storage.local.set({ [STORAGE_KEY]: clips })
      return updatedClip
    }, null)
  },

  async delete(id: string): Promise<void> {
    return safeStorageOperation(async () => {
      const clips = await this.getAll()
      const newClips = clips.filter((c) => c.id !== id)
      await chrome.storage.local.set({ [STORAGE_KEY]: newClips })
    }, undefined)
  },

  /**
   * 批量删除多个剪藏
   */
  async deleteMany(ids: string[]): Promise<void> {
    return safeStorageOperation(async () => {
      const clips = await this.getAll()
      const idSet = new Set(ids)
      const newClips = clips.filter((c) => !idSet.has(c.id))
      await chrome.storage.local.set({ [STORAGE_KEY]: newClips })
    }, undefined)
  },

  /**
   * 检查扩展是否可用
   */
  isAvailable(): boolean {
    return isExtensionContextValid()
  }
}
