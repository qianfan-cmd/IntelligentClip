/**
 * SelectionClipper - 选中文字浮动剪藏按钮
 * 
 * 当用户选中文字时，在选中区域附近显示剪藏按钮
 * 采用完全隔离的内联样式，避免被宿主页面 CSS 污染
 */
import type { PlasmoCSConfig, PlasmoGetShadowHostId } from "plasmo"
import { useState, useEffect, useRef, type CSSProperties } from "react"
import { ClipStore } from "@/lib/clip-store"
import { Provider } from "jotai"
// 【修复】使用统一的 API 配置模块，解决跨页面不同步问题
import { useApiConfig } from "@/lib/api-config-store"
import { usePort } from "@plasmohq/messaging/hook"
import { useContentScriptI18n } from "@/lib/use-content-script-i18n"

// Plasmo 配置
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  exclude_matches: ["*://www.youtube.com/*"],
  all_frames: false
}

// 自定义 Shadow Host ID
export const getShadowHostId: PlasmoGetShadowHostId = () => "selection-clipper-host"

// 内联样式确保隔离
export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = `
    :host {
      all: initial !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    }
    
    *, *::before, *::after {
      box-sizing: border-box !important;
    }
    
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(8px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `
  return style
}

// 固定 z-index
const Z_INDEX = 2147483640

// 文本样式重置（不包含 all: unset，避免破坏布局）
const textStyle: CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: "14px",
  lineHeight: "1.5",
  boxSizing: "border-box",
  WebkitFontSmoothing: "antialiased",
  margin: 0,
  padding: 0,
}

// 图标组件
const Icons = {
  Scissors: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
      <line x1="20" y1="4" x2="8.12" y2="15.88"/>
      <line x1="14.47" y1="14.48" x2="20" y2="20"/>
      <line x1="8.12" y1="8.12" x2="12" y2="12"/>
    </svg>
  ),
  Sparkles: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
  ),
  Chat: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Save: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
    </svg>
  ),
  X: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Loader: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  ),
}

// 通知
function showNotification(message: string, type: "success" | "error" | "warning" = "success") {
  const colors = { success: "#10b981", error: "#ef4444", warning: "#f59e0b" }
  const el = document.createElement("div")
  el.textContent = message
  Object.assign(el.style, {
    position: "fixed", top: "20px", right: "20px",
    background: colors[type], color: "#fff",
    padding: "12px 20px", borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: String(Z_INDEX + 10),
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: "14px", fontWeight: "500",
  } as CSSProperties)
  document.body.appendChild(el)
  setTimeout(() => {
    el.style.opacity = "0"
    el.style.transition = "opacity 0.3s"
    setTimeout(() => el.remove(), 300)
  }, type === "error" ? 5000 : 3000)
}

