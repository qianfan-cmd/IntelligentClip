/**
 * 全文剪藏后处理模块（纯字符串级别）
 * 
 * 职责：
 * - 在已有提取结果的基础上，对 text 字符串做清洗和规范化
 * - 不修改任何 DOM 提取逻辑（handler / Readability / Fallback）
 * - 只处理字符串：空格、换行、段落、垃圾行过滤等
 * 
 * 策略：
 * - 对 AI 对话类网站（chat.openai.com, claude.ai 等）保守处理，只做基础规范化
 * - 对其他网站启用垃圾行过滤（交互按钮、时间戳等）
 */

import type { ExtractedContent } from "./types"

export interface PostProcessOptions {
  // 预留扩展选项
  enableGarbageFilter?: boolean  // 是否启用垃圾行过滤（默认自动判断）
  preserveOriginal?: boolean     // 是否保留原始文本（调试用）
}

/**
 * 检测是否为 AI 对话类网站
 * 对这类网站只做基础规范化，不删除任何内容
 */
function isChatSite(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    const chatDomains = [
      'chat.openai.com',
      'claude.ai',
      'poe.com',
      'bard.google.com',
      'chatgpt.com',
      'copilot.microsoft.com'
    ]
    return chatDomains.some(domain => host.includes(domain))
  } catch {
    return false
  }
}

/**
 * 基础空白字符规范化
 * - 统一换行符为 \n
 * - 压缩连续空白（同行内）
 * - 压缩连续空行（段落间）
 */
function normalizeWhitespace(text: string): string {
  if (!text) {
    return ""
  }
  
  // 1. 统一换行符：\r\n / \r → \n
  let result = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  
  // 2. 按行处理：将每行内连续 3 个及以上空白字符压缩为 1 个空格
  const lines = result.split("\n").map(line => 
    line.replace(/\s{3,}/g, " ")
  )
  result = lines.join("\n")
  
  // 3. 压缩连续空行：3 个及以上空行 → 2 个空行（段落间保留一个空行）
  result = result.replace(/\n{3,}/g, "\n\n")
  
  return result
}

/**
 * 行级规范化
 * - 去除首尾空白
 * - 处理中文标点周围的多余空格
 */
function normalizeLine(text: string): string {
  if (!text) return ""
  
  let t = text.trim()
  
  // 中文标点前后的空格处理
  // 标点前的空格去掉
  t = t.replace(/\s+([，。！？；：、""''）】》」』])/g, "$1")
  
  // 标点后的多余空格压缩（保留一个空格用于分隔）
  t = t.replace(/([，。！？；：、""''（【《「『])\s+/g, "$1 ")
  t = t.replace(/([，。！？；：])\s+/g, "$1")  // 句末标点后不需要空格
  
  return t
}

/**
 * 判断是否为垃圾行（仅在非聊天站点启用）
 * 
 * 垃圾行定义：
 * 1. 空行或只有一个字符
 * 2. 典型交互按钮文案（发表、举报、点赞等）且长度很短
 * 3. 相对时间戳（"3小时前"、"5分钟前"）
 * 4. 来源标识（"来自某某客户端"）
 */
function isGarbageLine(text: string): boolean {
  const t = text.trim()
  
  // 空行或极短行
  if (!t || t.length <= 1) return true
  
  // 典型交互按钮文案（短且包含特定关键词）
  const interactionKeywords = [
    '发表', '举报', '点赞', '收藏', '分享', '转发', 
    '评论', '关注', '登录', '注册', '展开回复', '收起',
    '查看更多', '加载更多', '显示全部', '隐藏',
    '编辑', '删除', '复制', '粘贴',
    '播报', '暂停', '播放', '继续', '停止',  // 媒体控制按钮
    '回复'  // 评论区按钮
  ]
  
  if (t.length <= 8 && interactionKeywords.some(kw => t.includes(kw))) {
    return true
  }
  
  // 百度搜索结果页特有干扰文本
  const baiduNoiseKeywords = [
    '百度百科', '搜索智能聚合', '反馈', '微信号', '截图'
  ]
  
  if (t.length <= 10 && baiduNoiseKeywords.some(kw => t === kw || t.includes(kw))) {
    return true
  }
  
  // 评论区/社区特有的提示文本
  const communityNoiseKeywords = [
    '没有更多', '暂无评论', '到底了', '已经到底', 
    '上拉加载', '下拉刷新', '加载中'
  ]
  
  if (t.length <= 12 && communityNoiseKeywords.some(kw => t.includes(kw))) {
    return true
  }
  
  // 中国省份/城市名（单独一行，≤4字）
  const chineseRegions = [
    '北京', '上海', '天津', '重庆',
    '河北', '山西', '辽宁', '吉林', '黑龙江',
    '江苏', '浙江', '安徽', '福建', '江西', '山东',
    '河南', '湖北', '湖南', '广东', '海南',
    '四川', '贵州', '云南', '陕西', '甘肃',
    '青海', '台湾', '内蒙古', '广西', '西藏', '宁夏', '新疆',
    '香港', '澳门'
  ]
  
  if (t.length <= 4 && chineseRegions.includes(t)) {
    return true
  }
  
  // 相对时间戳："3小时前"、"5分钟前"、"刚刚"、"昨天09:48"
  if (/^(刚刚|\d+\s*(秒|分钟|小时|天|周|月|年)前)$/.test(t)) {
    return true
  }
  if (/^(今天|昨天|前天)\d{2}:\d{2}$/.test(t)) {
    return true
  }
  
  // 日期时间格式："12-03 11:01"、"2024-12-03"
  if (/^\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(t)) {
    return true
  }
  if (/^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}(:\d{2})?)?$/.test(t)) {
    return true
  }
  
  // 视频时长："02:31"、"01:07:30"
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(t)) {
    return true
  }
  
  // 视频平台来源标签
  const videoPlatforms = [
    '好看视频', '西瓜视频', '抖音', '快手', '哔哩哔哩',
    'B站', '腾讯视频', '爱奇艺', '优酷', '搜狐视频',
    '视频大全', '高清在线观看', '在线观看'
  ]
  if (t.length <= 12 && videoPlatforms.some(kw => t === kw || t.includes(kw))) {
    return true
  }
  
  // 来源标识："来自iPhone客户端"、"来自微博APP"
  if (/^来自.*(客户端|APP|手机|网页版)$/i.test(t)) {
    return true
  }
  
  // 纯数字行（可能是页码、计数等）
  if (/^\d+$/.test(t) && t.length <= 4) {
    return true
  }
  
  return false
}

