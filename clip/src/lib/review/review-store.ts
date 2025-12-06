/**
 * ReviewStore - 复习记录存储模块
 * 
 * 提供复习记录的 CRUD 操作，基于 IndexedDB (Dexie.js)
 */

import { clipDB, ensureDBReady } from "../clip-db"
import type { ReviewRecord, ReviewSettings, ReviewWithClip, DEFAULT_REVIEW_SETTINGS } from "./types"
import { createInitialReviewRecord, getDueReviews, calculateNextReview } from "./sm2-algorithm"
import type { ReviewRating } from "./types"

// 复习设置存储 key
const REVIEW_SETTINGS_KEY = "reviewSettings"

// ============================================
// ReviewStore - 复习记录存储
// ============================================

export const ReviewStore = {
  /**
   * 获取所有复习记录
   */
  async getAll(): Promise<ReviewRecord[]> {
    await ensureDBReady()
    
    try {
      return await clipDB.reviews.toArray()
    } catch (err) {
      console.error("[ReviewStore] getAll failed:", err)
      return []
    }
  },

  /**
   * 根据 ID 获取复习记录
   */
  async getById(id: string): Promise<ReviewRecord | undefined> {
    await ensureDBReady()
    
    try {
      return await clipDB.reviews.get(id)
    } catch (err) {
      console.error("[ReviewStore] getById failed:", err)
      return undefined
    }
  },

  /**
   * 根据剪藏 ID 获取复习记录
   */
  async getByClipId(clipId: string): Promise<ReviewRecord | undefined> {
    await ensureDBReady()
    
    try {
      return await clipDB.reviews
        .where("clipId")
        .equals(clipId)
        .first()
    } catch (err) {
      console.error("[ReviewStore] getByClipId failed:", err)
      return undefined
    }
  },

  /**
   * 获取今日待复习的记录
   */
  async getDueToday(): Promise<ReviewRecord[]> {
    await ensureDBReady()
    
    try {
      const now = Date.now()
      const records = await clipDB.reviews
        .where("nextReviewDate")
        .belowOrEqual(now)
        .toArray()
      
      // 过滤暂停的记录并排序
      return records
        .filter(r => !r.paused)
        .sort((a, b) => {
          // 优先级高的排前面
          const priorityDiff = (b.priority || 0) - (a.priority || 0)
          if (priorityDiff !== 0) return priorityDiff
          // 逾期时间长的排前面
          return a.nextReviewDate - b.nextReviewDate
        })
    } catch (err) {
      console.error("[ReviewStore] getDueToday failed:", err)
      return []
    }
  },

  /**
   * 获取今日待复习数量
   */
  async getDueCount(): Promise<number> {
    await ensureDBReady()
    
    try {
      const now = Date.now()
      return await clipDB.reviews
        .where("nextReviewDate")
        .belowOrEqual(now)
        .filter(r => !r.paused)
        .count()
    } catch (err) {
      console.error("[ReviewStore] getDueCount failed:", err)
      return 0
    }
  },

  /**
   * 创建复习记录（为剪藏添加到复习计划）
   */
  async create(clipId: string, delayDays: number = 1): Promise<ReviewRecord> {
    await ensureDBReady()
    
    // 检查是否已存在
    const existing = await this.getByClipId(clipId)
    if (existing) {
      console.warn("[ReviewStore] Review record already exists for clip:", clipId)
      return existing
    }
    
    const record = createInitialReviewRecord(clipId, delayDays)
    
    try {
      await clipDB.reviews.add(record)
      console.log("[ReviewStore] Review record created:", record.id)
      return record
    } catch (err) {
      console.error("[ReviewStore] create failed:", err)
      throw err
    }
  },

  /**
   * 批量创建复习记录
   */
  async createMany(clipIds: string[], delayDays: number = 1): Promise<ReviewRecord[]> {
    await ensureDBReady()
    
    const records: ReviewRecord[] = []
    
    for (const clipId of clipIds) {
      const existing = await this.getByClipId(clipId)
      if (!existing) {
        records.push(createInitialReviewRecord(clipId, delayDays))
      }
    }
    
    if (records.length === 0) {
      return []
    }
    
    try {
      await clipDB.reviews.bulkAdd(records)
      console.log("[ReviewStore] Created", records.length, "review records")
      return records
    } catch (err) {
      console.error("[ReviewStore] createMany failed:", err)
      throw err
    }
  },

  /**
   * 更新复习记录
   */
  async update(id: string, updates: Partial<ReviewRecord>): Promise<ReviewRecord | null> {
    await ensureDBReady()
    
    try {
      const count = await clipDB.reviews.update(id, updates)
      
      if (count === 0) {
        console.warn("[ReviewStore] Record not found for update:", id)
        return null
      }
      
      return await clipDB.reviews.get(id) || null
    } catch (err) {
      console.error("[ReviewStore] update failed:", err)
      return null
    }
  },

  /**
   * 提交复习结果
   */
  async submitReview(id: string, rating: ReviewRating): Promise<ReviewRecord | null> {
    await ensureDBReady()
    
    try {
      const record = await clipDB.reviews.get(id)
      if (!record) {
        console.warn("[ReviewStore] Record not found:", id)
        return null
      }
      
      const updates = calculateNextReview(record, rating)
      await clipDB.reviews.update(id, updates)
      
      console.log("[ReviewStore] Review submitted:", id, "Rating:", rating, "Next interval:", updates.interval, "days")
      
      return await clipDB.reviews.get(id) || null
    } catch (err) {
      console.error("[ReviewStore] submitReview failed:", err)
      return null
    }
  },

  /**
   * 删除复习记录
   */
  async delete(id: string): Promise<void> {
    await ensureDBReady()
    
    try {
      await clipDB.reviews.delete(id)
      console.log("[ReviewStore] Review record deleted:", id)
    } catch (err) {
      console.error("[ReviewStore] delete failed:", err)
      throw err
    }
  },

  /**
   * 根据剪藏 ID 删除复习记录
   */
  async deleteByClipId(clipId: string): Promise<void> {
    await ensureDBReady()
    
    try {
      await clipDB.reviews
        .where("clipId")
        .equals(clipId)
        .delete()
      console.log("[ReviewStore] Review record deleted for clip:", clipId)
    } catch (err) {
      console.error("[ReviewStore] deleteByClipId failed:", err)
      throw err
    }
  },

  /**
   * 暂停/恢复复习
   */
  async togglePause(id: string): Promise<ReviewRecord | null> {
    await ensureDBReady()
    
    try {
      const record = await clipDB.reviews.get(id)
      if (!record) return null
      
      await clipDB.reviews.update(id, { paused: !record.paused })
      return await clipDB.reviews.get(id) || null
    } catch (err) {
      console.error("[ReviewStore] togglePause failed:", err)
      return null
    }
  },

  /**
   * 设置优先级
   */
  async setPriority(id: string, priority: number): Promise<ReviewRecord | null> {
    return this.update(id, { priority: Math.max(1, Math.min(5, priority)) })
  },

  /**
   * 获取复习记录与剪藏的联合数据
   */
  async getWithClips(): Promise<ReviewWithClip[]> {
    await ensureDBReady()
    
    try {
      const reviews = await clipDB.reviews.toArray()
      const result: ReviewWithClip[] = []
      
      for (const review of reviews) {
        const clip = await clipDB.clips.get(review.clipId)
        if (clip) {
          result.push({
            review,
            clip: {
              id: clip.id,
              title: clip.title,
              summary: clip.summary,
              keyPoints: clip.keyPoints,
              url: clip.url,
              source: clip.source,
              createdAt: clip.createdAt
            }
          })
        }
      }
      
      return result
    } catch (err) {
      console.error("[ReviewStore] getWithClips failed:", err)
      return []
    }
  },

  /**
   * 获取待复习的记录与剪藏联合数据
   */
  async getDueTodayWithClips(): Promise<ReviewWithClip[]> {
    await ensureDBReady()
    
    try {
      const dueReviews = await this.getDueToday()
      const result: ReviewWithClip[] = []
      
      for (const review of dueReviews) {
        const clip = await clipDB.clips.get(review.clipId)
        if (clip) {
          result.push({
            review,
            clip: {
              id: clip.id,
              title: clip.title,
              summary: clip.summary,
              keyPoints: clip.keyPoints,
              url: clip.url,
              source: clip.source,
              createdAt: clip.createdAt
            }
          })
        }
      }
      
      return result
    } catch (err) {
      console.error("[ReviewStore] getDueTodayWithClips failed:", err)
      return []
    }
  },

  /**
   * 更新复习卡片缓存
   */
  async updateCards(id: string, cards: ReviewRecord['cards']): Promise<void> {
    await ensureDBReady()
    
    try {
      await clipDB.reviews.update(id, {
        cards,
        cardsGeneratedAt: Date.now()
      })
    } catch (err) {
      console.error("[ReviewStore] updateCards failed:", err)
    }
  },

  /**
   * 获取统计数据
   */
  async getStats(): Promise<{
    total: number
    dueToday: number
    paused: number
    avgEaseFactor: number
  }> {
    await ensureDBReady()
    
    try {
      const records = await clipDB.reviews.toArray()
      const now = Date.now()
      
      let dueToday = 0
      let paused = 0
      let totalEaseFactor = 0
      
      for (const r of records) {
        if (r.paused) paused++
        if (!r.paused && r.nextReviewDate <= now) dueToday++
        totalEaseFactor += r.easeFactor
      }
      
      return {
        total: records.length,
        dueToday,
        paused,
        avgEaseFactor: records.length > 0 ? totalEaseFactor / records.length : 2.5
      }
    } catch (err) {
      console.error("[ReviewStore] getStats failed:", err)
      return { total: 0, dueToday: 0, paused: 0, avgEaseFactor: 2.5 }
    }
  },

  /**
   * 清空所有复习记录（危险操作）
   */
  async clearAll(): Promise<void> {
    await ensureDBReady()
    
    try {
      await clipDB.reviews.clear()
      console.warn("[ReviewStore] All review records cleared!")
    } catch (err) {
      console.error("[ReviewStore] clearAll failed:", err)
      throw err
    }
  }
}

