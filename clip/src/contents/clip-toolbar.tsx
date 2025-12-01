/**
 * ClipToolbar - 网页剪藏浮动工具栏
 * 
 * 采用完全隔离的样式方案：
 * 1. 使用 Plasmo 的 Shadow DOM 自动隔离
 * 2. 所有样式使用 px 单位（避免 rem 继承问题）
 * 3. 显式重置所有可继承属性
 * 4. 内联关键样式确保不被覆盖
 */
import type { PlasmoCSConfig, PlasmoGetShadowHostId } from "plasmo"
import { useState, useEffect, useRef, type CSSProperties } from "react"
import { ClipStore } from "@/lib/clip-store"
import { extractContent, extractSelectedContent } from "@/core/index"
import type { ExtractedContent } from "@/core/types"
import { Provider, useAtomValue } from "jotai"
import { openAIKeyAtom } from "@/lib/atoms/openai"
import { usePort } from "@plasmohq/messaging/hook"

// Plasmo 配置
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  exclude_matches: ["*://www.youtube.com/*"],
  all_frames: false
}

// 自定义 Shadow Host ID
export const getShadowHostId: PlasmoGetShadowHostId = () => "clip-toolbar-host"

// 使用内联样式而非外部 CSS，确保完全隔离
export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = `
    /* 重置所有样式，防止继承 */
    :host {
      all: initial !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      font-size: 14px !important;
      line-height: 1.5 !important;
      color: #1f2937 !important;
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
    }
    
    *, *::before, *::after {
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      font: inherit !important;
      vertical-align: baseline !important;
    }
    
    /* 动画 */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    .animate-fade-in {
      animation: fadeIn 0.2s ease-out;
    }
    
    .animate-spin {
      animation: spin 1s linear infinite;
    }
  `
  return style
}

// 固定的 z-index 常量
const Z_INDEX = 2147483640

// 基础样式重置（内联样式，确保优先级最高）
const baseReset: CSSProperties = {
  all: "unset",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: "14px",
  lineHeight: "1.5",
  color: "#1f2937",
  boxSizing: "border-box",
  WebkitFontSmoothing: "antialiased",
}

// 图标组件（内联 SVG，避免外部依赖）
const Icons = {
  Scissors: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3"/>
      <circle cx="6" cy="18" r="3"/>
      <line x1="20" y1="4" x2="8.12" y2="15.88"/>
      <line x1="14.47" y1="14.48" x2="20" y2="20"/>
      <line x1="8.12" y1="8.12" x2="12" y2="12"/>
    </svg>
  ),
  FileText: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Sparkles: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
    </svg>
  ),
  History: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M12 7v5l4 2"/>
    </svg>
  ),
  ChevronUp: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Loader: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
  X: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Check: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
}

// 通知组件
function showNotification(message: string, type: "success" | "error" | "warning" = "success") {
  const colors = {
    success: { bg: "#10b981", text: "#ffffff" },
    error: { bg: "#ef4444", text: "#ffffff" },
    warning: { bg: "#f59e0b", text: "#ffffff" },
  }
  
  const notification = document.createElement("div")
  notification.textContent = message
  Object.assign(notification.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    background: colors[type].bg,
    color: colors[type].text,
    padding: "12px 20px",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: String(Z_INDEX + 10),
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: "14px",
    fontWeight: "500",
    animation: "fadeIn 0.3s ease-out",
  } as CSSProperties)
  
  document.body.appendChild(notification)
  setTimeout(() => {
    notification.style.opacity = "0"
    notification.style.transition = "opacity 0.3s"
    setTimeout(() => notification.remove(), 300)
  }, type === "error" ? 5000 : 3000)
}

