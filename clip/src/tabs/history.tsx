import React, { useEffect, useState, useCallback, useMemo, createContext, useContext } from "react"
import { ClipStore, FolderStore, type Clip, type Folder } from "@/lib/clip-store"
import { ReviewStore } from "@/lib/review/review-store"
import { Trash2, ExternalLink, Search, Calendar, Tag, Save, MessageSquare, Share, Loader2, CheckSquare, Square, Edit3, X, Check, ChevronDown, ChevronUp, Star, Filter, Clock, FileText, Image as ImageIcon, Sparkles, BookOpen, LayoutGrid, List, SortAsc, SortDesc, Zap, Globe, TrendingUp, Sun, Moon, FolderIcon, Pencil, RefreshCw, Brain } from "lucide-react"
import { ChatProvider, useChat } from "@/contexts/chat-context"
import { ExtensionProvider, useExtension } from "@/contexts/extension-context"
import { createRecordFromClip, checkFeishuSyncStatus } from "@/lib/feishuBitable"
import { storage } from "@/lib/atoms/storage"
import type { FeishuConfig } from "@/lib/atoms/feishu"
import Chat from "@/components/chat"
import Markdown from "@/components/markdown"
import ClipTagsPanel from "@/components/clip-tags-panel"
import ClipEditModal from "@/components/clip-edit-modal"
import FolderSidebar from "@/components/folder-sidebar"
import MoveToFolderDropdown from "@/components/move-to-folder-dropdown"
import "../style.css"

// Theme configuration
const themes = {
  dark: {
    // Base backgrounds
    pageBg: "bg-[#0a0a0f]",
    sidebarBg: "bg-[#0d0d14]",
    mainBg: "bg-[#08080c]",
    cardBg: "bg-white/[0.02]",
    cardBgHover: "hover:bg-white/[0.05]",
    inputBg: "bg-white/5",
    inputBgHover: "hover:bg-white/10",
    inputBgFocus: "focus:bg-white/10",
    sectionBg: "bg-black/20",
    overlayBg: "bg-black/30",
    
    // Borders
    borderColor: "border-white/5",
    ringColor: "ring-white/10",
    
    // Text colors
    textPrimary: "text-white",
    textSecondary: "text-gray-100",
    textMuted: "text-gray-300",
    textDim: "text-gray-400",
    textFaint: "text-gray-500",
    textDisabled: "text-gray-600",
    placeholderText: "placeholder:text-gray-500",
    
    // Option background (for select)
    optionBg: "bg-[#1a1a24]",
    
    // Gradients
    gradientAccent: "from-indigo-600/10 via-purple-600/5 to-transparent",
    gradientGlow: "from-purple-500/20 to-transparent",
    gradientCard: "from-indigo-500/5 to-purple-500/5",
    
    // Scrollbar
    scrollThumb: "scrollbar-thumb-gray-400",
    scrollTrack: "scrollbar-track-gray-800",
    
    // Special
    fadeGradient: "from-black/80 to-transparent",
  },
  light: {
    // Base backgrounds
    pageBg: "bg-gray-50",
    sidebarBg: "bg-white",
    mainBg: "bg-gray-50",
    cardBg: "bg-white",
    cardBgHover: "hover:bg-gray-50",
    inputBg: "bg-gray-100",
    inputBgHover: "hover:bg-gray-200",
    inputBgFocus: "focus:bg-white",
    sectionBg: "bg-gray-50",
    overlayBg: "bg-white",
    
    // Borders
    borderColor: "border-gray-200",
    ringColor: "ring-gray-200",
    
    // Text colors
    textPrimary: "text-gray-900",
    textSecondary: "text-gray-800",
    textMuted: "text-gray-700",
    textDim: "text-gray-600",
    textFaint: "text-gray-500",
    textDisabled: "text-gray-400",
    placeholderText: "placeholder:text-gray-400",
    
    // Option background (for select)
    optionBg: "bg-white",
    
    // Gradients
    gradientAccent: "from-indigo-100/50 via-purple-100/30 to-transparent",
    gradientGlow: "from-purple-200/40 to-transparent",
    gradientCard: "from-indigo-50 to-purple-50",
    
    // Scrollbar
    scrollThumb: "scrollbar-thumb-gray-300",
    scrollTrack: "scrollbar-track-gray-100",
    
    // Special
    fadeGradient: "from-white to-transparent",
  }
}

type Theme = "dark" | "light"
type ThemeContextType = {
  theme: Theme
  toggleTheme: () => void
  t: typeof themes.dark
}

/**
 * 检测文本是否可能是 Markdown 格式
 * 通过检查常见的 Markdown 语法特征来判断
 */
const looksLikeMarkdown = (text: string): boolean => {
  if (!text) return false
  // 检测：标题、列表、加粗、斜体、代码块、行内代码、链接等
  return /^#{1,6}\s|^\*\s|^-\s|^\d+\.\s|\*\*[^*]+\*\*|__[^_]+__|```[\s\S]*```|`[^`]+`|\[[^\]]+\]\([^)]+\)/m.test(text)
}

const ThemeContext = createContext<ThemeContextType | null>(null)
const windowsTheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';//系统默认主题
const defaultTheme = windowsTheme() === 'dark' ? 'dark' : 'light';//系统默认主题
const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within ThemeProvider")
  return context
}

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("clip-history-theme")//获取对应主题的键值对
      return (saved as Theme) || defaultTheme
    }
    return defaultTheme
  })

  useEffect(() => {
    localStorage.setItem("clip-history-theme", theme)//本地存储键值对
    try {
      const root = document.documentElement
      if (theme === "dark") {
        root.classList.add("dark")
      } else {
        root.classList.remove("dark")
      }
    } catch {}
  }, [theme])

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    try {
      window.postMessage({ source: "clip-history", type: "theme-change", theme: next }, "*")
    } catch (e) {
      console.log("AI面板切换主题失败", e)
    }
  }
  
  const t = themes[theme]

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, t }}>
      {children}
    </ThemeContext.Provider>
  )
}

export default function HistoryPage() {
  return (
    <ThemeProvider>
      <ExtensionProvider>
        <ChatProvider>
          <HistoryLayout />
        </ChatProvider>
      </ExtensionProvider>
    </ThemeProvider>
  )
}

