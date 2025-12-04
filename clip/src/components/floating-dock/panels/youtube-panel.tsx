/**
 * YouTubePanel - YouTube 专属功能面板
 * 
 * 整合原有 YouTube 右侧面板的核心功能：
 * - 视频信息展示（缩略图、标题、频道）
 * - 字幕获取状态
 * - AI 总结视频
 * - 字幕浏览
 * - 基于字幕的 AI 对话
 * 
 * 作为统一浮窗的一个 Tab/模块使用
 */
import React, { useEffect, useState, useRef } from "react"
import { getVideoData } from "@/utils/functions"
import { useApiConfig } from "@/lib/api-config-store"
import { usePort } from "@plasmohq/messaging/hook"
import { models, prompts, type Model, type Prompt, type Message } from "@/lib/constants"
import { ClipStore } from "@/lib/clip-store"
import Markdown from "@/components/markdown"
import {
  Play,
  FileText,
  AlignLeft,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  MessageCircle,
  MessageSquare,
  Send,
  Trash2
} from "lucide-react"

interface YouTubePanelProps {
  isDarkMode: boolean
}

interface VideoData {
  metadata?: {
    title?: string
    author?: string
    lengthSeconds?: string
  }
  transcript?: {
    events?: Array<{
      tStartMs: number
      dDurationMs?: number
      segs?: Array<{ utf8: string }>
    }>
  }
}

