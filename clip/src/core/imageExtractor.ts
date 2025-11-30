/**
 * 图片提取工具
 * 
 * 设计思路：
 * 
 * 【原有逻辑的问题】
 * 1. 过滤规则过于激进：大量正则黑名单（logo、icon、banner、avatar）导致正文图被误杀
 * 2. 空 alt 被错误排除：很多正常图片没有 alt 属性
 * 3. 选区和整页没有区分策略：用户选中的区域应该信任用户意图
 * 4. 基于容器 class 的过滤不可靠：内容图也可能在 share/social 容器里
 * 5. 只做减法（黑名单），不做加法（识别内容图特征）
 * 
 * 【新的设计】
 * 1. 选区剪藏（Selection）：几乎不过滤，信任用户的选区意图
 *    - 只排除极端垃圾（data URL、<=5px 像素图）
 *    - 不使用 alt/class/容器黑名单，避免误杀
 * 
 * 2. 整页剪藏（Full Page）：在主内容区域内打分选图
 *    - 先定位主内容容器（article/main 等）
 *    - 对候选图片计算 contentScore（面积、位置、文本邻域）
 *    - 按分数排序取 Top N，而非黑名单过滤
 */

import type { ClipImage } from "@/lib/clip-store"

/** 最大提取图片数量（整页） */
const MAX_IMAGES_FULL_PAGE = 20

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 将相对 URL 转换为绝对 URL
 */
function toAbsoluteUrl(src: string, baseUrl?: string): string {
  if (!src) return ""
  
  // 已经是绝对路径
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src
  }
  
  // data URL 直接返回空（我们不保存 base64）
  if (src.startsWith("data:")) {
    return ""
  }
  
  // 协议相对 URL
  if (src.startsWith("//")) {
    return `https:${src}`
  }
  
  // 相对路径转绝对路径
  try {
    const base = baseUrl || window.location.href
    return new URL(src, base).href
  } catch {
    return ""
  }
}

/**
 * 从 img 元素解析真实图片 src
 * 处理懒加载（data-src, data-lazy-src, srcset 等）
 */
function resolveImageSrc(img: HTMLImageElement): string {
  // 优先使用 data-src（懒加载常用）
  const dataSrc = img.getAttribute("data-src") || 
                  img.getAttribute("data-lazy-src") ||
                  img.getAttribute("data-original") ||
                  img.getAttribute("data-srcset")?.split(",")[0]?.trim()?.split(" ")[0]
  
  if (dataSrc) {
    return toAbsoluteUrl(dataSrc)
  }
  
  // 使用 srcset 的第一个图片
  const srcset = img.getAttribute("srcset")
  if (srcset) {
    const firstSrc = srcset.split(",")[0]?.trim()?.split(" ")[0]
    if (firstSrc && !firstSrc.startsWith("data:")) {
      return toAbsoluteUrl(firstSrc)
    }
  }
  
  // 最后使用 src
  const src = img.src || img.getAttribute("src")
  if (src) {
    return toAbsoluteUrl(src)
  }
  
  return ""
}

/**
 * 去重图片列表（基于 src）
 */
function deduplicateImages(images: ClipImage[]): ClipImage[] {
  const seen = new Set<string>()
  return images.filter(img => {
    if (seen.has(img.src)) {
      return false
    }
    seen.add(img.src)
    return true
  })
}

/**
 * 从 HTMLImageElement 创建 ClipImage 对象
 */
function imgToClipImage(img: HTMLImageElement): ClipImage {
  const src = resolveImageSrc(img)
  const width = img.naturalWidth || img.width || parseInt(img.getAttribute("width") || "0") || undefined
  const height = img.naturalHeight || img.height || parseInt(img.getAttribute("height") || "0") || undefined
  const alt = img.alt || img.getAttribute("title") || undefined
  
  return {
    src,
    alt: alt || undefined,
    width: width || undefined,
    height: height || undefined
  }
}

// ============================================================================
// 选区剪藏 - 极轻过滤
// ============================================================================

/**
 * 【选区专用】检查是否为极端垃圾图片（1x1 跟踪像素等）
 * 
 * 设计意图：选区模式下信任用户选择，只排除极端确定的垃圾：
 * - data URL（尤其是 gif，常见于 1x1 跟踪像素）
 * - 自然宽高都 <= 5 的微型像素图
 * 
 * 不排除：空 alt、带 icon/logo 的 class、在 social 容器里的图等
 */
