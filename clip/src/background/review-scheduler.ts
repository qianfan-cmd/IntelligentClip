/**
 * 复习提醒调度器
 * 
 * 在 background script 中运行，负责：
 * 1. 定时检查待复习内容
 * 2. 发送 Chrome 通知提醒用户
 * 3. 处理通知按钮点击事件
 */

import { ReviewStore, ReviewSettingsStore } from "../lib/review/review-store"
import type { ReviewSettings } from "../lib/review/types"

// Alarm 名称
const REVIEW_CHECK_ALARM = "review-check"
const REVIEW_SNOOZE_ALARM = "review-snooze"

// 通知 ID
const REVIEW_NOTIFICATION_ID = "review-reminder"

/**
 * 初始化复习调度器
 * 在 background script 启动时调用
 */
export async function initReviewScheduler() {
  console.log("[ReviewScheduler] Initializing...")
  
  // 创建定时检查（每小时检查一次）
  chrome.alarms.create(REVIEW_CHECK_ALARM, {
    periodInMinutes: 60,
    delayInMinutes: 1  // 启动后1分钟进行首次检查
  })
  
  // 监听 Alarm
  chrome.alarms.onAlarm.addListener(handleAlarm)
  
  // 监听通知点击
  chrome.notifications.onClicked.addListener(handleNotificationClick)
  chrome.notifications.onButtonClicked.addListener(handleNotificationButtonClick)
  
  console.log("[ReviewScheduler] Initialized successfully")
}

/**
 * 处理 Alarm 触发
 */
async function handleAlarm(alarm: chrome.alarms.Alarm) {
  if (alarm.name === REVIEW_CHECK_ALARM) {
    await checkAndNotify()
  } else if (alarm.name === REVIEW_SNOOZE_ALARM) {
    // 延后提醒触发
    await checkAndNotify()
  }
}

/**
 * 检查待复习内容并发送通知
 */
async function checkAndNotify() {
  console.log("[ReviewScheduler] Checking for due reviews...")
  
  try {
    // 获取设置
    const settings = await ReviewSettingsStore.get()
    
    // 检查是否启用
    if (!settings.enabled || !settings.notificationsEnabled) {
      console.log("[ReviewScheduler] Notifications disabled")
      return
    }
    
    // 检查勿扰时间
    if (isQuietHours(settings)) {
      console.log("[ReviewScheduler] In quiet hours, skipping notification")
      return
    }
    
    // 获取待复习数量
    const dueCount = await ReviewStore.getDueCount()
    
    if (dueCount > 0) {
      await showNotification(dueCount, settings)
    } else {
      console.log("[ReviewScheduler] No reviews due")
    }
  } catch (err) {
    console.error("[ReviewScheduler] Check failed:", err)
  }
}

/**
 * 检查当前是否在勿扰时间内
 */
function isQuietHours(settings: ReviewSettings): boolean {
  if (!settings.quietHours?.enabled) return false
  
  const now = new Date()
  const hour = now.getHours()
  const { start, end } = settings.quietHours
  
  // 处理跨午夜的情况
  if (start < end) {
    // 例如: 22:00 - 08:00 (不跨午夜的写法错误，实际是 08:00 - 22:00)
    return hour >= start && hour < end
  } else {
    // 例如: start=22, end=8 表示 22:00 - 08:00
    return hour >= start || hour < end
  }
}

/**
 * 显示通知
 */
async function showNotification(count: number, settings: ReviewSettings) {
  console.log("[ReviewScheduler] Showing notification for", count, "due reviews")
  
  // 检查通知权限
  const hasPermission = await chrome.permissions.contains({
    permissions: ["notifications"]
  })
  
  if (!hasPermission) {
    console.warn("[ReviewScheduler] No notification permission")
    return
  }
  
  // 创建通知
  const message = count === 1
    ? "有 1 条剪藏等待复习"
    : `有 ${count} 条剪藏等待复习`
  
  chrome.notifications.create(REVIEW_NOTIFICATION_ID, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("assets/icon128.png"),
    title: "📚 复习提醒",
    message: message + "，趁热打铁效果更好！",
    buttons: [
      { title: "🎯 开始复习" },
      { title: "⏰ 30分钟后提醒" }
    ],
    priority: 1,
    requireInteraction: true  // 保持显示直到用户操作
  })
}

/**
 * 处理通知点击（点击通知主体）
 */
function handleNotificationClick(notificationId: string) {
  if (notificationId === REVIEW_NOTIFICATION_ID) {
    openReviewPage()
    chrome.notifications.clear(notificationId)
  }
}

/**
 * 处理通知按钮点击
 */
function handleNotificationButtonClick(notificationId: string, buttonIndex: number) {
  if (notificationId !== REVIEW_NOTIFICATION_ID) return
  
  if (buttonIndex === 0) {
    // 开始复习
    openReviewPage()
  } else if (buttonIndex === 1) {
    // 30分钟后提醒
    chrome.alarms.create(REVIEW_SNOOZE_ALARM, {
      delayInMinutes: 30
    })
    console.log("[ReviewScheduler] Snoozed for 30 minutes")
  }
  
  chrome.notifications.clear(notificationId)
}

/**
 * 打开复习页面
 */
function openReviewPage() {
  chrome.tabs.create({
    url: chrome.runtime.getURL("tabs/review.html")
  })
}

/**
 * 手动触发通知检查（用于测试）
 */
export async function triggerReviewCheck() {
  await checkAndNotify()
}

/**
 * 获取调度器状态
 */
export async function getSchedulerStatus(): Promise<{
  nextCheckTime: number | null
  isQuietHours: boolean
  dueCount: number
}> {
  const alarm = await chrome.alarms.get(REVIEW_CHECK_ALARM)
  const settings = await ReviewSettingsStore.get()
  const dueCount = await ReviewStore.getDueCount()
  
  return {
    nextCheckTime: alarm?.scheduledTime || null,
    isQuietHours: isQuietHours(settings),
    dueCount
  }
}
