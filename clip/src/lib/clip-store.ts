/**
 * ClipStore & FolderStore - 剪藏数据存储模块
 * 
 * 【重构说明 - v2.1】
 * 本模块通过 Plasmo Messaging 在 Background Script 中执行 IndexedDB 操作
 * 
 * 【为什么需要 Background 中转？】
 * Content Script 中使用 IndexedDB 会绑定到当前网页的 origin，
 * 导致不同网站之间数据不共享。通过在 Background Script 中执行
 * 所有 IndexedDB 操作，可以确保数据存储在扩展的 origin 下，
 * 实现跨网站的数据共享。
 * 
 * 【兼容性】
 * - 对外 API 保持不变，调用方无需修改
 * - 所有方法仍返回 Promise，使用方式完全一致
 * 
 * 【性能提升】
 * - 支持更大数据量（不再受 chrome.storage.local 5MB 限制）
 * - 支持索引查询，按 url/createdAt/source/folderId 快速筛选
 * 
 * @see background/messages/clip-storage.ts - Background 消息处理器
 * @see clip-db.ts - 数据库定义和迁移逻辑
 */

import { sendToBackground } from "@plasmohq/messaging"

// 从 clip-db 导入类型
import type {
  Clip,
  ClipImage,
  Folder,
  ClipTagsResult
} from "./clip-db"

// 重新导出类型，保持向后兼容
export type { Clip, ClipImage, Folder, ClipTagsResult }

// ============================================
// 消息发送工具
// ============================================

type StorageAction = 
  // ClipStore actions
  | "clips:getAll"
  | "clips:getById"
  | "clips:getByUrl"
  | "clips:getBySource"
  | "clips:getByFolder"
  | "clips:getPaginated"
  | "clips:add"
  | "clips:update"
  | "clips:delete"
  | "clips:deleteMany"
  | "clips:addImage"
  | "clips:removeImage"
  | "clips:moveToFolder"
  | "clips:moveManyToFolder"
  | "clips:search"
  | "clips:count"
  | "clips:clearAll"
  // FolderStore actions
  | "folders:getAll"
  | "folders:getById"
  | "folders:create"
  | "folders:rename"
  | "folders:update"
  | "folders:delete"
  | "folders:getClipCount"
  | "folders:clearAll"

interface StorageResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 发送存储操作请求到 Background Script
 */
async function sendStorageRequest<T>(action: StorageAction, payload?: any): Promise<T> {
  try {
    const response = await sendToBackground<{ action: StorageAction; payload?: any }, StorageResponse<T>>({
      name: "clip-storage",
      body: { action, payload }
    })
    
    if (!response.success) {
      throw new Error(response.error || `Storage action ${action} failed`)
    }
    
    return response.data as T
  } catch (err) {
    console.error(`[ClipStore] ${action} failed:`, err)
    throw err
  }
}

// ============================================
// ClipStore - 剪藏存储
// ============================================

