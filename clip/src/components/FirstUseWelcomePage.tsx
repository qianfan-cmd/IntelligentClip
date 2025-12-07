import React, { useEffect, useState } from "react"
import { FiCheckCircle, FiCpu, FiLayout, FiZap } from "react-icons/fi"

import { Button } from "."

// Storage key for first use flag
export const FIRST_USE_KEY = "clip_plugin_first_use_completed"

const FirstUseWelcomePage = ({ onDismiss }: { onDismiss?: () => void }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    // Check if it's the first use
    chrome.storage.local.get([FIRST_USE_KEY, "clip_darkMode"], (result) => {
      const isFirstUse = !result[FIRST_USE_KEY]
      if (isFirstUse) {
        setIsVisible(true)
      }
      if (result.clip_darkMode) {
        setIsDarkMode(true)
      }
    })
  }, [])

  const handleStart = () => {
    // Mark as seen
    chrome.storage.local.set({ [FIRST_USE_KEY]: true }, () => {
      setIsVisible(false)
      if (onDismiss) onDismiss()
    })
  }

  if (!isVisible) return null

  return (
    <div 
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isDarkMode ? "rgba(15, 23, 42, 0.8)" : "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(4px)"
      }}
      className={`fixed inset-0 z-[2147483647] flex items-center justify-center backdrop-blur-sm transition-all duration-500 ${
        isDarkMode ? "bg-slate-900/80" : "bg-white/80"
      }`}
    >
      <div 
        style={{
          width: "600px",
          borderRadius: "24px",
          overflow: "hidden",
          backgroundColor: isDarkMode ? "#0f172a" : "#ffffff",
          borderColor: isDarkMode ? "#334155" : "#f1f5f9",
          borderWidth: "1px",
          color: isDarkMode ? "#f1f5f9" : "#1e293b",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
        }}
        className={`w-[600px] rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-500 hover:scale-105 ${
          isDarkMode ? "bg-slate-900 text-slate-100 border border-slate-700" : "bg-white text-slate-800 border border-slate-100"
        }`}
      >
        <div className="relative p-10 flex flex-col items-center text-center">
          {/* Decorative background elements */}
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
          
          <div className="mb-8 p-4 rounded-full bg-blue-500/10 text-blue-500">
            <FiZap className="w-12 h-12" />
          </div>

          <h1 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            欢迎使用 Clip Plugin
          </h1>
          
          <p className={`text-lg mb-10 max-w-md ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            您的智能网页助手已准备就绪。
            <br />
            剪藏内容、AI 对话、知识管理，从未如此简单。
          </p>

          <div className="grid grid-cols-3 gap-6 w-full mb-10">
            <FeatureCard 
              icon={<FiLayout />} 
              title="智能剪藏" 
              desc="一键提取网页核心内容，去除干扰元素"
              isDarkMode={isDarkMode}
            />
            <FeatureCard 
              icon={<FiCpu />} 
              title="AI 助手" 
              desc="基于当前内容的智能对话与问答"
              isDarkMode={isDarkMode}
            />
            <FeatureCard 
              icon={<FiCheckCircle />} 
              title="知识管理" 
              desc="自动分类、打标，构建您的知识库"
              isDarkMode={isDarkMode}
            />
          </div>

          <Button 
            size="lg" 
            className="w-full max-w-xs text-lg py-6 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            onClick={handleStart}
          >
            开始探索
          </Button>
        </div>
      </div>
    </div>
  )
}

const FeatureCard = ({ icon, title, desc, isDarkMode }: { icon: React.ReactNode, title: string, desc: string, isDarkMode: boolean }) => (
  <div className={`p-4 rounded-2xl border transition-all duration-300 hover:shadow-md ${
    isDarkMode 
      ? "bg-slate-800/50 border-slate-700 text-slate-300" 
      : "bg-slate-50 border-slate-100 text-slate-600"
  }`}>
    <div className="text-2xl mb-3 flex justify-center text-blue-500">{icon}</div>
    <h3 className={`font-bold mb-2 ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>{title}</h3>
    <p className={`text-xs leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{desc}</p>
  </div>
)

export default FirstUseWelcomePage
