import React, { useState, useEffect, useCallback } from "react"
import { ClipStore, type Clip, type ClipImage } from "@/lib/clip-store"
import { X, Save, Trash2, Plus, Image as ImageIcon, FileText, Link, Loader2, AlertCircle } from "lucide-react"

interface ClipEditModalProps {
  clip: Clip
  onClose: () => void
  onSaved: () => void
  theme: "dark" | "light"
}

export default function ClipEditModal({ clip, onClose, onSaved, theme }: ClipEditModalProps) {
  const isDark = theme === "dark"
  
  // 编辑状态
  const [title, setTitle] = useState(clip.title)
  const [rawTextFull, setRawTextFull] = useState(clip.rawTextFull || clip.rawTextSnippet || "")
  const [notes, setNotes] = useState(clip.notes || "")
  const [images, setImages] = useState<ClipImage[]>(clip.images || [])
  
  // UI 状态
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<"content" | "images">("content")
  const [newImageUrl, setNewImageUrl] = useState("")
  const [newImageAlt, setNewImageAlt] = useState("")
  const [isAddingImage, setIsAddingImage] = useState(false)
  const [imageToDelete, setImageToDelete] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 保存更改
  const handleSave = async () => {
    if (!title.trim()) {
      setError("标题不能为空")
      return
    }
    
    setIsSaving(true)
    setError(null)
    
    try {
      await ClipStore.update(clip.id, {
        title: title.trim(),
        rawTextFull,
        rawTextSnippet: rawTextFull.slice(0, 500),
        notes,
        images,
        updatedAt: Date.now()
      })
      onSaved()
      onClose()
    } catch (e) {
      console.error("保存失败:", e)
      setError("保存失败，请重试")
    } finally {
      setIsSaving(false)
    }
  }

  // 添加图片
  const handleAddImage = () => {
    if (!newImageUrl.trim()) {
      setError("请输入图片 URL")
      return
    }
    
    // 验证 URL 格式
    try {
      new URL(newImageUrl)
    } catch {
      setError("请输入有效的 URL")
      return
    }
    
    const newImage: ClipImage = {
      src: newImageUrl.trim(),
      alt: newImageAlt.trim() || undefined
    }
    
    setImages([...images, newImage])
    setNewImageUrl("")
    setNewImageAlt("")
    setIsAddingImage(false)
    setError(null)
  }

  // 删除图片
  const handleDeleteImage = (index: number) => {
    const newImages = [...images]
    newImages.splice(index, 1)
    setImages(newImages)
    setImageToDelete(null)
  }

  // 关闭时检查是否有未保存的更改
  const hasChanges = useCallback(() => {
    return (
      title !== clip.title ||
      rawTextFull !== (clip.rawTextFull || clip.rawTextSnippet || "") ||
      notes !== (clip.notes || "") ||
      JSON.stringify(images) !== JSON.stringify(clip.images || [])
    )
  }, [title, rawTextFull, notes, images, clip])

  const handleClose = () => {
    if (hasChanges()) {
      if (confirm("有未保存的更改，确定要关闭吗？")) {
        onClose()
      }
    } else {
      onClose()
    }
  }

  // ESC 关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose()
      }
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [hasChanges])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal 内容 */}
      <div className={`relative w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
        isDark ? "bg-[#12121a]" : "bg-white"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? "border-white/10" : "border-gray-200"
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>编辑剪藏</h2>
              <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                修改内容后点击保存
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark 
                ? "hover:bg-white/10 text-gray-400 hover:text-white" 
                : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex border-b ${isDark ? "border-white/10" : "border-gray-200"}`}>
          <button
            onClick={() => setActiveTab("content")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "content"
                ? "border-indigo-500 text-indigo-500"
                : `border-transparent ${isDark ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`
            }`}
          >
            <FileText className="w-4 h-4" />
            内容编辑
          </button>
          <button
            onClick={() => setActiveTab("images")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "images"
                ? "border-indigo-500 text-indigo-500"
                : `border-transparent ${isDark ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700"}`
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            图片管理
            {images.length > 0 && (
              <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                isDark ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-100 text-indigo-600"
              }`}>
                {images.length}
              </span>
            )}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "content" ? (
            <div className="space-y-5">
              {/* 标题 */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}>
                  标题 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入标题..."
                  className={`w-full px-4 py-3 rounded-xl border-0 text-sm transition-all ${
                    isDark 
                      ? "bg-white/5 text-white placeholder:text-gray-500 focus:bg-white/10 focus:ring-2 focus:ring-indigo-500/50" 
                      : "bg-gray-100 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/50"
                  }`}
                />
              </div>

              {/* 原文内容 */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}>
                  原文内容
                </label>
                <textarea
                  value={rawTextFull}
                  onChange={(e) => setRawTextFull(e.target.value)}
                  placeholder="输入原文内容..."
                  rows={10}
                  className={`w-full px-4 py-3 rounded-xl border-0 text-sm resize-none transition-all ${
                    isDark 
                      ? "bg-white/5 text-white placeholder:text-gray-500 focus:bg-white/10 focus:ring-2 focus:ring-indigo-500/50" 
                      : "bg-gray-100 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/50"
                  }`}
                />
                <p className={`mt-1 text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  {rawTextFull.length.toLocaleString()} 字符
                </p>
              </div>

              {/* 个人备注 */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}>
                  个人备注
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="记录你的想法和笔记..."
                  rows={4}
                  className={`w-full px-4 py-3 rounded-xl border-0 text-sm resize-none transition-all ${
                    isDark 
                      ? "bg-white/5 text-white placeholder:text-gray-500 focus:bg-white/10 focus:ring-2 focus:ring-indigo-500/50" 
                      : "bg-gray-100 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/50"
                  }`}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 添加图片按钮 */}
              {!isAddingImage ? (
                <button
                  onClick={() => setIsAddingImage(true)}
                  className={`w-full p-4 rounded-xl border-2 border-dashed transition-all flex items-center justify-center gap-2 ${
                    isDark 
                      ? "border-white/10 hover:border-indigo-500/50 text-gray-400 hover:text-indigo-400" 
                      : "border-gray-200 hover:border-indigo-300 text-gray-500 hover:text-indigo-600"
                  }`}
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-medium">添加图片</span>
                </button>
              ) : (
                <div className={`p-4 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
                  <div className="space-y-3">
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${
                        isDark ? "text-gray-400" : "text-gray-600"
                      }`}>
                        图片 URL <span className="text-red-400">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <Link className={`w-4 h-4 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
                        <input
                          type="url"
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className={`flex-1 px-3 py-2 rounded-lg border-0 text-sm ${
                            isDark 
                              ? "bg-white/5 text-white placeholder:text-gray-500" 
                              : "bg-white text-gray-900 placeholder:text-gray-400"
                          }`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${
                        isDark ? "text-gray-400" : "text-gray-600"
                      }`}>
                        图片描述（可选）
                      </label>
                      <input
                        type="text"
                        value={newImageAlt}
                        onChange={(e) => setNewImageAlt(e.target.value)}
                        placeholder="描述这张图片..."
                        className={`w-full px-3 py-2 rounded-lg border-0 text-sm ${
                          isDark 
                            ? "bg-white/5 text-white placeholder:text-gray-500" 
                            : "bg-white text-gray-900 placeholder:text-gray-400"
                        }`}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => {
                          setIsAddingImage(false)
                          setNewImageUrl("")
                          setNewImageAlt("")
                          setError(null)
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isDark 
                            ? "text-gray-400 hover:text-white hover:bg-white/10" 
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        取消
                      </button>
                      <button
                        onClick={handleAddImage}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 图片列表 */}
              {images.length === 0 ? (
                <div className={`text-center py-12 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                  <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">暂无图片</p>
                  <p className="text-xs mt-1">点击上方按钮添加图片</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {images.map((img, index) => (
                    <div
                      key={index}
                      className={`group relative aspect-video rounded-xl overflow-hidden ${
                        isDark ? "bg-white/5 ring-1 ring-white/10" : "bg-gray-100 ring-1 ring-gray-200"
                      }`}
                    >
                      <img
                        src={img.src}
                        alt={img.alt || `图片 ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = "none"
                          target.parentElement!.querySelector('.error-placeholder')?.classList.remove('hidden')
                        }}
                      />
                      {/* Error placeholder */}
                      <div className={`error-placeholder hidden absolute inset-0 flex items-center justify-center ${
                        isDark ? "bg-white/5" : "bg-gray-100"
                      }`}>
                        <div className="text-center">
                          <ImageIcon className={`w-8 h-8 mx-auto mb-1 ${isDark ? "text-gray-600" : "text-gray-400"}`} />
                          <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>加载失败</p>
                        </div>
                      </div>
                      
                      {/* Delete button */}
                      <button
                        onClick={() => setImageToDelete(index)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      {/* Alt text */}
                      {img.alt && (
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                          <p className="text-xs text-white truncate">{img.alt}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 删除确认 */}
              {imageToDelete !== null && (
                <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60`}>
                  <div className={`p-6 rounded-2xl max-w-sm w-full ${
                    isDark ? "bg-[#1a1a24]" : "bg-white"
                  }`}>
                    <h3 className={`font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                      确认删除
                    </h3>
                    <p className={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      确定要删除这张图片吗？此操作无法撤销。
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setImageToDelete(null)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                          isDark 
                            ? "text-gray-400 hover:bg-white/10" 
                            : "text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleDeleteImage(imageToDelete)}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-4 border-t ${
          isDark ? "border-white/10" : "border-gray-200"
        }`}>
          <div className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            {hasChanges() && "* 有未保存的更改"}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDark 
                  ? "text-gray-400 hover:text-white hover:bg-white/10" 
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-400 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  保存更改
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
