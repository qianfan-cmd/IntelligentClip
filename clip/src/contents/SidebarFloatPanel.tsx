// @ts-ignore
import Markdown from "@/components/markdown"
import { YouTubePanel } from "@/components/floating-dock/panels/youtube-panel"
import { FeedbackPage } from "@/components/FeedbackPage"
import FirstUseWelcomePage from "@/components/FirstUseWelcomePage"
import { extractContent } from "@/core/index"
// 【修复】使用统一的 API 配置模块，解决跨页面不同步问题
import { useApiConfig } from "@/lib/api-config-store"
import { ClipStore, type Clip } from "@/lib/clip-store"
import { models, type Message, type Model } from "@/lib/constants"
import cssText from "data-text:~style.css"
import type { PlasmoGetShadowHostId } from "plasmo"
import React, {
  Component,
  ErrorInfo,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react"
import { AiFillAliwangwang } from "react-icons/ai"
import { BsYoutube } from "react-icons/bs"
import {
  FiCheck,
  FiCrop,
  FiGrid,
  FiHelpCircle,
  FiMessageSquare,
  FiMoon,
  FiRefreshCcw,
  FiSave,
  FiSend,
  FiSettings,
  FiSun,
  FiTrash2,
  FiX
} from "react-icons/fi"
import { RiMagicLine, RiMessage2Line, RiRobot2Line } from "react-icons/ri"
import { VscFileCode } from "react-icons/vsc"

import { usePort } from "@plasmohq/messaging/hook"

import { Button } from "../components"

export const config = {
  matches: ["<all_urls>"]
}

export const getShadowHostId: PlasmoGetShadowHostId = () => "plasmo-inline"

export const getStyle = () => {
  // 1. 预处理 Tailwind CSS：将 rem 转换为 px
  // 即使 YouTube 根字体是 10px，我们将 1rem 强转为 16px，保证 UI 大小恒定
  const baseFontSize = 16
  const updatedCssText = cssText.replace(/([\d.]+)rem/g, (match, remValue) => {
    const pixels = parseFloat(remValue) * baseFontSize
    return `${pixels}px`
  })

  const style = document.createElement("style")

  // 2. 修复后的 CSS Reset (去除了非法空格)
  const fixStyles = `
    /* 针对 Shadow Host 本身的重置 */
    :host(#plasmo-inline) {
      all: initial;
      position: fixed !important;
      z-index: 2147483647 !important;
      top: 0 !important;
      left: 0 !important;
      width: 0 !important;
      height: 0 !important;
      
      /* 锁死基准字号 (配合上面的 rem->px 转换双重保险) */
      font-size: 16px !important;
      line-height: 1.5 !important;
    }

    /* 针对组件最外层容器的重置 */
    #plasmo-float-root {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
16px 或 100vw
      pointer-events: none; /* 容器透传点击 */
      overflow: visible;
    }
    
    #plasmo-float-root > * {
      pointer-events: auto; /* 内部内容恢复点击 */
    }

    /* 暴力重置盒模型 */
    #plasmo-float-root *,
    #plasmo-float-root *::before,
    #plasmo-float-root *::after {
      box-sizing: border-box !important;
    }
  `

  style.textContent = `${updatedCssText}\n${fixStyles}`
  return style
}

// [BUG FIX] 添加 Error Boundary 组件，防止子组件错误导致整个浮窗崩溃
interface ErrorBoundaryProps {
  children: ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class PanelErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.error("[ClipPlugin] Error Boundary caught error:", error)
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ClipPlugin] Error details:", error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <p className="text-red-500 font-medium mb-2">出现了一些问题</p>
          <p className="text-slate-500 text-sm mb-4">
            {this.state.error?.message || "未知错误"}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function PanelContent({
  onClose,
  onRefresh,
  initialChatText
}: {
  onClose: () => void
  onRefresh: () => void
  initialChatText?: string
}) {
  const [title, setTitle] = useState("Clip")
  const [searchValue, setSearchValue] = useState("")
  const [clips, setClips] = useState<Clip[]>([])
  const [notification, setNotification] = useState<{
    message: string
    type: "success" | "error"
  } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // 检测当前是否为 YouTube 页面
  const isYouTubePage = window.location.hostname.includes("youtube.com")

  // Panel mode: "clips" | "chat" | "youtube" - 如果有初始文本则默认显示聊天模式
  const [panelMode, setPanelMode] = useState<"clips" | "chat" | "youtube">(
    initialChatText ? "chat" : "clips"
  )
  const [isScreenshotMode, setIsScreenshotMode] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)

  // Theme & Drag state
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    chrome.storage.local.get("clip_darkMode", (res) => {
      if (res.clip_darkMode !== undefined) {
        setIsDarkMode(res.clip_darkMode)
      }
    })
  }, [])

  const toggleTheme = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    chrome.storage.local.set({ clip_darkMode: newMode })
  }

  // Chat state
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState(initialChatText || "")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isError, setIsError] = useState(false)
  const [selectedModel, setSelectedModel] = useState<Model>(models[0])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 【修复】使用统一的 API 配置模块，包含加载状态
  const {
    apiKey: openAIKey,
    isLoading: isApiKeyLoading,
    hasApiKey
  } = useApiConfig()

  // Port for chat
  const port = usePort("chat")

  // 过滤 AI 返回内容中的 clip_tags 和 END 标记
  // [BUG FIX] 增加类型检查，防止非字符串输入导致崩溃
  const cleanAIResponse = (content: string): string => {
    try {
      if (!content || typeof content !== "string") return content || ""
      // 移除 <clip_tags>...</clip_tags> 标签及其内容
      let cleaned = content.replace(/<clip_tags>[\s\S]*?<\/clip_tags>/gi, "")
      // 移除结尾的 END 标记
      cleaned = cleaned.replace(/\s*END\s*$/g, "")
      // 移除多余的空行
      cleaned = cleaned.replace(/\n{3,}/g, "\n\n")
      return cleaned.trim()
    } catch (e) {
      console.error("[ClipPlugin] cleanAIResponse error:", e)
      return content || ""
    }
  }

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  // 如果有初始文本，聚焦输入框
  useEffect(() => {
    if (initialChatText) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [initialChatText])

  // Handle port messages
  useEffect(() => {
    if (!port.data) return

    if (port.data?.message !== undefined && port.data?.message !== null) {
      if (port.data.isEnd === true) {
        // Message complete
        if (port.data.message && port.data.message !== "END") {
          setChatMessages((prev) => {
            const newMessages = [...prev]
            if (
              newMessages.length > 0 &&
              newMessages[newMessages.length - 1].role === "assistant"
            ) {
              // 过滤掉 clip_tags 和 END 标记
              newMessages[newMessages.length - 1].content = cleanAIResponse(
                port.data.message
              )
            }
            return newMessages
          })
        }
        setIsGenerating(false)
      } else {
        // Streaming message - 实时过滤显示
        setChatMessages((prev) => {
          const newMessages = [...prev]
          if (
            newMessages.length > 0 &&
            newMessages[newMessages.length - 1].role === "assistant"
          ) {
            newMessages[newMessages.length - 1].content = cleanAIResponse(
              port.data.message
            )
          }
          return newMessages
        })
      }
    }
  }, [port.data?.message, port.data?.isEnd])

  // Handle port errors
  useEffect(() => {
    if (!port.data) return

    if (
      port.data?.error !== undefined &&
      port.data?.error !== null &&
      port.data?.error !== ""
    ) {
      setIsError(true)
      setIsGenerating(false)
      setChatMessages((prev) => {
        const newMessages = [...prev]
        if (
          newMessages.length > 0 &&
          newMessages[newMessages.length - 1].role === "assistant"
        ) {
          newMessages[newMessages.length - 1].content =
            `❌ 错误: ${port.data.error}`
        }
        return newMessages
      })
    }
  }, [port.data?.error])

  // Get current page context
  const getPageContext = useCallback(() => {
    return {
      openAIKey,
      metadata: {
        title: document.title || "未知页面"
      },
      clipMode: true,
      summary: "",
      rawText: ""
    }
  }, [openAIKey])

  // Send message
  // [BUG FIX] 增加完整的 try/catch 保护，防止发送消息时异常导致浮窗崩溃
  const handleSendMessage = async (
    e?: React.MouseEvent | React.KeyboardEvent
  ) => {
    // [BUG FIX] 阻止事件冒泡和默认行为，防止触发父元素的点击事件（可能关闭面板）
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    try {
      const trimmedInput = inputValue?.trim() || ""
      if (!trimmedInput || isGenerating) {
        console.log(
          "[ClipPlugin] Send blocked: empty input or already generating"
        )
        return
      }

      console.log(
        "[ClipPlugin] Sending message:",
        trimmedInput.slice(0, 50) + "..."
      )

      // 【修复】正确区分"加载中"和"真正未设置"
      if (isApiKeyLoading) {
        setChatMessages((prev) => [
          ...prev,
          { role: "user", content: trimmedInput },
          { role: "assistant", content: "⏳ 正在加载 API 配置，请稍候..." }
        ])
        setInputValue("")
        return
      }

      if (!openAIKey || openAIKey.trim() === "") {
        setChatMessages((prev) => [
          ...prev,
          { role: "user", content: trimmedInput },
          {
            role: "assistant",
            content: "❌ API 密钥未设置，请在扩展设置中添加您的 API 密钥。"
          }
        ])
        setInputValue("")
        return
      }

      const userMessage: Message = { role: "user", content: trimmedInput }
      const newMessages = [
        ...chatMessages,
        userMessage,
        { role: "assistant", content: "" }
      ]
      setChatMessages(newMessages)
      setInputValue("")
      setIsGenerating(true)
      setIsError(false)

      // [BUG FIX] 延迟聚焦，确保状态更新完成
      setTimeout(() => {
        try {
          inputRef.current?.focus()
        } catch (focusErr) {
          console.warn("[ClipPlugin] Focus error (non-critical):", focusErr)
        }
      }, 0)

      // [BUG FIX] 安全获取页面上下文
      let context
      try {
        context = getPageContext()
      } catch (contextErr) {
        console.error("[ClipPlugin] getPageContext error:", contextErr)
        context = {
          openAIKey,
          metadata: { title: "未知页面" },
          clipMode: true,
          summary: "",
          rawText: ""
        }
      }

      // [BUG FIX] 包裹 port.send 调用，捕获可能的序列化/通信错误
      try {
        port.send({
          model: selectedModel?.content || models[0].content,
          messages: newMessages.slice(0, -1),
          context
        })
        console.log("[ClipPlugin] Message sent successfully")
      } catch (sendErr) {
        console.error("[ClipPlugin] port.send error:", sendErr)
        setIsGenerating(false)
        setIsError(true)
        setChatMessages((prev) => {
          const newMsgs = [...prev]
          if (
            newMsgs.length > 0 &&
            newMsgs[newMsgs.length - 1].role === "assistant"
          ) {
            newMsgs[newMsgs.length - 1].content =
              `❌ 发送失败: ${sendErr instanceof Error ? sendErr.message : String(sendErr)}`
          }
          return newMsgs
        })
      }
    } catch (err) {
      // [BUG FIX] 全局捕获，确保任何异常都不会导致组件崩溃
      console.error("[ClipPlugin] handleSendMessage unexpected error:", err)
      setIsGenerating(false)
      setIsError(true)
    }
  }

  // Handle key press
  // [BUG FIX] 统一调用 handleSendMessage 并传递事件对象
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      handleSendMessage(e)
    }
  }

  // Clear chat
  // [BUG FIX] 增加事件阻止，防止冒泡
  const handleClearChat = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setChatMessages([])
    setIsError(false)
  }

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  useEffect(() => {
    loadClips()

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === "local" && changes.clips) {
        loadClips()
      }
    }
    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => chrome.storage.onChanged.removeListener(handleStorageChange)
  }, [])

  useEffect(() => {
    const handleMessage = (msg: any) => {
      if (msg.type === "clip:notify") {
        setNotification({ message: msg.message, type: msg.status || "success" })
        // If it's a success notification, reload clips just in case
        if (msg.status === "success" || !msg.status) {
          loadClips()
        }
      }
      if (msg.type === "clip:screenshot-closed") {
        setIsScreenshotMode(false)
        loadClips()
      }
    }

    const handleCustomEvent = () => {
      setIsScreenshotMode(false)
      loadClips()
    }

    const handleSavedEvent = () => {
      // Screenshot saved successfully, reload clips and ensure screenshot mode is off
      loadClips()
      setIsScreenshotMode(false)
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    window.addEventListener("clip-plugin:screenshot-closed", handleCustomEvent)
    window.addEventListener("clip-plugin:screenshot-saved", handleSavedEvent)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
      window.removeEventListener(
        "clip-plugin:screenshot-closed",
        handleCustomEvent
      )
      window.removeEventListener(
        "clip-plugin:screenshot-saved",
        handleSavedEvent
      )
    }
  }, [])

  const loadClips = async () => {
    const data = await ClipStore.getAll()
    setClips(data.sort((a, b) => b.createdAt - a.createdAt))
  }

  useEffect(() => {
    if (ref.current) {
      const root = ref.current.getRootNode() as ShadowRoot
      if (root.host && root.host instanceof HTMLElement) {
        root.host.style.setProperty("z-index", "2147483647", "important")
        root.host.style.setProperty("position", "fixed", "important")
        root.host.style.top = "0px"
        root.host.style.left = "0px"
        root.host.style.width = "0px"
        root.host.style.height = "0px"
        root.host.style.overflow = "visible"
      }
    }
  }, [])

  const openHomepage = () => {
    chrome.runtime.sendMessage({ type: "clip:open-history" }, () => {})
  }

  // URL 标准化函数，保留重要查询参数
  const normalizeUrl = (u: string): string => {
    try {
      const url = new URL(u)
      const path = url.pathname.replace(/\/+$/, "") || "/"
      
      // 对于依赖查询参数区分内容的网站，保留关键参数
      // context: 百度新闻 mbd.baidu.com (内含 nid)
      // nid: 新闻ID
      const importantParams = ['id', 'vid', 'bvid', 'aid', 'p', 'articleId', 'newsId', 'docid', 'context', 'nid',"wd",
  "word","q","query"]
      const params = new URLSearchParams(url.search)
      const keptParams = new URLSearchParams()
      
      for (const key of importantParams) {
        const value = params.get(key)
        if (value) {
          keptParams.set(key, value)
        }
      }
      
      const queryString = keptParams.toString()
      return queryString ? `${url.origin}${path}?${queryString}` : `${url.origin}${path}`
    } catch {
      const base = u.split("#")[0]
      return base.replace(/\/+$/, "") || "/"
    }
  }

  const handleDirectSaveFullPage = async () => {
    try {
      const content = await extractContent()

      // 检查当前页面是否已保存过
      const contentUrlNorm = content?.url ? normalizeUrl(content.url) : normalizeUrl(window.location.href)
      if (contentUrlNorm) {
        const latest = await ClipStore.getAll()
        if (latest.some((c) => normalizeUrl(c.url) === contentUrlNorm)) {
          setNotification({
            message: "当前页面已保存过",
            type: "error"
          })
          return
        }
      }

      await ClipStore.add({
        source:
          content?.metadata?.platform === "Bilibili"
            ? "bilibili"
            : content?.metadata?.platform === "YouTube"
              ? "youtube"
              : "webpage",
        url: content?.url || window.location.href,
        title: content?.title || document.title,
        rawTextSnippet: content?.snippet || "",
        rawTextFull: content?.text || "",
        summary: "", // 无AI摘要
        keyPoints: [],
        tags: [],
        meta: content?.metadata,
        images: content?.images // 保存提取的图片
      })

      // Reload clips to update the list immediately
      loadClips()

      const imgCount = content?.images?.length || 0
      setNotification({
        message: `已直接保存整页！${imgCount > 0 ? `（含${imgCount}张图片）` : ""}`,
        type: "success"
      })
    } catch (e) {
      console.error("❌ Direct save error:", e)
      setNotification({
        message: "保存失败",
        type: "error"
      })
    }
  }

  const filteredClips = clips.filter((clip) => {
    if (!searchValue) return true
    const lowerSearch = searchValue.toLowerCase()
    return (
      (clip.title && clip.title.toLowerCase().includes(lowerSearch)) ||
      (clip.summary && clip.summary.toLowerCase().includes(lowerSearch)) ||
      (clip.rawTextSnippet && clip.rawTextSnippet.toLowerCase().includes(lowerSearch)) ||
      (clip.url && clip.url.toLowerCase().includes(lowerSearch)) ||
      (clip.tags && clip.tags.some(tag => tag.toLowerCase().includes(lowerSearch)))
    )
  })

  return (
    <>
    <div
      ref={ref}
      className={`fixed z-[2147483647] flex flex-col shadow-2xl rounded-2xl border font-sans transition-all duration-200 origin-top-right animate-scale-up ${
        isDarkMode
          ? "bg-slate-900/95 border-slate-700 text-slate-100"
          : "bg-white/95 border-white/20 text-slate-800"
      }`}
      style={{
        top: "24px",
        right: "24px",
        bottom: "24px",
        width: "340px",
        maxHeight: "calc(100vh - 48px)"
      }}>
      {/* Notification Toast */}
      {notification && (
        <div
          className={`absolute top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg border flex items-center gap-2 animate-fade-in-down transition-all duration-300 ${
            notification.type === "success"
              ? "bg-emerald-50 border-emerald-100 text-emerald-600"
              : "bg-red-50 border-red-100 text-red-600"
          }`}>
          {notification.type === "success" ? (
            <FiCheck className="w-4 h-4" />
          ) : (
            <FiX className="w-4 h-4" />
          )}
          <span className="text-xs font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div
        className={`FloatPanelHeader flex items-center justify-between px-5 h-14 border-b ${
          isDarkMode ? "border-slate-700/50" : "border-slate-100/50"
        }`}>
        <div className="flex items-center gap-3">
          <button
            className={`w-9 h-9 flex items-center justify-center rounded-xl shadow-sm ring-1 transition-all active:scale-95 ${
              isDarkMode
                ? "bg-blue-900/20 text-blue-400 ring-blue-800/50 hover:bg-blue-900/40"
                : "bg-blue-50 text-black-600 ring-blue-100/50 hover:bg-blue-100"
            }`}
            onClick={openHomepage}
            title="Open Homepage">
            <AiFillAliwangwang className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`bg-transparent text-sm font-bold outline-none w-24 ${
                isDarkMode
                  ? "text-slate-100 placeholder-slate-600"
                  : "text-slate-800 placeholder-slate-400"
              }`}
            />
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Workspace
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowFeedback(true)}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? "hover:bg-slate-800 text-slate-500 hover:text-slate-300"
                : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            }`}
            title="Feedback"
          >
            <FiMessageSquare className="w-4 h-4" />
          </button>

          <button
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? "hover:bg-slate-800 text-slate-500 hover:text-slate-300"
                : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            }`}
            onClick={toggleTheme}
            title={isDarkMode ? "Light Mode" : "Dark Mode"}>
            {isDarkMode ? (
              <FiSun className="w-4 h-4" />
            ) : (
              <FiMoon className="w-4 h-4" />
            )}
          </button>
          <button
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? "hover:bg-slate-800 text-slate-500 hover:text-slate-300"
                : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            }`}
            onClick={() =>
              window.open(
                "https://gitee.com/qyf150128/clip-plugin",
                "_blank",
                "noopener,noreferrer"
              )
            }
            title="Help">
            <FiHelpCircle className="w-4 h-4" />
          </button>
          <button
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? "hover:bg-slate-800 text-slate-500 hover:text-slate-300"
                : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            }`}
            onClick={onRefresh}
            title="Refresh">
            <FiRefreshCcw className="w-4 h-4" />
          </button>
          <button
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? "hover:bg-red-900/20 text-slate-500 hover:text-red-400"
                : "hover:bg-red-50 text-slate-400 hover:text-red-500"
            }`}
            onClick={onClose}
            title="Close">
            <FiX className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="FloatPanelBody flex-1 flex flex-col p-4 overflow-hidden gap-3">
        {/* Clips Mode - 使用 CSS 显示/隐藏而非条件渲染，保持组件状态 */}
        <div className={`flex flex-col gap-4 overflow-y-auto custom-scrollbar ${panelMode === "clips" ? "flex-1" : "hidden"}`}>
            {/* Input Area */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">
                Search
              </label>
              <div
                className={`flex gap-2 p-1 rounded-xl border focus-within:ring-2 focus-within:ring-blue-100 transition-all ${
                  isDarkMode
                    ? "bg-slate-800/50 border-slate-700"
                    : "bg-slate-50 border-slate-100"
                }`}>
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search clips..."
                  className={`flex-1 bg-transparent px-3 py-2 text-sm outline-none ${
                    isDarkMode
                      ? "text-slate-200 placeholder:text-slate-600"
                      : "text-slate-700 placeholder:text-slate-400"
                  }`}
                />
              </div>
            </div>

            {/* Content List */}
            {filteredClips.length === 0 ? (
              <div
                className={`FloatPanelBodyContentPlaceholder flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 min-h-[200px] ${
                  isDarkMode
                    ? "border-slate-800 text-slate-600"
                    : "border-slate-100 text-slate-300"
                }`}>
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isDarkMode ? "bg-slate-800" : "bg-slate-50"
                  }`}>
                  <RiMagicLine
                    className={`w-6 h-6 ${isDarkMode ? "text-slate-600" : "text-slate-300"}`}
                  />
                </div>
                <span className="text-xs font-medium">No clips yet</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 pb-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">
                  Recent Clips
                </label>
                {filteredClips.map((clip) => {
                  const firstImage =
                    clip.images && clip.images.length > 0
                      ? clip.images[0].src
                      : null

                  return (
                    <div
                      key={clip.id}
                      className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                        isDarkMode
                          ? "bg-slate-800/50 hover:bg-blue-900/20 border-slate-700 hover:border-blue-800"
                          : "bg-slate-50 hover:bg-blue-50 border-slate-100 hover:border-blue-100"
                      }`}
                      onClick={() =>
                        chrome.runtime.sendMessage({
                          type: "clip:open-history",
                          clipId: clip.id
                        })
                      }>
                      <div className="flex gap-3">
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div
                            className={`font-medium text-sm line-clamp-2 mb-1.5 leading-snug ${
                              isDarkMode
                                ? "text-slate-200 group-hover:text-blue-400"
                                : "text-slate-700 group-hover:text-blue-600"
                            }`}>
                            {clip.title || clip.summary || "Untitled Clip"}
                          </div>
                          <div className="flex items-center justify-between mt-auto">
                            <div className="text-[10px] text-slate-400 flex items-center gap-2">
                              <span
                                className={`capitalize px-1.5 py-0.5 rounded border text-[9px] font-medium tracking-wide ${
                                  isDarkMode
                                    ? "bg-slate-700 border-slate-600 text-slate-300"
                                    : "bg-white border-slate-100 text-slate-500"
                                }`}>
                                {clip.source}
                              </span>
                              <span>
                                {new Date(clip.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            {clip.rating && clip.rating > 0 && (
                              <div className="flex text-[10px] text-amber-400 gap-0.5">
                                {"★".repeat(clip.rating)}
                              </div>
                            )}
                          </div>
                        </div>

                        {firstImage && (
                          <div
                            className={`w-20 h-14 flex-shrink-0 rounded-lg overflow-hidden border shadow-sm ${
                              isDarkMode
                                ? "bg-slate-800 border-slate-700"
                                : "bg-white border-slate-200/60"
                            }`}>
                            <img
                              src={firstImage}
                              alt="thumbnail"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).style.display =
                                  "none"
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        {/* Chat Mode - 使用 CSS 显示/隐藏而非条件渲染，保持组件状态 */}
        <div className={`flex flex-col gap-3 ${panelMode === "chat" ? "flex-1" : "hidden"}`}>
            {/* Model Selector & Clear Button */}
            <div className="flex items-center justify-between gap-2">
              <select
                value={selectedModel.value}
                onChange={(e) =>
                  setSelectedModel(
                    models.find((m) => m.value === e.target.value) || models[0]
                  )
                }
                className={`flex-1 px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700 text-slate-200"
                    : "bg-slate-50 border-slate-200 text-slate-700"
                }`}>
                {models.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={(e) => handleClearChat(e)}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode
                    ? "hover:bg-red-900/20 text-slate-500 hover:text-red-400"
                    : "hover:bg-red-50 text-slate-400 hover:text-red-500"
                }`}
                title="清空对话">
                <FiTrash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages Area */}
            <div
              className={`flex-1 overflow-y-auto rounded-xl border p-3 space-y-3 min-h-[200px] custom-scrollbar ${
                isDarkMode
                  ? "bg-slate-800/50 border-slate-700"
                  : "bg-slate-50 border-slate-100"
              }`}>
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                    <RiRobot2Line className="w-7 h-7 text-blue-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-500">
                      AI 助手
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      随时为您解答问题
                    </p>
                  </div>
                  {/* Quick prompts */}
                  {/* [BUG FIX] 为模板按钮增加事件阻止，防止冒泡导致面板关闭 */}
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {[
                      "帮我总结这个页面",
                      "解释一下这段内容",
                      "有什么建议?"
                    ].map((prompt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          // [BUG FIX] 阻止事件冒泡，防止触发父元素事件导致面板关闭
                          e.preventDefault()
                          e.stopPropagation()
                          try {
                            console.log(
                              "[ClipPlugin] Quick prompt clicked:",
                              prompt
                            )
                            setInputValue(prompt)
                            // 延迟聚焦输入框
                            setTimeout(() => {
                              try {
                                inputRef.current?.focus()
                              } catch (focusErr) {
                                console.warn(
                                  "[ClipPlugin] Focus error:",
                                  focusErr
                                )
                              }
                            }, 50)
                          } catch (err) {
                            console.error(
                              "[ClipPlugin] Quick prompt click error:",
                              err
                            )
                          }
                        }}
                        className={`px-3 py-1.5 text-xs border rounded-full transition-all ${
                          isDarkMode
                            ? "bg-slate-800 border-slate-600 text-slate-300 hover:bg-blue-900/30 hover:border-blue-700 hover:text-blue-400"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600"
                        }`}>
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : isDarkMode
                              ? "bg-slate-700 border border-slate-600 text-slate-200 rounded-bl-sm shadow-sm"
                              : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm"
                        }`}>
                        {msg.role === "assistant" ? (
                          msg.content ? (
                            <div
                              className={`markdown-wrapper text-sm [&_p]:mb-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:text-sm ${
                                isDarkMode
                                  ? "[&_*:not(code)]:text-slate-200"
                                  : "[&_*:not(code)]:text-slate-800"
                              }`}
                              style={{
                                color: isDarkMode ? "#e2e8f0" : "#1e293b"
                              }}>
                              <Markdown
                                markdown={msg.content}
                                className={`[&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded ${
                                  isDarkMode
                                    ? "[&_code]:bg-slate-800 [&_code]:text-slate-200"
                                    : "[&_code]:bg-slate-100 [&_code]:text-slate-800"
                                }`}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                                style={{ animationDelay: "0ms" }}
                              />
                              <div
                                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                                style={{ animationDelay: "150ms" }}
                              />
                              <div
                                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                                style={{ animationDelay: "300ms" }}
                              />
                            </div>
                          )
                        ) : (
                          <span className="whitespace-pre-wrap">
                            {msg.content}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            {/* [BUG FIX] 将输入区域包裹在 form 中但阻止表单提交，确保按钮点击不会触发意外行为 */}
            <div
              className={`flex gap-2 p-1 rounded-xl border focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-slate-200"
              }`}
              onClick={(e) => e.stopPropagation()}>
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息... (Enter 发送)"
                className={`flex-1 bg-transparent px-3 py-2 text-sm outline-none resize-none min-h-[40px] max-h-[100px] ${
                  isDarkMode
                    ? "text-slate-200 placeholder:text-slate-500"
                    : "text-slate-700 placeholder:text-slate-400"
                }`}
                rows={1}
                disabled={isGenerating}
              />
              {/* [BUG FIX] 发送按钮增加 type="button" 防止触发表单提交，并明确传递事件对象 */}
              <button
                type="button"
                onClick={(e) => {
                  console.log("[ClipPlugin] Send button clicked")
                  handleSendMessage(e)
                }}
                disabled={!inputValue?.trim() || isGenerating}
                className={`self-end mb-1 mr-1 p-2 rounded-lg transition-all ${
                  inputValue?.trim() && !isGenerating
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
                    : isDarkMode
                      ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}>
                {isGenerating ? (
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                ) : (
                  <FiSend className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

        {/* YouTube Mode - 使用 CSS 显示/隐藏而非条件渲染，保持组件状态 */}
        {isYouTubePage && (
          <div className={`flex flex-col overflow-hidden ${panelMode === "youtube" ? "flex-1" : "hidden"}`}>
            <YouTubePanel isDarkMode={isDarkMode} />
          </div>
        )}
      </div>

      {/* Footer / Toolbar */}
      <div className="FloatPanelFooter px-5 pb-5 pt-2">
        <div
          className={`flex items-center justify-between p-1.5 rounded-xl border ${
            isDarkMode
              ? "bg-slate-800 border-slate-700"
              : "bg-slate-50 border-slate-100"
          }`}>
          {[
            {
              icon: FiSave,
              label: "Save",
              action: handleDirectSaveFullPage,
              active: false,
              show: !isYouTubePage // YouTube 页面隐藏，该功能在 YouTube 面板内
            },
            {
              icon: RiMessage2Line,
              label: "Chat",
              action: () =>
                setPanelMode(panelMode === "chat" ? "clips" : "chat"),
              active: panelMode === "chat",
              show: !isYouTubePage // YouTube 页面隐藏，该功能在 YouTube 面板内
            },
            // YouTube 按钮：只在 YouTube 页面显示
            {
              icon: BsYoutube,
              label: "YouTube",
              action: () =>
                setPanelMode(panelMode === "youtube" ? "clips" : "youtube"),
              active: panelMode === "youtube",
              show: isYouTubePage
            },
            {
              icon: FiCrop,
              label: "Screenshot",
              action: () => {
                setIsScreenshotMode(true)
                chrome.runtime.sendMessage({ type: "clip:start-screenshot" }, () => {})
              },
              active: isScreenshotMode,
              show: true
            },
            {
              icon: FiGrid,
              label: "Clips",
              action: () => setPanelMode("clips"),
              active: panelMode === "clips",
              show: true
            },
            {
              icon: FiSettings,
              label: "Settings",
              action: () =>
                chrome.runtime.sendMessage({ type: "clip:open-options" }),
              active: false,
              show: true
            }
          ].filter(item => item.show).map((Item, idx) => (
            <button
              key={idx}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all active:scale-95 ${
                Item.active
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                  : isDarkMode
                    ? "text-slate-400 hover:bg-slate-700 hover:text-blue-400"
                    : "text-slate-500 hover:bg-white hover:text-blue-600 hover:shadow-sm"
              }`}
              title={Item.label}
              onClick={Item.action}>
              <Item.icon className="w-5 h-5" />
            </button>
          ))}
        </div>
      </div>

    </div>
      <FirstUseWelcomePage />
      {showFeedback && <FeedbackPage onClose={() => setShowFeedback(false)} />}
    </>
  )
}

function FloatClip() {
  const [visible, setVisible] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pendingChatText, setPendingChatText] = useState<string | undefined>(
    undefined
  )

  const handleRefresh = () => {
    setVisible(false)
    setPendingChatText(undefined)
    setTimeout(() => {
      setRefreshKey((k) => k + 1)
      setVisible(true)
    }, 100)
  }

  // 监听来自 selection-clipper 的消息
  useEffect(() => {
    const handleClipSendToChat = (event: CustomEvent<{ text: string }>) => {
      const { text } = event.detail
      if (text) {
        const chatText = `请帮我解释以下内容：\n\n"${text.slice(0, 1000)}${text.length > 1000 ? "..." : ""}"`
        setPendingChatText(chatText)
        // 刷新组件以确保新文本被传入
        setRefreshKey((k) => k + 1)
        // 自动打开浮窗
        setVisible(true)
      }
    }

    window.addEventListener(
      "clip-send-to-chat",
      handleClipSendToChat as EventListener
    )
    return () => {
      window.removeEventListener(
        "clip-send-to-chat",
        handleClipSendToChat as EventListener
      )
    }
  }, [])

  useEffect(() => {
    const handler = (msg: any) => {
      if (msg?.type === "clip:show-float") setVisible(true)
      if (msg?.type === "clip:hide-float") setVisible(false)
      if (msg?.type === "clip:toggle-float") setVisible((v) => !v)
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  useEffect(() => {
    const pageHandler = (e: MessageEvent) => {
      const d = e?.data as any
      if (!d || d.source !== "clip") return
      if (d.type === "clip:show-float") setVisible(true)
      if (d.type === "clip:show-float-chat") {
        setVisible(true)
        setPendingChatText(" ")
      }
      if (d.type === "clip:hide-float") setVisible(false)
      if (d.type === "clip:toggle-float") setVisible((v) => !v)
    }
    window.addEventListener("message", pageHandler)
    return () => window.removeEventListener("message", pageHandler)
  }, [])

  useEffect(() => {
    const type = visible ? "clip:panel-open" : "clip:panel-close"
    try {
      window.postMessage({ source: "clip", type }, "*")
    } catch {}
    try {
      chrome.runtime.sendMessage({ type })
    } catch {}
  }, [visible])

  if (!visible) return null

  // [BUG FIX] 使用 Error Boundary 包裹 PanelContent，防止内部错误导致整个扩展崩溃
  return (
    <div id="plasmo-float-root">
      <PanelErrorBoundary onReset={handleRefresh}>
        <PanelContent
          key={refreshKey}
          onClose={() => {
            setVisible(false)
            setPendingChatText(undefined)
          }}
          onRefresh={handleRefresh}
          initialChatText={pendingChatText}
        />
      </PanelErrorBoundary>
    </div>
  )
}

export default FloatClip
