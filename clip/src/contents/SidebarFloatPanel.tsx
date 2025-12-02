// @ts-ignore
import cssText from "data-text:~style.css"
import React, { useEffect, useState, useRef, useCallback } from "react"
import { ClipStore, type Clip } from "@/lib/clip-store"
import { Button } from "../components"
import { FiRefreshCcw, FiGrid, FiSettings, FiX, FiHelpCircle, FiSave, FiCheck, FiSend, FiTrash2, FiCrop, FiMoon, FiSun } from "react-icons/fi"
import { AiFillAliwangwang } from "react-icons/ai"
import { RiMessage2Line, RiMagicLine, RiRobot2Line } from "react-icons/ri"
import { VscFileCode } from "react-icons/vsc"
import { extractContent } from "@/core/index"
import { usePort } from "@plasmohq/messaging/hook"
import { useAtomValue } from "jotai"
import { openAIKeyAtom } from "@/lib/atoms/openai"
import { models, type Message, type Model } from "@/lib/constants"
import Markdown from "@/components/markdown"

export const config = {
  matches: ["<all_urls>"]
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

function PanelContent({ onClose, onRefresh, initialChatText }: { onClose: () => void, onRefresh: () => void, initialChatText?: string }) {
  const [title, setTitle] = useState("Clip")
  const [quickSaveValue, setQuickSaveValue] = useState("")
  const [clips, setClips] = useState<Clip[]>([])
  const [notification, setNotification] = useState<{message: string, type: "success" | "error"} | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  
  // Panel mode: "clips" | "chat" - 如果有初始文本则默认显示聊天模式
  const [panelMode, setPanelMode] = useState<"clips" | "chat">(initialChatText ? "chat" : "clips")
  const [isScreenshotMode, setIsScreenshotMode] = useState(false)
  
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
  
  // Get OpenAI API key
  const openAIKey = useAtomValue(openAIKeyAtom)
  
  // Port for chat
  const port = usePort("chat")

  // 过滤 AI 返回内容中的 clip_tags 和 END 标记
  const cleanAIResponse = (content: string): string => {
    if (!content) return content
    // 移除 <clip_tags>...</clip_tags> 标签及其内容
    let cleaned = content.replace(/<clip_tags>[\s\S]*?<\/clip_tags>/gi, "")
    // 移除结尾的 END 标记
    cleaned = cleaned.replace(/\s*END\s*$/g, "")
    // 移除多余的空行
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n")
    return cleaned.trim()
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
          setChatMessages(prev => {
            const newMessages = [...prev]
            if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === "assistant") {
              // 过滤掉 clip_tags 和 END 标记
              newMessages[newMessages.length - 1].content = cleanAIResponse(port.data.message)
            }
            return newMessages
          })
        }
        setIsGenerating(false)
      } else {
        // Streaming message - 实时过滤显示
        setChatMessages(prev => {
          const newMessages = [...prev]
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === "assistant") {
            newMessages[newMessages.length - 1].content = cleanAIResponse(port.data.message)
          }
          return newMessages
        })
      }
    }
  }, [port.data?.message, port.data?.isEnd])

  // Handle port errors
  useEffect(() => {
    if (!port.data) return
    
    if (port.data?.error !== undefined && port.data?.error !== null && port.data?.error !== "") {
      setIsError(true)
      setIsGenerating(false)
      setChatMessages(prev => {
        const newMessages = [...prev]
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === "assistant") {
          newMessages[newMessages.length - 1].content = `❌ 错误: ${port.data.error}`
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
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isGenerating) return

    if (!openAIKey || openAIKey.trim() === "") {
      setChatMessages(prev => [
        ...prev,
        { role: "user", content: inputValue },
        { role: "assistant", content: "❌ API 密钥未设置，请在扩展设置中添加您的 API 密钥。" }
      ])
      setInputValue("")
      return
    }

    const userMessage: Message = { role: "user", content: inputValue }
    const newMessages = [...chatMessages, userMessage, { role: "assistant", content: "" }]
    setChatMessages(newMessages)
    setInputValue("")
    setIsGenerating(true)
    setIsError(false)

    inputRef.current?.focus()

    const context = getPageContext()
    
    port.send({
      model: selectedModel.content,
      messages: newMessages.slice(0, -1),
      context
    })
  }

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Clear chat
  const handleClearChat = () => {
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
    
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
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
      window.removeEventListener("clip-plugin:screenshot-closed", handleCustomEvent)
      window.removeEventListener("clip-plugin:screenshot-saved", handleSavedEvent)
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
    chrome.runtime.sendMessage({ type: "clip:open-history" })
  }

  const handleDirectSaveFullPage = async () => {
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

  return (
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
      }}
    >
      
      {/* Notification Toast */}
      {notification && (
        <div className={`absolute top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg border flex items-center gap-2 animate-fade-in-down transition-all duration-300 ${
          notification.type === "success" 
            ? "bg-emerald-50 border-emerald-100 text-emerald-600" 
            : "bg-red-50 border-red-100 text-red-600"
        }`}>
          {notification.type === "success" ? <FiCheck className="w-4 h-4" /> : <FiX className="w-4 h-4" />}
          <span className="text-xs font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className={`FloatPanelHeader flex items-center justify-between px-5 h-14 border-b ${
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
            title="Open Homepage"
          >
            <AiFillAliwangwang className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`bg-transparent text-sm font-bold outline-none w-24 ${
                isDarkMode ? "text-slate-100 placeholder-slate-600" : "text-slate-800 placeholder-slate-400"
              }`}
            />
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Workspace</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
           <button 
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? "hover:bg-slate-800 text-slate-500 hover:text-slate-300" : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            }`}
            onClick={toggleTheme}
            title={isDarkMode ? "Light Mode" : "Dark Mode"}
          >
            {isDarkMode ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
          </button>
          <button 
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? "hover:bg-slate-800 text-slate-500 hover:text-slate-300" : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            }`}
            onClick={() => window.open("https://github.com/your-repo", "_blank", "noopener,noreferrer")}
            title="Help"
          >
            <FiHelpCircle className="w-4 h-4" />
          </button>
          <button 
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? "hover:bg-slate-800 text-slate-500 hover:text-slate-300" : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            }`}
            onClick={onRefresh}
            title="Refresh"
          >
            <FiRefreshCcw className="w-4 h-4" />
          </button>
          <button 
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? "hover:bg-red-900/20 text-slate-500 hover:text-red-400" : "hover:bg-red-50 text-slate-400 hover:text-red-500"
            }`}
            onClick={onClose}
            title="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="FloatPanelBody flex-1 flex flex-col p-4 overflow-hidden gap-3">
        {panelMode === "clips" ? (
          /* Clips Mode */
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
            {/* Input Area */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Quick Save</label>
              <div className={`flex gap-2 p-1 rounded-xl border focus-within:ring-2 focus-within:ring-blue-100 transition-all ${
                isDarkMode ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-100"
              }`}>
                <input 
                  type="text" 
                  value={quickSaveValue}
                  onChange={(e) => setQuickSaveValue(e.target.value)}
                  placeholder="Paste link or note..." 
                  className={`flex-1 bg-transparent px-3 text-sm outline-none ${
                    isDarkMode ? "text-slate-200 placeholder:text-slate-600" : "text-slate-700 placeholder:text-slate-400"
                  }`}
                />
                <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2 rounded-lg shadow-md shadow-blue-200 transition-all active:scale-95">
                  Save
                </button>
              </div>
            </div>

            {/* Content List */}
            {clips.length === 0 ? (
              <div className={`FloatPanelBodyContentPlaceholder flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 min-h-[200px] ${
                isDarkMode ? "border-slate-800 text-slate-600" : "border-slate-100 text-slate-300"
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isDarkMode ? "bg-slate-800" : "bg-slate-50"
                }`}>
                  <RiMagicLine className={`w-6 h-6 ${isDarkMode ? "text-slate-600" : "text-slate-300"}`} />
                </div>
                <span className="text-xs font-medium">No clips yet</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 pb-2">
                 <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Recent Clips</label>
                 {clips.map(clip => {
                   const firstImage = clip.images && clip.images.length > 0 ? clip.images[0].src : null;
                   
                   return (
                   <div 
                     key={clip.id} 
                     className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                        isDarkMode 
                          ? "bg-slate-800/50 hover:bg-blue-900/20 border-slate-700 hover:border-blue-800" 
                          : "bg-slate-50 hover:bg-blue-50 border-slate-100 hover:border-blue-100"
                     }`}
                     onClick={() => chrome.runtime.sendMessage({ type: "clip:open-history", clipId: clip.id })}
                   >
                     <div className="flex gap-3">
                       <div className="flex-1 min-w-0 flex flex-col justify-between">
                         <div className={`font-medium text-sm line-clamp-2 mb-1.5 leading-snug ${
                            isDarkMode ? "text-slate-200 group-hover:text-blue-400" : "text-slate-700 group-hover:text-blue-600"
                         }`}>
                           {clip.title || clip.summary || "Untitled Clip"}
                         </div>
                         <div className="flex items-center justify-between mt-auto">
                           <div className="text-[10px] text-slate-400 flex items-center gap-2">
                              <span className={`capitalize px-1.5 py-0.5 rounded border text-[9px] font-medium tracking-wide ${
                                isDarkMode ? "bg-slate-700 border-slate-600 text-slate-300" : "bg-white border-slate-100 text-slate-500"
                              }`}>{clip.source}</span>
                              <span>{new Date(clip.createdAt).toLocaleDateString()}</span>
                           </div>
                           {clip.rating && clip.rating > 0 && (
                             <div className="flex text-[10px] text-amber-400 gap-0.5">
                               {'★'.repeat(clip.rating)}
                             </div>
                           )}
                         </div>
                       </div>

                       {firstImage && (
                         <div className={`w-20 h-14 flex-shrink-0 rounded-lg overflow-hidden border shadow-sm ${
                            isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200/60"
                         }`}>
                           <img 
                             src={firstImage} 
                             alt="thumbnail" 
                             className="w-full h-full object-cover"
                             onError={(e) => {
                               (e.target as HTMLImageElement).style.display = 'none'
                             }}
                           />
                         </div>
                       )}
                     </div>
                   </div>
                 )})}
              </div>
            )}
          </div>
        ) : (
          /* Chat Mode */
          <>
            {/* Model Selector & Clear Button */}
            <div className="flex items-center justify-between gap-2">
              <select
                value={selectedModel.value}
                onChange={(e) => setSelectedModel(models.find(m => m.value === e.target.value) || models[0])}
                className={`flex-1 px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all ${
                  isDarkMode 
                    ? "bg-slate-800 border-slate-700 text-slate-200" 
                    : "bg-slate-50 border-slate-200 text-slate-700"
                }`}
              >
                {models.map(model => (
                  <option key={model.value} value={model.value}>{model.label}</option>
                ))}
              </select>
              <button
                onClick={handleClearChat}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode ? "hover:bg-red-900/20 text-slate-500 hover:text-red-400" : "hover:bg-red-50 text-slate-400 hover:text-red-500"
                }`}
                title="清空对话"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages Area */}
            <div className={`flex-1 overflow-y-auto rounded-xl border p-3 space-y-3 min-h-[200px] custom-scrollbar ${
              isDarkMode ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-100"
            }`}>
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                    <RiRobot2Line className="w-7 h-7 text-blue-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-500">AI 助手</p>
                    <p className="text-xs text-slate-400 mt-1">随时为您解答问题</p>
                  </div>
                  {/* Quick prompts */}
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {["帮我总结这个页面", "解释一下这段内容", "有什么建议?"].map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => setInputValue(prompt)}
                        className={`px-3 py-1.5 text-xs border rounded-full transition-all ${
                          isDarkMode 
                            ? "bg-slate-800 border-slate-600 text-slate-300 hover:bg-blue-900/30 hover:border-blue-700 hover:text-blue-400" 
                            : "bg-white border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600"
                        }`}
                      >
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
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : isDarkMode 
                                ? "bg-slate-700 border border-slate-600 text-slate-200 rounded-bl-sm shadow-sm"
                                : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          msg.content ? (
                            <Markdown markdown={msg.content} className={`text-sm [&_p]:mb-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:text-sm [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded ${
                              isDarkMode ? "[&_code]:bg-slate-800 [&_code]:text-slate-200" : "[&_code]:bg-slate-100 [&_code]:text-slate-800"
                            }`} />
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                          )
                        ) : (
                          <span className="whitespace-pre-wrap">{msg.content}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className={`flex gap-2 p-1 rounded-xl border focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all ${
              isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"
            }`}>
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息... (Enter 发送)"
                className={`flex-1 bg-transparent px-3 py-2 text-sm outline-none resize-none min-h-[40px] max-h-[100px] ${
                  isDarkMode ? "text-slate-200 placeholder:text-slate-500" : "text-slate-700 placeholder:text-slate-400"
                }`}
                rows={1}
                disabled={isGenerating}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isGenerating}
                className={`self-end mb-1 mr-1 p-2 rounded-lg transition-all ${
                  inputValue.trim() && !isGenerating
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
                    : isDarkMode ? "bg-slate-700 text-slate-500 cursor-not-allowed" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {isGenerating ? (
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                ) : (
                  <FiSend className="w-4 h-4" />
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Footer / Toolbar */}
      <div className="FloatPanelFooter px-5 pb-5 pt-2">
        <div className={`flex items-center justify-between p-1.5 rounded-xl border ${
          isDarkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100"
        }`}>
          {[
            { icon: FiSave, label: "Save", action: handleDirectSaveFullPage, active: false },
            { icon: RiMessage2Line, label: "Chat", action: () => setPanelMode(panelMode === "chat" ? "clips" : "chat"), active: panelMode === "chat" },
            { 
              icon: FiCrop, 
              label: "Screenshot", 
              action: () => {
                setIsScreenshotMode(true)
                chrome.runtime.sendMessage({ type: "clip:start-screenshot" })
              }, 
              active: isScreenshotMode 
            },
            { icon: FiGrid, label: "Clips", action: () => setPanelMode("clips"), active: panelMode === "clips" },
            { icon: FiSettings, label: "Settings", action: () => chrome.runtime.sendMessage({ type: "clip:open-options" }), active: false }
          ].map((Item, idx) => (
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
              onClick={Item.action}
            >
              <Item.icon className="w-5 h-5" />
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}

function FloatClip() {
  const [visible, setVisible] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pendingChatText, setPendingChatText] = useState<string | undefined>(undefined)

  const handleRefresh = () => {
    setVisible(false)
    setPendingChatText(undefined)
    setTimeout(() => {
      setRefreshKey(k => k + 1)
      setVisible(true)
    }, 100)
  }

  // 监听来自 selection-clipper 的消息
  useEffect(() => {
    const handleClipSendToChat = (event: CustomEvent<{ text: string }>) => {
      const { text } = event.detail
      if (text) {
        const chatText = `请帮我解释以下内容：\n\n"${text.slice(0, 1000)}${text.length > 1000 ? '...' : ''}"`
        setPendingChatText(chatText)
        // 刷新组件以确保新文本被传入
        setRefreshKey(k => k + 1)
        // 自动打开浮窗
        setVisible(true)
      }
    }

    window.addEventListener('clip-send-to-chat', handleClipSendToChat as EventListener)
    return () => {
      window.removeEventListener('clip-send-to-chat', handleClipSendToChat as EventListener)
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
    try { window.postMessage({ source: "clip", type }, "*") } catch {}
    try { chrome.runtime.sendMessage({ type }) } catch {}
  }, [visible])

  if (!visible) return null

  return (
    <PanelContent 
      key={refreshKey} 
      onClose={() => {
        setVisible(false)
        setPendingChatText(undefined)
      }} 
      onRefresh={handleRefresh}
      initialChatText={pendingChatText}
    />
  )
}

export default FloatClip
