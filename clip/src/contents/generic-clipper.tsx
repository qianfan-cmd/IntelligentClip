import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect, useRef } from "react"
import { ClipStore } from "@/lib/clip-store"
import { extractContent } from "@/core/index"
import type { ExtractedContent } from "@/core/types"
import { Scissors, Loader2, History } from "lucide-react"
import cssText from "data-text:~style.css"
import { Provider, useAtomValue } from "jotai"
import { openAIKeyAtom } from "@/lib/atoms/openai"
import { usePort } from "@plasmohq/messaging/hook"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  exclude_matches: ["*://www.youtube.com/*"]
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

function ClipperButton() {
  const [loading, setLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const openAIKey = useAtomValue(openAIKeyAtom)
  const port = usePort("page-completion")  // Use separate port from floating-clipper
  const extractedContentRef = useRef<ExtractedContent | null>(null)

  /**
   * 检查扩展上下文是否有效
   */
  const checkExtensionContext = (): boolean => {
    try {
      return !!chrome.runtime?.id
    } catch {
      return false
    }
  }

  const showNotification = (message: string, isError = false) => {
    const notification = document.createElement("div")
    notification.textContent = message
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${isError ? "#ef4444" : "#10b981"};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999999;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      animation: slideIn 0.3s ease-out;
    `
    document.body.appendChild(notification)
    setTimeout(() => {
      notification.style.opacity = "0"
      notification.style.transition = "opacity 0.5s"
      setTimeout(() => notification.remove(), 500)
    }, isError ? 5000 : 3000)
  }

  const handleClip = async () => {
    // Pre-check extension context
    if (!checkExtensionContext()) {
      showNotification("⚠️ Extension reloaded. Please refresh the page.", true)
      return
    }
    
    if (!openAIKey) {
      showNotification("⚠️ Please set your OpenAI API Key in settings first.", true)
      return
    }

    setLoading(true)
    setShowMenu(false)
    try {
      // Use unified content extraction layer
      const content = await extractContent()
      extractedContentRef.current = content
      
      console.log("📄 Extracted content:", {
        title: content.title,
        textLength: content.text.length,
        snippetLength: content.snippet.length,
        metadata: content.metadata
      })
      
      // Send full text to LLM for summarization
      port.send({
        prompt: "Please summarize the following content into a concise summary and list key points.",
        model: "gpt-4o-mini",
        context: { 
            metadata: { 
              title: content.title,
              ...content.metadata 
            },
            text: content.text,  // Use full text for AI
            openAIKey
        }
      })
      
    } catch (e) {
      console.error(e)
      if (e instanceof Error && e.message.includes("Extension context invalidated")) {
        showNotification("⚠️ Extension reloaded. Please refresh the page.", true)
      } else {
        showNotification("❌ Failed to start clipping.", true)
      }
      setLoading(false)
    }
  }

  const openHistory = () => {
    console.log("📜 Opening history page from generic clipper...")
    setShowMenu(false)
    
    chrome.runtime.sendMessage({ action: "openHistory" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Message error:", chrome.runtime.lastError)
        // Fallback: try opening directly
        try {
          chrome.tabs.create({ url: chrome.runtime.getURL("tabs/history.html") })
        } catch (e) {
          console.error("❌ Failed to open history:", e)
          alert("Failed to open history page. Please try clicking the extension icon.")
        }
      } else {
        console.log("✅ History page opened:", response)
      }
    })
  }

  // Listen for port messages
  useEffect(() => {
    if (!port.data) return

    if (port.data.isEnd) {
        const summary = port.data.message?.replace(/\nEND$/, '').replace(/END$/, '') || ""
        const content = extractedContentRef.current
        
        // Pre-check extension context before saving
        if (!checkExtensionContext()) {
          setLoading(false)
          showNotification("⚠️ Extension reloaded. Please refresh the page.", true)
          return
        }
        
        // Save to store with both snippet and full text
        ClipStore.add({
            source: content?.metadata?.platform === "Bilibili" ? "bilibili" : 
                   content?.metadata?.platform === "YouTube" ? "youtube" : "webpage",
            url: content?.url || window.location.href,
            title: content?.title || document.title,
            rawTextSnippet: content?.snippet || "",  // Only for preview
            rawTextFull: content?.text || "",    // Full text for export/AI
            summary: summary,
            keyPoints: [],
            tags: [],
            meta: content?.metadata
        }).then(() => {
            setLoading(false)
            showNotification("✅ Full page clipped successfully!")
        }).catch((err) => {
            setLoading(false)
            if (err instanceof Error && err.message.includes("Extension context invalidated")) {
              showNotification("⚠️ Extension reloaded. Please refresh the page.", true)
            } else {
              showNotification("❌ Failed to save: " + (err as Error).message, true)
            }
        })
    } else if (port.data.error) {
        console.error(port.data.error)
        setLoading(false)
        showNotification("❌ Error: " + port.data.error, true)
    }
  }, [port.data])

  return (
    <div className="fixed bottom-4 right-4 z-[99999] font-sans">
      {/* Menu overlay */}
      {showMenu && (
        <div className="absolute bottom-16 right-0 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-700 p-2 w-48 mb-2">
          <button
            onClick={openHistory}
            className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-gray-700 dark:text-gray-300"
          >
            <History className="w-4 h-4" />
            View History
          </button>
        </div>
      )}

      {/* Main button */}
      <div className="flex gap-2">
        <button 
          onClick={handleClip}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scissors className="w-5 h-5" />}
          <span className="font-medium">{loading ? "Clipping..." : "Clip Full Page"}</span>
        </button>

        <button
          onClick={() => setShowMenu(!showMenu)}
          className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg transition-all"
          title="More options"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function GenericClipper() {
    return (
        <Provider>
            <ClipperButton />
        </Provider>
    )
}
