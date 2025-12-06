/**
 * IndexedDB 数据库定义 (基于 Dexie.js)
 * 
 * 【设计说明】
 * - 使用 IndexedDB 替代 chrome.storage.local 存储剪藏数据
 * - 支持更大数据量、更好的查询性能、索引支持
 * - 保持与原有 ClipStore API 兼容
 * 
 * 【数据表】
 * - clips: 剪藏内容主表
 * - folders: 文件夹表
 * - reviews: 复习记录表（AI 回顾助手）
 * 
 * 【索引设计】
 * - clips: id(主键), url, createdAt, source, folderId
 * - folders: id(主键), name, createdAt
 * - reviews: id(主键), clipId, nextReviewDate, createdAt
 */

import Dexie, { type Table } from "dexie"
import type { ContentMetadata } from "@/core/index"
import type { ReviewRecord } from "./review/types"

// ============================================
// 类型定义（与原 clip-store.ts 保持一致）
// ============================================

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

/**
 * 文件夹类型定义
 */
export interface Folder {
  id: string
  name: string
  createdAt: number
  color?: string
  icon?: string
}

/**
 * 剪藏内容类型定义
 */
export interface Clip {
  id: string
  source: "youtube" | "bilibili" | "webpage" | "chat" | "other" | "screenshot"
  url: string
  title: string
  createdAt: number
  rawTextSnippet: string
  rawTextFull?: string
  summary: string
  keyPoints?: string[]
  tags?: string[]
  rating?: number
  extra?: any
  meta?: ContentMetadata
  syncedToFeishu?: boolean
  feishuRecordId?: string
  notes?: string
  updatedAt?: number
  folderId?: string
  
  // AI 交互式打标字段
  categories?: string[]
  scenarios?: string[]
  personalComment?: string
  
  // 图片剪藏
  images?: ClipImage[]
}

/**
 * AI 打标结果的类型定义
 */
export interface ClipTagsResult {
  shouldUpdate: boolean
  categories?: string[]
  scenarios?: string[]
  personalComment?: string
  rating?: number
  tags?: string[]
}

// ============================================
// Dexie 数据库定义
// ============================================

/**
 * ClipDatabase - 基于 Dexie.js 的 IndexedDB 封装
 * 
 * 【版本管理】
 * - v1: 初始版本，包含 clips 和 folders 表
 * 
 * 【索引说明】
 * - clips 表索引: id(主键), url, createdAt, source, folderId
 *   - id: 唯一标识，用于精确查找
 *   - url: 用于检查重复 URL
 *   - createdAt: 用于按时间排序
 *   - source: 用于按来源筛选
 *   - folderId: 用于按文件夹筛选
 * 
 * - folders 表索引: id(主键), name, createdAt
 */
export class ClipDatabase extends Dexie {
  // 表定义（带类型）
  clips!: Table<Clip, string>
  folders!: Table<Folder, string>
  reviews!: Table<ReviewRecord, string>

  constructor() {
    super("clipper_db")
    
    // 版本 1：初始表结构
    this.version(1).stores({
      // clips 表：id 为主键，其他为索引字段
      // 注意：Dexie 中第一个字段默认为主键
      clips: "id, url, createdAt, source, folderId",
      // folders 表
      folders: "id, name, createdAt"
    })
    
    // 版本 2：添加 reviews 表（AI 回顾助手）
    this.version(2).stores({
      clips: "id, url, createdAt, source, folderId",
      folders: "id, name, createdAt",
      // reviews 表：用于存储复习记录
      // clipId: 关联剪藏
      // nextReviewDate: 用于查询待复习内容
      // createdAt: 用于按时间排序
      reviews: "id, clipId, nextReviewDate, createdAt"
    })
  }
}

// 单例数据库实例
export const clipDB = new ClipDatabase()

// ============================================
// 迁移相关常量
// ============================================

/** 旧存储 key（chrome.storage.local） */
export const LEGACY_CLIPS_KEY = "clips"
export const LEGACY_FOLDERS_KEY = "folders"

/** 迁移完成标记 key */
export const MIGRATION_FLAG_KEY = "clipMigratedToIndexedDB"
export const MIGRATION_VERSION_KEY = "clipMigrationVersion"

/** 当前迁移版本 */
export const CURRENT_MIGRATION_VERSION = 1

// ============================================
// 工具函数
// ============================================

/**
 * 生成 UUID
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * 检查扩展上下文是否有效
 */
export function isExtensionContextValid(): boolean {
  try {
    return !!chrome.runtime?.id
  } catch {
    return false
  }
}

/**
 * 检查 IndexedDB 是否可用
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

// ============================================
// 迁移逻辑
// ============================================

/**
 * 检查是否需要迁移
 */