export function YouTubePanel({ isDarkMode }: YouTubePanelProps) {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [videoData, setVideoData] = useState<VideoData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // 面板状态 - 增加 chat tab
  const [activeTab, setActiveTab] = useState<"summary" | "transcript" | "chat">("summary")
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(true)
  
  // 总结相关状态
  const [summaryContent, setSummaryContent] = useState<string | null>(null)
  const [summaryIsGenerating, setSummaryIsGenerating] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<Model>(models[0])
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt>(prompts[0])
  
  // 对话相关状态
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatIsGenerating, setChatIsGenerating] = useState(false)
  const [chatSelectedModel, setChatSelectedModel] = useState<Model>(models[0])
  const chatMessagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  
  // 复制状态
  const [isCopied, setIsCopied] = useState(false)
  
  // 保存状态
  const [isSummarySaved, setIsSummarySaved] = useState(false)
  const [isChatSaved, setIsChatSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // API 配置
  const { apiKey, isLoading: isApiKeyLoading, hasApiKey } = useApiConfig()
  
  // Port for completion (总结)
  const port = usePort("completion")
  
  // Port for chat (对话)
  const chatPort = usePort("chat")

  // 获取当前视频 ID
  const getVideoIdFromUrl = (): string | null => {
    if (!window.location.hostname.includes("youtube.com")) return null
    return new URLSearchParams(window.location.search).get("v")
  }

  // 检测视频变化并获取数据
  useEffect(() => {
    const fetchData = async () => {
      const id = getVideoIdFromUrl()
      
      if (!id) {
        setVideoId(null)
        setVideoData(null)
        return
      }
      
      if (id === videoId && videoData) return // 视频未变化
      
      setVideoId(id)
      setIsLoading(true)
      setError(null)
      setSummaryContent(null)
      
      try {
        const data = await getVideoData(id)
        setVideoData(data)
        console.log("[YouTubePanel] Video data loaded:", {
          hasMetadata: !!data?.metadata,
          hasTranscript: !!data?.transcript,
          transcriptEvents: data?.transcript?.events?.length || 0
        })
      } catch (err) {
        console.error("[YouTubePanel] Failed to fetch video data:", err)
        setError("获取视频信息失败")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()

    // 监听 URL 变化（YouTube SPA 导航）
    let lastUrl = window.location.href
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href
        fetchData()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [videoId])

  // 处理总结生成的消息
  useEffect(() => {
    if (!port.data) return

    if (port.data?.message !== undefined && port.data?.message !== null) {
      if (port.data.isEnd === true) {
        const content = port.data.message.replace(/\nEND$/, "").replace(/END$/, "")
        setSummaryContent(content)
        setSummaryIsGenerating(false)
        setIsSummarySaved(false) // 新生成的总结未保存
      } else {
        setSummaryContent(port.data.message)
      }
    }
  }, [port.data?.message, port.data?.isEnd])

  // 处理错误
  useEffect(() => {
    if (port.data?.error) {
      setSummaryError(port.data.error)
      setSummaryIsGenerating(false)
    }
  }, [port.data?.error])

  // 处理对话消息
  useEffect(() => {
    if (!chatPort.data) return

    if (chatPort.data?.message !== undefined && chatPort.data?.message !== null) {
      if (chatPort.data.isEnd === true) {
        const content = chatPort.data.message.replace(/\nEND$/, "").replace(/END$/, "")
        setChatMessages(prev => {
          const newMessages = [...prev]
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === "assistant") {
            newMessages[newMessages.length - 1].content = content
          }
          return newMessages
        })
        setChatIsGenerating(false)
      } else {
        setChatMessages(prev => {
          const newMessages = [...prev]
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === "assistant") {
            newMessages[newMessages.length - 1].content = chatPort.data.message
          }
          return newMessages
        })
      }
    }
  }, [chatPort.data?.message, chatPort.data?.isEnd])

  // 处理对话错误
  useEffect(() => {
    if (chatPort.data?.error) {
      setChatMessages(prev => {
        const newMessages = [...prev]
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === "assistant") {
          newMessages[newMessages.length - 1].content = `❌ 错误: ${chatPort.data.error}`
        }
        return newMessages
      })
      setChatIsGenerating(false)
    }
  }, [chatPort.data?.error])

  // 自动滚动到对话底部
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  // 获取字幕文本
  const getTranscriptText = (): string => {
    if (!videoData?.transcript?.events) return ""
    return videoData.transcript.events
      .filter(e => e.segs)
      .map(e => e.segs?.map(s => s.utf8).join(" "))
      .join(" ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  }

  // 发送对话消息
  const sendChatMessage = () => {
    const trimmedInput = chatInput.trim()
    if (!trimmedInput || chatIsGenerating) return

    if (!hasApiKey) {
      setChatMessages(prev => [
        ...prev,
        { role: "user", content: trimmedInput },
        { role: "assistant", content: "❌ 请先在设置中配置 API Key" }
      ])
      setChatInput("")
      return
    }

    if (!videoData?.transcript?.events?.length) {
      setChatMessages(prev => [
        ...prev,
        { role: "user", content: trimmedInput },
        { role: "assistant", content: "❌ 当前视频没有字幕，无法进行对话" }
      ])
      setChatInput("")
      return
    }

    const userMessage: Message = { role: "user", content: trimmedInput }
    const newMessages = [...chatMessages, userMessage, { role: "assistant", content: "" }]
    setChatMessages(newMessages)
    setChatInput("")
    setChatIsGenerating(true)

    chatPort.send({
      model: chatSelectedModel.content,
      messages: newMessages.slice(0, -1), // 不发送空的 assistant 消息
      context: {
        metadata: videoData.metadata,
        transcript: videoData.transcript,
        openAIKey: apiKey
      }
    })
  }

  // 清空对话
  const clearChat = () => {
    setChatMessages([])
    setChatIsGenerating(false)
    setIsChatSaved(false)
  }

  // 保存总结
  const saveSummary = async () => {
    if (!summaryContent || !videoData?.metadata || isSaving) return
    
    setIsSaving(true)
    try {
      await ClipStore.add({
        source: "youtube",
        url: window.location.href,
        title: videoData.metadata.title || document.title,
        rawTextSnippet: getTranscriptText().slice(0, 500),
        summary: summaryContent,
        keyPoints: [],
        tags: []
      })
      setIsSummarySaved(true)
      console.log("[YouTubePanel] Summary saved")
    } catch (err) {
      console.error("[YouTubePanel] Failed to save summary:", err)
    } finally {
      setIsSaving(false)
    }
  }

  // 保存对话
  const saveChat = async () => {
    if (chatMessages.length === 0 || !videoData?.metadata || isSaving) return
    
    setIsSaving(true)
    try {
      // 将对话格式化为文本
      const chatContent = chatMessages
        .map(msg => `${msg.role === "user" ? "Q" : "A"}: ${msg.content}`)
        .join("\n\n")
      
      await ClipStore.add({
        source: "youtube",
        url: window.location.href,
        title: `[对话] ${videoData.metadata.title || document.title}`,
        rawTextSnippet: getTranscriptText().slice(0, 500),
        summary: chatContent,
        keyPoints: [],
        tags: ["chat"]
      })
      setIsChatSaved(true)
      console.log("[YouTubePanel] Chat saved")
    } catch (err) {
      console.error("[YouTubePanel] Failed to save chat:", err)
    } finally {
      setIsSaving(false)
    }
  }

  // 对话快捷提示
  const chatQuickPrompts = [
    "这个视频讲了什么？",
    "总结一下关键要点",
    "有什么值得注意的地方？"
  ]

  // 生成总结
  const generateSummary = () => {
    if (!hasApiKey) {
      setSummaryError("请先在设置中配置 API Key")
      return
    }
    
    if (!videoData?.transcript?.events?.length) {
      setSummaryError("当前视频没有字幕，无法生成总结")
      return
    }

    setSummaryIsGenerating(true)
    setSummaryError(null)
    setSummaryContent(null)

    port.send({
      prompt: selectedPrompt.content,
      model: selectedModel.content,
      context: {
        metadata: videoData.metadata,
        transcript: videoData.transcript,
        openAIKey: apiKey
      }
    })
  }

  // 复制字幕
  const copyTranscript = async () => {
    const text = getTranscriptText()
    if (!text) return
    
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  // 格式化时间
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // 跳转到视频时间
  const seekTo = (timeMs: number) => {
    const video = document.querySelector("video")
    if (video) {
      video.currentTime = timeMs / 1000
    }
  }

  // 非 YouTube 页面提示
  if (!videoId) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 px-4 text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
          isDarkMode ? "bg-slate-800" : "bg-gray-100"
        }`}>
          <Play className={`h-8 w-8 ${isDarkMode ? "text-slate-600" : "text-gray-400"}`} />
        </div>
        <h3 className={`font-semibold mb-2 ${isDarkMode ? "text-slate-300" : "text-gray-700"}`}>
          YouTube 视频工具
        </h3>
        <p className={`text-sm ${isDarkMode ? "text-slate-500" : "text-gray-500"}`}>
          在 YouTube 视频页面时，这里会显示视频总结和字幕工具
        </p>
      </div>
    )
  }

  // 加载中
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
        <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
          正在获取视频信息...
        </p>
      </div>
    )
  }

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
  const hasTranscript = !!videoData?.transcript?.events?.length

  return (
    <div className={`flex flex-col h-full overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
      {/* 视频信息卡片 */}
      <div className={`p-3 border-b ${isDarkMode ? "border-slate-700" : "border-gray-100"}`}>
        <div className="flex gap-3">
          <img
            src={thumbnailUrl}
            alt="Video thumbnail"
            className="w-20 h-12 object-cover rounded-lg flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-medium line-clamp-2 leading-snug ${
              isDarkMode ? "text-slate-200" : "text-gray-800"
            }`}>
              {videoData?.metadata?.title || "Loading..."}
            </h3>
            {videoData?.metadata?.author && (
              <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-500" : "text-gray-500"}`}>
                {videoData.metadata.author}
              </p>
            )}
          </div>
        </div>
        
        {/* 字幕状态 */}
        <div className={`mt-2 flex items-center gap-2 text-xs ${
          hasTranscript
            ? isDarkMode ? "text-green-400" : "text-green-600"
            : isDarkMode ? "text-amber-400" : "text-amber-600"
        }`}>
          {hasTranscript ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>已获取字幕 ({videoData?.transcript?.events?.length} 段)</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3.5 w-3.5" />
              <span>此视频暂无字幕</span>
            </>
          )}
        </div>
      </div>

      {/* Tab 切换 */}
      <div className={`flex border-b ${isDarkMode ? "border-slate-700" : "border-gray-100"}`}>
        <button
          onClick={() => setActiveTab("summary")}
          className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === "summary"
              ? isDarkMode
                ? "text-blue-400 border-b-2 border-blue-400 bg-blue-900/10"
                : "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
              : isDarkMode
                ? "text-slate-400 hover:text-slate-300"
                : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          AI 总结
        </button>
        <button
          onClick={() => setActiveTab("transcript")}
          className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === "transcript"
              ? isDarkMode
                ? "text-blue-400 border-b-2 border-blue-400 bg-blue-900/10"
                : "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
              : isDarkMode
                ? "text-slate-400 hover:text-slate-300"
                : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <AlignLeft className="h-3.5 w-3.5" />
          字幕
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === "chat"
              ? isDarkMode
                ? "text-blue-400 border-b-2 border-blue-400 bg-blue-900/10"
                : "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
              : isDarkMode
                ? "text-slate-400 hover:text-slate-300"
                : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          对话
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "summary" && (
          /* 总结面板 */
          <div className="p-3 space-y-3">
            {/* 操作栏 */}
            <div className="flex items-center gap-2">
              <select
                value={selectedModel.value}
                onChange={(e) => setSelectedModel(models.find(m => m.value === e.target.value) || models[0])}
                className={`flex-1 px-2 py-1.5 text-xs rounded-lg border ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700 text-slate-200"
                    : "bg-white border-gray-200 text-gray-700"
                }`}
              >
                {models.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              
              <button
                onClick={generateSummary}
                disabled={summaryIsGenerating || !hasTranscript || isApiKeyLoading}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all ${
                  summaryIsGenerating || !hasTranscript || isApiKeyLoading
                    ? isDarkMode
                      ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600"
                }`}
              >
                {summaryIsGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {summaryIsGenerating ? "生成中..." : "生成总结"}
              </button>
            </div>

            {/* 提示词选择 */}
            <div className="flex gap-1.5 flex-wrap">
              {prompts.map(p => (
                <button
                  key={p.value}
                  onClick={() => setSelectedPrompt(p)}
                  className={`px-2 py-1 text-[10px] rounded-full transition-colors ${
                    selectedPrompt.value === p.value
                      ? isDarkMode
                        ? "bg-blue-900/50 text-blue-300 border border-blue-700"
                        : "bg-blue-100 text-blue-700 border border-blue-200"
                      : isDarkMode
                        ? "bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600"
                        : "bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* 总结内容 */}
            {summaryError && (
              <div className={`p-3 rounded-lg text-xs ${
                isDarkMode ? "bg-red-900/20 text-red-400" : "bg-red-50 text-red-600"
              }`}>
                ❌ {summaryError}
              </div>
            )}
            
            {summaryContent ? (
              <>
                <div className={`p-3 rounded-lg text-sm ${
                  isDarkMode ? "bg-slate-800/50 text-slate-300" : "bg-gray-50 text-gray-700"
                }`}>
                  <Markdown 
                    markdown={summaryContent} 
                    className={`prose prose-sm max-w-none ${
                      isDarkMode 
                        ? "prose-invert prose-p:text-slate-300 prose-headings:text-slate-200 prose-strong:text-slate-200 prose-li:text-slate-300 prose-a:text-blue-400" 
                        : ""
                    }`}
                  />
                </div>
                {/* 保存按钮 */}
                <button
                  onClick={saveSummary}
                  disabled={isSummarySaved || isSaving}
                  className={`w-full mt-2 px-3 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                    isSummarySaved
                      ? isDarkMode
                        ? "bg-green-900/30 text-green-400 cursor-default"
                        : "bg-green-100 text-green-600 cursor-default"
                      : isDarkMode
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isSummarySaved ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {isSummarySaved ? "已保存" : "保存总结"}
                </button>
              </>
            ) : !summaryIsGenerating && (
              <div className={`text-center py-8 text-xs ${
                isDarkMode ? "text-slate-500" : "text-gray-400"
              }`}>
                {hasTranscript ? "点击「生成总结」开始" : "此视频没有字幕，无法生成总结"}
              </div>
            )}
          </div>
        )}

        {activeTab === "transcript" && (
          /* 字幕面板 */
          <div className="flex flex-col h-full p-3 space-y-2">
            {/* 字幕操作栏 */}
            <div className="flex items-center justify-between flex-shrink-0">
              <span className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                {hasTranscript ? `${videoData?.transcript?.events?.length} 段字幕` : "暂无字幕"}
              </span>
              {hasTranscript && (
                <button
                  onClick={copyTranscript}
                  className={`px-2 py-1 text-xs rounded-lg flex items-center gap-1 transition-colors ${
                    isDarkMode
                      ? "hover:bg-slate-700 text-slate-400"
                      : "hover:bg-gray-100 text-gray-500"
                  }`}
                >
                  {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {isCopied ? "已复制" : "复制全部"}
                </button>
              )}
            </div>

            {/* 字幕列表 */}
            {hasTranscript ? (
              <div className="flex-1 space-y-1 overflow-y-auto">
                {videoData?.transcript?.events
                  ?.filter(e => e.segs)
                  .map((event, idx) => (
                    <button
                      key={idx}
                      onClick={() => seekTo(event.tStartMs)}
                      className={`w-full text-left p-2 rounded-lg flex gap-2 transition-colors ${
                        isDarkMode
                          ? "hover:bg-slate-800"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <span className={`text-[10px] font-mono flex-shrink-0 ${
                        isDarkMode ? "text-blue-400" : "text-blue-600"
                      }`}>
                        {formatTime(event.tStartMs)}
                      </span>
                      <span className={`text-xs ${
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      }`}>
                        {event.segs?.map(s => s.utf8).join("")}
                      </span>
                    </button>
                  ))}
              </div>
            ) : (
              <div className={`text-center py-8 text-xs ${
                isDarkMode ? "text-slate-500" : "text-gray-400"
              }`}>
                此视频没有可用的字幕
              </div>
            )}
          </div>
        )}

        {/* 对话 Tab 内容 */}
        {activeTab === "chat" && (
          <div className="flex flex-col h-full">
            {!hasTranscript ? (
              <div className={`flex-1 flex items-center justify-center text-xs ${
                isDarkMode ? "text-slate-500" : "text-gray-400"
              }`}>
                需要字幕才能进行视频相关对话
              </div>
            ) : (
              <>
                {/* 消息列表 */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {chatMessages.length === 0 ? (
                    <div className={`text-center py-8 text-xs ${
                      isDarkMode ? "text-slate-500" : "text-gray-400"
                    }`}>
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>基于视频内容进行对话</p>
                      <p className="mt-1 opacity-75">AI 将根据字幕内容回答你的问题</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                            msg.role === "user"
                              ? isDarkMode
                                ? "bg-blue-600 text-white"
                                : "bg-blue-500 text-white"
                              : isDarkMode
                                ? "bg-slate-700 text-slate-300"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {msg.role === "assistant" ? (
                            msg.content ? (
                              <Markdown 
                                markdown={msg.content}
                                className={`prose prose-sm max-w-none ${
                                  isDarkMode 
                                    ? "prose-invert prose-p:text-slate-300 prose-headings:text-slate-200 prose-strong:text-slate-200 prose-li:text-slate-300" 
                                    : ""
                                }`}
                              />
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                正在思考...
                              </span>
                            )
                          ) : (
                            msg.content
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatMessagesEndRef} />
                </div>

                {/* 输入区域 */}
                <div className={`p-3 border-t ${
                  isDarkMode ? "border-slate-700" : "border-gray-200"
                }`}>
                  {/* 保存对话按钮 */}
                  {chatMessages.length > 0 && (
                    <button
                      onClick={saveChat}
                      disabled={isChatSaved || isSaving}
                      className={`w-full mb-2 px-3 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        isChatSaved
                          ? isDarkMode
                            ? "bg-green-900/30 text-green-400 cursor-default"
                            : "bg-green-100 text-green-600 cursor-default"
                          : isDarkMode
                            ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isChatSaved ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {isChatSaved ? "对话已保存" : "保存对话"}
                    </button>
                  )}
                  <div className="flex gap-2">
                    <textarea
                      ref={chatInputRef}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          sendChatMessage()
                        }
                      }}
                      placeholder="询问关于这个视频的问题..."
                      rows={2}
                      className={`flex-1 resize-none rounded-lg px-3 py-2 text-xs outline-none ${
                        isDarkMode
                          ? "bg-slate-700 text-slate-200 placeholder:text-slate-500 border-slate-600"
                          : "bg-gray-50 text-gray-800 placeholder:text-gray-400 border-gray-200"
                      } border focus:ring-1 focus:ring-blue-500`}
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={!chatInput.trim() || chatIsGenerating}
                      className={`px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isDarkMode
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "bg-blue-500 hover:bg-blue-600 text-white"
                      }`}
                    >
                      {chatIsGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
