/**
 * 内容提取层入口
 */

// 类型导出
export type { 
  ExtractedContent, 
  ContentMetadata, 
  SiteHandler, 
  SiteHandlerConfig 
} from "./types"

// 后处理相关导出
export type { PostProcessOptions } from "./post-process"
export { postProcessExtractedContent } from "./post-process"

// 主函数导出
export { 
  extractContent, 
  extractContentSync, 
  extractSelectedContent,
  detectSourceType 
} from "./contentExtractor"

// 图片提取导出
export {
  extractImagesFromSelection,
  extractImagesFromDocument,
  extractImagesFromHtml
} from "./imageExtractor"

// 提取器导出（如需单独使用）
export { extractByReadability } from "./extractors/readability"
export { extractByFallback } from "./extractors/fallback"

// Handler 导出（如需单独使用）
export { youtubeHandler } from "./handlers/youtube"
export { bilibiliHandler } from "./handlers/bilibili"
export { baikeHandler } from "./handlers/baike"
export { docsHandler, isDocsPage } from "./handlers/docs"