export const ClipStore = {
  /**
   * 获取所有剪藏
   * 按创建时间倒序排列（最新的在前）
   */
  async getAll(): Promise<Clip[]> {
    try {
      return await sendStorageRequest<Clip[]>("clips:getAll")
    } catch (err) {
      console.error("[ClipStore] getAll failed:", err)
      return []
    }
  },

  /**
   * 根据 ID 获取单个剪藏
   */
  async getById(id: string): Promise<Clip | undefined> {
    try {
      return await sendStorageRequest<Clip | undefined>("clips:getById", { id })
    } catch (err) {
      console.error("[ClipStore] getById failed:", err)
      return undefined
    }
  },

  /**
   * 根据 URL 获取剪藏
   */
  async getByUrl(url: string): Promise<Clip | undefined> {
    try {
      return await sendStorageRequest<Clip | undefined>("clips:getByUrl", { url })
    } catch (err) {
      console.error("[ClipStore] getByUrl failed:", err)
      return undefined
    }
  },

  /**
   * 根据来源筛选剪藏
   */
  async getBySource(source: Clip["source"]): Promise<Clip[]> {
    try {
      return await sendStorageRequest<Clip[]>("clips:getBySource", { source })
    } catch (err) {
      console.error("[ClipStore] getBySource failed:", err)
      return []
    }
  },

  /**
   * 根据文件夹筛选剪藏
   */
  async getByFolder(folderId: string | undefined): Promise<Clip[]> {
    try {
      return await sendStorageRequest<Clip[]>("clips:getByFolder", { folderId })
    } catch (err) {
      console.error("[ClipStore] getByFolder failed:", err)
      return []
    }
  },

  /**
   * 分页获取剪藏
   * 
   * @param page 页码（从 1 开始）
   * @param pageSize 每页数量
   */
  async getPaginated(page: number = 1, pageSize: number = 50): Promise<{
    clips: Clip[]
    total: number
    hasMore: boolean
  }> {
    try {
      return await sendStorageRequest<{
        clips: Clip[]
        total: number
        hasMore: boolean
      }>("clips:getPaginated", { page, pageSize })
    } catch (err) {
      console.error("[ClipStore] getPaginated failed:", err)
      return { clips: [], total: 0, hasMore: false }
    }
  },

  /**
   * 新增剪藏
   */
  async add(clip: Omit<Clip, "id" | "createdAt">): Promise<Clip> {
    const result = await sendStorageRequest<Clip>("clips:add", clip)
    console.log("[ClipStore] Clip added:", result.id)
    return result
  },

  /**
   * 更新剪藏
   */
  async update(id: string, updates: Partial<Clip>): Promise<Clip | null> {
    try {
      return await sendStorageRequest<Clip | null>("clips:update", { id, updates })
    } catch (err) {
      console.error("[ClipStore] update failed:", err)
      return null
    }
  },

  /**
   * 删除单个剪藏
   */
  async delete(id: string): Promise<void> {
    await sendStorageRequest<boolean>("clips:delete", { id })
    console.log("[ClipStore] Clip deleted:", id)
  },

  /**
   * 批量删除剪藏
   */
  async deleteMany(ids: string[]): Promise<void> {
    await sendStorageRequest<boolean>("clips:deleteMany", { ids })
    console.log("[ClipStore] Clips deleted:", ids.length)
  },

  /**
   * 添加图片到剪藏
   */
  async addImage(clipId: string, image: ClipImage): Promise<Clip | null> {
    try {
      return await sendStorageRequest<Clip | null>("clips:addImage", { clipId, image })
    } catch (err) {
      console.error("[ClipStore] addImage failed:", err)
      return null
    }
  },

  /**
   * 从剪藏删除图片
   */
  async removeImage(clipId: string, imageIndex: number): Promise<Clip | null> {
    try {
      return await sendStorageRequest<Clip | null>("clips:removeImage", { clipId, imageIndex })
    } catch (err) {
      console.error("[ClipStore] removeImage failed:", err)
      return null
    }
  },

  /**
   * 移动剪藏到文件夹
   */
  async moveToFolder(clipId: string, folderId: string | undefined): Promise<Clip | null> {
    try {
      return await sendStorageRequest<Clip | null>("clips:moveToFolder", { clipId, folderId })
    } catch (err) {
      console.error("[ClipStore] moveToFolder failed:", err)
      return null
    }
  },

  /**
   * 批量移动剪藏到文件夹
   */
  async moveManyToFolder(clipIds: string[], folderId: string | undefined): Promise<void> {
    await sendStorageRequest<boolean>("clips:moveManyToFolder", { clipIds, folderId })
    console.log("[ClipStore] Moved clips to folder:", clipIds.length, folderId)
  },

  /**
   * 搜索剪藏（标题和摘要）
   */
  async search(keyword: string): Promise<Clip[]> {
    try {
      return await sendStorageRequest<Clip[]>("clips:search", { keyword })
    } catch (err) {
      console.error("[ClipStore] search failed:", err)
      return []
    }
  },

  /**
   * 获取剪藏总数
   */
  async count(): Promise<number> {
    try {
      return await sendStorageRequest<number>("clips:count")
    } catch (err) {
      console.error("[ClipStore] count failed:", err)
      return 0
    }
  },

  /**
   * 检查扩展是否可用
   */
  isAvailable(): boolean {
    try {
      return !!chrome.runtime?.id
    } catch {
      return false
    }
  },

  /**
   * 清空所有剪藏
   * 
   * 【危险操作】仅用于调试/重置
   */
  async clearAll(): Promise<void> {
    await sendStorageRequest<boolean>("clips:clearAll")
    console.warn("[ClipStore] All clips cleared!")
  }
}