function isTinyTrackingPixel(src: string, img: HTMLImageElement): boolean {
  // 排除 data URL
  if (src.startsWith("data:")) {
    return true
  }
  
  // 排除极小像素图（<=5px）
  const width = img.naturalWidth || img.width || 0
  const height = img.naturalHeight || img.height || 0
  if (width > 0 && height > 0 && width <= 5 && height <= 5) {
    return true
  }
  
  return false
}

/**
 * 从选中内容中提取图片
 * 
 * 【策略】几乎不过滤，信任用户的选区意图
 * - 用户已经框选了区域，里面的图大概率是他要的
 * - 只排除极端垃圾（data URL、<=5px 像素图）
 * - 不使用 alt/class/容器黑名单
 * 
 * @param selection - 当前选中内容
 * @returns 提取的图片列表
 */
export function extractImagesFromSelection(selection?: Selection | null): ClipImage[] {
  if (!selection || selection.rangeCount === 0) {
    return []
  }
  
  const images: ClipImage[] = []
  const processedSrcs = new Set<string>()
  
  try {
    const range = selection.getRangeAt(0)
    const ancestor = range.commonAncestorContainer
    
    // 获取祖先元素
    const ancestorElement = ancestor.nodeType === Node.ELEMENT_NODE 
      ? ancestor as Element 
      : ancestor.parentElement
    
    if (!ancestorElement) {
      return []
    }
    
    // 在祖先元素下查找所有图片
    const allImgs = ancestorElement.querySelectorAll("img")
    
    allImgs.forEach(img => {
      // 检查图片是否在选区内（部分包含也算）
      if (!selection.containsNode(img, true)) {
        return
      }
      
      const src = resolveImageSrc(img as HTMLImageElement)
      if (!src || processedSrcs.has(src)) {
        return
      }
      
      // 【极轻过滤】只排除极端垃圾
      if (isTinyTrackingPixel(src, img as HTMLImageElement)) {
        return
      }
      
      processedSrcs.add(src)
      images.push(imgToClipImage(img as HTMLImageElement))
    })
    
    // 检查选区起点/终点是否直接是图片
    const startNode = range.startContainer
    const endNode = range.endContainer
    
    if (startNode.nodeName === "IMG") {
      const img = startNode as HTMLImageElement
      const src = resolveImageSrc(img)
      if (src && !processedSrcs.has(src) && !isTinyTrackingPixel(src, img)) {
        processedSrcs.add(src)
        images.push(imgToClipImage(img))
      }
    }
    
    if (endNode !== startNode && endNode.nodeName === "IMG") {
      const img = endNode as HTMLImageElement
      const src = resolveImageSrc(img)
      if (src && !processedSrcs.has(src) && !isTinyTrackingPixel(src, img)) {
        processedSrcs.add(src)
        images.push(imgToClipImage(img))
      }
    }
    
  } catch (e) {
    console.error("❌ Error extracting images from selection:", e)
  }
  
  return deduplicateImages(images)
}

// ============================================================================
// 整页剪藏 - 打分模型
// ============================================================================

/** 整页模式：最小有效尺寸（单边） */
const MIN_IMAGE_SIZE_FULL_PAGE = 80

/** 整页模式：最小有效面积 */
const MIN_IMAGE_AREA_FULL_PAGE = 10000  // 100x100

/**
 * 【整页专用】检查是否应该排除此图片
 * 
 * 设计意图：在主内容区域内，排除明显不是正文配图的元素
 * - 跟踪像素、data URL
 * - 过小的图片（< 80px 或面积 < 10000）
 * - URL/class 中明确的功能性图标
 * - 装饰性图片（role=presentation, aria-hidden）
 */
