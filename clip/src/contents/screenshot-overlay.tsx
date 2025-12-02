import type { PlasmoCSConfig, PlasmoGetShadowHostId } from "plasmo"
import { useState, useEffect, useRef, useCallback } from "react"
import { ClipStore } from "@/lib/clip-store"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

export const getShadowHostId: PlasmoGetShadowHostId = () => "clip-screenshot-host"

// Styles for the overlay and selection box
const styles = `
  .screenshot-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2147483646;
    cursor: crosshair;
    background: rgba(0, 0, 0, 0.2);
    user-select: none;
  }
  .selection-box {
    position: absolute;
    border: 2px dashed #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3), 0 0 10px rgba(59, 130, 246, 0.2);
    pointer-events: none;
    z-index: 2147483647;
    animation: dash-march 1s linear infinite;
  }
  @keyframes dash-march {
    from { border-style: dashed; }
    to { border-style: dashed; }
  }
  .hover-box {
    position: absolute;
    border: 3px dashed rgba(59, 130, 246, 0.8);
    background: rgba(59, 130, 246, 0.1);
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
    pointer-events: none;
    transition: all 0.1s ease-out;
    z-index: 2147483646;
  }
  .loading-toast {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    color: #334155;
    padding: 24px 40px;
    border-radius: 16px;
    font-size: 16px;
    font-weight: 600;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    z-index: 2147483649;
    box-shadow: 0 20px 50px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.5);
    animation: toast-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    min-width: 200px;
  }
  @keyframes toast-pop {
    from { opacity: 0; transform: translate(-50%, -40%) scale(0.95); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e2e8f0;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .success-icon {
    width: 40px;
    height: 40px;
    color: #10b981;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: scale-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  .success-icon svg {
    width: 100%;
    height: 100%;
  }
  @keyframes scale-in {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  .toolbar {
    position: absolute;
    background: white;
    padding: 8px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    gap: 8px;
    z-index: 2147483648;
    animation: fade-in 0.2s ease-out;
  }
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .btn {
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    color: white;
    transition: transform 0.1s;
  }
  .btn:active {
    transform: scale(0.95);
  }
  .btn-confirm {
    background: #3b82f6;
  }
  .btn-confirm:hover {
    background: #2563eb;
  }
  .btn-cancel {
    background: #ef4444;
  }
  .btn-cancel:hover {
    background: #dc2626;
  }
  .size-tag {
    position: absolute;
    bottom: -24px;
    right: 0;
    background: rgba(0,0,0,0.7);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    pointer-events: none;
  }
`

