/**
 * SM-2 算法实现
 * 
 * SuperMemo SM-2 是一种间隔重复算法，用于优化复习时间安排。
 * 
 * 核心原理：
 * 1. 根据用户对内容的记忆程度（评分 0-5）调整复习间隔
 * 2. 记得越好，下次复习间隔越长
 * 3. 忘记则重置间隔，从头开始
 * 
 * @see https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 */

import type { ReviewRecord, ReviewRating } from './types'

/** 一天的毫秒数 */
const DAY_MS = 24 * 60 * 60 * 1000

/** 最小难度因子 */
const MIN_EASE_FACTOR = 1.3

/** 默认难度因子 */
const DEFAULT_EASE_FACTOR = 2.5

/** 最大间隔天数（防止间隔过长导致遗忘） */
const MAX_INTERVAL_DAYS = 365

/**
 * SM-2 算法核心函数
 * 根据用户评分计算下次复习参数
 * 
 * @param record 当前复习记录
 * @param rating 用户评分 (0-5)
 * @returns 更新后的复习参数
 */
export function calculateNextReview(
  record: ReviewRecord,
  rating: ReviewRating
): Partial<ReviewRecord> {
  let { easeFactor, interval, repetitions } = record
  
  // 评分 >= 3 视为"记得"
  const isCorrect = rating >= 3
  
  if (isCorrect) {
    // ========== 记得：增加间隔 ==========
    if (repetitions === 0) {
      // 第一次正确：1天后复习
      interval = 1
    } else if (repetitions === 1) {
      // 第二次正确：6天后复习
      interval = 6
    } else {
      // 后续正确：间隔 = 上次间隔 × 难度因子
      interval = Math.round(interval * easeFactor)
    }
    
    // 增加连续正确次数
    repetitions += 1
  } else {
    // ========== 忘记：重置 ==========
    repetitions = 0
    interval = 1  // 明天重新复习
  }
  
  // 限制最大间隔
  interval = Math.min(interval, MAX_INTERVAL_DAYS)
  
  // ========== 更新难度因子 ==========
  // SM-2 公式: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  // q 是评分，EF 是当前难度因子
  easeFactor = easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
  
  // 难度因子不能低于最小值
  easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor)
  
  // 计算下次复习时间
  const nextReviewDate = Date.now() + interval * DAY_MS
  
  return {
    easeFactor,
    interval,
    repetitions,
    nextReviewDate,
    lastReviewDate: Date.now(),
    totalReviews: record.totalReviews + 1,
    correctCount: record.correctCount + (isCorrect ? 1 : 0)
  }
}

/**
 * 创建新剪藏的初始复习记录
 * 
 * @param clipId 剪藏 ID
 * @param delayDays 首次复习延迟天数（默认1天）
 * @returns 初始复习记录
 */
export function createInitialReviewRecord(
  clipId: string,
  delayDays: number = 1
): ReviewRecord {
  return {
    id: crypto.randomUUID(),
    clipId,
    easeFactor: DEFAULT_EASE_FACTOR,
    interval: 0,
    repetitions: 0,
    nextReviewDate: Date.now() + delayDays * DAY_MS,
    createdAt: Date.now(),
    totalReviews: 0,
    correctCount: 0
  }
}

/**
 * 获取今日待复习的记录
 * 
 * @param records 所有复习记录
 * @returns 按优先级排序的待复习记录
 */
export function getDueReviews(records: ReviewRecord[]): ReviewRecord[] {
  const now = Date.now()
  
  return records
    .filter(r => !r.paused && r.nextReviewDate <= now)
    .sort((a, b) => {
      // 优先级高的排前面
      const priorityDiff = (b.priority || 0) - (a.priority || 0)
      if (priorityDiff !== 0) return priorityDiff
      
      // 逾期时间长的排前面
      return a.nextReviewDate - b.nextReviewDate
    })
}

/**
 * 获取今日待复习数量
 * 
 * @param records 所有复习记录
 * @returns 待复习数量
 */