function shouldExcludeInFullPage(src: string, img: HTMLImageElement): boolean {
  // 1. data URL 排除
  if (src.startsWith("data:")) {
    return true
  }
  
  // 2. URL 中明确的跟踪/广告标识
  const trackingPatterns = [
    /\/pixel[\/\.]/i,
    /\/tracking[\/\.]/i,
    /\/beacon[\/\.]/i,
    /\/analytics[\/\.]/i,
    /1x1\.(gif|png)/i,
    /spacer\.(gif|png)/i,
    /blank\.(gif|png)/i,
    /\/ad[s]?[\/\.\-_]/i,
    /doubleclick/i,
    /googlesyndication/i,
  ]
  if (trackingPatterns.some(p => p.test(src))) {
    return true
  }
  
  // 3. 尺寸检查
  const width = img.naturalWidth || img.width || 0
  const height = img.naturalHeight || img.height || 0
  
  // 极小图排除
  if (width > 0 && height > 0 && width <= 10 && height <= 10) {
    return true
  }
  
  // 单边过小排除（但允许未知尺寸的图片通过）
  if ((width > 0 && width < MIN_IMAGE_SIZE_FULL_PAGE) || 
      (height > 0 && height < MIN_IMAGE_SIZE_FULL_PAGE)) {
    return true
  }
  
  // 面积过小排除
  if (width > 0 && height > 0 && width * height < MIN_IMAGE_AREA_FULL_PAGE) {
    return true
  }
  
  // 4. 装饰性图片排除
  if (img.getAttribute("role") === "presentation" || 
      img.getAttribute("aria-hidden") === "true") {
    return true
  }
  
  // 5. URL 中的功能性图标模式
  const iconUrlPatterns = [
    /\/icon[s]?[\/\.\-_]/i,
    /\/emoji[s]?[\/\.\-_]/i,
    /\/avatar[s]?[\/\.\-_]/i,
    /\/badge[s]?[\/\.\-_]/i,
    /\/button[s]?[\/\.\-_]/i,
    /\/sprite[s]?[\/\.\-_]/i,
  ]
  if (iconUrlPatterns.some(p => p.test(src))) {
    return true
  }
  
  // 6. class 中的功能性标识（只检查明确的功能类）
  const className = img.className?.toString() || ""
  const iconClassPatterns = [
    /\bicon\b/i,
    /\bemoji\b/i,
    /\bavatar\b/i,
    /\bbadge\b/i,
    /\bspinner\b/i,
    /\bloading\b/i,
    /\bplaceholder\b/i,
  ]
  if (iconClassPatterns.some(p => p.test(className))) {
    return true
  }
  
  // 7. 检查是否在明显的非内容容器中
  const nonContentContainers = [
    "nav", "header", "footer", "aside",
  ]
  const parentTag = img.closest(nonContentContainers.join(","))
  if (parentTag) {
    // 在导航/页眉/页脚/侧边栏中，额外检查尺寸
    // 只有较大的图片才保留（可能是 logo 或重要配图）
    if (width > 0 && height > 0 && width * height < 40000) {
      return true
    }
  }
  
  return false
}

/** 整页模式：内容分数阈值（低于此分数的图片不保留） */
const MIN_CONTENT_SCORE = 2.5

/**
 * 计算图片的「内容分数」
 * 
 * 分数构成：
 * 1. 面积分（areaScore）：图片越大，越可能是正文配图
 * 2. 位置分（positionScore）：靠近页面顶部的图片更可能是重要内容
 * 3. 文本邻域分（textScore）：周围有较多文字的图片更可能是正文配图
 * 
 * @param img - 图片元素
 * @returns 内容分数（越高越可能是正文图片）
 */
function calculateContentScore(img: HTMLImageElement): number {
  let score = 0
  
  // 1. 面积分
  try {
    const rect = img.getBoundingClientRect()
    const area = rect.width * rect.height
    if (area > 0) {
      // 用对数避免大图占比太夸张，基础分 0-5
      score += Math.min(Math.log10(area + 1), 5)
    }
  } catch {
    // getBoundingClientRect 可能在某些情况下失败
    const width = img.naturalWidth || img.width || 0
    const height = img.naturalHeight || img.height || 0
    const area = width * height
    if (area > 0) {
      score += Math.min(Math.log10(area + 1), 5)
    }
  }
  
  // 2. 位置分
  try {
    const rect = img.getBoundingClientRect()
    const viewportHeight = window.innerHeight || 800
    const top = rect.top + window.scrollY
    
    // 顶部附近给高分，越往下分越低
    if (top < viewportHeight) {
      score += 1.5  // 首屏
    } else if (top < viewportHeight * 2) {
      score += 1.0  // 第二屏
    } else if (top < viewportHeight * 3) {
      score += 0.5  // 第三屏
    }
    // 超过 3 屏不加位置分
  } catch {
    // 忽略
  }
  
  // 3. 文本邻域分
  try {
    // 查找最近的父级容器
    let parent: Element | null = img.parentElement
    let depth = 0
    const maxDepth = 3
    
    while (parent && depth < maxDepth) {
      const tagName = parent.tagName.toLowerCase()
      // 找到 figure/p/div/section 等常见内容容器
      if (['figure', 'p', 'div', 'section', 'article'].includes(tagName)) {
        const textLength = (parent.textContent || "").trim().length
        if (textLength > 120) {
          score += 1.0  // 大量文字
        } else if (textLength > 30) {
          score += 0.5  // 有一些文字
        }
        break
      }
      parent = parent.parentElement
      depth++
    }
  } catch {
    // 忽略
  }
  
  // 4. 额外加分项
  // 有 alt 属性的图片稍微加分（但不因为没有 alt 而减分）
  if (img.alt && img.alt.length > 0) {
    score += 0.3
  }
  
  // 在 figure 标签内的图片加分
  if (img.closest("figure")) {
    score += 0.5
  }
  
  return score
}

