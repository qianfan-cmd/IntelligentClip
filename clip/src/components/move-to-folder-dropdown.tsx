import React, { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { FolderStore, ClipStore, type Folder } from "@/lib/clip-store"
import { useI18n } from "@/lib/use-i18n"
import { Folder as FolderIcon, FolderOpen, ChevronDown, Check, Inbox } from "lucide-react"

interface MoveToFolderDropdownProps {
  clipId: string
  currentFolderId?: string
  onMoved?: () => void
  theme: "dark" | "light"
  compact?: boolean  // 紧凑模式，只显示图标
}

// 添加自定义滚动条样式
const ScrollbarStyles = () => (
  <style jsx global>{`
    /* 深色主题滚动条样式 */
    .scrollbar-dark::-webkit-scrollbar {
      width: 6px;
    }
    .scrollbar-dark::-webkit-scrollbar-track {
      background: #1a1a24; /* 与下拉框背景颜色一致 */
      border-radius: 3px;
    }
    .scrollbar-dark::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2); /* 半透明白色，保持可见性 */
      border-radius: 3px;
    }
    .scrollbar-dark::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.3); /* 悬停时稍微变亮 */
    }
    
    /* 浅色主题滚动条样式 */
    .scrollbar-light::-webkit-scrollbar {
      width: 6px;
    }
    .scrollbar-light::-webkit-scrollbar-track {
      background: white; /* 与下拉框背景颜色一致 */
      border-radius: 3px;
    }
    .scrollbar-light::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.2); /* 半透明黑色，保持可见性 */
      border-radius: 3px;
    }
    .scrollbar-light::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.3); /* 悬停时稍微变暗 */
    }
    
    /* Firefox 滚动条样式通过scrollbar-color属性在style中设置 */
    .scrollbar-dark {
      scrollbar-color: rgba(255, 255, 255, 0.2) #1a1a24;
    }
    .scrollbar-light {
      scrollbar-color: rgba(0, 0, 0, 0.2) white;
    }
  `}</style>
);

export default function MoveToFolderDropdown({
  clipId,
  currentFolderId,
  onMoved,
  theme,
  compact = false
}: MoveToFolderDropdownProps) {
  const isDark = theme === "dark"
  const { t } = useI18n()
  const [folders, setFolders] = useState<Folder[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [dropdownHeight, setDropdownHeight] = useState(0) // 存储动态计算的下拉框高度
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // 计算下拉框项的高度
  const ITEM_HEIGHT = 40 // 每个选项的高度 (py-2.5 = 10px padding top + bottom + 20px content ~ 40px)
  const SEPARATOR_HEIGHT = 8 // 分隔线高度 (my-1 = 4px margin top + bottom ~ 8px)
  const NO_FOLDERS_HEIGHT = 64 // 无文件夹提示的高度 (py-4 = 16px padding top + bottom ~ 64px)
  const MAX_HEIGHT = 200 // 设置最大高度，防止下拉框过高

  // 加载文件夹
  useEffect(() => {
    const loadFolders = async () => {
      const data = await FolderStore.getAll()
      setFolders(data.sort((a, b) => a.createdAt - b.createdAt))
    }
    loadFolders()
    
    // 监听存储变化，当文件夹列表更新时自动刷新
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === "local" && changes.folders) {
        loadFolders()
      }
    }
    chrome.storage.onChanged.addListener(handleStorageChange)
    return () => chrome.storage.onChanged.removeListener(handleStorageChange)
  }, [])

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // 根据文件夹数量动态计算下拉框高度
  // 测试指导：
  // 1. 无文件夹场景：创建一个空文件夹列表，验证下拉框高度是否为NO_FOLDERS_HEIGHT (64px)
  // 2. 少量文件夹场景：添加1-5个文件夹，验证下拉框高度是否按比例增加
  // 3. 大量文件夹场景：添加超过多个文件夹，验证下拉框高度限制在MAX_HEIGHT (320px)并显示滚动条
  // 4. 滚动测试：添加足够多的文件夹，验证能否通过滚动查看所有文件夹
  useEffect(() => {
    if (isOpen) {
      let calculatedHeight: number
      
      if (folders.length === 0) {
        // 无文件夹时只显示提示信息
        calculatedHeight = NO_FOLDERS_HEIGHT
      } else {
        // 计算所有文件夹选项的总高度
        // 1个分隔线 + 文件夹数量个选项 + 未归类选项
        calculatedHeight = ITEM_HEIGHT + SEPARATOR_HEIGHT + (folders.length * ITEM_HEIGHT)
        // 确保高度不超过最大值
        calculatedHeight = Math.min(calculatedHeight, MAX_HEIGHT)
      }
      
      setDropdownHeight(calculatedHeight)
    }
  }, [folders.length, isOpen])

  // 计算下拉框位置，并在打开时刷新文件夹列表
  useEffect(() => {
    if (isOpen && buttonRef.current && dropdownHeight > 0) {
      const rect = buttonRef.current.getBoundingClientRect()
      const dropdownWidth = 192 // w-48 (12rem)
      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight
      
      // 计算左侧位置：优先按钮左对齐，如果超出屏幕右边则右对齐
      let left = rect.left
      if (left + dropdownWidth > windowWidth - 16) {
        // 如果超出右边界，改为右对齐
        left = rect.right - dropdownWidth
      }
      // 确保不超出左边界
      if (left < 16) {
        left = 16
      }
      
      // 计算顶部位置：优先在按钮下方，如果空间不够则在上方
      let top = rect.bottom + 4
      if (top + dropdownHeight > windowHeight - 16) {
        // 如果下方空间不够，显示在按钮上方
        top = rect.top - dropdownHeight - 4
      }
      
      setDropdownPosition({ top, left })
      
      // 打开下拉菜单时重新加载文件夹列表
      const refreshFolders = async () => {
        const data = await FolderStore.getAll()
        setFolders(data.sort((a, b) => a.createdAt - b.createdAt))
      }
      refreshFolders()
    }
  }, [isOpen, dropdownHeight])

  // 移动到文件夹
  const handleMove = async (folderId: string | undefined) => {
    if (folderId === currentFolderId) {
      setIsOpen(false)
      return
    }
    
    setIsMoving(true)
    try {
      await ClipStore.moveToFolder(clipId, folderId)
      onMoved?.()
    } catch (e) {
      console.error("移动失败:", e)
    } finally {
      setIsMoving(false)
      setIsOpen(false)
    }
  }

  // 获取当前文件夹名称
  const currentFolder = folders.find(f => f.id === currentFolderId)

  // 预设颜色
  const getColorClass = (colorName?: string) => {
    const colors: Record<string, string> = {
      indigo: "bg-indigo-500",
      purple: "bg-purple-500",
      blue: "bg-blue-500",
      cyan: "bg-cyan-500",
      emerald: "bg-emerald-500",
      amber: "bg-amber-500",
      rose: "bg-rose-500",
      gray: "bg-gray-500",
    }
    return colors[colorName || "indigo"] || colors.indigo
  }

  return (
    <div className="relative">
      {/* 自定义滚动条样式 */}
      <ScrollbarStyles />
      {/* Trigger Button */}
      {/** title="移动到文件夹" */}
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        disabled={isMoving}
        className={`flex items-center gap-2 rounded-lg transition-all ${
          compact 
            ? `p-2 ${isDark ? "hover:bg-white/10 text-gray-400 hover:text-indigo-400" : "hover:bg-gray-100 text-gray-500 hover:text-indigo-600"}`
            : `px-3 py-1.5 text-xs font-medium ${
                isDark 
                  ? "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-300" 
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-700"
              }`
        }`}
        title={t("moveToFolderDropdownMoveToFolder")}
      >
        {isMoving ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : currentFolder ? (
          <div className={`w-3.5 h-3.5 rounded ${getColorClass(currentFolder.color)}`} />
        ) : (
          <FolderIcon className="w-4 h-4" />
        )}
        {!compact && (
          <>
            <span className="max-w-[80px] truncate">
              {/** {currentFolder?.name || "移动到..."} */}
              {currentFolder?.name || t("moveToFolderDropdownMoveTo")}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {/* Dropdown Menu - 使用 Portal 渲染到 body */}
      {isOpen && createPortal(
        <div 
            ref={dropdownRef}
            style={{
              maxHeight: MAX_HEIGHT,
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              zIndex: 99999,
              // 滚动条基础样式
              scrollbarWidth: 'thin', // Firefox
              // 针对Chrome、Edge等WebKit浏览器的自定义滚动条样式通过CSS实现
            }}
            className={`fixed w-48 rounded-xl shadow-2xl py-1 overflow-y-auto ${
              isDark 
                ? "bg-[#1a1a24] ring-1 ring-white/10 scrollbar-dark" 
                : "bg-white ring-1 ring-gray-200 shadow-lg scrollbar-light"
            }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 未归类选项 */}
          <button
            onClick={() => handleMove(undefined)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
              !currentFolderId
                ? isDark ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-50 text-indigo-700"
                : isDark ? "hover:bg-white/5 text-gray-300" : "hover:bg-gray-50 text-gray-700"
            }`}
          >
            <Inbox className="w-4 h-4" />
            {/** 未归类 */}
            <span className="flex-1 text-left">{t("moveToFolderDropdownUncategorized")}</span>
            {!currentFolderId && <Check className="w-4 h-4 text-indigo-500" />}
          </button>

          {folders.length > 0 && (
            <div className={`my-1 border-t ${isDark ? "border-white/10" : "border-gray-100"}`} />
          )}

          {/* 文件夹列表 */}
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => handleMove(folder.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                currentFolderId === folder.id
                  ? isDark ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-50 text-indigo-700"
                  : isDark ? "hover:bg-white/5 text-gray-300" : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              <div className={`w-4 h-4 rounded ${getColorClass(folder.color)}`} />
              <span className="flex-1 text-left truncate">{folder.name}</span>
              {currentFolderId === folder.id && <Check className="w-4 h-4 text-indigo-500" />}
            </button>
          ))}

          {folders.length === 0 && (
            <div className={`px-3 py-4 text-center text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
              {/** 暂无文件夹 */}
              {t("moveToFolderDropdownNoFolders")}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
