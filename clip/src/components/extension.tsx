import ExtensionActions from "@/components/extension-actions"
import ExtensionPanels from "@/components/extension-panels"
import { VideoHeader } from "@/components/video-header"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { useExtension } from "@/contexts/extension-context"
import { getVideoData } from "@/utils/functions"
import React from "react"

export default function Extension() {

  const {
    setExtensionContainer,
    setExtensionIsOpen,
    setExtensionVideoId,
    setExtensionLoading,
    setExtensionData,
    setExtensionTheme,
    extensionTheme,
    extensionIsOpen,
    extensionVideoId,
    extensionData
  } = useExtension()

  React.useEffect(() => {
    console.log("Use Effect That Fetches Video Data Called")
    const getVideoId = () => {
      return new URLSearchParams(window.location.search).get("v")
    }

    const fetchVideoData = async () => {
      const id = getVideoId()
      console.log("🎥 Current video ID:", id, "Previous ID:", extensionVideoId)
      
      if (id && id !== extensionVideoId) {
        console.log("🔄 Video ID changed, fetching new data...")
        setExtensionVideoId(id)
        setExtensionLoading(true)
        
        const data = await getVideoData(id)
        
        console.log("📦 Data received from getVideoData:")
        console.log("  - Has data:", !!data)
        console.log("  - Has metadata:", !!data?.metadata)
        console.log("  - Has transcript:", !!data?.transcript)
        console.log("  - Transcript events:", data?.transcript?.events?.length || 0)
        
        setExtensionData(data)
        setExtensionLoading(false)
        
        console.log("✅ Extension data updated")
      }
    }

    fetchVideoData()

    // Use MutationObserver to detect URL changes (SPA navigation)
    let lastUrl = window.location.href
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href
        console.log("🔄 URL changed (MutationObserver), checking for new video...")
        fetchVideoData()
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    // Also keep the interval as a fallback, but reduce frequency
    const intervalId = setInterval(fetchVideoData, 2000)

    return () => {
      clearInterval(intervalId)
      observer.disconnect()
    }
  }, [extensionVideoId])

  React.useEffect(() => {
    console.log("Use Effect That Fetches Theme Called")
    const getCssVariable = (name: string) => {
      const rootStyle = getComputedStyle(document.documentElement)
      return rootStyle.getPropertyValue(name).trim()
    }
    const backgroundColor = getCssVariable("--yt-spec-base-background")
    if (backgroundColor === "#fff") {
      setExtensionTheme("light")
    } else {
      setExtensionTheme("dark")
    }
  }, [])

  if (!extensionTheme) return null

  return (
    <main
      ref={setExtensionContainer}
      className={`antialiased w-full mb-3 z-10 ${extensionTheme}`}
      key="youtube-ai-extension">
      <div className="w-full space-y-3">
        <Collapsible
          open={extensionIsOpen}
          onOpenChange={setExtensionIsOpen}
          className="space-y-3">
          
          {/* 顶部操作栏 */}
          <ExtensionActions />
          
          {extensionIsOpen && (
            <div className="w-full space-y-3">
              {/* 视频信息卡片 */}
              <VideoHeader 
                videoId={extensionVideoId}
                title={extensionData?.metadata?.title || document.title?.replace(" - YouTube", "")}
                channelName={extensionData?.metadata?.author}
              />
              
              {/* 内容面板 */}
              <div className="w-full bg-white dark:bg-[#0f0f0f] border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <ExtensionPanels />
              </div>
            </div>
          )}
        </Collapsible>
      </div>
    </main>
  )
}