export function getDueCount(records: ReviewRecord[]): number {
  const now = Date.now()
  return records.filter(r => !r.paused && r.nextReviewDate <= now).length
}

/**
 * 计算记忆强度（用于 UI 显示）
 * 
 * @param record 复习记录
 * @returns 0-100 的记忆强度值
 */
export function calculateMemoryStrength(record: ReviewRecord): number {
  if (record.totalReviews === 0) return 100  // 新内容，假设刚学完
  
  const now = Date.now()
  const daysSinceLastReview = record.lastReviewDate 
    ? (now - record.lastReviewDate) / DAY_MS 
    : 0
  
  // 基于艾宾浩斯遗忘曲线的简化计算
  // 记忆强度 = 100 * e^(-t/S)
  // t: 距离上次复习的天数
  // S: 稳定性（与间隔和正确率相关）
  
  const stability = record.interval * (record.easeFactor / DEFAULT_EASE_FACTOR)
  const strength = 100 * Math.exp(-daysSinceLastReview / Math.max(stability, 1))
  
  return Math.max(0, Math.min(100, Math.round(strength)))
}

/**
 * 获取复习状态描述
 * 
 * @param record 复习记录
 * @returns 状态描述
 */
export function getReviewStatus(record: ReviewRecord): {
  status: 'new' | 'learning' | 'review' | 'overdue'
  label: string
  color: string
} {
  const now = Date.now()
  
  if (record.totalReviews === 0) {
    return { status: 'new', label: '新学习', color: 'blue' }
  }
  
  if (record.repetitions < 2) {
    return { status: 'learning', label: '学习中', color: 'yellow' }
  }
  
  if (record.nextReviewDate <= now) {
    const overdueDays = Math.floor((now - record.nextReviewDate) / DAY_MS)
    if (overdueDays > 7) {
      return { status: 'overdue', label: `逾期 ${overdueDays} 天`, color: 'red' }
    }
    return { status: 'review', label: '待复习', color: 'orange' }
  }
  
  return { status: 'review', label: '已掌握', color: 'green' }
}

/**
 * 预测下次复习日期（用于 UI 显示）
 * 
 * @param record 复习记录
 * @returns 格式化的日期字符串
 */
export function formatNextReviewDate(record: ReviewRecord): string {
  const now = Date.now()
  const diff = record.nextReviewDate - now
  
  if (diff <= 0) {
    return '现在'
  }
  
  const days = Math.floor(diff / DAY_MS)
  
  if (days === 0) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    if (hours === 0) {
      return '1 小时内'
    }
    return `${hours} 小时后`
  }
  
  if (days === 1) return '明天'
  if (days < 7) return `${days} 天后`
  if (days < 30) return `${Math.floor(days / 7)} 周后`
  if (days < 365) return `${Math.floor(days / 30)} 个月后`
  
  return `${Math.floor(days / 365)} 年后`
}

/**
 * 计算复习统计
 * 
 * @param records 所有复习记录
 * @returns 统计数据
 */
export function calculateReviewStats(records: ReviewRecord[]): {
  totalRecords: number
  dueToday: number
  newCount: number
  learningCount: number
  masteredCount: number
  averageEaseFactor: number
} {
  const now = Date.now()
  
  let dueToday = 0
  let newCount = 0
  let learningCount = 0
  let masteredCount = 0
  let totalEaseFactor = 0
  
  for (const record of records) {
    if (record.paused) continue
    
    totalEaseFactor += record.easeFactor
    
    if (record.nextReviewDate <= now) {
      dueToday++
    }
    
    if (record.totalReviews === 0) {
      newCount++
    } else if (record.repetitions < 2) {
      learningCount++
    } else {
      masteredCount++
    }
  }
  
  return {
    totalRecords: records.length,
    dueToday,
    newCount,
    learningCount,
    masteredCount,
    averageEaseFactor: records.length > 0 ? totalEaseFactor / records.length : DEFAULT_EASE_FACTOR
  }
}
