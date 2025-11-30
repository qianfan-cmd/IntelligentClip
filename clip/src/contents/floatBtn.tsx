import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Storage } from '@plasmohq/storage';
import styleText from "data-text:../style.css"
import { AiOutlineRobot } from "react-icons/ai";
import { MdGTranslate } from "react-icons/md";
import { CiBookmark } from "react-icons/ci";
import { AiFillAliwangwang } from "react-icons/ai";
import { FaExchangeAlt } from "react-icons/fa";
import { TooltipProvider } from "@/components/ui/tooltip"
import { TooltipWrapper } from "@/components/ui/tooltip-wrapper"
import { ClipStore } from "@/lib/clip-store"
import { extractContent } from "@/core/index"
import type { ExtractedContent } from "@/core/types"
import { useAtomValue } from "jotai"
import { openAIKeyAtom } from "@/lib/atoms/openai"
import { usePort } from "@plasmohq/messaging/hook"
import { cn } from "@/lib/utils"

export const config = {
  matches: ["<all_urls>"] 
}

const BUTTON_SIZE: number = 40;
const RIGHT_MARGIN: number = (document.documentElement.clientWidth - BUTTON_SIZE - 40 + 7.5)
const TOP_MARGIN: number = 20;
const BOTTOM_MARGIN: number = 20;
const INITIAL_POSITION = { x: RIGHT_MARGIN, y: 200 };
const Z_INDEX = 2147483640

// 菜单按钮组件
const MenuButton = ({ icon, onClick, tooltip }: { icon: React.ReactNode; onClick: () => void; tooltip: string|React.ReactNode }) => (
  <TooltipWrapper side="left" text={typeof tooltip === 'string' ? tooltip as string : undefined} content={typeof tooltip !== 'string' ? tooltip as React.ReactNode : undefined}>
    <button
      className="p-3 bg-white border-none rounded-full shadow-md cursor-pointer transition-colors duration-150 outline-none overflow-hidden w-10 h-10 flex items-center justify-center hover:scale-110 active:scale-90 group"
      onClick={onClick}
    >
      <div className="transform transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>
    </button>
  </TooltipWrapper>
);

// 通知组件
function showNotification(message: string, type: "success" | "error" | "warning" = "success") {
  const colors = {
    success: { bg: "#10b981", text: "#ffffff" },
    error: { bg: "#ef4444", text: "#ffffff" },
    warning: { bg: "#f59e0b", text: "#ffffff" },
  }
  
  const notification = document.createElement("div")
  notification.textContent = message
  Object.assign(notification.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    background: colors[type].bg,
    color: colors[type].text,
    padding: "12px 20px",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: String(Z_INDEX + 10),
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: "14px",
    fontWeight: "500",
    animation: "fadeIn 0.3s ease-out",
  })
  
  document.body.appendChild(notification)
  setTimeout(() => {
    notification.style.opacity = "0"
    notification.style.transition = "opacity 0.3s"
    setTimeout(() => notification.remove(), 300)
  }, type === "error" ? 5000 : 3000)
}