const ScreenshotOverlay = () => {
  const [visible, setVisible] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
  const [selection, setSelection] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
  const [hoveredElement, setHoveredElement] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
  
  // Status state: "idle" | "saving" | "success" | "error"
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string>("")
  
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const messageHandler = (message: any) => {
      if (message.type === "clip:start-screenshot") {
        setVisible(true)
        setSelection(null)
        setHoveredElement(null)
        setSaveStatus("idle")
        setErrorMessage("")
        document.body.style.cursor = "crosshair"
        // Prevent scrolling
        document.body.style.overflow = "hidden"
      }
    }
    chrome.runtime.onMessage.addListener(messageHandler)
    return () => chrome.runtime.onMessage.removeListener(messageHandler)
  }, [])

  const closeOverlay = useCallback(() => {
    setVisible(false)
    setSelection(null)
    setIsDragging(false)
    setHoveredElement(null)
    setSaveStatus("idle")
    document.body.style.cursor = "default"
    document.body.style.overflow = "" // Restore scrolling
    
    // Notify via runtime (for background)
    chrome.runtime.sendMessage({ type: "clip:screenshot-closed" })
    
    // Notify via DOM event (for other content scripts in the same isolated world like Sidebar)
    window.dispatchEvent(new CustomEvent("clip-plugin:screenshot-closed"))
  }, [])

  // ESC key listener
  useEffect(() => {
    if (!visible) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeOverlay()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [visible, closeOverlay])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!visible || saveStatus !== "idle" || selection) return
    
    if (selection) return;

    setIsDragging(true)
    setStartPos({ x: e.clientX, y: e.clientY })
    setCurrentPos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!visible) return

    if (isDragging) {
      setCurrentPos({ x: e.clientX, y: e.clientY })
    } else if (!selection) {
      // Auto-snap logic: Find element under cursor
      if (overlayRef.current) {
        // Temporarily disable pointer events on overlay to peek through
        overlayRef.current.style.pointerEvents = "none"
        const el = document.elementFromPoint(e.clientX, e.clientY)
        overlayRef.current.style.pointerEvents = "auto"

        if (el && el !== document.body && el !== document.documentElement) {
          const rect = el.getBoundingClientRect()
          // Only highlight if it has some size
          if (rect.width > 10 && rect.height > 10) {
            setHoveredElement({
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height
            })
            return
          }
        }
      }
      setHoveredElement(null)
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging) return
    setIsDragging(false)
    
    const width = Math.abs(currentPos.x - startPos.x)
    const height = Math.abs(currentPos.y - startPos.y)
    
    // If drag was very small, treat as click (Auto-snap selection)
    if (width < 5 && height < 5) {
      if (hoveredElement) {
        setSelection(hoveredElement)
      }
    } else if (width > 10 && height > 10) {
      // Manual selection
      const x = Math.min(currentPos.x, startPos.x)
      const y = Math.min(currentPos.y, startPos.y)
      setSelection({ x, y, width, height })
    }
  }

  const handleConfirm = async () => {
    if (!selection) return
    setSaveStatus("saving")

    try {
      // 1. Capture visible tab
      const response = await chrome.runtime.sendMessage({ type: "clip:capture-screen" })
      
      if (response.error) {
        throw new Error(response.error)
      }

      const dataUrl = response.dataUrl

      // 2. Crop image
      const img = new Image()
      img.onload = async () => {
        try {
          const canvas = document.createElement("canvas")
          const pixelRatio = window.devicePixelRatio || 1
          
          canvas.width = selection.width * pixelRatio
          canvas.height = selection.height * pixelRatio
          
          const ctx = canvas.getContext("2d")
          if (!ctx) throw new Error("Failed to get canvas context")

          ctx.drawImage(
            img,
            selection.x * pixelRatio,
            selection.y * pixelRatio,
            selection.width * pixelRatio,
            selection.height * pixelRatio,
            0,
            0,
            selection.width * pixelRatio,
            selection.height * pixelRatio
          )

          // Use JPEG with 0.8 quality to reduce size and ensure successful storage
          const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.8)

          // Artificial delay to make "Saving..." visible (User requested it not to be too fast)
          await new Promise(resolve => setTimeout(resolve, 800))

          // 3. Save to ClipStore
          console.log("Saving screenshot to ClipStore...")
          const clip = await ClipStore.add({
            source: "screenshot",
            url: window.location.href,
            title: "Screenshot - " + document.title,
            rawTextSnippet: "",
            rawTextFull: "",
            summary: "",
            keyPoints: [],
            tags: ["screenshot"],
            images: [{
              src: croppedDataUrl,
              alt: "screenshot",
              width: selection.width,
              height: selection.height
            }]
          })
          
          console.log("Screenshot saved successfully:", clip)

          // Show success state
          setSaveStatus("success")
          
          // Notify Sidebar to reload clips
          window.dispatchEvent(new CustomEvent("clip-plugin:screenshot-saved", { 
            detail: { clipId: clip.id }
          }))
          
          // Wait a moment to let user see the success checkmark
          setTimeout(() => {
            closeOverlay()
          }, 1000)
        } catch (innerError) {
          console.error("Error inside image processing:", innerError)
          setErrorMessage(innerError instanceof Error ? innerError.message : "Image processing failed")
          setSaveStatus("error")
          setTimeout(() => {
            setSaveStatus("idle")
            setErrorMessage("")
          }, 3000)
        }
      }
      img.onerror = () => {
        console.error("Failed to load captured image")
        setErrorMessage("Failed to load captured image")
        setSaveStatus("error")
        setTimeout(() => {
          setSaveStatus("idle")
          setErrorMessage("")
        }, 3000)
      }
      img.src = dataUrl

    } catch (error) {
      console.error("Screenshot failed:", error)
      setErrorMessage(error instanceof Error ? error.message : "Screenshot failed")
      setSaveStatus("error")
      setTimeout(() => {
        setSaveStatus("idle")
        setErrorMessage("")
      }, 3000)
    }
  }

  if (!visible) return null

  // Calculate display rect for dragging or selection
  const displayRect = isDragging 
    ? {
        left: Math.min(startPos.x, currentPos.x),
        top: Math.min(startPos.y, currentPos.y),
        width: Math.abs(currentPos.x - startPos.x),
        height: Math.abs(currentPos.y - startPos.y)
      }
    : {
        left: selection?.x || 0,
        top: selection?.y || 0,
        width: selection?.width || 0,
        height: selection?.height || 0
      }

  return (
    <>
      <style>{styles}</style>
      <div 
        ref={overlayRef}
        className="screenshot-overlay"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Auto-snap Hover Indicator */}
        {!isDragging && !selection && hoveredElement && (
          <div 
            className="hover-box"
            style={{
              left: hoveredElement.x,
              top: hoveredElement.y,
              width: hoveredElement.width,
              height: hoveredElement.height,
            }}
          />
        )}

        {/* Active Selection/Drag Box */}
        {(isDragging || selection) && displayRect && (
          <div 
            className="selection-box"
            style={{
              left: displayRect.left,
              top: displayRect.top,
              width: displayRect.width,
              height: displayRect.height,
            }}
          >
             <div className="size-tag">
                {Math.round(displayRect.width)} x {Math.round(displayRect.height)}
             </div>
          </div>
        )}

        {/* Status Toast (Saving / Success / Error) */}
        {saveStatus !== "idle" && (
          <div className="loading-toast">
            {saveStatus === "saving" && (
              <>
                <div className="spinner" />
                <span>Saving screenshot...</span>
              </>
            )}
            {saveStatus === "success" && (
              <>
                <div className="success-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span style={{color: '#10b981'}}>Saved Successfully!</span>
              </>
            )}
            {saveStatus === "error" && (
              <>
                 <div className="success-icon" style={{color: '#ef4444'}}>
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                     <line x1="18" y1="6" x2="6" y2="18" />
                     <line x1="6" y1="6" x2="18" y2="18" />
                   </svg>
                 </div>
                 <span style={{color: '#ef4444', textAlign: 'center', maxWidth: '250px'}}>
                   {errorMessage || "Failed to save"}
                 </span>
              </>
            )}
          </div>
        )}

        {/* Toolbar */}
        {selection && !isDragging && saveStatus === "idle" && (
          <div 
            className="toolbar"
            style={{
              left: Math.max(10, selection.x),
              top: selection.y + selection.height + 10 > window.innerHeight - 50 
                ? selection.y - 50 
                : selection.y + selection.height + 10
            }}
            onMouseDown={(e) => e.stopPropagation()} // Prevent dragging from starting on toolbar click
          >
            <button className="btn btn-cancel" onClick={closeOverlay}>Cancel (Esc)</button>
            <button className="btn btn-confirm" onClick={handleConfirm}>
              Save
            </button>
          </div>
        )}
        
        {/* Hint text when nothing selected */}
        {!selection && !isDragging && saveStatus === "idle" && (
           <div style={{
             position: "fixed",
             top: 20,
             left: "50%",
             transform: "translateX(-50%)",
             background: "rgba(0,0,0,0.6)",
             color: "white",
             padding: "8px 16px",
             borderRadius: "20px",
             fontSize: "14px",
             pointerEvents: "none",
             zIndex: 2147483649
           }}>
             Drag to select area or click to select element (Esc to cancel)
           </div>
        )}
      </div>
    </>
  )
}

export default ScreenshotOverlay
