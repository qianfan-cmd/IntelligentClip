import type { PlasmoCSConfig, PlasmoGetInlineAnchor, PlasmoGetStyle } from "plasmo"
import { useState, useEffect, useRef } from "react"
import { ClipStore } from "@/lib/clip-store"
import { extractSelectedContent } from "@/core/index"
import { Scissors, Sparkles, Save, X, Loader2 } from "lucide-react"
import cssText from "data-text:~style.css"
import { Provider, useAtomValue } from "jotai"
import { openAIKeyAtom } from "@/lib/atoms/openai"
import { usePort } from "@plasmohq/messaging/hook"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  exclude_matches: ["*://www.youtube.com/*"],
  all_frames: false
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

interface Position {
  top: number
  left: number
}

function FloatingToolbar() {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 })
  const [selectedText, setSelectedText] = useState("")
  const [showPanel, setShowPanel] = useState(false)
  const [loading, setLoading] = useState(false)
  const [savingDirect, setSavingDirect] = useState(false)
  
  const toolbarRef = useRef<HTMLDivElement>(null)
  const openAIKey = useAtomValue(openAIKeyAtom)
  const port = usePort("selection-completion")  // Use separate port from generic-clipper
  const isProcessingRef = useRef(false)  // Track if we initiated the request
  const justShowedRef = useRef(false)  // Prevent immediate hide after showing
  const toolbarClickedRef = useRef(false)  // Track if toolbar was clicked

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
    `
    document.body.appendChild(notification)
    setTimeout(() => notification.remove(), isError ? 5000 : 3000)
  }

  // Handle text selection
  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const handleSelection = () => {
      // Don't process selection changes if panel is already shown
      if (showPanel) {
        console.log("⏸️ Panel is open, ignoring selection change")
        return
      }

      // Clear existing timeout
      if (timeoutId) clearTimeout(timeoutId)
      
      // Add delay to ensure selection is complete
      timeoutId = setTimeout(() => {
        const selection = window.getSelection()
        const text = selection?.toString().trim()

        console.log("🔍 Selection detected:", text?.length, "characters")

        if (text && text.length > 10) { // Minimum 10 characters
          setSelectedText(text)
          
          // Get selection position
          try {
            const range = selection?.getRangeAt(0)
            const rect = range?.getBoundingClientRect()
            
            if (rect) {
              // Position toolbar above selection
              const scrollTop = window.pageYOffset || document.documentElement.scrollTop
              const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
              
              const toolbarTop = rect.top + scrollTop - 60 // 60px above selection
              const toolbarLeft = Math.max(10, rect.left + scrollLeft + rect.width / 2 - 100) // Center horizontally, min 10px from left
              
              console.log("📍 Toolbar position:", { top: toolbarTop, left: toolbarLeft })
              
              setPosition({
                top: toolbarTop,
                left: toolbarLeft
              })
              setVisible(true)
              // Set flag to prevent immediate hide
              justShowedRef.current = true
              setTimeout(() => {
                justShowedRef.current = false
              }, 300)
            }
          } catch (e) {
            console.error("Error getting selection rect:", e)
          }
        } else {
          // Only hide if not showing panel and toolbar wasn't just clicked
          if (!showPanel && !toolbarClickedRef.current) {
            console.log("❌ Selection too short or empty, hiding toolbar")
            setVisible(false)
          }
        }
      }, 100)
    }

    const handleClickOutside = (e: MouseEvent) => {
      // If toolbar was just shown or just clicked, don't hide
      if (justShowedRef.current || toolbarClickedRef.current) {
        console.log("👆 Toolbar just shown/clicked, ignoring click outside")
        toolbarClickedRef.current = false
        return
      }
      
      // Only hide if panel is not shown
      if (!showPanel) {
        console.log("👆 Click outside (no panel), hiding toolbar")
        setVisible(false)
      } else {
        console.log("👆 Click outside but panel is open, keeping visible")
      }
    }

    console.log("🎯 Floating clipper mounted, listening for selections")

    document.addEventListener("mouseup", handleSelection)
    document.addEventListener("keyup", handleSelection)
    // Use bubble phase instead of capture, with delay
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside, false)
    }, 200)

    return () => {
      console.log("🔌 Floating clipper unmounted")
      if (timeoutId) clearTimeout(timeoutId)
      document.removeEventListener("mouseup", handleSelection)
      document.removeEventListener("keyup", handleSelection)
      document.removeEventListener("click", handleClickOutside, false)
    }
  }, [showPanel])

  // Handle AI summary response
  useEffect(() => {
    if (!port.data) return
    
    // Only process if we initiated the request (loading state is true)
    if (!isProcessingRef.current) {
      console.log("⏸️ Ignoring port data - not initiated by us")
      return
    }

    console.log("📨 Port data received:", port.data)

    if (port.data.isEnd) {
      isProcessingRef.current = false  // Reset processing flag
      const summary = port.data.message?.replace(/\nEND$/, "").replace(/END$/, "") || ""

      console.log("📝 Summary generated, saving to store...")
      
      // Pre-check extension context before saving
      if (!checkExtensionContext()) {
        setLoading(false)
        setShowPanel(false)
        setVisible(false)
        showNotification("⚠️ Extension reloaded. Please refresh the page.", true)
        return
      }
      
      // Save to store with AI summary
      ClipStore.add({
        source: "webpage",
        url: window.location.href,
        title: document.title,
        rawTextSnippet: selectedText.slice(0, 500),  // For preview
        rawTextFull: selectedText,  // Full selected text
        summary: summary,
        keyPoints: [],
        tags: []
      }).then((newClip) => {
        console.log("✅ Clip saved with AI summary:", newClip)
        setLoading(false)
        setShowPanel(false)
        setVisible(false)
        
        // Show success notification
        showNotification("✅ Clip saved with AI summary!")
      }).catch((err) => {
        console.error("❌ Failed to save clip:", err)
        setLoading(false)
        
        if (err instanceof Error && err.message.includes("Extension context invalidated")) {
          showNotification("⚠️ Extension reloaded. Please refresh the page.", true)
          setShowPanel(false)
          setVisible(false)
        } else {
          showNotification("❌ Failed to save: " + (err as Error).message, true)
        }
      })
    } else if (port.data.error) {
      isProcessingRef.current = false  // Reset processing flag
      console.error("❌ LLM error:", port.data.error)
      setLoading(false)
      showNotification("❌ Error: " + port.data.error, true)
    }
  }, [port.data, selectedText])

  const handleSaveDirect = async () => {
    console.log("💾 Saving directly...")
    
    // Pre-check extension context
    if (!checkExtensionContext()) {
      showNotification("⚠️ Extension reloaded. Please refresh the page.", true)
      setSavingDirect(false)
      setShowPanel(false)
      setVisible(false)
      return
    }
    
    setSavingDirect(true)
    try {
      const newClip = await ClipStore.add({
        source: "webpage",
        url: window.location.href,
        title: document.title,
        rawTextSnippet: selectedText.slice(0, 500),  // For preview
        rawTextFull: selectedText,  // Full selected text
        summary: selectedText.slice(0, 300) + (selectedText.length > 300 ? "..." : ""),
        keyPoints: [],
        tags: []
      })
      
      console.log("✅ Clip saved:", newClip)
      setSavingDirect(false)
      setShowPanel(false)
      setVisible(false)
      showNotification("✅ Clip saved!")
    } catch (err) {
      console.error("❌ Failed to save clip:", err)
      setSavingDirect(false)
      
      // Check if it's a context invalidated error
      if (err instanceof Error && err.message.includes("Extension context invalidated")) {
        showNotification("⚠️ Extension reloaded. Please refresh the page.", true)
        setShowPanel(false)
        setVisible(false)
      } else {
        showNotification("❌ Failed to save: " + (err as Error).message, true)
      }
    }
  }

  const handleSaveWithAI = () => {
    console.log("🤖 Starting AI summary...")
    console.log("OpenAI Key available:", !!openAIKey)
    
    // Pre-check extension context
    if (!checkExtensionContext()) {
      showNotification("⚠️ Extension reloaded. Please refresh the page.", true)
      setShowPanel(false)
      setVisible(false)
      return
    }
    
    if (!openAIKey) {
      showNotification("⚠️ Please set your OpenAI API Key in settings first.", true)
      return
    }

    setLoading(true)
    isProcessingRef.current = true  // Mark that we initiated the request
    
    try {
      console.log("📤 Sending to LLM...")
      // Send to LLM for summarization
      port.send({
        prompt: "Please provide a concise summary of the following text in 2-3 sentences, and extract 3-5 key points as a bullet list.",
        model: "gpt-4o-mini",
        context: {
          metadata: { title: document.title },
          text: selectedText,
          openAIKey
        }
      })
    } catch (err) {
      console.error("❌ Failed to send to LLM:", err)
      setLoading(false)
      isProcessingRef.current = false  // Reset on error
      
      if (err instanceof Error && err.message.includes("Extension context invalidated")) {
        showNotification("⚠️ Extension reloaded. Please refresh the page.", true)
        setShowPanel(false)
        setVisible(false)
      } else {
        showNotification("❌ Failed: " + (err as Error).message, true)
      }
    }
  }

  const handleClipAction = () => {
    console.log("🎬 Clip action clicked, showing panel")
    setShowPanel(true)
  }

  const handleClose = () => {
    console.log("❌ Panel closed")
    setShowPanel(false)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      ref={toolbarRef}
      data-floating-toolbar="true"
      style={{
        position: "absolute",
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 999999,
        pointerEvents: "auto"
      }}
      className="font-sans"
      onMouseDown={(e) => {
        // Set flag to prevent immediate hide
        toolbarClickedRef.current = true
        e.stopPropagation()
        e.nativeEvent.stopImmediatePropagation()
        console.log("🖱️ Toolbar mousedown (stopped)")
      }}
      onClick={(e) => {
        // Set flag to prevent hide
        toolbarClickedRef.current = true
        e.stopPropagation()
        e.nativeEvent.stopImmediatePropagation()
        console.log("🖱️ Toolbar clicked (stopped)")
      }}
    >
      {!showPanel ? (
        // Initial floating button
        <div 
          className="bg-black text-white px-4 py-2 rounded-lg shadow-2xl flex items-center gap-2 hover:bg-gray-800 transition-all cursor-pointer select-none"
          onMouseDown={(e) => {
            toolbarClickedRef.current = true
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            toolbarClickedRef.current = true
            console.log("🎬 Clip button clicked, showing panel")
            handleClipAction()
          }}
        >
          <Scissors className="w-4 h-4" />
          <span className="text-sm font-medium">Clip</span>
        </div>
      ) : (
        // Expanded panel with options
        <div 
          className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl border border-gray-200 dark:border-zinc-700 p-4 w-80 select-none"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              💾 Save this clip
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mb-3 p-3 bg-gray-50 dark:bg-zinc-800 rounded text-xs text-gray-600 dark:text-gray-400 max-h-24 overflow-y-auto border border-gray-200 dark:border-zinc-700">
            "{selectedText.slice(0, 200)}
            {selectedText.length > 200 && "..."}"
          </div>

          <div className="space-y-2">
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleSaveDirect()
              }}
              disabled={savingDirect || loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {savingDirect ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save as-is</span>
                </>
              )}
            </button>

            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleSaveWithAI()
              }}
              disabled={loading || savingDirect}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Save with AI Summary</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
            📝 {selectedText.length} characters selected
          </p>
        </div>
      )}
    </div>
  )
}

export default function FloatingClipperContent() {
  return (
    <Provider>
      <FloatingToolbar />
    </Provider>
  )
}
