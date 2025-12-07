import React, { useEffect, useState } from "react"
import { FiMessageSquare, FiX, FiSmile, FiMeh, FiFrown } from "react-icons/fi"

import { Button } from "."

export const FeedbackPage = ({ onClose }: { onClose?: () => void }) => {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [selectedReaction, setSelectedReaction] = useState<string | null>("smile")

  useEffect(() => {
    chrome.storage.local.get("clip_darkMode", (res) => {
      if (res.clip_darkMode) {
        setIsDarkMode(true)
      }
    })
  }, [])

  return (
    <div 
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isDarkMode ? "rgba(15, 23, 42, 0.6)" : "rgba(255, 255, 255, 0.6)",
        backdropFilter: "blur(4px)"
      }}
      className={`fixed inset-0 z-[2147483647] flex items-center justify-center backdrop-blur-sm transition-all duration-300 ${
        isDarkMode ? "bg-slate-900/60" : "bg-white/60"
      }`}
    >
      <div 
        style={{
          width: "480px",
          padding: "24px",
          borderRadius: "16px",
          borderWidth: "1px",
          backgroundColor: isDarkMode ? "#0f172a" : "#ffffff",
          borderColor: isDarkMode ? "#334155" : "#f1f5f9",
          color: isDarkMode ? "#f1f5f9" : "#1e293b",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
        }}
        className={`w-[480px] rounded-2xl shadow-2xl border p-6 transform transition-all duration-300 scale-100 ${
          isDarkMode 
            ? "bg-slate-900 border-slate-700 text-slate-100" 
            : "bg-white border-slate-100 text-slate-800"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
              <FiMessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">意见反馈</h2>
              <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                帮助我们做得更好
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${
              isDarkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"
            }`}
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Reaction Selection */}
        <div className="mb-6">
          <label className={`text-sm font-medium mb-3 block ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            您对 Clip Plugin 的体验如何？
          </label>
          <div className="grid grid-cols-3 gap-3">
            <ReactionButton 
              icon={<FiSmile />} 
              label="满意" 
              active={selectedReaction === "smile"} 
              isDarkMode={isDarkMode}
              onClick={() => setSelectedReaction("smile")}
            />
            <ReactionButton 
              icon={<FiMeh />} 
              label="一般" 
              active={selectedReaction === "meh"} 
              isDarkMode={isDarkMode}
              onClick={() => setSelectedReaction("meh")}
            />
            <ReactionButton 
              icon={<FiFrown />} 
              label="不满意" 
              active={selectedReaction === "frown"} 
              isDarkMode={isDarkMode}
              onClick={() => setSelectedReaction("frown")}
            />
          </div>
        </div>

        {/* Feedback Input */}
        <div className="mb-8">
          <label className={`text-sm font-medium mb-2 block ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            您的建议或遇到的问题
          </label>
          <textarea 
            className={`w-full h-32 p-4 rounded-xl border resize-none outline-none transition-all text-sm ${
              isDarkMode 
                ? "bg-slate-800/50 border-slate-700 placeholder-slate-500 focus:border-blue-500/50 focus:bg-slate-800" 
                : "bg-slate-50 border-slate-200 placeholder-slate-400 focus:border-blue-500/50 focus:bg-white"
            }`}
            placeholder="请详细描述您遇到的问题或建议，我们会认真阅读每一条反馈..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className={isDarkMode ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-600"}
          >
            取消
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20">
            提交反馈
          </Button>
        </div>
      </div>
    </div>
  )
}

const ReactionButton = ({ 
  icon, 
  label, 
  active, 
  isDarkMode,
  onClick
}: { 
  icon: React.ReactNode, 
  label: string, 
  active: boolean, 
  isDarkMode: boolean,
  onClick?: () => void
}) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-200 ${
      active 
        ? "bg-blue-500/10 border-blue-500 text-blue-500 ring-1 ring-blue-500/20" 
        : isDarkMode
          ? "border-slate-700 bg-slate-800/30 text-slate-400 hover:bg-slate-800 hover:border-slate-600"
          : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-white hover:border-slate-300"
    }`}
  >
    <div className="text-2xl">{icon}</div>
    <span className="text-xs font-medium">{label}</span>
  </button>
)

export default FeedbackPage