/**
 * 构建清洗后的文本
 * 
 * 流程：
 * 1. 基础空白规范化
 * 2. 按行拆分并规范化每行
 * 3. 根据网站类型决定是否过滤垃圾行
 * 4. 压缩多余空行
 * 5. 去除首尾多余换行
 */
function buildCleanText(
  rawText: string, 
  url: string,
  enableGarbageFilter?: boolean
): string {
  if (!rawText) return ""
  
  // 1. 基础规范化
  let text = normalizeWhitespace(rawText)
  
  // 2. 判断是否为对话站点
  const isChatPage = isChatSite(url)
  const shouldFilter = enableGarbageFilter !== undefined 
    ? enableGarbageFilter 
    : !isChatPage  // 默认：非对话站点启用过滤
  
  // 3. 按行拆分并规范化
  let lines = text.split("\n").map(normalizeLine)
  
  // 4. 垃圾行过滤（可选）
  if (shouldFilter) {
    // 非对话站点：删除垃圾行
    lines = lines.filter(line => !isGarbageLine(line))
  } else {
    // 对话站点：只过滤纯空行，保留所有有内容的行
    lines = lines.filter((line, idx, arr) => {
      // 保留空行用于段落分隔，只过滤极端连续空行的场景
      if (line === "") {
        // 如果前一行也是空行，则丢弃当前空行
        return idx === 0 || arr[idx - 1] !== ""
      }
      return true
    })
  }
  
  // 5. 再次压缩连续空行（防止过滤后产生多余空行）
  let result = lines.join("\n")
  result = result.replace(/\n{3,}/g, "\n\n")
  
  // 6. 去除开头和结尾的多余换行
  result = result.replace(/^\n+/, "").replace(/\n+$/, "")
  
  return result
}

/**
 * 后处理主函数
 * 
 * 在已有提取结果的基础上，对文本做纯字符串级别的清洗
 * 不影响任何 DOM 提取逻辑（handler / Readability / Fallback）
 * 
 * @param content - 原始提取内容（来自 handler / Readability / Fallback）
 * @param options - 后处理选项
 * @returns 清洗后的内容
 */
export function postProcessExtractedContent(
  content: ExtractedContent,
  options?: PostProcessOptions
): ExtractedContent {
  const originalText = content.text || ""
  
  // 如果原始文本为空，直接返回
  if (!originalText.trim()) {
    return content
  }
  
  // 执行字符串级清洗
  let cleanedText = buildCleanText(
    originalText, 
    content.url,
    options?.enableGarbageFilter
  )
  
  // 字符数量限制：超过 6w 字符时截断到 6w 字符
  const MAX_CHARS = 60000  // 6万字符
  const TRUNCATE_TO = 60000  // 截断到6万字符
  let isTruncated = false
  
  if (cleanedText.length > MAX_CHARS) {
    console.warn(`⚠️ 文本过长 (${cleanedText.length} 字符)，已截断到 ${TRUNCATE_TO} 字符`)
    cleanedText = cleanedText.slice(0, TRUNCATE_TO)
    isTruncated = true
    
    // 尝试在截断处找到合适的句子结尾，避免截断在句子中间
    const lastPeriod = Math.max(
      cleanedText.lastIndexOf('。'),
      cleanedText.lastIndexOf('！'),
      cleanedText.lastIndexOf('？'),
      cleanedText.lastIndexOf('.'),
      cleanedText.lastIndexOf('!'),
      cleanedText.lastIndexOf('?')
    )
    
    // 如果在最后 1000 字符内找到了句子结尾，就在那里截断
    if (lastPeriod > TRUNCATE_TO - 1000) {
      cleanedText = cleanedText.slice(0, lastPeriod + 1)
    }
    
    cleanedText += '\n\n[注：原文过长，已自动截断...]'
  }
  
  // 生成新的 snippet（清洗后的前 500 字符）
  const maxSnippetLength = 500
  const snippet = cleanedText.length > maxSnippetLength
    ? cleanedText.slice(0, maxSnippetLength) + "..."
    : cleanedText
  
  // 构建返回结果
  const result: ExtractedContent = {
    ...content,
    text: cleanedText,
    snippet: snippet
  }
  
  // 可选：保留原始文本用于调试
  if (options?.preserveOriginal) {
    (result as any).rawTextOriginal = originalText
  }
  
  // 记录清洗效果
  const reduction = originalText.length - cleanedText.length
  if (reduction > 0) {
    console.log(`📝 Post-process cleaned ${reduction} chars (${originalText.length} → ${cleanedText.length})`)
  }
  
  if (isTruncated) {
    console.log(`✂️ 文本已截断: ${originalText.length} → ${cleanedText.length} 字符`)
  }
  
  return result
}
