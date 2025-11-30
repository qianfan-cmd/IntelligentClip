import type { ClipImage } from "@/lib/clip-store"

/** 最大提取图片数量（整页） */
const MAX_IMAGES_FULL_PAGE = 20

/** 最小图片尺寸（过滤小图标） */
const MIN_IMAGE_SIZE = 50

/** 排除的图片模式（广告、跟踪等） */
const EXCLUDED_PATTERNS = [
  /^data:image\/gif/i,  // 1x1 跟踪像素
  /pixel\./i,
  /tracking\./i,
  /beacon\./i,
  /analytics\./i,
  /ad[sx]?\./i,
  /doubleclick/i,
  /googleadservices/i,
]

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
 * 检查图片是否应该被排除
 */
function shouldExcludeImage(src: string, img?: HTMLImageElement): boolean {
  if (!src) return true
  
  // 排除已知的广告/跟踪模式
  if (EXCLUDED_PATTERNS.some(pattern => pattern.test(src))) {
    return true
  }
  
  // 检查尺寸（如果有）
  if (img) {
    const width = img.naturalWidth || img.width || parseInt(img.getAttribute("width") || "0")
    const height = img.naturalHeight || img.height || parseInt(img.getAttribute("height") || "0")
    
    // 过滤太小的图片（可能是图标或跟踪像素）
    if ((width > 0 && width < MIN_IMAGE_SIZE) || (height > 0 && height < MIN_IMAGE_SIZE)) {
      return true
    }
  }
  
  return false
}

/**
 * 从 HTMLImageElement 创建 ClipImage
 */
function createClipImage(img: HTMLImageElement): ClipImage | null {
  const src = resolveImageSrc(img)
  
  if (shouldExcludeImage(src, img)) {
    return null
  }
  
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
 * 从选中内容中提取图片
 * @param selection - 当前选中内容
 * @returns 提取的图片列表
 */
export function extractImagesFromSelection(selection?: Selection | null): ClipImage[] {
  if (!selection || selection.rangeCount === 0) {
    return []
  }
  
  const images: ClipImage[] = []
  
  try {
    const range = selection.getRangeAt(0)
    const container = range.cloneContents()
    
    // 查找选中内容中的所有图片
    const imgElements = container.querySelectorAll("img")
    
    imgElements.forEach(img => {
      // cloneContents 创建的是文档片段，img 可能丢失 src
      // 需要从原始位置获取
      const clipImage = createClipImage(img as HTMLImageElement)
      if (clipImage) {
        images.push(clipImage)
      }
    })
    
    // 也检查选区是否直接在图片上
    const startContainer = range.startContainer
    const endContainer = range.endContainer
    
    if (startContainer.nodeName === "IMG") {
      const clipImage = createClipImage(startContainer as HTMLImageElement)
      if (clipImage) {
        images.push(clipImage)
      }
    }
    
    if (endContainer !== startContainer && endContainer.nodeName === "IMG") {
      const clipImage = createClipImage(endContainer as HTMLImageElement)
      if (clipImage) {
        images.push(clipImage)
      }
    }
    
    // 检查选区范围内的所有图片（通过遍历 DOM）
    const ancestor = range.commonAncestorContainer
    if (ancestor.nodeType === Node.ELEMENT_NODE) {
      const allImgs = (ancestor as Element).querySelectorAll("img")
      allImgs.forEach(img => {
        if (selection.containsNode(img, true)) {
          const clipImage = createClipImage(img as HTMLImageElement)
          if (clipImage) {
            images.push(clipImage)
          }
        }
      })
    }
    
  } catch (e) {
    console.error("❌ Error extracting images from selection:", e)
  }
  
  return deduplicateImages(images)
}

/**
 * 从文档中提取图片
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
  const images: ClipImage[] = []
  
  // 优先使用提供的容器，否则尝试找到主内容区域
  let searchContainer: Element = container || document.body
  
  if (!container) {
    // 尝试找到主内容区域
    const mainContent = document.querySelector("article") ||
                        document.querySelector("main") ||
                        document.querySelector(".article-content") ||
                        document.querySelector(".post-content") ||
                        document.querySelector(".entry-content") ||
                        document.querySelector('[role="main"]') ||
                        document.querySelector("#content") ||
                        document.querySelector(".content")
    
    if (mainContent) {
      searchContainer = mainContent
    }
  }
  
  try {
    const imgElements = searchContainer.querySelectorAll("img")
    
    for (const img of imgElements) {
      if (images.length >= maxImages) {
        break
      }
      
      const clipImage = createClipImage(img as HTMLImageElement)
      if (clipImage) {
        images.push(clipImage)
      }
    }
    
  } catch (e) {
    console.error("❌ Error extracting images from document:", e)
  }
  
  return deduplicateImages(images)
}

/**
 * 从 HTML 字符串中提取图片
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
      
      // 手动解析 src 因为 DOMParser 创建的元素没有完整的 DOM 属性
      let src = img.getAttribute("data-src") || 
                img.getAttribute("data-lazy-src") ||
                img.getAttribute("data-original") ||
                img.getAttribute("src") || ""
      
      src = toAbsoluteUrl(src, baseUrl)
      
      if (shouldExcludeImage(src)) {
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