/**
 * 定位主内容容器
 */
function findMainContentContainer(doc: Document): Element {
  // 按优先级查找主内容区域
  const selectors = [
    "article",
    "main",
    '[role="main"]',
    "#content",
    ".article-content",
    ".post-content",
    ".entry-content",
    ".content",
  ]
  
  for (const selector of selectors) {
    const element = doc.querySelector(selector)
    if (element) {
      return element
    }
  }
  
  return doc.body
}

/**
 * 从文档中提取图片
 * 
 * 【策略】在主内容区域内打分选图
 * 1. 先定位主内容容器（article/main 等）
 * 2. 收集候选图片，用极轻过滤排除明显垃圾
 * 3. 对每个候选计算 contentScore
 * 4. 按分数排序取 Top N
 * 
 * @param doc - 文档对象
 * @param container - 可选的容器元素（如 Readability 解析后的内容）
 * @param maxImages - 最大图片数量
 * @returns 提取的图片列表
 */
export function extractImagesFromDocument(
  doc?: Document,
  container?: Element | null,
  maxImages: number = MAX_IMAGES_FULL_PAGE
): ClipImage[] {
  const document = doc || window.document
  
  // 确定搜索容器
  const searchContainer = container || findMainContentContainer(document)
  
  // 收集候选图片并计算分数
  const candidates: Array<{ img: HTMLImageElement; score: number; clipImage: ClipImage }> = []
  
  try {
    const imgElements = searchContainer.querySelectorAll("img")
    
    for (const img of imgElements) {
      const htmlImg = img as HTMLImageElement
      const src = resolveImageSrc(htmlImg)
      
      // 跳过无效 src
      if (!src) continue
      
      // 【过滤】排除明显不是正文配图的元素
      if (shouldExcludeInFullPage(src, htmlImg)) {
        continue
      }
      
      // 计算内容分数
      const score = calculateContentScore(htmlImg)
      
      // 分数太低的不要
      if (score < MIN_CONTENT_SCORE) {
        continue
      }
      
      candidates.push({
        img: htmlImg,
        score,
        clipImage: imgToClipImage(htmlImg)
      })
    }
    
  } catch (e) {
    console.error("❌ Error extracting images from document:", e)
  }
  
  // 按分数降序排序
  candidates.sort((a, b) => b.score - a.score)
  
  // 取前 maxImages 个
  const topImages = candidates.slice(0, maxImages).map(c => c.clipImage)
  
  return deduplicateImages(topImages)
}

/**
 * 从 HTML 字符串中提取图片
 * 
 * 由于是离线 HTML，无法获取 getBoundingClientRect 等信息，
 * 采用简化的过滤策略：只排除明显垃圾，按出现顺序取图
 * 
 * @param html - HTML 字符串
 * @param baseUrl - 基础 URL（用于转换相对路径）
 * @param maxImages - 最大图片数量
 * @returns 提取的图片列表
 */
export function extractImagesFromHtml(
  html: string,
  baseUrl?: string,
  maxImages: number = MAX_IMAGES_FULL_PAGE
): ClipImage[] {
  const images: ClipImage[] = []
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")
    const imgElements = doc.querySelectorAll("img")
    
    for (const img of imgElements) {
      if (images.length >= maxImages) {
        break
      }
      
      // 解析 src
      let src = img.getAttribute("data-src") || 
                img.getAttribute("data-lazy-src") ||
                img.getAttribute("data-original") ||
                img.getAttribute("src") || ""
      
      src = toAbsoluteUrl(src, baseUrl)
      
      // 跳过无效或 data URL
      if (!src || src.startsWith("data:")) {
        continue
      }
      
      // 简单的跟踪像素检查
      const trackingPatterns = [/\/pixel[\/\.]/i, /\/tracking[\/\.]/i, /1x1\.(gif|png)/i]
      if (trackingPatterns.some(p => p.test(src))) {
        continue
      }
      
      const width = parseInt(img.getAttribute("width") || "0") || undefined
      const height = parseInt(img.getAttribute("height") || "0") || undefined
      const alt = img.getAttribute("alt") || img.getAttribute("title") || undefined
      
      images.push({
        src,
        alt: alt || undefined,
        width: width || undefined,
        height: height || undefined
      })
    }
    
  } catch (e) {
    console.error("❌ Error extracting images from HTML:", e)
  }
  
  return deduplicateImages(images)
}