// ============================================
// FolderStore - 文件夹存储
// ============================================

export const FolderStore = {
  /**
   * 获取所有文件夹
   */
  async getAll(): Promise<Folder[]> {
    try {
      return await sendStorageRequest<Folder[]>("folders:getAll")
    } catch (err) {
      console.error("[FolderStore] getAll failed:", err)
      return []
    }
  },

  /**
   * 根据 ID 获取文件夹
   */
  async getById(id: string): Promise<Folder | undefined> {
    try {
      return await sendStorageRequest<Folder | undefined>("folders:getById", { id })
    } catch (err) {
      console.error("[FolderStore] getById failed:", err)
      return undefined
    }
  },

  /**
   * 创建文件夹
   */
  async create(name: string, color?: string): Promise<Folder> {
    const result = await sendStorageRequest<Folder>("folders:create", { name, color })
    console.log("[FolderStore] Folder created:", result.id)
    return result
  },

  /**
   * 重命名文件夹
   */
  async rename(id: string, newName: string): Promise<Folder | null> {
    try {
      return await sendStorageRequest<Folder | null>("folders:rename", { id, newName })
    } catch (err) {
      console.error("[FolderStore] rename failed:", err)
      return null
    }
  },

  /**
   * 更新文件夹
   */
  async update(id: string, updates: Partial<Folder>): Promise<Folder | null> {
    try {
      return await sendStorageRequest<Folder | null>("folders:update", { id, updates })
    } catch (err) {
      console.error("[FolderStore] update failed:", err)
      return null
    }
  },

  /**
   * 删除文件夹
   * 同时将该文件夹下的所有剪藏移到"未归类"
   */
  async delete(id: string): Promise<void> {
    await sendStorageRequest<boolean>("folders:delete", { id })
    console.log("[FolderStore] Folder deleted:", id)
  },

  /**
   * 获取文件夹下的剪藏数量
   */
  async getClipCount(folderId: string): Promise<number> {
    try {
      return await sendStorageRequest<number>("folders:getClipCount", { folderId })
    } catch (err) {
      console.error("[FolderStore] getClipCount failed:", err)
      return 0
    }
  },

  /**
   * 清空所有文件夹
   * 
   * 【危险操作】仅用于调试/重置
   */
  async clearAll(): Promise<void> {
    await sendStorageRequest<boolean>("folders:clearAll")
    console.warn("[FolderStore] All folders cleared!")
  }
}

// ============================================
// 兼容性导出（这些函数在新架构下不需要从外部调用）
// ============================================

/**
 * @deprecated 在新架构下，数据库初始化在 Background Script 中自动进行
 */
export async function initClipDB(): Promise<void> {
  // 在新架构下，数据库在 Background 中自动初始化
  // 这个函数保留是为了兼容性，实际不做任何事
  console.log("[ClipStore] initClipDB called - initialization happens in background")
}

/**
 * @deprecated 在新架构下，无需手动确保数据库就绪
 */
export async function ensureDBReady(): Promise<void> {
  // 同上，保留兼容性
}

/**
 * @deprecated 迁移在 Background Script 中自动进行
 */
export async function migrateFromChromeStorage(): Promise<{
  clipsCount: number
  foldersCount: number
  skipped: boolean
}> {
  // 迁移在 Background 中自动进行
  console.log("[ClipStore] migrateFromChromeStorage called - migration happens in background")
  return { clipsCount: 0, foldersCount: 0, skipped: true }
}
