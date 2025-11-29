import type { ContentMetadata } from "@/core/index"

export interface Clip {
  id: string
  source: "youtube" | "bilibili" | "webpage" | "chat" | "other"
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