function HistoryLayout() {
  const { theme, toggleTheme, t } = useTheme()
  const isDark = theme === "dark"
  const [clips, setClips] = useState<Clip[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [exportingId, setExportingId] = useState<string | null>(null)
  
  // View mode & sorting
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest")
  const [filterSource, setFilterSource] = useState<string>("all")
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [folderSidebarCollapsed, setFolderSidebarCollapsed] = useState(true)
  const [statsFilter, setStatsFilter] = useState<"all" | "today" | "withImages" | "synced">("all")
  
  // Batch selection state
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  // Notes editing state
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [editedNotes, setEditedNotes] = useState("")
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  
  // Raw text expand state
  const [isRawTextExpanded, setIsRawTextExpanded] = useState(false)
  
  // Hover effect for cards
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  
  // Edit modal state
  const [editingClip, setEditingClip] = useState<Clip | null>(null)
  
  // Feishu sync status refresh
  const [isRefreshingSyncStatus, setIsRefreshingSyncStatus] = useState(false)
  
  // Review state
  const [reviewStatus, setReviewStatus] = useState<Record<string, boolean>>({}) // clipId -> hasReview
  const [addingToReview, setAddingToReview] = useState<string | null>(null)
  const [dueReviewCount, setDueReviewCount] = useState(0)
  
  const { setExtensionData, setCurrentClipId } = useExtension()
  const { chatMessages } = useChat()

  useEffect(() => {
    loadClips()
    loadFolders()
    loadReviewStatus()
    
    // Listen for storage changes to update the list in real-time
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === "local") {
        if (changes.clips) loadClips()
        if (changes.folders) loadFolders()
      }
    }
    
    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  // Check for URL params to select clip
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const clipId = params.get("id")
    if (clipId) {
      setSelectedClipId(clipId)
    }
  }, [])

  const loadClips = useCallback(async () => {
    const data = await ClipStore.getAll()
    // Sort by createdAt in descending order (newest first)
    const sorted = data.sort((a, b) => b.createdAt - a.createdAt)
    setClips(sorted)
  }, [])

  const loadFolders = useCallback(async () => {
    const data = await FolderStore.getAll()
    setFolders(data)
  }, [])

  // 加载复习状态
  const loadReviewStatus = useCallback(async () => {
    try {
      const reviews = await ReviewStore.getAll()
      const status: Record<string, boolean> = {}
      for (const r of reviews) {
        status[r.clipId] = true
      }
      setReviewStatus(status)
      
      const dueCount = await ReviewStore.getDueCount()
      setDueReviewCount(dueCount)
    } catch (err) {
      console.error("Failed to load review status:", err)
    }
  }, [])

  // 添加到复习
  const handleAddToReview = async (clipId: string) => {
    setAddingToReview(clipId)
    try {
      await ReviewStore.create(clipId)
      setReviewStatus(prev => ({ ...prev, [clipId]: true }))
    } catch (err) {
      console.error("Failed to add to review:", err)
      alert("添加到复习失败")
    } finally {
      setAddingToReview(null)
    }
  }

  // 移除复习
  const handleRemoveFromReview = async (clipId: string) => {
    if (!confirm("确定要从复习计划中移除吗？")) return
    try {
      await ReviewStore.deleteByClipId(clipId)
      setReviewStatus(prev => {
        const next = { ...prev }
        delete next[clipId]
        return next
      })
    } catch (err) {
      console.error("Failed to remove from review:", err)
      alert("移除失败")
    }
  }

  // 打开复习页面
  const openReviewPage = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("tabs/review.html") })
  }

  const closeEditModal = useCallback(() => {
    setEditingClip(null)
  }, [])

  const handleDelete = async (id: string) => {
    if (confirm("确定要删除这个剪藏吗？")) {
      await ClipStore.delete(id)
      if (selectedClipId === id) setSelectedClipId(null)
    }
  }

  // Batch delete handler
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    if (confirm(`确定要删除选中的 ${selectedIds.size} 个剪藏吗？`)) {
      await ClipStore.deleteMany(Array.from(selectedIds))
      if (selectedClipId && selectedIds.has(selectedClipId)) {
        setSelectedClipId(null)
      }
      setSelectedIds(new Set())
      setIsSelectMode(false)
    }
  }

  // Toggle select mode
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode)
    if (isSelectMode) {
      setSelectedIds(new Set())
    }
  }

  // Toggle single item selection
  const toggleItemSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newSelectedIds = new Set(selectedIds)
    if (newSelectedIds.has(id)) {
      newSelectedIds.delete(id)
    } else {
      newSelectedIds.add(id)
    }
    setSelectedIds(newSelectedIds)
  }

  // Select all / Deselect all
  const toggleSelectAll = () => {
    if (selectedIds.size === processedClips.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(processedClips.map(c => c.id)))
    }
  }

  // Notes editing handlers
  const startEditingNotes = () => {
    const selectedClip = clips.find(c => c.id === selectedClipId)
    setEditedNotes(selectedClip?.notes || "")
    setIsEditingNotes(true)
  }

  const cancelEditingNotes = () => {
    setIsEditingNotes(false)
    setEditedNotes("")
  }

  const saveNotes = async () => {
    if (!selectedClipId) return
    setIsSavingNotes(true)
    try {
      await ClipStore.update(selectedClipId, { 
        notes: editedNotes,
        updatedAt: Date.now()
      })
      setIsEditingNotes(false)
    } catch (e) {
      console.error(e)
      alert("保存笔记失败")
    } finally {
      setIsSavingNotes(false)
    }
  }

  const handleExportToFeishu = async (clip: Clip) => {
    if (exportingId) return
    // 导出前检查：从安全存储读取飞书配置，缺失则提示并可跳转设置页
    try {
      const cfg = await storage.get<FeishuConfig>("feishuConfig")
      const missing = !cfg || !cfg.appToken || !cfg.tableId || !cfg.appId || !cfg.appSecret
      if (missing) {
        const goSettings = confirm("未检测到完整的飞书配置（需要 App Token、Table ID、App ID 和 App Secret）。现在前往扩展设置页进行配置吗？")
        if (goSettings && chrome?.runtime?.openOptionsPage) {
          chrome.runtime.openOptionsPage()
        }
        return
      }
    } catch (e) {
      console.warn("读取飞书配置失败", e)
      const goSettings = confirm("读取飞书配置失败。现在前往扩展设置页进行配置吗？")
      if (goSettings && chrome?.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage()
      }
      return
    }

    setExportingId(clip.id)
    try {
      // 调用飞书多维表格接口创建记录
      const recordId = await createRecordFromClip(clip)
      await ClipStore.update(clip.id, {
        syncedToFeishu: true,
        feishuRecordId: recordId
      })
      // 列表刷新：尽管 storage 监听会更新，这里显式刷新以确保 UI 反馈
      await loadClips()
      alert("✅ 成功上传到飞书多维表格！")
    } catch (e) {
      console.error(e)
      const msg = (e as Error)?.message || "未知错误"
      // 错误处理：配置缺失时提供快速跳转至设置页
      if (msg.includes("飞书配置缺失") || msg.includes("configuration missing")) {
        const go = confirm("飞书配置缺失或不完整。是否前往扩展设置进行配置？\n需要：App Token、Table ID、App ID 和 App Secret")
        if (go && chrome?.runtime?.openOptionsPage) {
          chrome.runtime.openOptionsPage()
        }
      } else {
        alert("❌ 导出失败: " + msg)
      }
    } finally {
      setExportingId(null)
    }
  }

  // 刷新飞书同步状态
  const handleRefreshSyncStatus = async () => {
    const syncedClips = clips.filter(c => c.syncedToFeishu && c.feishuRecordId)
    
    if (syncedClips.length === 0) {
      alert("ℹ️ 没有已同步的记录需要检查")
      return
    }
    
    const confirmCheck = confirm(`将检查 ${syncedClips.length} 条已同步记录的状态，这可能需要一些时间。是否继续？`)
    if (!confirmCheck) return
    
    setIsRefreshingSyncStatus(true)
    
    try {
      const invalidClipIds = await checkFeishuSyncStatus(
        syncedClips.map(c => ({ id: c.id, feishuRecordId: c.feishuRecordId }))
      )
      
      if (invalidClipIds.length === 0) {
        alert("✅ 所有同步记录状态正常")
      } else {
        // 清除已删除记录的同步状态
        for (const clipId of invalidClipIds) {
          await ClipStore.update(clipId, {
            syncedToFeishu: false,
            feishuRecordId: undefined
          })
        }
        await loadClips()
        alert(`🔄 已更新 ${invalidClipIds.length} 条记录的同步状态（飞书端已删除）`)
      }
    } catch (e) {
      console.error("刷新同步状态失败:", e)
      alert("❌ 刷新同步状态失败: " + (e as Error).message)
    } finally {
      setIsRefreshingSyncStatus(false)
    }
  }

  const handleSaveChat = async () => {
    if (!chatMessages || chatMessages.length === 0) {
      alert("No chat messages to save.")
      return
    }
    
    const chatContent = chatMessages.map(m => `**${m.role.toUpperCase()}**: ${m.content}`).join("\n\n")
    const selectedClip = clips.find(c => c.id === selectedClipId)
    
    try {
      await ClipStore.add({
        source: "chat",
        url: window.location.href,
        title: `Chat: ${selectedClip?.title || "Untitled"}`,
        rawTextSnippet: chatContent.slice(0, 500),
        summary: chatContent,
        keyPoints: [],
        tags: ["chat", "ai"]
      })
      alert("✅ Chat saved as a new clip!")
    } catch (e) {
      console.error(e)
      alert("Failed to save chat.")
    }
  }

  const filteredClips = clips.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.summary.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Enhanced filtering and sorting
  const processedClips = useMemo(() => {
    let result = [...filteredClips]
    
    // Filter by stats card selection
    if (statsFilter === "today") {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      result = result.filter(c => c.createdAt >= today.getTime())
    } else if (statsFilter === "withImages") {
      result = result.filter(c => c.images && c.images.length > 0)
    } else if (statsFilter === "synced") {
      result = result.filter(c => c.syncedToFeishu)
    }
    
    // Filter by folder
    if (selectedFolderId === "uncategorized") {
      result = result.filter(c => !c.folderId)
    } else if (selectedFolderId) {
      result = result.filter(c => c.folderId === selectedFolderId)
    }
    
    // Filter by source
    if (filterSource !== "all") {
      result = result.filter(c => c.source === filterSource)
    }
    
    // Sort
    result.sort((a, b) => {
      if (sortOrder === "newest") {
        return b.createdAt - a.createdAt
      } else {
        return a.createdAt - b.createdAt
      }
    })
    
    return result
  }, [filteredClips, filterSource, sortOrder, selectedFolderId, statsFilter])

  // Get unique sources for filter
  const uniqueSources = useMemo(() => {
    const sources = new Set(clips.map(c => c.source))
    return Array.from(sources)
  }, [clips])

  // Folder clip counts
  const folderClipCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    folders.forEach(f => {
      counts[f.id] = clips.filter(c => c.folderId === f.id).length
    })
    return counts
  }, [clips, folders])

  const uncategorizedCount = useMemo(() => {
    return clips.filter(c => !c.folderId).length
  }, [clips])

  // Stats
  const stats = useMemo(() => {
    const total = clips.length
    const today = clips.filter(c => {
      const clipDate = new Date(c.createdAt)
      const todayDate = new Date()
      return clipDate.toDateString() === todayDate.toDateString()
    }).length
    const withImages = clips.filter(c => c.images && c.images.length > 0).length
    const synced = clips.filter(c => c.syncedToFeishu).length
    return { total, today, withImages, synced }
  }, [clips])

  // Truncate text to specified length
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + "..."
  }

  const selectedClip = useMemo(() => {
    return clips.find(c => c.id === selectedClipId) || null
  }, [clips, selectedClipId])

  // Update extension context when clip changes
  useEffect(() => {
    // Reset expanded state when switching clips
    setIsRawTextExpanded(false)
    setIsEditingNotes(false)
    
    if (selectedClip) {
      // 设置当前剪藏 ID，用于 AI 打标功能
      setCurrentClipId(selectedClip.id)
      
      // 设置扩展数据，包含剪藏模式所需的信息
      setExtensionData({
        clipMode: true,  // 标记为剪藏模式
        transcript: {
          events: [{ segs: [{ utf8: selectedClip.rawTextFull || selectedClip.rawTextSnippet || selectedClip.summary }] }]
        },
        metadata: {
          title: selectedClip.title
        },
        summary: selectedClip.summary,
        rawText: selectedClip.rawTextFull || selectedClip.rawTextSnippet
      })
    } else {
      setCurrentClipId(null)
    }
  }, [selectedClipId, setExtensionData, setCurrentClipId])

  return (
    <div className={`flex h-screen w-full ${t.pageBg} ${t.textSecondary} font-sans overflow-hidden transition-colors duration-300`}>
       {/* Edit Modal */}
       {editingClip && (
         <ClipEditModal
           key={editingClip.id}
           clip={editingClip}
           onClose={closeEditModal}
           onSaved={loadClips}
           theme={theme}
         />
       )}

       {/* Sidebar - 25% width */}
       <div className={`w-[25%] min-w-[320px] border-r ${t.borderColor} flex flex-col ${t.sidebarBg} transition-colors duration-300`}>
          {/* Fixed Mini Header */}
          <div className={`p-3 border-b ${t.borderColor} flex items-center justify-between shrink-0`}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className={`text-sm font-bold ${t.textPrimary}`}>我的剪藏</h2>
                <p className={`text-[10px] ${t.textFaint}`}>{stats.total} 条</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleTheme}
                className={`p-1.5 rounded-lg transition-all duration-300 ${t.inputBg} ${t.inputBgHover} ${t.textDim} hover:text-indigo-400`}
                title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
              >
                {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={toggleSelectMode}
                className={`px-2 py-1 text-[10px] font-medium rounded-lg transition-all duration-300 ${
                  isSelectMode 
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" 
                    : `${t.inputBg} ${t.textDim} ${t.inputBgHover} hover:text-indigo-400`
                }`}
              >
                {isSelectMode ? "✓ 完成" : "管理"}
              </button>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className={`flex-1 overflow-y-auto custom-scrollbar ${theme === 'dark' ? 'dark' : ''}`}>
            {/* Stats Cards */}
            <div className="p-4 pb-2">
              <div className="grid grid-cols-5 gap-2">
                <button 
                  onClick={() => setStatsFilter(statsFilter === "all" ? "all" : "all")}
                  className={`${t.inputBg} backdrop-blur rounded-lg p-2 text-center transition-all cursor-pointer group ${
                    statsFilter === "all" 
                      ? "ring-2 ring-indigo-500 ring-offset-1 ring-offset-transparent" 
                      : t.inputBgHover
                  }`}
                >
                  <div className={`text-base font-bold transition-colors ${statsFilter === "all" ? "text-indigo-400" : `${t.textPrimary} group-hover:text-indigo-400`}`}>{stats.total}</div>
                  <div className={`text-[10px] ${statsFilter === "all" ? "text-indigo-300" : t.textFaint}`}>全部</div>
                </button>
                <button 
                  onClick={() => setStatsFilter(statsFilter === "today" ? "all" : "today")}
                  className={`${t.inputBg} backdrop-blur rounded-lg p-2 text-center transition-all cursor-pointer group ${
                    statsFilter === "today" 
                      ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-transparent" 
                      : t.inputBgHover
                  }`}
                >
                  <div className={`text-base font-bold transition-colors ${statsFilter === "today" ? "text-emerald-300" : "text-emerald-400 group-hover:text-emerald-300"}`}>{stats.today}</div>
                  <div className={`text-[10px] ${statsFilter === "today" ? "text-emerald-300" : t.textFaint}`}>今日</div>
                </button>
                <button 
                  onClick={() => setStatsFilter(statsFilter === "withImages" ? "all" : "withImages")}
                  className={`${t.inputBg} backdrop-blur rounded-lg p-2 text-center transition-all cursor-pointer group ${
                    statsFilter === "withImages" 
                      ? "ring-2 ring-cyan-500 ring-offset-1 ring-offset-transparent" 
                      : t.inputBgHover
                  }`}
                >
                  <div className={`text-base font-bold transition-colors ${statsFilter === "withImages" ? "text-cyan-300" : "text-cyan-400 group-hover:text-cyan-300"}`}>{stats.withImages}</div>
                  <div className={`text-[10px] ${statsFilter === "withImages" ? "text-cyan-300" : t.textFaint}`}>含图</div>
                </button>
                <button 
                  onClick={() => setStatsFilter(statsFilter === "synced" ? "all" : "synced")}
                  className={`${t.inputBg} backdrop-blur rounded-lg p-2 text-center transition-all cursor-pointer group relative ${
                    statsFilter === "synced" 
                      ? "ring-2 ring-amber-500 ring-offset-1 ring-offset-transparent" 
                      : t.inputBgHover
                  }`}
                >
                  <div className={`text-base font-bold transition-colors ${statsFilter === "synced" ? "text-amber-300" : "text-amber-400 group-hover:text-amber-300"}`}>{stats.synced}</div>
                  <div className={`text-[10px] ${statsFilter === "synced" ? "text-amber-300" : t.textFaint}`}>已同步</div>
                  {/* 刷新同步状态按钮 */}
                  {stats.synced > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRefreshSyncStatus()
                      }}
                      disabled={isRefreshingSyncStatus}
                      className={`absolute -top-1 -right-1 p-1 rounded-full ${t.inputBg} hover:bg-amber-500/20 transition-all ${isRefreshingSyncStatus ? 'animate-spin' : ''}`}
                      title="刷新飞书同步状态"
                    >
                      <RefreshCw className={`h-3 w-3 ${isRefreshingSyncStatus ? 'text-amber-400' : t.textFaint + ' hover:text-amber-400'}`} />
                    </button>
                  )}
                </button>
                {/* 待复习入口 */}
                <button 
                  onClick={openReviewPage}
                  className={`${t.inputBg} backdrop-blur rounded-lg p-2 text-center transition-all cursor-pointer group ${t.inputBgHover} relative`}
                  title="开始复习"
                >
                  <div className={`text-base font-bold transition-colors text-purple-400 group-hover:text-purple-300`}>{dueReviewCount}</div>
                  <div className={`text-[10px] ${t.textFaint} group-hover:text-purple-300`}>待复习</div>
                  {dueReviewCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                  )}
                </button>
              </div>
            </div>
          
            {/* Batch actions bar */}
            {isSelectMode && (
              <div className="px-4 pb-2">
                <div className={`flex items-center justify-between p-2.5 bg-indigo-500/10 backdrop-blur rounded-xl border border-indigo-500/20`}>
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 text-xs font-medium text-indigo-300 hover:text-indigo-200 transition-colors"
                  >
                    {selectedIds.size === processedClips.length && processedClips.length > 0 ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    {selectedIds.size === processedClips.length && processedClips.length > 0 ? "取消全选" : "全选"}
                  </button>
                  <span className={`text-xs ${t.textDim}`}>
                    已选 <span className="text-indigo-400 font-bold">{selectedIds.size}</span>
                  </span>
                  <button
                    onClick={handleBatchDelete}
                    disabled={selectedIds.size === 0}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                      selectedIds.size === 0
                        ? `${t.textFaint} ${t.inputBg} cursor-not-allowed`
                        : "text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30"
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </button>
                </div>
              </div>
            )}
            
            {/* Search */}
            <div className="px-4 pb-3">
              <div className="relative group">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${t.textFaint} group-focus-within:text-indigo-400 transition-colors`} />
                <input 
                  placeholder="搜索剪藏..." 
                  className={`pl-10 pr-4 py-2 border-0 rounded-xl w-full text-sm ${t.inputBg} ${t.textPrimary} ${t.placeholderText} focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${t.inputBgFocus} transition-all`}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          
            {/* Folders Section */}
            <div className={`px-4 pb-3 border-b ${t.borderColor}`}>
              <FolderSidebar
                selectedFolderId={selectedFolderId}
                onSelectFolder={setSelectedFolderId}
                clipCounts={folderClipCounts}
                totalCount={stats.total}
                uncategorizedCount={uncategorizedCount}
                theme={theme}
                collapsed={folderSidebarCollapsed}
                onToggleCollapse={() => setFolderSidebarCollapsed(!folderSidebarCollapsed)}
              />
            </div>

            {/* Filters & View Toggle */}
            <div className="px-4 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {/* Source Filter */}
                  <select
                    value={filterSource}
                    onChange={e => setFilterSource(e.target.value)}
                    className={`px-2 py-1 text-xs ${t.inputBg} border-0 rounded-lg ${t.textMuted} focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer ${t.inputBgHover} transition-colors appearance-none`}
                    style={{ backgroundImage: 'none' }}
                  >
                    <option value="all" className={t.optionBg}>全部来源</option>
                    {uniqueSources.map(source => (
                      <option key={source} value={source} className={t.optionBg}>{source}</option>
                    ))}
                  </select>
                  
                  {/* Sort Toggle */}
                  <button
                    onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
                    className={`p-1.5 ${t.textDim} hover:text-indigo-400 ${t.inputBg} ${t.inputBgHover} rounded-lg transition-all`}
                    title={sortOrder === "newest" ? "最新优先" : "最早优先"}
                  >
                    {sortOrder === "newest" ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />}
                  </button>
                </div>
                
                {/* View Mode Toggle */}
                <div className={`flex items-center ${t.inputBg} rounded-lg p-0.5`}>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-indigo-500 text-white" : `${t.textDim} hover:text-indigo-400`}`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-indigo-500 text-white" : `${t.textDim} hover:text-indigo-400`}`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          
            {/* Clips List */}
            <div className="px-3 pb-3">
              {processedClips.length === 0 ? (
                <div className="p-12 text-center">
                  <div className={`w-16 h-16 mx-auto mb-4 ${t.inputBg} rounded-2xl flex items-center justify-center`}>
                    <Search className={`h-8 w-8 ${t.textDisabled}`} />
                  </div>
                  <p className={`${t.textDim} text-sm font-medium`}>暂无剪藏</p>
                  <p className={`${t.textDisabled} text-xs mt-1`}>开始浏览并剪藏内容吧</p>
                </div>
              ) : viewMode === "list" ? (
                /* List View */
                <div className="space-y-2">
                  {processedClips.map((clip, index) => (
                    <div 
                      key={clip.id} 
                      onClick={() => !isSelectMode && setSelectedClipId(clip.id)}
                      onMouseEnter={() => setHoveredId(clip.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={`relative p-3 cursor-pointer rounded-xl transition-all duration-300 group ${
                        selectedClipId === clip.id 
                          ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 ring-1 ring-indigo-500/50' 
                          : `${t.cardBg} ${t.cardBgHover}`
                      }`}
                      style={{
                        animationDelay: `${index * 30}ms`
                      }}
                    >
                    {/* Hover glow effect */}
                    {hoveredId === clip.id && selectedClipId !== clip.id && (
                      <div className={`absolute inset-0 rounded-xl bg-gradient-to-r ${t.gradientCard} pointer-events-none`} />
                    )}
                    
                    <div className="flex items-start gap-3 relative">
                      {/* Checkbox for batch selection */}
                      {isSelectMode && (
                        <button
                          onClick={(e) => toggleItemSelection(clip.id, e)}
                          className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110"
                        >
                          {selectedIds.has(clip.id) ? (
                            <CheckSquare className="h-5 w-5 text-indigo-400" />
                          ) : (
                            <Square className={`h-5 w-5 ${t.textDisabled} group-hover:${t.textDim}`} />
                          )}
                        </button>
                      )}
                      
                      {/* Source Icon */}
                      {!isSelectMode && (
                        <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                          (clip.source as string) === 'selection' ? 'bg-emerald-500/10 text-emerald-400' :
                          (clip.source as string) === 'page' || clip.source === 'webpage' ? 'bg-blue-500/10 text-blue-400' :
                          clip.source === 'youtube' || clip.source === 'bilibili' ? 'bg-red-500/10 text-red-400' :
                          'bg-purple-500/10 text-purple-400'
                        }`}>
                          {(clip.source as string) === 'selection' ? <FileText className="h-4 w-4" /> :
                           (clip.source as string) === 'page' || clip.source === 'webpage' ? <Globe className="h-4 w-4" /> :
                           clip.source === 'youtube' || clip.source === 'bilibili' ? <Zap className="h-4 w-4" /> :
                           <Sparkles className="h-4 w-4" />}
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        {/* Title */}
                        <div className={`font-medium text-sm line-clamp-2 mb-1.5 ${t.textSecondary} group-hover:${t.textPrimary} transition-colors`}>{clip.title}</div>
                        
                        {/* Summary Preview */}
                        <div className={`text-xs ${t.textFaint} line-clamp-2 leading-relaxed mb-2`}>
                          {truncateText(clip.summary, 80)}
                        </div>
                        
                        {/* Meta row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Date */}
                          <span className={`flex items-center gap-1 text-[10px] ${t.textFaint}`}>
                            <Clock className="h-3 w-3" />
                            {new Date(clip.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                          </span>
                          
                          {/* Rating */}
                          {clip.rating && clip.rating > 0 && (
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-2.5 w-2.5 ${
                                    star <= clip.rating!
                                      ? "fill-amber-400 text-amber-400"
                                      : `fill-transparent ${t.textDisabled}`
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                          
                          {/* Images */}
                          {clip.images && clip.images.length > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-full">
                              <ImageIcon className="h-2.5 w-2.5" />
                              {clip.images.length}
                            </span>
                          )}
                          
                          {/* Synced */}
                          {clip.syncedToFeishu && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                              ✓ 已同步
                            </span>
                          )}
                          
                          {/* Folder indicator */}
                          {clip.folderId && folders.find(f => f.id === clip.folderId) && (
                            <span className={`flex items-center gap-1 text-[10px] ${t.textDim} ${t.inputBg} px-1.5 py-0.5 rounded-full`}>
                              <FolderIcon className="h-2.5 w-2.5" />
                              {folders.find(f => f.id === clip.folderId)?.name}
                            </span>
                          )}
                        </div>
                        
                        {/* Actions row - only show on hover when not in select mode */}
                        {!isSelectMode && hoveredId === clip.id && (
                          <div className="flex items-center gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingClip(clip)
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isDark ? "hover:bg-white/10 text-gray-400 hover:text-indigo-400" : "hover:bg-gray-100 text-gray-500 hover:text-indigo-600"
                              }`}
                              title="编辑"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <MoveToFolderDropdown
                              clipId={clip.id}
                              currentFolderId={clip.folderId}
                              onMoved={loadClips}
                              theme={theme}
                              compact
                            />
                          </div>
                        )}
                        
                        {/* Tags preview */}
                        {clip.tags && clip.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {clip.tags.slice(0, 2).map((tag, i) => (
                              <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.inputBg} ${t.textDim}`}>
                                #{tag}
                              </span>
                            ))}
                            {clip.tags.length > 2 && (
                              <span className={`text-[10px] ${t.textFaint}`}>+{clip.tags.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Grid View */
              <div className="p-3 grid grid-cols-2 gap-2">
                {processedClips.map((clip, index) => (
                  <div 
                    key={clip.id} 
                    onClick={() => !isSelectMode && setSelectedClipId(clip.id)}
                    className={`relative p-3 cursor-pointer rounded-xl transition-all duration-300 group ${
                      selectedClipId === clip.id 
                        ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 ring-1 ring-indigo-500/50' 
                        : `${t.cardBg} ${t.cardBgHover}`
                    }`}
                  >
                    {/* Thumbnail or gradient */}
                    <div className={`w-full h-20 rounded-lg mb-2 flex items-center justify-center overflow-hidden ${
                      clip.images && clip.images.length > 0 ? '' : `bg-gradient-to-br ${t.gradientCard}`
                    }`}>
                      {clip.images && clip.images.length > 0 ? (
                        <img src={clip.images[0].src} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <FileText className={`h-6 w-6 ${t.textDisabled}`} />
                      )}
                    </div>
                    
                    {/* Checkbox */}
                    {isSelectMode && (
                      <button
                        onClick={(e) => toggleItemSelection(clip.id, e)}
                        className="absolute top-2 left-2 transition-transform hover:scale-110"
                      >
                        {selectedIds.has(clip.id) ? (
                          <CheckSquare className="h-5 w-5 text-indigo-400" />
                        ) : (
                          <Square className={`h-5 w-5 ${t.textDisabled} group-hover:${t.textDim}`} />
                        )}
                      </button>
                    )}
                    
                    <div className={`font-medium text-xs line-clamp-2 ${t.textSecondary} mb-1`}>{clip.title}</div>
                    <div className={`flex items-center gap-1.5 text-[10px] ${t.textFaint}`}>
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(clip.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                      {clip.images && clip.images.length > 0 && (
                        <span className="ml-auto flex items-center gap-0.5 text-cyan-400">
                          <ImageIcon className="h-2.5 w-2.5" />
                          {clip.images.length}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
       </div>

       {/* Main Content - 45% width */}
       <div className={`w-[45%] flex flex-col h-full overflow-hidden ${t.mainBg} transition-colors duration-300`}>
          {selectedClip ? (
            <div className="flex flex-col h-full">
              {/* Header with glass effect */}
              <div className={`p-6 border-b ${t.borderColor} relative overflow-hidden`}>
                {/* Gradient background */}
                <div className={`absolute inset-0 bg-gradient-to-r ${t.gradientAccent}`} />
                
                <div className="relative flex justify-between items-start gap-4">
                  <div className="space-y-3 flex-1 min-w-0">
                    <h1 className={`text-xl font-bold leading-tight ${t.textPrimary} line-clamp-2`}>{selectedClip.title}</h1>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <a 
                        href={selectedClip.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className={`flex items-center gap-1.5 ${t.textDim} hover:text-indigo-400 transition-colors ${t.inputBg} ${t.inputBgHover} px-3 py-1.5 rounded-lg group`}
                      >
                        <Globe className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">{new URL(selectedClip.url).hostname}</span>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                      <span className={`flex items-center gap-1.5 ${t.textFaint} text-xs`}>
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(selectedClip.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Edit Button */}
                    <button
                      onClick={() => setEditingClip(selectedClip)}
                      className={`px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 text-sm font-medium ${t.textMuted} ${t.inputBg} hover:bg-indigo-500/20 hover:text-indigo-300 hover:ring-1 hover:ring-indigo-500/30`}
                    >
                      <Pencil className="h-4 w-4" />
                      <span>编辑</span>
                    </button>
                    
                    {/* Move to Folder */}
                    <MoveToFolderDropdown
                      clipId={selectedClip.id}
                      currentFolderId={selectedClip.folderId}
                      onMoved={loadClips}
                      theme={theme}
                    />
                    
                    {/* Review Button */}
                    <button
                      onClick={() => reviewStatus[selectedClip.id] 
                        ? handleRemoveFromReview(selectedClip.id) 
                        : handleAddToReview(selectedClip.id)
                      }
                      disabled={addingToReview === selectedClip.id}
                      className={`px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 text-sm font-medium ${
                        reviewStatus[selectedClip.id]
                          ? "text-purple-400 bg-purple-500/10 ring-1 ring-purple-500/30 hover:bg-purple-500/20"
                          : `${t.textMuted} ${t.inputBg} hover:bg-purple-500/20 hover:text-purple-300 hover:ring-1 hover:ring-purple-500/30`
                      }`}
                      title={reviewStatus[selectedClip.id] ? "点击移除复习计划" : "添加到复习计划"}
                    >
                      {addingToReview === selectedClip.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Brain className="h-4 w-4" />
                          <span>{reviewStatus[selectedClip.id] ? "已加入复习" : "复习"}</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleExportToFeishu(selectedClip)}
                      disabled={exportingId === selectedClip.id || selectedClip.syncedToFeishu}
                      className={`px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 text-sm font-medium ${
                        selectedClip.syncedToFeishu 
                          ? "text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/30" 
                          : `${t.textMuted} ${t.inputBg} hover:bg-indigo-500/20 hover:text-indigo-300 hover:ring-1 hover:ring-indigo-500/30`
                      }`}
                    >
                      {exportingId === selectedClip.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : selectedClip.syncedToFeishu ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>已同步</span>
                        </>
                      ) : (
                        <>
                          <Share className="h-4 w-4" />
                          <span>同步飞书</span>
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => handleDelete(selectedClip.id)}
                      className={`p-2 ${t.textFaint} hover:text-red-400 ${t.inputBg} hover:bg-red-500/10 rounded-xl transition-all duration-300 hover:ring-1 hover:ring-red-500/30`}
                      title="删除剪藏"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Content with custom scrollbar */}
              <div className={`flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar ${theme === 'dark' ? 'dark' : ''}`}>
                
                {/* My Notes Section - Glassmorphism style */}
                <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-5 ring-1 ring-amber-500/20">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full blur-2xl" />
                  
                  <div className="relative flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold flex items-center gap-2 text-amber-300">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                        <Edit3 className="h-3.5 w-3.5 text-white" />
                      </div>
                      我的笔记
                    </h3>
                    {!isEditingNotes ? (
                      <button
                        onClick={startEditingNotes}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 rounded-lg hover:bg-amber-500/20 transition-all"
                      >
                        <Edit3 className="h-3 w-3" />
                        {selectedClip.notes ? "编辑" : "添加"}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={cancelEditingNotes}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${t.textDim} ${t.inputBg} rounded-lg ${t.inputBgHover} transition-all`}
                        >
                          <X className="h-3 w-3" />
                          取消
                        </button>
                        <button
                          onClick={saveNotes}
                          disabled={isSavingNotes}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50"
                        >
                          {isSavingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          保存
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {isEditingNotes ? (
                    <textarea
                      value={editedNotes}
                      onChange={(e) => setEditedNotes(e.target.value)}
                      placeholder="记录你的想法..."
                      className={`w-full h-32 p-3 text-sm rounded-xl border-0 ${t.sectionBg} ${t.textPrimary} ${t.placeholderText} focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none`}
                      autoFocus
                    />
                  ) : (
                    <div className={`${t.sectionBg} rounded-xl p-3`}>
                      {selectedClip.notes ? (
                        <p className={`text-sm whitespace-pre-wrap leading-relaxed ${theme === 'dark' ? 'text-amber-100/80' : 'text-amber-900/80'}`}>
                          {selectedClip.notes}
                        </p>
                      ) : (
                        <p className={`${t.textFaint} text-sm text-center py-3`}>
                          点击添加笔记...
                        </p>
                      )}
                    </div>
                  )}
                </section>

                {/* Summary Section */}
                <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 p-5 ring-1 ring-indigo-500/20">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-full blur-2xl" />
                  
                  <h3 className="relative text-base font-semibold mb-4 flex items-center gap-2 text-indigo-300">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-white" />
                    </div>
                    AI 摘要
                  </h3>
                  <div className={`${t.sectionBg} rounded-xl p-4`}>
                    <Markdown 
                      markdown={selectedClip.summary} 
                      className={`${t.textMuted} text-sm leading-relaxed [&_p]:mb-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:text-sm [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_code]:text-xs [&_code]:${t.inputBg} [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded`}
                    />
                  </div>
                </section>

                {/* AI Tags Section */}
                <ClipTagsPanel clip={selectedClip} />

                {/* Key Points Section */}
                {selectedClip.keyPoints && selectedClip.keyPoints.length > 0 && (
                  <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/5 to-teal-500/5 p-5 ring-1 ring-emerald-500/20">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-teal-500/10 to-transparent rounded-full blur-2xl" />
                    
                    <h3 className="relative text-base font-semibold mb-4 flex items-center gap-2 text-emerald-300">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                        <TrendingUp className="h-3.5 w-3.5 text-white" />
                      </div>
                      关键要点
                    </h3>
                    <div className="space-y-2">
                      {selectedClip.keyPoints.map((point, i) => (
                        <div key={i} className={`flex gap-3 p-3 ${t.sectionBg} rounded-xl`}>
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center text-xs font-bold">
                            {i + 1}
                          </span>
                          <span className={`text-sm leading-relaxed ${t.textMuted} pt-0.5`}>{point}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Raw Text Section */}
                {(selectedClip.rawTextFull || selectedClip.rawTextSnippet) && (
                  <section className={`relative overflow-hidden rounded-2xl ${t.cardBg} p-5 ring-1 ${t.ringColor}`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`text-base font-semibold flex items-center gap-2 ${t.textMuted}`}>
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gray-500 to-slate-600 flex items-center justify-center">
                          <FileText className="h-3.5 w-3.5 text-white" />
                        </div>
                        原文内容
                        {selectedClip.rawTextFull && (
                          <span className={`text-xs font-normal ${t.textFaint} ml-2`}>
                            {selectedClip.rawTextFull.length.toLocaleString()} 字
                          </span>
                        )}
                      </h3>
                      {selectedClip.rawTextFull && selectedClip.rawTextFull.length > 500 && (
                        <button
                          onClick={() => setIsRawTextExpanded(!isRawTextExpanded)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${t.textDim} ${t.inputBg} rounded-lg ${t.inputBgHover} transition-all`}
                        >
                          {isRawTextExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3" />
                              收起
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3" />
                              展开
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <div className={`relative ${t.overlayBg} rounded-xl p-4`}>
                      <div className={`text-sm leading-relaxed ${!isRawTextExpanded && selectedClip.rawTextFull && selectedClip.rawTextFull.length > 500 ? 'max-h-[200px] overflow-hidden' : ''}`}>
                        {looksLikeMarkdown(selectedClip.rawTextFull || selectedClip.rawTextSnippet || "") ? (
                          <Markdown 
                            markdown={selectedClip.rawTextFull || selectedClip.rawTextSnippet || ""} 
                            className={`${t.textDim} [&_p]:mb-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:text-sm [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_code]:text-xs [&_code]:${t.inputBg} [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:overflow-x-auto [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:${t.sectionBg}`}
                          />
                        ) : (
                          <div className={`${t.textDim} whitespace-pre-wrap`}>
                            {selectedClip.rawTextFull || selectedClip.rawTextSnippet}
                          </div>
                        )}
                      </div>
                      {!isRawTextExpanded && selectedClip.rawTextFull && selectedClip.rawTextFull.length > 500 && (
                        <div className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t ${t.fadeGradient} pointer-events-none rounded-b-xl`} />
                      )}
                    </div>
                  </section>
                )}

                {/* Images Section */}
                {selectedClip.images && selectedClip.images.length > 0 && (
                  <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 p-5 ring-1 ring-cyan-500/20">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/10 to-transparent rounded-full blur-2xl" />
                    
                    <h3 className="relative text-base font-semibold mb-4 flex items-center gap-2 text-cyan-300">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                        <ImageIcon className="h-3.5 w-3.5 text-white" />
                      </div>
                      图片
                      <span className={`text-sm font-normal ${t.textFaint}`}>
                        ({selectedClip.images.length})
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {selectedClip.images.map((img, i) => (
                        <a
                          key={i}
                          href={img.src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`group relative aspect-video ${t.overlayBg} rounded-xl overflow-hidden ring-1 ${t.ringColor} hover:ring-cyan-500/50 transition-all duration-300`}
                        >
                          <img
                            src={img.src}
                            alt={img.alt || `图片 ${i + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = "none"
                            }}
                          />
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-2">
                            <div className="flex items-center gap-1 text-white text-xs">
                              <ExternalLink className="h-3 w-3" />
                              查看原图
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                {/* Tags Section */}
                {selectedClip.tags && selectedClip.tags.length > 0 && (
                  <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/5 to-purple-500/5 p-5 ring-1 ring-violet-500/20">
                    <h3 className="text-base font-semibold mb-4 flex items-center gap-2 text-violet-300">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                        <Tag className="h-3.5 w-3.5 text-white" />
                      </div>
                      标签
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedClip.tags.map((tag, i) => (
                        <span key={i} className="px-3 py-1.5 rounded-full bg-violet-500/10 text-sm font-medium text-violet-300 ring-1 ring-violet-500/30 hover:bg-violet-500/20 transition-colors cursor-default">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="relative">
                <div className={`w-20 h-20 ${t.inputBg} rounded-2xl flex items-center justify-center`}>
                  <BookOpen className={`h-10 w-10 ${t.textDisabled}`} />
                </div>
                <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-3xl blur-xl -z-10" />
              </div>
              <p className={`${t.textDim} font-medium mt-6`}>选择一个剪藏</p>
              <p className={`${t.textDisabled} text-sm mt-1`}>从左侧列表选择查看详情</p>
            </div>
          )}
       </div>

       {/* Chat Sidebar - 30% width */}
       <div className={`w-[30%] flex flex-col h-full ${t.sidebarBg} border-l ${t.borderColor} transition-colors duration-300`}>
          {selectedClip ? (
            <>
              <div className={`p-5 border-b ${t.borderColor} relative overflow-hidden`}>
                {/* Gradient accent */}
                <div className={`absolute inset-0 bg-gradient-to-r ${t.gradientAccent}`} />
                <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl ${t.gradientGlow} rounded-full blur-2xl`} />
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-white" />
                      </div>
                      {/* Pulse indicator */}
                      <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 ${theme === 'dark' ? 'border-[#0d0d14]' : 'border-white'}`}>
                        <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75" />
                      </div>
                    </div>
                    <div>
                      <h2 className={`font-semibold text-sm ${t.textPrimary}`}>AI 助手</h2>
                      <p className={`text-[10px] ${t.textFaint} flex items-center gap-1`}>
                        <Zap className="h-2.5 w-2.5 text-amber-400" />
                        Qwen3 驱动
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={handleSaveChat}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-medium rounded-lg hover:from-indigo-400 hover:to-purple-500 transition-all duration-300 shadow-lg shadow-indigo-500/20"
                  >
                    <Save className="w-3.5 h-3.5" />
                    保存
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden relative">
                <Chat className="h-full border-0" theme={theme} />
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="relative">
                <div className={`w-16 h-16 ${t.inputBg} rounded-2xl flex items-center justify-center`}>
                  <MessageSquare className={`h-8 w-8 ${t.textDisabled}`} />
                </div>
                <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-3xl blur-xl -z-10" />
              </div>
              <p className={`${t.textDim} font-medium mt-5`}>AI 对话</p>
              <p className={`${t.textDisabled} text-xs mt-1 max-w-[180px]`}>选择剪藏后可与 AI 助手探讨内容</p>
            </div>
          )}
       </div>
    </div>
  )
}
