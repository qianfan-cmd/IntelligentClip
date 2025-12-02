import React, { useState, useEffect, useRef } from "react"
import { FolderStore, type Folder } from "@/lib/clip-store"
import { 
  Folder as FolderIcon, 
  FolderPlus, 
  FolderOpen, 
  ChevronRight,
  MoreHorizontal,
  Edit3,
  Trash2,
  X,
  Check,
  Inbox
} from "lucide-react"

interface FolderSidebarProps {
  selectedFolderId: string | null  // null = 全部, undefined 会被转成 null
  onSelectFolder: (folderId: string | null) => void
  clipCounts: Record<string, number>  // folderId -> count
  totalCount: number
  uncategorizedCount: number
  theme: "dark" | "light"
}

// 预设颜色
const FOLDER_COLORS = [
  { name: "indigo", class: "bg-indigo-500" },
  { name: "purple", class: "bg-purple-500" },
  { name: "blue", class: "bg-blue-500" },
  { name: "cyan", class: "bg-cyan-500" },
  { name: "emerald", class: "bg-emerald-500" },
  { name: "amber", class: "bg-amber-500" },
  { name: "rose", class: "bg-rose-500" },
  { name: "gray", class: "bg-gray-500" },
]

export default function FolderSidebar({
  selectedFolderId,
  onSelectFolder,
  clipCounts,
  totalCount,
  uncategorizedCount,
  theme
}: FolderSidebarProps) {
  const isDark = theme === "dark"
  const [folders, setFolders] = useState<Folder[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [newFolderColor, setNewFolderColor] = useState("indigo")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // 加载文件夹
  const loadFolders = async () => {
    const data = await FolderStore.getAll()
    setFolders(data.sort((a, b) => a.createdAt - b.createdAt))
  }

  useEffect(() => {
    loadFolders()
    
    // 监听存储变化
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === "local" && changes.folders) {
        loadFolders()
      }
    }
    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => chrome.storage.onChanged.removeListener(handleStorageChange)
  }, [])

  // 创建后聚焦输入框
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isCreating])

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // 创建文件夹
  const handleCreate = async () => {
    if (!newFolderName.trim()) return
    
    await FolderStore.create(newFolderName.trim(), newFolderColor)
    setNewFolderName("")
    setNewFolderColor("indigo")
    setIsCreating(false)
    loadFolders()
  }

  // 重命名文件夹
  const handleRename = async (id: string) => {
    if (!editingName.trim()) return
    
    await FolderStore.rename(id, editingName.trim())
    setEditingId(null)
    setEditingName("")
    loadFolders()
  }

  // 删除文件夹
  const handleDelete = async (id: string) => {
    await FolderStore.delete(id)
    setDeletingId(null)
    
    // 如果当前选中的就是被删除的文件夹，切换到全部
    if (selectedFolderId === id) {
      onSelectFolder(null)
    }
    loadFolders()
  }

  const getColorClass = (colorName?: string) => {
    const color = FOLDER_COLORS.find(c => c.name === colorName) || FOLDER_COLORS[0]
    return color.class
  }

  return (
    <div className={`w-full ${isDark ? "text-gray-300" : "text-gray-700"}`}>
      {/* 标题 */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className={`text-xs font-semibold uppercase tracking-wider ${
          isDark ? "text-gray-500" : "text-gray-400"
        }`}>
          文件夹
        </h3>
        <button
          onClick={() => setIsCreating(true)}
          className={`p-1 rounded-lg transition-colors ${
            isDark 
              ? "hover:bg-white/10 text-gray-500 hover:text-indigo-400" 
              : "hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
          }`}
          title="新建文件夹"
        >
          <FolderPlus className="w-4 h-4" />
        </button>
      </div>

      {/* 创建文件夹表单 */}
      {isCreating && (
        <div className={`mb-3 p-3 rounded-xl ${
          isDark ? "bg-white/5" : "bg-gray-50"
        }`}>
          <input
            ref={inputRef}
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate()
              if (e.key === "Escape") setIsCreating(false)
            }}
            placeholder="文件夹名称..."
            className={`w-full px-3 py-2 rounded-lg border-0 text-sm mb-2 ${
              isDark 
                ? "bg-white/5 text-white placeholder:text-gray-500" 
                : "bg-white text-gray-900 placeholder:text-gray-400"
            }`}
          />
          {/* 颜色选择 */}
          <div className="flex items-center gap-1.5 mb-3">
            {FOLDER_COLORS.map((color) => (
              <button
                key={color.name}
                onClick={() => setNewFolderColor(color.name)}
                className={`w-5 h-5 rounded-full ${color.class} transition-transform ${
                  newFolderColor === color.name ? "ring-2 ring-offset-2 ring-offset-transparent scale-110" : ""
                } ${isDark ? "ring-white/50" : "ring-gray-400"}`}
              />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setIsCreating(false)
                setNewFolderName("")
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={!newFolderName.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              创建
            </button>
          </div>
        </div>
      )}

      {/* 文件夹列表 */}
      <div className="space-y-1">
        {/* 全部剪藏 */}
        <button
          onClick={() => onSelectFolder(null)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
            selectedFolderId === null
              ? isDark 
                ? "bg-indigo-500/20 text-indigo-300" 
                : "bg-indigo-50 text-indigo-700"
              : isDark
                ? "hover:bg-white/5 text-gray-400"
                : "hover:bg-gray-50 text-gray-600"
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span className="flex-1 text-left text-sm font-medium">全部剪藏</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isDark ? "bg-white/10" : "bg-gray-200"
          }`}>
            {totalCount}
          </span>
        </button>

        {/* 未归类 */}
        <button
          onClick={() => onSelectFolder("uncategorized")}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
            selectedFolderId === "uncategorized"
              ? isDark 
                ? "bg-indigo-500/20 text-indigo-300" 
                : "bg-indigo-50 text-indigo-700"
              : isDark
                ? "hover:bg-white/5 text-gray-400"
                : "hover:bg-gray-50 text-gray-600"
          }`}
        >
          <FolderIcon className="w-4 h-4" />
          <span className="flex-1 text-left text-sm font-medium">未归类</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isDark ? "bg-white/10" : "bg-gray-200"
          }`}>
            {uncategorizedCount}
          </span>
        </button>

        {/* 自定义文件夹 */}
        {folders.map((folder) => (
          <div key={folder.id} className="relative group">
            {editingId === folder.id ? (
              // 编辑模式
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                isDark ? "bg-white/5" : "bg-gray-50"
              }`}>
                <div className={`w-4 h-4 rounded ${getColorClass(folder.color)}`} />
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(folder.id)
                    if (e.key === "Escape") {
                      setEditingId(null)
                      setEditingName("")
                    }
                  }}
                  className={`flex-1 px-2 py-1 rounded text-sm border-0 ${
                    isDark ? "bg-white/5 text-white" : "bg-white text-gray-900"
                  }`}
                  autoFocus
                />
                <button
                  onClick={() => handleRename(folder.id)}
                  className="p-1 text-emerald-500 hover:text-emerald-400"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setEditingId(null)
                    setEditingName("")
                  }}
                  className={`p-1 ${isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              // 正常显示
              <button
                onClick={() => onSelectFolder(folder.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  selectedFolderId === folder.id
                    ? isDark 
                      ? "bg-indigo-500/20 text-indigo-300" 
                      : "bg-indigo-50 text-indigo-700"
                    : isDark
                      ? "hover:bg-white/5 text-gray-400"
                      : "hover:bg-gray-50 text-gray-600"
                }`}
              >
                <div className={`w-4 h-4 rounded ${getColorClass(folder.color)}`} />
                <span className="flex-1 text-left text-sm font-medium truncate">{folder.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  isDark ? "bg-white/10" : "bg-gray-200"
                }`}>
                  {clipCounts[folder.id] || 0}
                </span>
                
                {/* 更多操作按钮 */}
                <div 
                  className="relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setMenuOpenId(menuOpenId === folder.id ? null : folder.id)}
                    className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                      isDark ? "hover:bg-white/10" : "hover:bg-gray-200"
                    }`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  
                  {/* 下拉菜单 */}
                  {menuOpenId === folder.id && (
                    <div 
                      ref={menuRef}
                      className={`absolute right-0 top-full mt-1 z-10 w-32 rounded-lg shadow-lg py-1 ${
                        isDark ? "bg-[#1a1a24] ring-1 ring-white/10" : "bg-white ring-1 ring-gray-200"
                      }`}
                    >
                      <button
                        onClick={() => {
                          setEditingId(folder.id)
                          setEditingName(folder.name)
                          setMenuOpenId(null)
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm ${
                          isDark ? "hover:bg-white/5 text-gray-300" : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        重命名
                      </button>
                      <button
                        onClick={() => {
                          setDeletingId(folder.id)
                          setMenuOpenId(null)
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 ${
                          isDark ? "hover:bg-red-500/10" : "hover:bg-red-50"
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 删除确认对话框 */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className={`p-6 rounded-2xl max-w-sm w-full ${
            isDark ? "bg-[#1a1a24]" : "bg-white"
          }`}>
            <h3 className={`font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
              删除文件夹
            </h3>
            <p className={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              确定要删除这个文件夹吗？文件夹内的剪藏将移动到"未归类"。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingId(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  isDark ? "text-gray-400 hover:bg-white/10" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
