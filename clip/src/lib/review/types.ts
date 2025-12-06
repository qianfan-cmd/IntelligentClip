/**
 * AI 回顾助手 - 类型定义
 * 
 * 基于艾宾浩斯记忆曲线和 SM-2 算法的智能复习系统
 */

/**
 * 复习评分（SM-2 算法标准评分）
 * 0: 完全忘记 - 需要重新学习
 * 1: 错误，但看到答案后想起来了
 * 2: 错误，但感觉快要想起来了
 * 3: 正确，但很困难
 * 4: 正确，有些犹豫
 * 5: 完美，轻松回答
 */
export type ReviewRating = 0 | 1 | 2 | 3 | 4 | 5

/**
 * 复习卡片类型
 */
export type CardType = 'qa' | 'cloze' | 'summary' | 'keypoint'

/**
 * 复习卡片
 */
export interface ReviewCard {
  /** 卡片类型 */
  type: CardType
  /** 问题/提示 */
  question: string
  /** 答案 */
  answer: string
  /** 提示（可选） */
  hint?: string
}

/**
 * 复习记录
 * 存储每个剪藏的复习状态和 SM-2 算法参数
 */
export interface ReviewRecord {
  /** 记录 ID */
  id: string
  /** 关联的剪藏 ID */
  clipId: string
  
  // ========== SM-2 算法参数 ==========
  
  /** 
   * 难度因子 (Ease Factor)
   * 范围: 1.3 - 2.5+
   * 默认值: 2.5
   * 越高表示内容越容易记住
   */
  easeFactor: number
  
  /** 
   * 当前间隔天数
   * 下次复习与上次复习之间的天数
   */
  interval: number
  
  /** 
   * 连续正确次数
   * 用于确定是否进入长期记忆阶段
   */
  repetitions: number
  
  // ========== 时间相关 ==========
  
  /** 下次复习时间戳 (毫秒) */
  nextReviewDate: number
  
  /** 上次复习时间戳 (毫秒) */
  lastReviewDate?: number
  
  /** 创建时间戳 (毫秒) */
  createdAt: number
  
  // ========== 统计数据 ==========
  
  /** 总复习次数 */
  totalReviews: number
  
  /** 正确次数（评分 >= 3） */
  correctCount: number
  
  // ========== AI 生成的复习卡片缓存 ==========
  
  /** 缓存的复习卡片 */
  cards?: ReviewCard[]
  
  /** 卡片生成时间戳 */
  cardsGeneratedAt?: number
  
  // ========== 用户设置 ==========
  
  /** 是否暂停复习 */
  paused?: boolean
  
  /** 用户标记的优先级 (1-5) */
  priority?: number
}

/**
 * 复习设置
 */
export interface ReviewSettings {
  /** 是否启用复习功能 */
  enabled: boolean
  
  /** 是否启用通知 */
  notificationsEnabled: boolean
  
  /** 每日复习目标数量 */
  dailyGoal: number
  
  /** 新剪藏自动加入复习计划 */
  autoAddNewClips: boolean
  
  /** 勿扰时间设置 */
  quietHours?: {
    enabled: boolean
    start: number  // 小时 (0-23)
    end: number    // 小时 (0-23)
  }
  
  /** 提醒时间 (小时，如 9 表示早上9点) */
  reminderHour?: number
}

/**
 * 复习统计
 */
export interface ReviewStats {
  /** 今日已复习数量 */
  reviewedToday: number
  
  /** 今日待复习数量 */
  dueToday: number
  
  /** 总复习次数 */
  totalReviews: number
  
  /** 平均正确率 */
  averageAccuracy: number
  
  /** 连续复习天数 */
  streak: number
  
  /** 上次复习日期 */
  lastReviewDate?: number
}

/**
 * 复习记录与剪藏的联合类型（用于 UI 显示）
 */
export interface ReviewWithClip {
  review: ReviewRecord
  clip: {
    id: string
    title: string
    summary: string
    keyPoints?: string[]
    url: string
    source: string
    createdAt: number
  }
}

/**
 * 默认复习设置
 */
export const DEFAULT_REVIEW_SETTINGS: ReviewSettings = {
  enabled: true,
  notificationsEnabled: true,
  dailyGoal: 10,
  autoAddNewClips: false,
  quietHours: {
    enabled: true,
    start: 22,  // 晚上10点
    end: 8      // 早上8点
  },
  reminderHour: 9
}
