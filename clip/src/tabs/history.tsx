import React, { useEffect, useState, useCallback } from "react"
import { ClipStore, type Clip } from "@/lib/clip-store"
import { Trash2, ExternalLink, Search, Calendar, Tag, Save, MessageSquare, Share, Loader2, CheckSquare, Square, Edit3, X, Check, ChevronDown, ChevronUp, Star } from "lucide-react"
import { ChatProvider, useChat } from "@/contexts/chat-context"
import { ExtensionProvider, useExtension } from "@/contexts/extension-context"
import { createRecordFromClip } from "@/lib/feishuBitable"
import Chat from "@/components/chat"
import Markdown from "@/components/markdown"
import ClipTagsPanel from "@/components/clip-tags-panel"
import "../style.css"

export default function HistoryPage() {
  return (
    <ExtensionProvider>
      <ChatProvider>
        <HistoryLayout />
      </ChatProvider>
    </ExtensionProvider>
  )
}

function HistoryLayout() {
  const [clips, setClips] = useState<Clip[]>([])
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [exportingId, setExportingId] = useState<string | null>(null)
  
  // Batch selection state
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  // Notes editing state
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [editedNotes, setEditedNotes] = useState("")
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  
  // Raw text expand state
  const [isRawTextExpanded, setIsRawTextExpanded] = useState(false)
  
  const { setExtensionData, setCurrentClipId } = useExtension()
  const { chatMessages } = useChat()

  useEffect(() => {
    loadClips()
    
    // Listen for storage changes to update the list in real-time
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === "local" && changes.clips) {
        loadClips()
      }
    }
    
    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  const loadClips = async () => {
    const data = await ClipStore.getAll()
    // Sort by createdAt in descending order (newest first)
    const sorted = data.sort((a, b) => b.createdAt - a.createdAt)
    setClips(sorted)
  }

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
    if (selectedIds.size === filteredClips.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredClips.map(c => c.id)))
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
    setExportingId(clip.id)
    try {
      const recordId = await createRecordFromClip(clip)
      await ClipStore.update(clip.id, {
        syncedToFeishu: true,
        feishuRecordId: recordId
      })
      // Refresh list (though storage listener should handle it, explicit reload is safer for UI feedback)
      await loadClips()
      alert("✅ Successfully exported to Feishu!")
    } catch (e) {
      console.error(e)
      alert("❌ Export failed: " + (e as Error).message)
    } finally {
      setExportingId(null)
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

  // Truncate text to specified length
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + "..."
  }

  const selectedClip = clips.find(c => c.id === selectedClipId)

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
  }, [selectedClip, setExtensionData, setCurrentClipId])

  return (
    <div className="flex h-screen w-full bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100 dark:from-zinc-950 dark:via-slate-950 dark:to-gray-950 text-gray-900 dark:text-gray-100 font-sans">
       {/* Sidebar - 25% width */}
       <div className="w-[25%] min-w-[300px] border-r border-gray-200/80 dark:border-zinc-800/80 flex flex-col bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
          <div className="p-5 border-b border-gray-200/80 dark:border-zinc-800/80 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
                <span className="text-2xl">📚</span> 我的剪藏
              </h2>
              <button
                onClick={toggleSelectMode}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 shadow-sm ${
                  isSelectMode 
                    ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-indigo-200 dark:shadow-indigo-900/30" 
                    : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 border border-gray-200 dark:border-zinc-700"
                }`}
              >
                {isSelectMode ? "✓ 完成" : "批量管理"}
              </button>
            </div>
            
            {/* Batch actions bar */}
            {isSelectMode && (
              <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-indigo-100/80 to-purple-100/80 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl border border-indigo-200/50 dark:border-indigo-800/30">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
                >
                  {selectedIds.size === filteredClips.length && filteredClips.length > 0 ? (
                    <CheckSquare className="h-5 w-5" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                  {selectedIds.size === filteredClips.length && filteredClips.length > 0 ? "取消全选" : "全选"}
                </button>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 bg-white/60 dark:bg-zinc-800/60 px-3 py-1 rounded-full">
                  已选 <span className="text-indigo-600 dark:text-indigo-400 font-bold">{selectedIds.size}</span> 项
                </span>
                <button
                  onClick={handleBatchDelete}
                  disabled={selectedIds.size === 0}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    selectedIds.size === 0
                      ? "text-gray-400 bg-gray-100 dark:bg-zinc-800 cursor-not-allowed"
                      : "text-white bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-lg shadow-red-200 dark:shadow-red-900/30"
                  }`}
                >
                  <Trash2 className="h-4 w-4" />
                  删除选中
                </button>
              </div>
            )}
            
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input 
                placeholder="搜索剪藏内容..." 
                className="pl-12 pr-4 py-3 border-0 rounded-xl w-full text-sm bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-gray-200 dark:ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all placeholder:text-gray-400"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredClips.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-900 rounded-2xl flex items-center justify-center">
                  <Search className="h-10 w-10 text-gray-300 dark:text-zinc-600" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">暂无剪藏内容</p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">开始浏览并剪藏你感兴趣的内容吧</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {filteredClips.map(clip => (
                  <div 
                    key={clip.id} 
                    onClick={() => !isSelectMode && setSelectedClipId(clip.id)}
                    className={`p-4 cursor-pointer rounded-xl transition-all duration-200 group ${
                      selectedClipId === clip.id 
                        ? 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 ring-2 ring-indigo-400 dark:ring-indigo-500 shadow-lg shadow-indigo-100 dark:shadow-indigo-950/50' 
                        : 'bg-white dark:bg-zinc-900/50 hover:bg-gray-50 dark:hover:bg-zinc-800/50 ring-1 ring-gray-100 dark:ring-zinc-800 hover:ring-gray-200 dark:hover:ring-zinc-700 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox for batch selection */}
                      {isSelectMode && (
                        <button
                          onClick={(e) => toggleItemSelection(clip.id, e)}
                          className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110"
                        >
                          {selectedIds.has(clip.id) ? (
                            <CheckSquare className="h-5 w-5 text-indigo-500" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-300 dark:text-zinc-600 group-hover:text-gray-400 dark:group-hover:text-zinc-500" />
                          )}
                        </button>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        {/* Title */}
                        <div className="font-semibold text-sm line-clamp-2 mb-2 text-gray-800 dark:text-gray-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{clip.title}</div>
                        
                        {/* Summary Preview */}
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 leading-relaxed">
                          {truncateText(clip.summary, 100)}
                        </div>
                        
                        {/* Notes indicator */}
                        {clip.notes && (
                          <div className="text-xs text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg w-fit">
                            <Edit3 className="h-3 w-3" />
                            <span className="line-clamp-1 font-medium">{truncateText(clip.notes, 40)}</span>
                          </div>
                        )}
                        
                        {/* Rating indicator */}
                        {clip.rating && clip.rating > 0 && (
                          <div className="flex items-center gap-1 mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-3 w-3 ${
                                  star <= clip.rating!
                                    ? "fill-amber-400 text-amber-400"
                                    : "fill-transparent text-gray-300 dark:text-zinc-600"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                        
                        {/* Tags preview */}
                        {clip.tags && clip.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {clip.tags.slice(0, 3).map((tag, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                #{tag}
                              </span>
                            ))}
                            {clip.tags.length > 3 && (
                              <span className="text-[10px] text-gray-400">+{clip.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                        
                        {/* Meta info */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(clip.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                          </span>
                          <div className="flex items-center gap-2">
                            {/* Images count indicator */}
                            {clip.images && clip.images.length > 0 && (
                              <span className="text-[10px] bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded-full font-medium" title={`${clip.images.length} 张图片`}>
                                🖼️ {clip.images.length}
                              </span>
                            )}
                            {clip.syncedToFeishu && (
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium" title="已同步到飞书">
                                ✓ 已同步
                              </span>
                            )}
                            <span className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-700 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide text-gray-500 dark:text-gray-400 uppercase">
                              {clip.source}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
       </div>

       {/* Main Content - 45% width */}
       <div className="w-[45%] flex flex-col h-full overflow-hidden bg-white/60 dark:bg-zinc-950/60 backdrop-blur-sm">
          {selectedClip ? (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-8 border-b border-gray-200/80 dark:border-zinc-800/80 bg-gradient-to-r from-white via-gray-50/50 to-white dark:from-zinc-950 dark:via-zinc-900/50 dark:to-zinc-950">
                <div className="flex justify-between items-start gap-6">
                  <div className="space-y-3 flex-1 min-w-0">
                    <h1 className="text-2xl font-bold leading-tight text-gray-900 dark:text-white line-clamp-2">{selectedClip.title}</h1>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <a 
                        href={selectedClip.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="flex items-center gap-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="font-medium">{new URL(selectedClip.url).hostname}</span>
                      </a>
                      <span className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                        <Calendar className="h-4 w-4" />
                        {new Date(selectedClip.createdAt).toLocaleString('zh-CN')}
                      </span>
                      {selectedClip.updatedAt && (
                        <span className="text-xs text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-1 rounded-full">
                          更新于 {new Date(selectedClip.updatedAt).toLocaleString('zh-CN')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleExportToFeishu(selectedClip)}
                      disabled={exportingId === selectedClip.id || selectedClip.syncedToFeishu}
                      className={`px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 text-sm font-semibold ${
                        selectedClip.syncedToFeishu 
                          ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 cursor-default ring-1 ring-emerald-200 dark:ring-emerald-800" 
                          : "text-gray-600 hover:text-indigo-600 bg-gray-100 hover:bg-indigo-50 dark:text-gray-300 dark:bg-zinc-800 dark:hover:bg-indigo-900/30 hover:ring-2 hover:ring-indigo-200 dark:hover:ring-indigo-800"
                      }`}
                      title={selectedClip.syncedToFeishu ? "已导出到飞书" : "导出到飞书"}
                    >
                      {exportingId === selectedClip.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : selectedClip.syncedToFeishu ? (
                        <>
                          <Share className="h-4 w-4" />
                          <span>已同步</span>
                        </>
                      ) : (
                        <>
                          <Share className="h-5 w-5" />
                          <span>导出飞书</span>
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => handleDelete(selectedClip.id)}
                      className="p-2.5 text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 dark:bg-zinc-800 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200 hover:ring-2 hover:ring-red-200 dark:hover:ring-red-800"
                      title="删除剪藏"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                
                {/* My Notes Section - Editable */}
                <section className="bg-gradient-to-br from-amber-50 via-orange-50/50 to-yellow-50 dark:from-amber-950/20 dark:via-orange-950/10 dark:to-yellow-950/20 p-6 rounded-2xl border border-amber-200/60 dark:border-amber-800/30 shadow-lg shadow-amber-100/50 dark:shadow-amber-900/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-amber-800 dark:text-amber-200">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
                        <Edit3 className="h-4 w-4 text-white" />
                      </div>
                      我的笔记
                    </h3>
                    {!isEditingNotes ? (
                      <button
                        onClick={startEditingNotes}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300 bg-white dark:bg-zinc-900 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all duration-200 shadow-sm hover:shadow-md ring-1 ring-amber-200 dark:ring-amber-800"
                      >
                        <Edit3 className="h-4 w-4" />
                        {selectedClip.notes ? "编辑笔记" : "添加笔记"}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={cancelEditingNotes}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-zinc-800 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all duration-200 ring-1 ring-gray-200 dark:ring-zinc-700"
                        >
                          <X className="h-4 w-4" />
                          取消
                        </button>
                        <button
                          onClick={saveNotes}
                          disabled={isSavingNotes}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all duration-200 shadow-lg shadow-amber-200 dark:shadow-amber-900/30 disabled:opacity-50"
                        >
                          {isSavingNotes ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          保存笔记
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {isEditingNotes ? (
                    <textarea
                      value={editedNotes}
                      onChange={(e) => setEditedNotes(e.target.value)}
                      placeholder="在这里记录你的想法、见解或评论..."
                      className="w-full h-44 p-4 text-sm rounded-xl border-0 bg-white dark:bg-zinc-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-400 dark:focus:ring-amber-500 resize-none placeholder:text-amber-400/60"
                      autoFocus
                    />
                  ) : (
                    <div className="bg-white/60 dark:bg-zinc-900/60 rounded-xl p-4">
                      {selectedClip.notes ? (
                        <p className="whitespace-pre-wrap leading-relaxed text-amber-900 dark:text-amber-100">
                          {selectedClip.notes}
                        </p>
                      ) : (
                        <p className="text-amber-500/60 dark:text-amber-400/40 italic text-sm text-center py-4">
                          💡 点击"添加笔记"记录你对这篇内容的思考...
                        </p>
                      )}
                    </div>
                  )}
                </section>

                {/* Summary Section */}
                <section>
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-md">
                      <span className="text-white text-sm">📝</span>
                    </div>
                    AI 摘要
                  </h3>
                  <div className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-zinc-900 dark:to-slate-900 p-6 rounded-2xl border border-gray-200/60 dark:border-zinc-800 shadow-sm">
                    <Markdown 
                      markdown={selectedClip.summary} 
                      className="text-gray-700 dark:text-gray-300 leading-relaxed [&_p]:mb-3 [&_ul]:my-2 [&_ol]:my-2 [&_li]:text-sm [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_code]:text-xs"
                    />
                  </div>
                </section>

                {/* AI Tags Section - 显示 AI 标注信息 */}
                <ClipTagsPanel clip={selectedClip} />

                {/* Key Points Section */}
                {selectedClip.keyPoints && selectedClip.keyPoints.length > 0 && (
                  <section>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md">
                        <span className="text-white text-sm">✨</span>
                      </div>
                      关键要点
                    </h3>
                    <ul className="space-y-3">
                      {selectedClip.keyPoints.map((point, i) => (
                        <li key={i} className="flex gap-4 p-4 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center text-sm font-bold shadow-md">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed text-gray-700 dark:text-gray-300 pt-1">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Raw Text Section - Full text with expand/collapse */}
                {(selectedClip.rawTextFull || selectedClip.rawTextSnippet) && (
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800 dark:text-gray-200">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400 to-slate-500 flex items-center justify-center shadow-md">
                          <span className="text-white text-sm">📄</span>
                        </div>
                        原文内容
                      </h3>
                      {selectedClip.rawTextFull && selectedClip.rawTextFull.length > 500 && (
                        <button
                          onClick={() => setIsRawTextExpanded(!isRawTextExpanded)}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all duration-200"
                        >
                          {isRawTextExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              收起
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              展开全文
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="bg-gradient-to-br from-slate-50 to-gray-100 dark:from-zinc-900 dark:to-slate-900 p-6 rounded-2xl border border-gray-200/60 dark:border-zinc-800 relative">
                      <div className="absolute top-4 left-4 text-4xl text-gray-200 dark:text-zinc-700 select-none">"</div>
                      <div className={`text-sm text-gray-600 dark:text-gray-400 leading-relaxed pl-8 pr-8 whitespace-pre-wrap ${!isRawTextExpanded && selectedClip.rawTextFull && selectedClip.rawTextFull.length > 500 ? 'max-h-[300px] overflow-hidden' : ''}`}>
                        {selectedClip.rawTextFull || selectedClip.rawTextSnippet}
                      </div>
                      {!isRawTextExpanded && selectedClip.rawTextFull && selectedClip.rawTextFull.length > 500 && (
                        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-slate-50 dark:from-zinc-900 to-transparent pointer-events-none rounded-b-2xl" />
                      )}
                      <div className="absolute bottom-4 right-4 text-4xl text-gray-200 dark:text-zinc-700 select-none">"</div>
                    </div>
                    {selectedClip.rawTextFull && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
                        共 {selectedClip.rawTextFull.length.toLocaleString()} 字符
                      </p>
                    )}
                  </section>
                )}

                {/* Images Section - 图片预览 */}
                {selectedClip.images && selectedClip.images.length > 0 && (
                  <section>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-md">
                        <span className="text-white text-sm">🖼️</span>
                      </div>
                      图片
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                        ({selectedClip.images.length} 张)
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {selectedClip.images.map((img, i) => (
                        <a
                          key={i}
                          href={img.src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative aspect-video bg-gradient-to-br from-gray-100 to-slate-100 dark:from-zinc-800 dark:to-slate-800 rounded-xl overflow-hidden border border-gray-200/60 dark:border-zinc-700 shadow-sm hover:shadow-lg hover:ring-2 hover:ring-cyan-400 dark:hover:ring-cyan-500 transition-all duration-200"
                          title={img.alt || `图片 ${i + 1}`}
                        >
                          <img
                            src={img.src}
                            alt={img.alt || `图片 ${i + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            onError={(e) => {
                              // 图片加载失败时显示占位符
                              const target = e.target as HTMLImageElement
                              target.style.display = "none"
                              const placeholder = target.nextElementSibling as HTMLElement
                              if (placeholder) placeholder.style.display = "flex"
                            }}
                          />
                          <div className="hidden absolute inset-0 items-center justify-center bg-gray-100 dark:bg-zinc-800 text-gray-400">
                            <span className="text-sm">图片加载失败</span>
                          </div>
                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end">
                            <div className="p-3 w-full">
                              <p className="text-white text-xs truncate">
                                {img.alt || `点击查看原图`}
                              </p>
                              {img.width && img.height && (
                                <p className="text-white/70 text-xs">
                                  {img.width} × {img.height}
                                </p>
                              )}
                            </div>
                          </div>
                          {/* External link icon */}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-6 h-6 rounded-full bg-white/90 dark:bg-zinc-800/90 flex items-center justify-center shadow">
                              <ExternalLink className="h-3 w-3 text-gray-600 dark:text-gray-300" />
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                {/* Tags Section */}
                {selectedClip.tags && selectedClip.tags.length > 0 && (
                  <section>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-200">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-md">
                        <Tag className="h-4 w-4 text-white" />
                      </div>
                      标签
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedClip.tags.map((tag, i) => (
                        <span key={i} className="px-4 py-2 rounded-full bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 text-sm font-medium text-violet-700 dark:text-violet-300 border border-violet-200/50 dark:border-violet-800/30 shadow-sm hover:shadow-md transition-shadow cursor-default">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-6">
              <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-900 rounded-3xl flex items-center justify-center shadow-lg">
                <Search className="h-12 w-12 text-gray-300 dark:text-zinc-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-gray-500 dark:text-gray-400">选择一个剪藏</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">从左侧列表选择查看详情</p>
              </div>
            </div>
          )}
       </div>

       {/* Chat Sidebar - 30% width */}
       <div className="w-[30%] flex flex-col h-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-l border-gray-200/80 dark:border-zinc-800/80">
          {selectedClip ? (
            <>
              <div className="p-5 border-b border-gray-200/80 dark:border-zinc-800/80 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/30 dark:to-purple-950/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-sm text-gray-800 dark:text-gray-100">AI 智能助手</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">由 Qwen3 驱动</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleSaveChat}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 hover:shadow-xl"
                    title="将当前对话保存为新剪藏"
                  >
                    <Save className="w-4 h-4" />
                    保存对话
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden relative">
                <Chat className="h-full border-0" />
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 mb-6 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-3xl flex items-center justify-center shadow-lg">
                <MessageSquare className="h-10 w-10 text-indigo-400 dark:text-indigo-500" />
              </div>
              <p className="text-lg font-medium text-gray-500 dark:text-gray-400">开始 AI 对话</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 max-w-[200px]">选择左侧的剪藏，与 AI 助手深入探讨内容</p>
            </div>
          )}
       </div>
    </div>
  )
}
