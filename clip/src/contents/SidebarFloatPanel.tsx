// @ts-ignore
import cssText from "data-text:~style.css"
import React, { useEffect, useState, useRef } from "react"
import { ClipStore, type Clip } from "@/lib/clip-store"
import { Button } from "../components"
import { FiRefreshCcw, FiGrid, FiSettings, FiX, FiHelpCircle, FiSave, FiCheck } from "react-icons/fi"
import { AiFillAliwangwang } from "react-icons/ai"
import { RiMessage2Line, RiMagicLine } from "react-icons/ri"
import { VscFileCode } from "react-icons/vsc"
import { extractContent } from "@/core/index"

export const config = {
  matches: ["<all_urls>"]
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

function PanelContent({ onClose, onRefresh }: { onClose: () => void, onRefresh: () => void }) {
  const [title, setTitle] = useState("Clip")
  const [quickSaveValue, setQuickSaveValue] = useState("")
  const [clips, setClips] = useState<Clip[]>([])
  const [notification, setNotification] = useState<{message: string, type: "success" | "error"} | null>(null)
  const ref = useRef<HTMLDivElement>(null)

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
      // showNotification(`✅ 已直接保存整页！${imgCount > 0 ? `（含${imgCount}张图片）` : ""}`, "success")
      // alert(`✅ 已直接保存整页！${imgCount > 0 ? `（含${imgCount}张图片）` : ""}`)
      setNotification({
        message: `已直接保存整页！${imgCount > 0 ? `（含${imgCount}张图片）` : ""}`,
        type: "success"
      })
    } catch (e) {
      console.error("❌ Direct save error:", e)
      // showNotification("❌ 保存失败", "error")
      // alert("❌ 保存失败")
      setNotification({
        message: "保存失败",
        type: "error"
      })
    }
  }

  return (
    <div 
      ref={ref}
      className="fixed z-[2147483647] flex flex-col bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl border border-white/20 font-sans text-slate-800 animate-scale-up origin-top-right"
      style={{
        top: "24px",
        right: "24px",
        bottom: "24px",
        width: "340px"
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
      <div className="FloatPanelHeader flex items-center justify-between px-5 h-16 border-b border-slate-100/50">
        <div className="flex items-center gap-3">
          <button 
            className="w-9 h-9 flex items-center justify-center bg-blue-50 text-black-600 rounded-xl shadow-sm ring-1 ring-blue-100/50 hover:bg-blue-100 transition-all active:scale-95"
            onClick={openHomepage}
            title="Open Homepage"
          >
            <AiFillAliwangwang className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <input 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-800 outline-none w-24 placeholder-slate-400"
            />
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Workspace</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            onClick={() => window.open("https://github.com/your-repo", "_blank", "noopener,noreferrer")}
            title="Help"
          >
            <FiHelpCircle className="w-4 h-4" />
          </button>
          <button 
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            onClick={onRefresh}
            title="Refresh"
          >
            <FiRefreshCcw className="w-4 h-4" />
          </button>
          <button 
            className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            onClick={onClose}
            title="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="FloatPanelBody flex-1 flex flex-col p-5 overflow-y-auto gap-6 custom-scrollbar">
        {/* Input Area */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Quick Save</label>
          <div className="flex gap-2 p-1 bg-slate-50 rounded-xl border border-slate-100 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <input 
              type="text" 
              value={quickSaveValue}
              onChange={(e) => setQuickSaveValue(e.target.value)}
              placeholder="Paste link or note..." 
              className="flex-1 bg-transparent px-3 text-sm outline-none text-slate-700 placeholder:text-slate-400"
            />
            <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2 rounded-lg shadow-md shadow-blue-200 transition-all active:scale-95">
              Save
            </button>
          </div>
        </div>

        {/* Content List */}
        {clips.length === 0 ? (
          <div className="FloatPanelBodyContentPlaceholder flex-1 border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-300 gap-2 min-h-[200px]">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
              <RiMagicLine className="w-6 h-6 text-slate-300" />
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
                 className="p-3 bg-slate-50 hover:bg-blue-50 rounded-xl border border-slate-100 hover:border-blue-100 transition-all cursor-pointer group"
                 onClick={() => chrome.runtime.sendMessage({ type: "clip:open-history", clipId: clip.id })}
               >
                 <div className="flex gap-3">
                   <div className="flex-1 min-w-0 flex flex-col justify-between">
                     <div className="font-medium text-sm text-slate-700 line-clamp-2 group-hover:text-blue-600 mb-1.5 leading-snug">
                       {clip.title || clip.summary || "Untitled Clip"}
                     </div>
                     <div className="flex items-center justify-between mt-auto">
                       <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          <span className="capitalize px-1.5 py-0.5 bg-white rounded border border-slate-100 text-[9px] font-medium tracking-wide">{clip.source}</span>
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
                     <div className="w-20 h-14 flex-shrink-0 rounded-lg bg-white overflow-hidden border border-slate-200/60 shadow-sm">
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

      {/* Footer / Toolbar */}
      <div className="FloatPanelFooter px-5 pb-5 pt-2">
        <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded-xl border border-slate-100">
          {[
            { icon: FiSave, label: "Save", action: handleDirectSaveFullPage },
            { icon: RiMessage2Line, label: "Chat", action: () => {} },
            { icon: RiMagicLine, label: "AI", action: () => {} },
            { icon: FiGrid, label: "Layout", action: () => {} },
            { icon: FiSettings, label: "Settings", action: () => chrome.runtime.sendMessage({ type: "clip:open-options" }) }
          ].map((Item, idx) => (
            <button 
              key={idx}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all active:scale-95"
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

  const handleRefresh = () => {
    setVisible(false)
    setTimeout(() => {
      setRefreshKey(k => k + 1)
      setVisible(true)
    }, 100)
  }

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

  return <PanelContent key={refreshKey} onClose={() => setVisible(false)} onRefresh={handleRefresh} />
}

export default FloatClip