async function shouldMigrate(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get([MIGRATION_FLAG_KEY, MIGRATION_VERSION_KEY])
    
    // 如果没有迁移标记，需要迁移
    if (!result[MIGRATION_FLAG_KEY]) {
      return true
    }
    
    // 如果迁移版本低于当前版本，需要再次迁移
    if ((result[MIGRATION_VERSION_KEY] || 0) < CURRENT_MIGRATION_VERSION) {
      return true
    }
    
    return false
  } catch (err) {
    console.error("[ClipDB] Failed to check migration status:", err)
    return false
  }
}

/**
 * 从 chrome.storage.local 迁移数据到 IndexedDB
 * 
 * 【迁移策略】
 * 1. 读取 chrome.storage.local 中的旧数据
 * 2. 检查 IndexedDB 中是否已有数据（避免重复迁移）
 * 3. 批量写入 IndexedDB
 * 4. 设置迁移完成标记
 * 
 * 【幂等性保证】
 * - 通过检查迁移标记避免重复迁移
 * - 通过检查 ID 存在性避免重复插入
 */
export async function migrateFromChromeStorage(): Promise<{
  clipsCount: number
  foldersCount: number
  skipped: boolean
}> {
  const result = { clipsCount: 0, foldersCount: 0, skipped: false }
  
  try {
    // 检查是否需要迁移
    const needMigrate = await shouldMigrate()
    if (!needMigrate) {
      console.log("[ClipDB] Migration already completed, skipping...")
      result.skipped = true
      return result
    }
    
    console.log("[ClipDB] Starting migration from chrome.storage.local...")
    
    // 读取旧数据
    const storageData = await chrome.storage.local.get([LEGACY_CLIPS_KEY, LEGACY_FOLDERS_KEY])
    const oldClips: Clip[] = storageData[LEGACY_CLIPS_KEY] || []
    const oldFolders: Folder[] = storageData[LEGACY_FOLDERS_KEY] || []
    
    console.log(`[ClipDB] Found ${oldClips.length} clips and ${oldFolders.length} folders to migrate`)
    
    // 迁移 Clips
    if (oldClips.length > 0) {
      // 获取已存在的 ID，避免重复插入
      const existingIds = new Set(
        (await clipDB.clips.toArray()).map(c => c.id)
      )
      
      const newClips = oldClips.filter(c => !existingIds.has(c.id))
      
      if (newClips.length > 0) {
        await clipDB.clips.bulkAdd(newClips)
        result.clipsCount = newClips.length
        console.log(`[ClipDB] Migrated ${newClips.length} clips`)
      }
    }
    
    // 迁移 Folders
    if (oldFolders.length > 0) {
      const existingFolderIds = new Set(
        (await clipDB.folders.toArray()).map(f => f.id)
      )
      
      const newFolders = oldFolders.filter(f => !existingFolderIds.has(f.id))
      
      if (newFolders.length > 0) {
        await clipDB.folders.bulkAdd(newFolders)
        result.foldersCount = newFolders.length
        console.log(`[ClipDB] Migrated ${newFolders.length} folders`)
      }
    }
    
    // 设置迁移完成标记
    await chrome.storage.local.set({
      [MIGRATION_FLAG_KEY]: true,
      [MIGRATION_VERSION_KEY]: CURRENT_MIGRATION_VERSION
    })
    
    console.log("[ClipDB] Migration completed successfully!")
    
    // 【可选】清理旧数据（暂时注释，确认迁移成功后再启用）
    // await chrome.storage.local.remove([LEGACY_CLIPS_KEY, LEGACY_FOLDERS_KEY])
    
    return result
    
  } catch (err) {
    console.error("[ClipDB] Migration failed:", err)
    throw err
  }
}

// ============================================
// 初始化
// ============================================

/** 初始化状态 */
let _initialized = false
let _initPromise: Promise<void> | null = null

/**
 * 初始化数据库
 * - 确保数据库已打开
 * - 执行数据迁移（如需要）
 * 
 * 【并发安全】
 * 使用单例 Promise 确保初始化只执行一次
 */
export async function initClipDB(): Promise<void> {
  if (_initialized) return
  
  if (_initPromise) {
    return _initPromise
  }
  
  _initPromise = (async () => {
    try {
      // 检查 IndexedDB 可用性
      if (!isIndexedDBAvailable()) {
        throw new Error("IndexedDB is not available in this environment")
      }
      
      // 打开数据库
      await clipDB.open()
      console.log("[ClipDB] Database opened successfully")
      
      // 执行迁移
      if (isExtensionContextValid()) {
        await migrateFromChromeStorage()
      }
      
      _initialized = true
      
    } catch (err) {
      console.error("[ClipDB] Initialization failed:", err)
      _initPromise = null
      throw err
    }
  })()
  
  return _initPromise
}

/**
 * 确保数据库已初始化
 * 在每个数据操作前调用
 */
export async function ensureDBReady(): Promise<void> {
  if (!_initialized) {
    await initClipDB()
  }
}