// ============================================
// 复习设置存储
// ============================================

export const ReviewSettingsStore = {
  /**
   * 获取复习设置
   */
  async get(): Promise<ReviewSettings> {
    try {
      const result = await chrome.storage.local.get(REVIEW_SETTINGS_KEY)
      return result[REVIEW_SETTINGS_KEY] || {
        enabled: true,
        notificationsEnabled: true,
        dailyGoal: 10,
        autoAddNewClips: false,
        quietHours: { enabled: true, start: 22, end: 8 },
        reminderHour: 9
      }
    } catch (err) {
      console.error("[ReviewSettingsStore] get failed:", err)
      return {
        enabled: true,
        notificationsEnabled: true,
        dailyGoal: 10,
        autoAddNewClips: false,
        quietHours: { enabled: true, start: 22, end: 8 },
        reminderHour: 9
      }
    }
  },

  /**
   * 保存复习设置
   */
  async save(settings: Partial<ReviewSettings>): Promise<void> {
    try {
      const current = await this.get()
      const updated = { ...current, ...settings }
      await chrome.storage.local.set({ [REVIEW_SETTINGS_KEY]: updated })
      console.log("[ReviewSettingsStore] Settings saved")
    } catch (err) {
      console.error("[ReviewSettingsStore] save failed:", err)
    }
  }
}