function SelectionClipper() {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [selectedText, setSelectedText] = useState("")
  const [loading, setLoading] = useState(false)
  const [savingDirect, setSavingDirect] = useState(false)
  const { t } = useContentScriptI18n()
  const translateCurrentPage = t
  
  // 【修复】使用统一的 API 配置模块，包含加载状态
  const { apiKey: openAIKey, isLoading: isApiKeyLoading } = useApiConfig()
  const port = usePort("selection-completion")
  const isProcessingRef = useRef(false)
  const justShowedRef = useRef(false)
  const clickedRef = useRef(false)

  const checkContext = (): boolean => {
    try { return !!chrome.runtime?.id } catch { return false }
  }

  // 监听选中
  useEffect(() => {
    let timeout: NodeJS.Timeout

    const handleSelection = () => {
      if (expanded) return
      if (timeout) clearTimeout(timeout)
      
      timeout = setTimeout(() => {
        const selection = window.getSelection()
        const text = selection?.toString().trim()
        
        if (text && text.length > 10) {
          setSelectedText(text)
          try {
            const range = selection?.getRangeAt(0)
            const rect = range?.getBoundingClientRect()
            if (rect) {
              const scrollTop = window.pageYOffset || document.documentElement.scrollTop
              const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
              
              // 在选中区域上方居中显示
              setPosition({
                top: rect.top + scrollTop - 50,
                left: Math.max(10, Math.min(
                  rect.left + scrollLeft + rect.width / 2 - 60,
                  window.innerWidth - 140
                ))
              })
              setVisible(true)
              justShowedRef.current = true
              setTimeout(() => { justShowedRef.current = false }, 300)
            }
          } catch (e) {
            console.error("Selection error:", e)
          }
        } else if (!expanded && !clickedRef.current) {
          setVisible(false)
        }
      }, 150)
    }

    const handleClickOutside = () => {
      if (justShowedRef.current || clickedRef.current) {
        clickedRef.current = false
        return
      }
      if (!expanded) {
        setVisible(false)
      }
    }

    document.addEventListener("mouseup", handleSelection)
    document.addEventListener("keyup", handleSelection)
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside, false)
    }, 200)

    return () => {
      if (timeout) clearTimeout(timeout)
      document.removeEventListener("mouseup", handleSelection)
      document.removeEventListener("keyup", handleSelection)
      document.removeEventListener("click", handleClickOutside, false)
    }
  }, [expanded])

  // 监听 AI 响应
  useEffect(() => {
    if (!port.data || !isProcessingRef.current) return

    if (port.data.isEnd) {
      isProcessingRef.current = false
      const summary = port.data.message?.replace(/\nEND$/, "").replace(/END$/, "") || ""
      
      if (!checkContext()) {
        setLoading(false)
        setExpanded(false)
        setVisible(false)
        showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
        return
      }
      
      ClipStore.add({
        source: "webpage",
        url: window.location.href,
        title: document.title,
        rawTextSnippet: selectedText.slice(0, 500),
        rawTextFull: selectedText,
        summary,
        keyPoints: [],
        tags: []
      }).then(() => {
        setLoading(false)
        setExpanded(false)
        setVisible(false)
        showNotification("✅ 已保存并生成摘要！")
      }).catch((err) => {
        setLoading(false)
        showNotification("❌ 保存失败: " + err.message, "error")
      })
    } else if (port.data.error) {
      isProcessingRef.current = false
      setLoading(false)
      showNotification("❌ AI 处理失败", "error")
    }
  }, [port.data, selectedText])

  // 直接保存
  const handleSaveDirect = async () => {
    if (!checkContext()) {
      showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
      return
    }
    
    setSavingDirect(true)
    try {
      await ClipStore.add({
        source: "webpage",
        url: window.location.href,
        title: document.title,
        rawTextSnippet: selectedText.slice(0, 500),
        rawTextFull: selectedText,
        summary: selectedText.slice(0, 300) + (selectedText.length > 300 ? "..." : ""),
        keyPoints: [],
        tags: []
      })
      setSavingDirect(false)
      setExpanded(false)
      setVisible(false)
      showNotification("✅ 已保存选中内容！")
    } catch (err) {
      setSavingDirect(false)
      showNotification("❌ 保存失败", "error")
    }
  }

  // AI 摘要保存
  const handleSaveWithAI = () => {
    if (!checkContext()) {
      showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
      return
    }
    // 【修复】正确区分"加载中"和"真正未设置"
    if (isApiKeyLoading) {
      showNotification("⏳ 正在加载配置，请稍候重试", "warning")
      return
    }
    if (!openAIKey) {
      showNotification("⚠️ 请先设置 API Key", "warning")
      return
    }
    
    setLoading(true)
    isProcessingRef.current = true
    
    try {
      port.send({
        prompt: "请用中文对以下内容进行简洁总结（2-3句话），并提取3-5个要点。",
        model: "qwen3-max",
        context: {
          metadata: { title: document.title },
          text: selectedText,
          openAIKey
        }
      })
    } catch (err) {
      setLoading(false)
      isProcessingRef.current = false
      showNotification("❌ 发送失败", "error")
    }
  }

  const handleClose = () => {
    setExpanded(false)
    setVisible(false)
  }

  // 发送到侧边栏聊天窗口
  const handleSendToChat = () => {
    // 通过自定义事件将选中内容发送到 SidebarFloatPanel
    window.dispatchEvent(new CustomEvent('clip-send-to-chat', {
      detail: { text: selectedText }
    }))
    setExpanded(false)
    setVisible(false)
    showNotification("✨ 已发送到 AI 聊天窗口", "success")
  }

  if (!visible) return null

  // 样式定义
  const containerStyle: CSSProperties = {
    position: "absolute",
    top: `${position.top}px`,
    left: `${position.left}px`,
    zIndex: Z_INDEX,
    animation: "fadeInUp 0.2s ease-out",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  }

  const buttonStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    color: "#fff",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(99, 102, 241, 0.4)",
    border: "none",
    whiteSpace: "nowrap",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    margin: 0,
    outline: "none",
  }

  const panelStyle: CSSProperties = {
    width: "280px",
    padding: "16px",
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 8px 30px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)",
    color: "#1f2937",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: "14px",
    lineHeight: "1.5",
    boxSizing: "border-box",
  }

  const actionBtnStyle = (primary = false): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    padding: "10px 16px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "500",
    cursor: loading || savingDirect ? "not-allowed" : "pointer",
    border: "none",
    background: primary ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" : "#f3f4f6",
    color: primary ? "#fff" : "#374151",
    transition: "all 0.15s ease",
    opacity: loading || savingDirect ? 0.6 : 1,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    margin: 0,
    outline: "none",
    boxSizing: "border-box",
  })

  return (
    <div
      style={containerStyle}
      onMouseDown={(e) => { clickedRef.current = true; e.stopPropagation() }}
      onClick={(e) => { clickedRef.current = true; e.stopPropagation() }}
    >
      {!expanded ? (
        // 小按钮
        <button
          style={buttonStyle}
          onClick={() => setExpanded(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)"
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(99, 102, 241, 0.5)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)"
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.4)"
          }}
        >
          <Icons.Scissors />
          {/** <span>剪藏</span> */}
          <span>{translateCurrentPage("selectionClipperClip")}</span>
        </button>
      ) : (
        // 展开面板
        <div style={panelStyle}>
          {/* 头部 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "24px", 
                height: "24px",
                borderRadius: "6px",
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: "#fff",
                flexShrink: 0,
              }}>
                <Icons.Scissors />
              </div>
              {/* 保存选中内容 */}
              <span style={{ fontWeight: "600", fontSize: "14px", color: "#1f2937", margin: 0 }}>{translateCurrentPage("selectionClipperSaveSelected")}</span>
            </div>
            <button
              style={{ 
                padding: "4px", 
                borderRadius: "4px", 
                cursor: "pointer", 
                color: "#9ca3af", 
                background: "transparent", 
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                outline: "none",
              }}
              onClick={handleClose}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.color = "#6b7280" }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9ca3af" }}
            >
              <Icons.X />
            </button>
          </div>

          {/* 预览 */}
          <div style={{
            padding: "10px",
            background: "#f9fafb",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#6b7280",
            marginBottom: "12px",
            maxHeight: "80px",
            overflow: "hidden",
            lineHeight: "1.5",
            wordBreak: "break-word",
            boxSizing: "border-box",
          }}>
            "{selectedText.slice(0, 150)}{selectedText.length > 150 && "..."}"
          </div>

          {/* 操作按钮 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              style={actionBtnStyle(true)}
              disabled={loading || savingDirect}
              onClick={handleSaveWithAI}
              onMouseEnter={(e) => { if (!loading && !savingDirect) e.currentTarget.style.opacity = "0.9" }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = loading || savingDirect ? "0.6" : "1" }}
            >
              {loading ? <Icons.Loader /> : <Icons.Sparkles />}
              {/** <span>{loading ? "AI 生成中..." : "AI 摘要保存"}</span> */}
              <span>{loading ? translateCurrentPage("selectionClipperAIGenerating") : translateCurrentPage("selectionClipperAISummarySave")}</span>
            </button>
            
            <button
              style={{
                ...actionBtnStyle(false),
                background: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                color: "#fff",
              }}
              disabled={loading || savingDirect}
              onClick={handleSendToChat}
              onMouseEnter={(e) => { if (!loading && !savingDirect) e.currentTarget.style.opacity = "0.9" }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = loading || savingDirect ? "0.6" : "1" }}
            >
              <Icons.Chat />
              {/** 询问 AI */}
              <span>{translateCurrentPage("selectionClipperAskAI")}</span>
            </button>
            
            <button
              style={actionBtnStyle(false)}
              disabled={loading || savingDirect}
              onClick={handleSaveDirect}
              onMouseEnter={(e) => { if (!loading && !savingDirect) e.currentTarget.style.background = "#e5e7eb" }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#f3f4f6" }}
            >
              {savingDirect ? <Icons.Loader /> : <Icons.Save />}
              {/** <span>{savingDirect ? "保存中..." : "直接保存"}</span> */}
              <span>{savingDirect ? translateCurrentPage("selectionClipperSaving") : translateCurrentPage("selectionClipperSaveDirect")}</span>
            </button>
          </div>

          {/* 字数统计 */}
          <div style={{ marginTop: "10px", fontSize: "11px", color: "#9ca3af", textAlign: "center" }}>
            {/* 已选中 {selectedText.length} 个字符 */}
            <span>{translateCurrentPage("selectionClipperSelectedCharactersLeft")} {selectedText.length} {translateCurrentPage("selectionClipperSelectedCharactersRight")}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SelectionClipperContent() {
  return (
    <Provider>
      <SelectionClipper />
    </Provider>
  )
}