const floatButton = () => {
  const [position, setPosition] = useState(INITIAL_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [translateLang, setTranslateLang] = useState<string>('en-US');
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false)
  const [loadingType, setLoadingType] = useState<"full" | "selection" | "direct-full" | "direct-selection" | null>(null)
  const openAIKey = useAtomValue(openAIKeyAtom)
  const port = usePort("page-completion")
  const extractedContentRef = useRef<ExtractedContent | null>(null)
  const requestTypeRef = useRef<"full" | "selection" | null>(null)

  const checkContext = (): boolean => {
    try {
      return !!chrome.runtime?.id
    } catch {
      return false
    }
  }

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDragging(true);
    offsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position.x, position.y]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    let newX = e.clientX - offsetRef.current.x;
    let newY = e.clientY - offsetRef.current.y;

    const iconWidth = containerRef.current?.offsetWidth || 0;
    const iconHeight = containerRef.current?.offsetHeight || 0;

    newX = Math.max(0, Math.min(newX, window.innerWidth - iconWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - iconHeight));

    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  function getRightMargin() {
    const dpr = window.devicePixelRatio;
    const buttonSize = BUTTON_SIZE;
    const visualMargin = 20;
    const scropWidth = window.innerWidth - document.documentElement.clientWidth
    return window.innerWidth - scropWidth - buttonSize - visualMargin - dpr * 7.5;
  }

  const handleMouseUp = useCallback((position: { x: number; y: number }) => {
    if (isDragging) {
      let topLimit: number;
      if (position.y <= 0) {
         topLimit = TOP_MARGIN;
      } else if (position.y > document.documentElement.clientHeight - BUTTON_SIZE / 2) {
        topLimit = document.documentElement.clientHeight - BUTTON_SIZE - BOTTOM_MARGIN;
      } else {
         topLimit = position.y;
      }
      
      setPosition(() => ({
        x: getRightMargin(),
        y: topLimit
      }));
    }
    setIsDragging(false);
  }, [isDragging]);

  let lastRatio = window.devicePixelRatio;
  useEffect(() => {
    const handleResize = () => {
      if (window.devicePixelRatio !== lastRatio) {
        lastRatio = window.devicePixelRatio;
        handleMouseUp(position);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [position, handleMouseUp]);

  // Determine menu position mode based on container position
  const getMenuPositionMode = () => {
    if (!containerRef.current) return 'default';
    const rect = containerRef.current.getBoundingClientRect();
    const topThreshold = 50;
    const bottomThreshold = 50;

    if (rect.top <= topThreshold) return 'topEdge';
    if (rect.top >= window.innerHeight - BUTTON_SIZE - bottomThreshold) return 'bottomEdge';
    return 'default';
  };

  const menuMode = getMenuPositionMode();

  // Dynamic transforms based on menu mode
  const getTransform = (type: 'bookmark' | 'translate' | 'ai') => {
    if (!isMenuOpen) return 'translate(-50%, -50%) scale(0)';

    if (menuMode === 'bottomEdge') {
      switch (type) {
        case 'bookmark': return 'translate(calc(100% - 60px), calc(-150% - 20px)) scale(1)';
        case 'translate': return 'translate(-175%, -175%) scale(1)';
        case 'ai': return 'translate(calc(-100% - 40px), -50%) scale(1)';
      }
    } else if (menuMode === 'topEdge') {
      switch (type) {
        case 'bookmark': return 'translate(calc(-100% - 40px), -50%) scale(1)';
        case 'translate': return 'translate(-175%, 75%) scale(1)';
        case 'ai': return 'translate(-50%, 40px) scale(1)';
      }
    } else {
      // Default
      switch (type) {
        case 'bookmark': return 'translate(calc(-50% - 20px), calc(-50% - 60px)) scale(1)';
        case 'translate': return 'translate(calc(-50% - 60px), -50%) scale(1)';
        case 'ai': return 'translate(calc(-50% - 15px), calc(-50% + 60px)) scale(1)';
      }
    }
  }

  const handleMouseEnter = () => {
    if(hideTimeout.current) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }
    setIsMenuOpen(true);
  }

  const handleMouseLeave = () => {
    hideTimeout.current = setTimeout(() => {
        setIsMenuOpen(false);
    }, 200);
  }

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const host = window.location.host;
    const storage = new Storage();
    (async () => {
      const globalDisabled = await storage.get<boolean>('clipDisableGlobal');
      const siteDisabled = await storage.get<boolean>(`clipDisableSite:${host}`);
      if (globalDisabled || siteDisabled) {
        setIsEnabled(false);
      }
    })();
  }, []);

  const handleMain = () => {
    console.log("打开悬浮面板");
  }

  useEffect(() => {
    if (!port.data || !requestTypeRef.current) return
    if (port.data.isEnd) {
      const summary = port.data.message?.replace(/\nEND$/, "").replace(/END$/, "") || ""
      const content = extractedContentRef.current
      if (!checkContext()) {
        setLoading(false)
        setLoadingType(null)
        showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
        return
      }
      ClipStore.add({
        source: content?.metadata?.platform === "Bilibili" ? "bilibili" : 
               content?.metadata?.platform === "YouTube" ? "youtube" : "webpage",
        url: content?.url || window.location.href,
        title: content?.title || document.title,
        rawTextSnippet: content?.snippet || "",
        rawTextFull: content?.text || "",
        summary: summary,
        keyPoints: [],
        tags: [],
        meta: content?.metadata,
        images: content?.images
      }).then(() => {
        setLoading(false)
        setLoadingType(null)
        requestTypeRef.current = null
        const imgCount = content?.images?.length || 0
        showNotification(`✅ 剪藏成功！${imgCount > 0 ? `（含${imgCount}张图片）` : ""}`, "success")
      }).catch((err) => {
        setLoading(false)
        setLoadingType(null)
        showNotification("❌ 保存失败: " + err.message, "error")
      })
    } else if (port.data.error) {
      setLoading(false)
      setLoadingType(null)
      showNotification("❌ AI 处理失败", "error")
    }
  }, [port.data])

  const handleSave = async () => {
    if (!checkContext()) {
      showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
      return
    }
    setLoading(true)
    setLoadingType("direct-full")
    try {
      const content = await extractContent()
      await ClipStore.add({
        source: content?.metadata?.platform === "Bilibili" ? "bilibili" : 
               content?.metadata?.platform === "YouTube" ? "youtube" : "webpage",
        url: content?.url || window.location.href,
        title: content?.title || document.title,
        rawTextSnippet: content?.snippet || "",
        rawTextFull: content?.text || "",
        summary: "",
        keyPoints: [],
        tags: [],
        meta: content?.metadata,
        images: content?.images
      })
      setLoading(false)
      setLoadingType(null)
      const imgCount = content?.images?.length || 0
      showNotification(`✅ 已直接保存整页！${imgCount > 0 ? `（含${imgCount}张图片）` : ""}`, "success")
    } catch (e) {
      console.error("❌ Direct save error:", e)
      setLoading(false)
      setLoadingType(null)
      showNotification("❌ 保存失败", "error")
    }
  }

  const handleTranslate = () => console.log("执行翻译操作");
  const handleAI = () => console.log("执行ai对话操作");
  const handleLanguage = () => {
    const next = translateLang === 'en-US' ? 'zh-CN' : 'en-US'
    setTranslateLang(next)
  }

  if (!isEnabled) return null;

  const handleOpenSettings = (e: React.MouseEvent) => { 
    e.stopPropagation(); 
    setIsSettingsOpen((v) => !v);
   };

 const handleHideOnce = (e: React.MouseEvent) => { 
  e.stopPropagation(); 
  setIsEnabled(false); 
}; 

 const handleDisableSite = async (e: React.MouseEvent) => { 
  e.stopPropagation(); 
  const storage = new Storage(); 
  await storage.set(`clipDisableSite:${window.location.host}`, true); 
  setIsEnabled(false); };

  const handleDisableGlobal = async (e: React.MouseEvent) => { 
    e.stopPropagation(); 
    const storage = new Storage(); 
    await storage.set('clipDisableGlobal', true); 
    setIsEnabled(false); 
  };

  const bookMarkIcon = <CiBookmark color='#000000' size={25} className="w-5 h-5 transform scale-100 transition-transform duration-300 hover:scale-115 active:scale-90"/>;
  const translateIcon = <MdGTranslate color='#000000' size={25} className="w-5 h-5 transform scale-100 transition-transform duration-300 hover:scale-115 active:scale-90"/>;
  const languageIcon = <FaExchangeAlt color='#000000' size={25} className="w-5 h-5 transform scale-100 transition-transform duration-300 hover:scale-115 active:scale-90"/>;
  const aiIcon = <AiFillAliwangwang color='#000000' size={25} className="w-5 h-5 transform scale-100 transition-transform duration-300 hover:scale-115 active:scale-90"/>;

  return (
    <div 
      ref={containerRef}
      className={cn(
        "fixed z-[2147483647] select-none w-10 h-10 rounded-full transition-all duration-200",
        isDragging && "opacity-75 transition-none"
      )}
      style={{ 
        left: position.x,
        top: position.y,
      }}
      onMouseEnter={ handleMouseEnter }
      onMouseLeave={ handleMouseLeave }
    >
      <TooltipProvider delayDuration={0}>
        <div className={cn(
            "absolute inset-0 w-full h-full pointer-events-none opacity-0 transition-opacity duration-300 ease-out",
            isMenuOpen && "pointer-events-auto opacity-100 cursor-pointer"
          )}>
          <div className="relative w-full h-full">
            {/* Bookmark Item */}
            <div 
              className="absolute top-1/2 left-1/2 origin-center transition-all duration-300 ease-out delay-75"
              style={{ transform: getTransform('bookmark') }}
            >
              <MenuButton icon={bookMarkIcon} onClick={handleSave} tooltip='一键保存'/>
            </div>

            {/* Translate Item */}
            <div 
              className="absolute top-1/2 left-1/2 origin-center transition-all duration-300 ease-out delay-100"
              style={{ 
                transform: getTransform('translate'),
                width: 40, height: 40 
              }}
            >
              <div className="absolute right-0 top-0 w-10 h-10 bg-white rounded-[20px] shadow-md flex items-center justify-end overflow-hidden transition-[width,box-shadow] duration-300 z-20 hover:w-[90px] hover:justify-between hover:shadow-lg">
                 <div className="w-10 h-10 flex items-center justify-center cursor-pointer flex-shrink-0 hover:scale-110 active:scale-90 transition-transform" onClick={handleLanguage}>
                   {languageIcon}
                 </div>
                 
                 <TooltipWrapper
                   offset={8}
                   content={
                     <div style={{ display: 'flex', alignItems: 'center' }}>
                       <span style={{ fontWeight: 600 }}>翻译为：</span>
                       <span style={{ marginLeft: 4 }}>{translateLang}</span>
                       {/* <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 10 }}>Alt+T</span> */}
                     </div>
                   }
                 >
                   <div className="w-10 h-10 flex items-center justify-center cursor-pointer flex-shrink-0 hover:scale-110 active:scale-90 transition-transform" onClick={handleTranslate}>
                     {translateIcon}
                   </div>
                 </TooltipWrapper>
              </div>
            </div>

            {/* AI Item */}
            <div 
              className="absolute top-1/2 left-1/2 origin-center transition-all duration-300 ease-out delay-150"
              style={{ transform: getTransform('ai') }}
            >
              <MenuButton icon={aiIcon} onClick={handleAI} tooltip='ai对话'/>
            </div>
          </div>
        </div>
      </TooltipProvider>

      {/* 主图标 */}
      <div
        className="relative w-10 h-10 rounded-full bg-white shadow-md cursor-pointer hover:shadow-xl transition-all group"
        onMouseDown={handleMouseDown}
        onClick={handleMain}
      >
        <AiOutlineRobot color='black' size={25} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-95 w-5 h-5 transition-transform duration-300 ease-in-out group-hover:scale-100 group-active:scale-90"/>
        <div 
          className={cn(
            "absolute -right-2.5 -top-2.5 w-4 h-4 rounded-full bg-gray-200 shadow flex items-center justify-center text-gray-700 font-bold cursor-pointer transition-transform scale-0 hover:bg-gray-300 text-[10px]",
            isMenuOpen && "scale-100"
          )}
          onMouseDown={(e) => e.stopPropagation()} 
          onClick={handleOpenSettings}
        >
          -
        </div>
      </div>

      {isSettingsOpen && (
        <div 
          className="absolute top-6 right-5 w-[180px] bg-gray-800 text-gray-200 rounded-[10px] shadow-xl py-1.5 z-[2147483647] text-[13px] leading-snug"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors" onClick={handleHideOnce}>隐藏直到下次访问</div>
          <div className="px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors" onClick={handleDisableSite}>在此网站禁用</div>
          <div className="px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors" onClick={handleDisableGlobal}>全局禁用</div>
          <div className="h-px bg-white/10 my-1.5 mx-3"></div>
          <div className="px-3 py-1.5 text-gray-400 text-xs">您可以在此处重新启用 设置</div>
        </div>
      )}

    </div>
  );
};

export const getStyle = () => {
  const style = document.createElement('style');
  style.textContent = styleText;
  return style;
};

export default floatButton;