// 主工具栏组件
function ClipToolbar() {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingType, setLoadingType] = useState<"full" | "selection" | "direct-full" | "direct-selection" | null>(null)
  
  const openAIKey = useAtomValue(openAIKeyAtom)
  const port = usePort("page-completion")
  const extractedContentRef = useRef<ExtractedContent | null>(null)
  const requestTypeRef = useRef<"full" | "selection" | null>(null)

  // 检查扩展上下文
  const checkContext = (): boolean => {
    try {
      return !!chrome.runtime?.id
    } catch {
      return false
    }
  }

  // 剪藏整页
   const handleClipFullPage = async () => {
    if (!checkContext()) {
      showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
      return
    }
    
    if (!openAIKey) {
      showNotification("⚠️ 请先在设置中配置 API Key", "warning")
      return
    }

    setLoading(true)
    setLoadingType("full")
    requestTypeRef.current = "full"
    
    try {
      const content = await extractContent()
      extractedContentRef.current = content
      
      port.send({
        prompt: "请用中文对以下内容进行简洁总结，并列出3-5个要点。",
        model: "qwen3-max",
        context: {
          metadata: { title: content.title, ...content.metadata },
          text: content.text,
          openAIKey
        }
      })
    } catch (e) {
      console.error("❌ Clip error:", e)
      setLoading(false)
      setLoadingType(null)
      showNotification("❌ 剪藏失败", "error")
    }
  }

  // 剪藏选中内容（AI摘要）
  const handleClipSelection = async () => {
    const selection = window.getSelection()
    const selectedText = selection?.toString().trim()
    
    if (!selectedText || selectedText.length < 10) {
      showNotification("⚠️ 请先选中一些文字（至少10个字符）", "warning")
      return
    }
    
    if (!checkContext()) {
      showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
      return
    }
    
    if (!openAIKey) {
      showNotification("⚠️ 请先在设置中配置 API Key", "warning")
      return
    }

    setLoading(true)
    setLoadingType("selection")
    requestTypeRef.current = "selection"
    
    try {
      // 使用 extractSelectedContent 获取选中内容（包含图片）
      const selectedContent = extractSelectedContent()
      
      extractedContentRef.current = {
        title: document.title,
        text: selectedText,
        html: selectedText,
        snippet: selectedText.slice(0, 500),
        url: window.location.href,
        metadata: {},
        images: selectedContent?.images || []
      }
      
      port.send({
        prompt: "请用中文对以下内容进行简洁总结。",
        model: "qwen3-max",
        context: {
          metadata: { title: document.title },
          text: selectedText,
          openAIKey
        }
      })
    } catch (e) {
      console.error("❌ Clip error:", e)
      setLoading(false)
      setLoadingType(null)
      showNotification("❌ 剪藏失败", "error")
    }
  }

  // 直接保存整页（不使用AI）
  const handleDirectSaveFullPage = async () => {
    if (!checkContext()) {
      showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
      return
    }

    setLoading(true)
    setLoadingType("direct-full")
    
    try {
      const content = await extractContent()
      
      await ClipStore.add({
        source: content?.metadata?.platform === "Bilibili" ? "bilibili" : 
               content?.metadata?.platform === "YouTube" ? "youtube" : "webpage",
        url: content?.url || window.location.href,
        title: content?.title || document.title,
        rawTextSnippet: content?.snippet || "",
        rawTextFull: content?.text || "",
        summary: "",  // 无AI摘要
        keyPoints: [],
        tags: [],
        meta: content?.metadata,
        images: content?.images  // 保存提取的图片
      })
      
      setLoading(false)
      setLoadingType(null)
      const imgCount = content?.images?.length || 0
      showNotification(`✅ 已直接保存整页！${imgCount > 0 ? `（含${imgCount}张图片）` : ""}`, "success")
    } catch (e) {
      console.error("❌ Direct save error:", e)
      setLoading(false)
      setLoadingType(null)
      showNotification("❌ 保存失败", "error")
    }
  }

  // 直接保存选中内容（不使用AI）
  const handleDirectSaveSelection = async () => {
    const selection = window.getSelection()
    const selectedText = selection?.toString().trim()
    
    if (!selectedText || selectedText.length < 10) {
      showNotification("⚠️ 请先选中一些文字（至少10个字符）", "warning")
      return
    }
    
    if (!checkContext()) {
      showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
      return
    }

    setLoading(true)
    setLoadingType("direct-selection")
    
    try {
      // 提取选中内容中的图片
      const selectedContent = extractSelectedContent()
      const images = selectedContent?.images || []
      
      await ClipStore.add({
        source: "webpage",
        url: window.location.href,
        title: document.title,
        rawTextSnippet: selectedText.slice(0, 500),
        rawTextFull: selectedText,
        summary: "",  // 无AI摘要
        keyPoints: [],
        tags: [],
        meta: {},
        images  // 保存选中内容中的图片
      })
      
      setLoading(false)
      setLoadingType(null)
      const imgCount = images.length
      showNotification(`✅ 已直接保存选中内容！${imgCount > 0 ? `（含${imgCount}张图片）` : ""}`, "success")
    } catch (e) {
      console.error("❌ Direct save error:", e)
      setLoading(false)
      setLoadingType(null)
      showNotification("❌ 保存失败", "error")
    }
  }

  // 打开历史页面
  const openHistory = () => {
    chrome.runtime.sendMessage({ action: "openHistory" }, (response) => {
      if (chrome.runtime.lastError) {
        try {
          chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") })
        } catch (e) {
          showNotification("❌ 无法打开历史记录", "error")
        }
      }
    })
  }

  // 监听 LLM 响应
  useEffect(() => {
    if (!port.data || !requestTypeRef.current) return

    if (port.data.isEnd) {
      const summary = port.data.message?.replace(/\nEND$/, "").replace(/END$/, "") || ""
      const content = extractedContentRef.current
      
      if (!checkContext()) {
        setLoading(false)
        setLoadingType(null)
        showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
        return
      }
      
      ClipStore.add({
        source: content?.metadata?.platform === "Bilibili" ? "bilibili" : 
               content?.metadata?.platform === "YouTube" ? "youtube" : "webpage",
        url: content?.url || window.location.href,
        title: content?.title || document.title,
        rawTextSnippet: content?.snippet || "",
        rawTextFull: content?.text || "",
        summary: summary,
        keyPoints: [],
        tags: [],
        meta: content?.metadata,
        images: content?.images  // 保存提取的图片
      }).then(() => {
        setLoading(false)
        setLoadingType(null)
        requestTypeRef.current = null
        const imgCount = content?.images?.length || 0
        showNotification(`✅ 剪藏成功！${imgCount > 0 ? `（含${imgCount}张图片）` : ""}`, "success")
      }).catch((err) => {
        setLoading(false)
        setLoadingType(null)
        showNotification("❌ 保存失败: " + err.message, "error")
      })
    } else if (port.data.error) {
      setLoading(false)
      setLoadingType(null)
      showNotification("❌ AI 处理失败", "error")
    }
  }, [port.data])

  // 容器样式
  const containerStyle: CSSProperties = {
    ...baseReset,
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: Z_INDEX,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "8px",
  }

  // 卡片样式
  const cardStyle: CSSProperties = {
    ...baseReset,
    background: "#ffffff",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)",
    padding: expanded ? "16px" : "0",
    width: expanded ? "220px" : "auto",
    animation: "fadeIn 0.2s ease-out",
    overflow: "hidden",
  }

  // 按钮基础样式
  const buttonBaseStyle: CSSProperties = {
    ...baseReset,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px 16px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.15s ease",
    width: "100%",
    whiteSpace: "nowrap",
  }

  // 主按钮样式（收起状态）
  const mainButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    color: "#ffffff",
    padding: "12px 16px",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(99, 102, 241, 0.4)",
  }

  // 操作按钮样式
  const actionButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    background: "#f3f4f6",
    color: "#374151",
  }

  // 主要操作按钮样式
  const primaryButtonStyle: CSSProperties = {
    ...buttonBaseStyle,
    background: "#4f46e5",
    color: "#ffffff",
  }

  if (!expanded) {
    // 收起状态 - 显示一个小圆按钮
    return (
      <div style={containerStyle}>
        <button
          style={mainButtonStyle}
          onClick={() => setExpanded(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.02)"
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(99, 102, 241, 0.5)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)"
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.4)"
          }}
        >
          <Icons.Scissors />
          <span>剪藏工具</span>
        </button>
      </div>
    )
  }

  // 展开状态 - 显示完整工具栏
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* 标题栏 */}
        <div style={{
          ...baseReset,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
          paddingBottom: "12px",
          borderBottom: "1px solid #e5e7eb",
        }}>
          <div style={{
            ...baseReset,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <div style={{
              ...baseReset,
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
            }}>
              <Icons.Scissors />
            </div>
            <span style={{ ...baseReset, fontWeight: "600", color: "#111827" }}>
              剪藏工具
            </span>
          </div>
          <button
            style={{
              ...baseReset,
              padding: "4px",
              borderRadius: "4px",
              cursor: "pointer",
              color: "#9ca3af",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={() => setExpanded(false)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f3f4f6"
              e.currentTarget.style.color = "#6b7280"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent"
              e.currentTarget.style.color = "#9ca3af"
            }}
          >
            <Icons.ChevronDown />
          </button>
        </div>

        {/* 操作按钮 */}
        <div style={{ ...baseReset, display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* 分组标题：整页 */}
          <div style={{ ...baseReset, fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
            整页剪藏
          </div>
          
          {/* 整页 + AI 摘要 */}
          <button
            style={primaryButtonStyle}
            disabled={loading}
            onClick={handleClipFullPage}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.background = "#4338ca"
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.background = "#4f46e5"
            }}
          >
            {loadingType === "full" ? <Icons.Loader /> : <Icons.Sparkles />}
            <span>{loadingType === "full" ? "AI处理中..." : "AI 摘要保存"}</span>
          </button>

          {/* 整页直接保存 */}
          <button
            style={actionButtonStyle}
            disabled={loading}
            onClick={handleDirectSaveFullPage}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.background = "#e5e7eb"
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.background = "#f3f4f6"
            }}
          >
            {loadingType === "direct-full" ? <Icons.Loader /> : <Icons.FileText />}
            <span>{loadingType === "direct-full" ? "保存中..." : "直接保存"}</span>
          </button>

          {/* 分隔线 */}
          <div style={{ ...baseReset, height: "1px", background: "#e5e7eb", margin: "8px 0" }} />
          
          {/* 分组标题：选中 */}
          <div style={{ ...baseReset, fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
            选中内容
          </div>

          {/* 选中 + AI 摘要 */}
          <button
            style={{
              ...actionButtonStyle,
              background: "#eef2ff",
              color: "#4f46e5",
            }}
            disabled={loading}
            onClick={handleClipSelection}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.background = "#e0e7ff"
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.background = "#eef2ff"
            }}
          >
            {loadingType === "selection" ? <Icons.Loader /> : <Icons.Sparkles />}
            <span>{loadingType === "selection" ? "AI处理中..." : "AI 摘要保存"}</span>
          </button>

          {/* 选中直接保存 */}
          <button
            style={actionButtonStyle}
            disabled={loading}
            onClick={handleDirectSaveSelection}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.background = "#e5e7eb"
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.background = "#f3f4f6"
            }}
          >
            {loadingType === "direct-selection" ? <Icons.Loader /> : <Icons.FileText />}
            <span>{loadingType === "direct-selection" ? "保存中..." : "直接保存"}</span>
          </button>

          {/* 分隔线 */}
          <div style={{ ...baseReset, height: "1px", background: "#e5e7eb", margin: "8px 0" }} />

          {/* 查看历史 */}
          <button
            style={{
              ...actionButtonStyle,
              background: "transparent",
              color: "#6b7280",
            }}
            onClick={openHistory}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f9fafb"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent"
            }}
          >
            <Icons.History />
            <span>查看历史</span>
          </button>
        </div>

        {/* 底部提示 */}
        {loading && (
          <div style={{
            ...baseReset,
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid #e5e7eb",
            fontSize: "12px",
            color: "#9ca3af",
            textAlign: "center",
          }}>
            AI 正在生成摘要...
          </div>
        )}
      </div>
    </div>
  )
}

// 导出组件
export default function ClipToolbarContent() {
  return (
    <Provider>
      <ClipToolbar />
    </Provider>
  )
}
