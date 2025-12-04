import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Storage } from '@plasmohq/storage';
import styleText from "data-text:../style.css"
import type { PlasmoGetShadowHostId } from "plasmo"
import { AiOutlineRobot } from "react-icons/ai";
import { MdGTranslate } from "react-icons/md";
import { CiBookmark } from "react-icons/ci";
import { AiFillAliwangwang } from "react-icons/ai";
import { FaExchangeAlt } from "react-icons/fa";
import { TooltipProvider } from "@/components/ui/tooltip"
import { TooltipWrapper } from "@/components/ui/tooltip-wrapper"
import { ClipStore } from "@/lib/clip-store"
import { extractContent, extractSelectedContent } from "@/core/index"
import type { ExtractedContent } from "@/core/types"
// 【修复】使用统一的 API 配置模块，解决跨页面不同步问题
import { useApiConfig } from "@/lib/api-config-store"
import { usePort } from "@plasmohq/messaging/hook"
import { cn } from "@/lib/utils"
import { RiExchangeBoxLine } from "react-icons/ri";
import { SaveTypeChange } from "@/components/saveType-change"
import { storage as secureStorage } from "@/lib/atoms/storage"
import { translateCurrentPage } from "~/contents/pageTranslator" 

export const config = {
  matches: ["<all_urls>"]
}

// 独立的 Shadow Host，提升到全页最顶层
export const getShadowHostId: PlasmoGetShadowHostId = () => "plasmo-inline"

export const getStyle = () => {
  const style = document.createElement('style')
  style.textContent = `${styleText}\n:host(#plasmo-inline){position:relative!important;z-index:auto!important;pointer-events:none!important;}`
  return style
}

const BUTTON_SIZE: number = 40;
const RIGHT_MARGIN: number = (window.innerWidth - (window.innerWidth - document.documentElement.clientWidth) - BUTTON_SIZE - window.devicePixelRatio * 7.5)
const TOP_MARGIN: number = 20;
const BOTTOM_MARGIN: number = 20;
const INITIAL_POSITION = { x: RIGHT_MARGIN, y: 200 };
const Z_INDEX = 2147483640

// 菜单按钮组件
const MenuButton = ({ icon, onClick, tooltip, isDark }: { icon: React.ReactNode; onClick: () => void; tooltip: string | React.ReactNode; isDark?: boolean }) => ( // 通用菜单按钮，支持提示与主题色
  <TooltipWrapper side="left" text={typeof tooltip === 'string' ? tooltip as string : undefined} content={typeof tooltip !== 'string' ? tooltip as React.ReactNode : undefined}>
    <button
      className={cn(
        "p-3 border-none rounded-full shadow-md cursor-pointer transition-colors duration-150 outline-none overflow-hidden w-[40px] h-[40px] flex items-center justify-center hover:scale-110 active:scale-90 group",
        isDark ? "bg-neutral-900 text-white" : "bg-white text-gray-900"
      )}
      onClick={onClick}
    >
      <div className="transform transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>
    </button>
  </TooltipWrapper>
);

// 通知组件
function showNotification(message: string, type: "success" | "error" | "warning" | "loading" = "success") { // 顶部通知（加载提示/成功/错误）
  const colors = {
    success: { bg: "#10b981", text: "#ffffff" },
    error: { bg: "#ef4444", text: "#ffffff" },
    warning: { bg: "#f59e0b", text: "#ffffff" },
    loading: { bg: "#111827", text: "#ffffff" },
  }

  const notification = document.createElement("div")
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
    display: "inline-flex",
    alignItems: "center",
    gap: "8px"
  })

  if (!document.getElementById("clip-notify-style")) {
    const styleEl = document.createElement("style")
    styleEl.id = "clip-notify-style"
    styleEl.textContent = `@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`
    document.head.appendChild(styleEl)
  }

  if (type === "loading") {
    const spinner = document.createElement("div")
    Object.assign(spinner.style, {
      width: "12px",
      height: "12px",
      border: "2px solid rgba(255,255,255,0.6)",
      borderTopColor: "transparent",
      borderRadius: "50%",
      animation: "spin 1s linear infinite"
    })
    notification.appendChild(spinner)
  }

  const textSpan = document.createElement("span")
  textSpan.textContent = message
  notification.appendChild(textSpan)

  document.body.appendChild(notification)
  if (type === "loading") {
    return () => {
      notification.style.opacity = "0"
      notification.style.transition = "opacity 0.2s"
      setTimeout(() => notification.remove(), 200)
    }
  }
  setTimeout(() => {
    notification.style.opacity = "0"
    notification.style.transition = "opacity 0.3s"
    setTimeout(() => notification.remove(), 300)
  }, type === "error" ? 5000 : 3000)
  return () => { }
}

const floatButton = () => { // 悬浮按钮主组件
  const [position, setPosition] = useState(INITIAL_POSITION);//悬浮按钮当前位置
  const [isDragging, setIsDragging] = useState(false);//是否拖拽
  const [isSnapping, setIsSnapping] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false);//是否打开菜单
  const [isEnabled, setIsEnabled] = useState(true);//是否启用按钮
  const [hiddenByPanel, setHiddenByPanel] = useState(false);//是否被面板隐藏
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);//设置面板
  const [translateLang, setTranslateLang] = useState<string>('zh-CN');
  const [languageLang, setLanguageLang] = useState<string>('en-US');
  const [isTranslating, setIsTranslating] = useState(false);//是否正在翻译
  const [saveTypeTip, setSaveTypeTip] = useState<string>("一键保存");//当前保存类型提示
  const [isSaveTypeOpen, setIsSaveTypeOpen] = useState<boolean>(false);//切换保存类型菜单
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);//隐藏超时定时器
  const saveTypeHideTimeout = useRef<NodeJS.Timeout | null>(null);//保存类型面板隐藏定时器
  const offsetRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false)
  const [loadingType, setLoadingType] = useState<"full" | "selection" | "direct-full" | "direct-selection" | null>(null)
  // 【修复】使用统一的 API 配置模块，包含加载状态
  const { apiKey: openAIKey, isLoading: isApiKeyLoading } = useApiConfig()
  const port = usePort("page-completion")
  const extractedContentRef = useRef<ExtractedContent | null>(null)
  const requestTypeRef = useRef<"full" | "selection" | null>(null)
  const [isDark, setIsDark] = useState<boolean>(() => {
    try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches } catch { return false }
  })
  const lastDragTimeRef = useRef<number>(0)
  const dragMovedRef = useRef<boolean>(false)
  const expandStartRef = useRef<number>(0)
  const chosenSaveActionRef = useRef<(() => Promise<void> | void) | null>(null)
  const loadingNotifyDismissRef = useRef<(() => void) | null>(null);//加载通知关闭函数
  const selectedTextRef = useRef<string>("")
  const snapAnimRef = useRef<number | null>(null)

//防抖函数


  const captureSelection = () => {
    try {
      selectedTextRef.current = window.getSelection()?.toString().trim() || ""
    } catch (e) {
      console.log("选取失败：", e);
      showNotification("⚠️ 抓取失败，请重新选择内容", "warning")
    }
  }


  const checkContext = (): boolean => {
    try {
      return !!chrome.runtime?.id
    } catch {
      return false
    }
  }

  const normalizeUrl = (u: string): string => {
    try {
      const url = new URL(u)
      const path = url.pathname.replace(/\/+$/, "") || "/"
      return `${url.origin}${path}`
    } catch {
      const base = u.split("#")[0].split("?")[0]
      return base.replace(/\/+$/, "") || "/"
    }
  }

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDragging(true);
    if (snapAnimRef.current) {
      cancelAnimationFrame(snapAnimRef.current)
      snapAnimRef.current = null
    }
    setIsSnapping(false)
    dragMovedRef.current = false
    offsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position.x, position.y]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setIsMenuOpen(false);
    let newX = e.clientX - offsetRef.current.x;
    let newY = e.clientY - offsetRef.current.y;

    const iconWidth = containerRef.current?.offsetWidth || 0;
    const iconHeight = containerRef.current?.offsetHeight || 0;

    newX = Math.max(0, Math.min(newX, window.innerWidth - iconWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - iconHeight));

    setPosition({ x: newX, y: newY });
    if (!dragMovedRef.current) {
      const dx = Math.abs(newX - (position.x ?? 0))
      const dy = Math.abs(newY - (position.y ?? 0))
      if (dx > 3 || dy > 3) dragMovedRef.current = true
    }
  }, [isDragging]);

  function getRightMargin() {
    const dpr = window.devicePixelRatio
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    const margin = dpr * 7.5
    const x = window.innerWidth - scrollbarWidth - BUTTON_SIZE - margin
    return Math.max(0, x)
  }

  const handleMouseUp = useCallback((position: { x: number; y: number }) => {
    if (isDragging && dragMovedRef.current) {
      let topLimit: number;
      if (position.y <= 0) {
        topLimit = TOP_MARGIN;
      } else if (position.y > document.documentElement.clientHeight - BUTTON_SIZE / 2) {
        topLimit = document.documentElement.clientHeight - BUTTON_SIZE - BOTTOM_MARGIN;
      } else {
        topLimit = position.y;
      }

      const startX = position.x
      const endX = getRightMargin()
      const duration = 280
      setIsDragging(false)
      setIsSnapping(true)
      const start = performance.now()
      const ease = (t: number) => 1 - Math.pow(1 - t, 3)
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration)
        const x = startX + (endX - startX) * ease(p)
        setPosition({ x, y: topLimit })
        if (p < 1) {
          snapAnimRef.current = requestAnimationFrame(step)
        } else {
          setIsSnapping(false)
        }
      }
      snapAnimRef.current = requestAnimationFrame(step)
      lastDragTimeRef.current = Date.now()
      return
    }
    setIsDragging(false)
  }, [isDragging])

  const snapToRight = useCallback(() => {
    const topLimit = Math.max(
      TOP_MARGIN,
      Math.min(position.y, (window.innerHeight || document.documentElement.clientHeight) - BUTTON_SIZE - BOTTOM_MARGIN)
    )
    setPosition({ x: getRightMargin(), y: topLimit })
  }, [position.y])

  const isAtRightEdge = useCallback(() => {
    return Math.abs(position.x - getRightMargin()) <= 10
  }, [position.x])

  useEffect(() => {
    const onResize = () => {
      if (isDragging) return
      snapToRight()
    }
    window.addEventListener("resize", onResize)
    const vv = window.visualViewport
    vv?.addEventListener("resize", onResize)
    vv?.addEventListener("scroll", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
      vv?.removeEventListener("resize", onResize)
      vv?.removeEventListener("scroll", onResize)
    }
  }, [snapToRight])

  useEffect(() => {
    const pageHandler = (e: MessageEvent) => {
      const d = e?.data as { source?: string; type?: string } | undefined
      if (!d || d.source !== "clip") return
      if (d.type === "clip:panel-open") setHiddenByPanel(true)
      if (d.type === "clip:panel-close" || d.type === "clip:toggle-float") setHiddenByPanel(false)
    }
    window.addEventListener("message", pageHandler)
    return () => window.removeEventListener("message", pageHandler)
  }, [])

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

  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const cb = (e: MediaQueryListEvent) => setIsDark(e.matches)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    } catch {}
  }, [])

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
    if (hideTimeout.current) {
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
      const savedMode = await storage.get<string>('clipSaveMode')
      if (savedMode && ["allPageSave", "allPageAISave", "selectSave", "selectAISave"].includes(savedMode)) {
        setSaveTypeTip(savedMode)
        chosenSaveActionRef.current =
          savedMode === "allPageSave" ? handleSave :
            savedMode === "allPageAISave" ? handleAISaveFull :
              savedMode === "selectSave" ? handleDirectSaveSelection :
                savedMode === "selectAISave" ? handleAISaveSelection :
                  handleSave
      }
    })();
  }, []);

  const handleMain = () => {
    if (Date.now() - lastDragTimeRef.current < 150) return
    try {
      window.postMessage({ source: "clip", type: "clip:show-float" }, "*")
    } catch (e) {
      console.log("悬浮窗打开请求发送失败：", e);
    }
    if (!checkContext()) return
    try {
      chrome.runtime.sendMessage({ type: "clip:show-float" }, () => {})
    } catch (e) {
      console.log(e);
      alert("悬浮窗打开失败");
    }
  }

  useEffect(() => {
    if (!port.data || !requestTypeRef.current) return
    if (port.data.isEnd) {
      loadingNotifyDismissRef.current?.()
      loadingNotifyDismissRef.current = null
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
      loadingNotifyDismissRef.current?.()
      loadingNotifyDismissRef.current = null
      setLoading(false)
      setLoadingType(null)
      showNotification("❌ AI 处理失败", "error")
    }
  }, [port.data])

  //直接保存整页
  const handleSave = async () => {
    if (!checkContext()) {
      showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
      return
    }
    //检查当前网页是否保存过
    try {
      const content = await extractContent()
      try {
        const contentUrlNorm = content?.url ? normalizeUrl(content.url) : null
        if (contentUrlNorm) {
          const latest = await ClipStore.getAll()
          if (latest.some((c) => normalizeUrl(c.url) === contentUrlNorm)) {
            setLoading(false)
            setLoadingType(null)
            showNotification("⚠️ 当前页面已保存", "warning")
            return
          }
        }
      } catch (e) {
        console.log(e);
        showNotification("❌ 检查剪藏失败:Error")
        return
      }
      setLoading(true)
      setLoadingType("direct-full")

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

  //打开切换保存类型面板
  const handleOpenSaveTypeChange = () => {
    if (saveTypeHideTimeout.current) {
      clearTimeout(saveTypeHideTimeout.current)
      saveTypeHideTimeout.current = null
    }
    if (Date.now() - expandStartRef.current < 180) return
    setIsSaveTypeOpen(true);
  }

  //关闭切换保存类型面板
  const handleCloseSaveTypeChange = () => {
    if (saveTypeHideTimeout.current) {
      clearTimeout(saveTypeHideTimeout.current)
    }
    saveTypeHideTimeout.current = setTimeout(() => {
      setIsSaveTypeOpen(false)
      saveTypeHideTimeout.current = null
    }, 200)
  }

  const handleTranslate = () => { // 点击翻译/显示原文的统一入口
  if (isTranslating) return;//若翻译已经启动则不翻译
  if (!isTranslated) {
    setIsTranslating(true);
    const dismiss = showNotification("正在翻译可视区域…", "loading");
    loadingNotifyDismissRef.current = dismiss;
    /** 启动定时器，延迟600ms秒执行，该函数负责节点扫描、并发调度、分批翻译、结果写回与恢复原文。
     * 在暂停的同时异步发送消息给内容脚本（chrome.runtime.sendMessage)=>跳转到pageTranslator接受消息
     * 如果消息回调到达表示通道正常，就清除计时器（此时就可以正常发送请求了）否则600ms后就走前端直启直接调用translateCurrentPage开始翻译
     * 这里做了一个兜底。（chrome扩展的后台service worker可能挂起，消息到达存在抖动，做了一个直接调用的兜底可以保证稳定
     * 防止报错channel closed
    */
    const safety = setTimeout(() => { 
      try { translateCurrentPage(translateLang) 

      } catch (e) {
        console.error("❌ 翻译失败:", e)
      } }, 600);
    chrome.runtime.sendMessage({ type: "TRANSLATE_PAGE", translateLang }, () => { clearTimeout(safety) });//发送翻译请求
  } else {
    //显示原文
    const dismiss = showNotification("正在恢复原文…", "loading")
    loadingNotifyDismissRef.current = dismiss;
    setIsTranslated(false);
    //兜底，通道延迟500ms到期自动切换按钮状态关闭loading通知
    const restoreSafety = setTimeout(() => {
      try { loadingNotifyDismissRef.current?.(); } catch {}
      loadingNotifyDismissRef.current = null;
      setIsTranslating(false);
    }, 500);
    /**双通道触发恢复原文：同时向页面线程和扩展后台发送指令
     * 页面管道触发：window发送消息被pageTranslator接收，pageTranslator立即回传确认事件，协会__clipOriginal保存的原文，实现快速恢复原文
     * 扩展一样
     */
    try { window.postMessage({ source: "clip", type: "clip:translate-restore" }, "*") } catch {}
    chrome.runtime.sendMessage({ type: "TRANSLATE_RESTORE" }, () => { try { clearTimeout(restoreSafety) } catch {} })
  }
}

  const [isTranslated, setIsTranslated] = useState(false);//是否已翻译

  //监听页面线程和扩展后台的消息，更新按钮状态和loading通知
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg?.type === "CLIP_TRANSLATE_FIRST") {//翻译完成事件
        try { loadingNotifyDismissRef.current?.() } catch {}
        loadingNotifyDismissRef.current = null
        setIsTranslating(false)
        setIsTranslated(true)
      }
      if (msg?.type === "CLIP_TRANSLATE_RESTORE_ACK") {//恢复原文确认事件
        try { loadingNotifyDismissRef.current?.() } catch {}
        loadingNotifyDismissRef.current = null
        setIsTranslating(false)
        setIsTranslated(false)
      }
      if (msg?.type === "CLIP_TRANSLATE_RESTORED") {//恢复原文完成事件
        setIsTranslated(false)
      }
    }
    chrome.runtime.onMessage.addListener(handler);
    const pageHandler = (e: MessageEvent) => {
      const d = e?.data as any;//e.data是postMessage传入的对象
      if (!d || d.source !== "clip") return
      if (d.type === "clip:translate-first") {
        try { loadingNotifyDismissRef.current?.() } catch {}
        loadingNotifyDismissRef.current = null
        setIsTranslating(false)
        setIsTranslated(true)
      }
      if (d.type === "clip:translate-restore-ack") {
        try { loadingNotifyDismissRef.current?.() } catch {}
        loadingNotifyDismissRef.current = null
        setIsTranslating(false)
        setIsTranslated(false)
      }
      if (d.type === "clip:translate-restored") {
        setIsTranslated(false)
      }
    }
    window.addEventListener("message", pageHandler)
    return () => {
      chrome.runtime.onMessage.removeListener(handler)
      window.removeEventListener("message", pageHandler)
    }
  }, [])


  const handleAI = () => {
    if (Date.now() - lastDragTimeRef.current < 150) return
    try {
      window.postMessage({ source: "clip", type: "clip:show-float-chat" }, "*")
      const sel = window.getSelection()?.toString().trim() || ""
      try {
        window.dispatchEvent(new CustomEvent('clip-send-to-chat', { detail: { text: sel } }))
      } catch (e) {
        console.log(e);
        alert("悬浮窗打开失败");
      }

    } catch (e) {
      console.log("悬浮窗打开请求发送失败：", e);
    }
    if (!checkContext()) return
    try {
      chrome.runtime.sendMessage({ type: "clip:show-float" }, () => {})
    } catch (e) {
      console.log(e);
      alert("悬浮窗打开失败");
    }
  }

  const handlePickSaveType = (payload: { tag: "allPageSave" | "allPageAISave" | "selectSave" | "selectAISave" }) => {
    setSaveTypeTip(payload.tag)
    chosenSaveActionRef.current =
      payload.tag === "allPageSave" ? handleSave :
        payload.tag === "allPageAISave" ? handleAISaveFull :
          payload.tag === "selectSave" ? handleDirectSaveSelection :
            payload.tag === "selectAISave" ? handleAISaveSelection :
              handleSave
    const storage = new Storage()
    storage.set('clipSaveMode', payload.tag)
  }

  const handleSaveClick = async () => {
    expandStartRef.current = Date.now()
    const fn = chosenSaveActionRef.current
    if (fn) {
      await Promise.resolve(fn())
    } else {
      await handleSave()
    }
  }
  //整页保存(AI)
  const handleAISaveFull = async () => {
    if (!checkContext()) {
      showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
      return
    }
    const key = await getOpenAIKeySafely()
    if (!key) {
      showNotification("⚠️ 请先在设置中配置 API Key", "warning")
      return
    }
    setLoading(true)
    setLoadingType("full")
    requestTypeRef.current = "full"
    loadingNotifyDismissRef.current = showNotification("AI处理中…", "loading")
    try {
      const content = await extractContent()
      extractedContentRef.current = content
      port.send({
        prompt: "请用中文对以下内容进行简洁总结，并列出3-5个要点。",
        model: "qwen3-max",
        context: {
          metadata: { title: content.title, ...content.metadata },
          text: content.text,
          openAIKey: key
        }
      })
    } catch (e) {
      console.error("❌ Clip error:", e)
      setLoading(false)
      setLoadingType(null)
      showNotification("❌ 剪藏失败", "error")
    }
  }
  // 剪藏选中内容（AI摘要）
  const handleAISaveSelection = async () => {
    const liveText = window.getSelection()?.toString().trim()
    const selectedText = (selectedTextRef.current || liveText || "").trim()
    if (!selectedText || selectedText.length < 10) {
      showNotification("⚠️ 请先选中一些文字（至少10个字符）", "warning")
      return
    }
    if (!checkContext()) {
      showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
      return
    }
    const key = await getOpenAIKeySafely()
    if (!key) {
      showNotification("⚠️ 请先在设置中配置 API Key", "warning")
      return
    }
    setLoading(true)
    setLoadingType("selection")
    requestTypeRef.current = "selection"
    loadingNotifyDismissRef.current = showNotification("AI处理中…", "loading")
    try {
      const selectedContent = extractSelectedContent()
      extractedContentRef.current = {
        title: document.title,
        text: selectedText,
        html: selectedText,
        snippet: selectedText.slice(0, 500),
        url: window.location.href,
        metadata: {},
        images: selectedContent?.images || []
      }
      port.send({
        prompt: "请用中文对以下内容进行简洁总结。",
        model: "qwen3-max",
        context: { metadata: { title: document.title }, text: selectedText, openAIKey: key }
      })
    } catch (e) {
      console.error("❌ Clip error:", e)
      setLoading(false)
      setLoadingType(null)
      showNotification("❌ 剪藏失败", "error")
    }
  }

  // 直接保存选中内容（不使用AI）
  const handleDirectSaveSelection = async () => {
    const liveText = window.getSelection()?.toString().trim()
    const selectedText = (selectedTextRef.current || liveText || "").trim()
    if (!selectedText || selectedText.length < 10) {
      showNotification("⚠️ 请先选中一些文字（至少10个字符）", "warning")
      return
    }
    if (!checkContext()) {
      showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
      return
    }
    setLoading(true)
    setLoadingType("direct-selection")
    try {
      const selectedContent = extractSelectedContent()
      const images = selectedContent?.images || []
      await ClipStore.add({
        source: "webpage",
        url: window.location.href,
        title: document.title,
        rawTextSnippet: selectedText.slice(0, 500),
        rawTextFull: selectedText,
        summary: "",
        keyPoints: [],
        tags: [],
        meta: {},
        images
      })
      setLoading(false)
      setLoadingType(null)
      const imgCount = images.length
      showNotification(`✅ 已直接保存选中内容！${imgCount > 0 ? `（含${imgCount}张图片）` : ""}`, "success")
    } catch (e) {
      console.error("❌ Direct save error:", e)
      setLoading(false)
      setLoadingType(null)
      showNotification("❌ 保存失败", "error")
    }
  }

  const handleLanguage = () => {
    setLanguageLang(translateLang)
    const next = translateLang === 'en-US' ? 'zh-CN' : 'en-US'
    setTranslateLang(next)
  }

  if (!isEnabled || hiddenByPanel) return null;

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
    setIsEnabled(false);
  };

  const handleDisableGlobal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const storage = new Storage();
    await storage.set('clipDisableGlobal', true);
    setIsEnabled(false);
  };

  // 【修复】改进 API Key 获取逻辑，优先使用 hook 中的值
  const getOpenAIKeySafely = async (): Promise<string | null> => {
    // 优先使用 hook 中已加载的值
    if (openAIKey) return openAIKey
    
    // 如果 hook 还在加载中，等待一小段时间
    if (isApiKeyLoading) {
      await new Promise(resolve => setTimeout(resolve, 500))
      // 重新检查
      if (openAIKey) return openAIKey
    }
    
    // 兜底：直接从存储读取（不推荐，但作为备用）
    try {
      const result = await chrome.storage.local.get("clipper_api_config")
      const config = result.clipper_api_config
      if (config && config.apiKey) {
        return config.apiKey
      }
      // 再尝试旧的 SecureStorage
      const v = await secureStorage.get("openAIKey")
      return (v as string) ?? null
    } catch {
      return openAIKey ?? null
    }
  };

  const bookMarkIcon = <CiBookmark color='currentColor' size={24} className="w-[20px] h-[20px] transform scale-100 transition-transform duration-300 hover:scale-115 active:scale-90" />;
  const translateIcon = <MdGTranslate color='currentColor' size={24} className="w-[20px] h-[20px] transform scale-100 transition-transform duration-300 hover:scale-115 active:scale-90" />;
  const languageIcon = <FaExchangeAlt color='currentColor' size={24} className="w-[20px] h-[20px] transform scale-100 transition-transform duration-300 hover:scale-115 active:scale-90" />;
  const aiIcon = <AiFillAliwangwang color='currentColor' size={24} className="w-[20px] h-[20px] transform scale-100 transition-transform duration-300 hover:scale-115 active:scale-90" />;
  const saveTypeChangeIcon = <RiExchangeBoxLine color='currentColor' size={24} className="w-[20px] h-[20px] transform scale-100 transition-transform duration-300 hover:scale-115 active:scale-90" />;

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed z-[2147483647] select-none w-[40px] h-[40px] rounded-full pointer-events-auto",
        (isDragging || isSnapping) ? "opacity-75" : "transition-all duration-300 ease-out"
      )}
      style={{
        left: position.x,
        top: position.y,
        zIndex: 2147483700,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <TooltipProvider delayDuration={0}>
        <div className={cn(
          "absolute inset-0 w-full h-full pointer-events-none opacity-0 transition-opacity duration-300 ease-out",
          isMenuOpen && "pointer-events-auto opacity-100 cursor-pointer"
        )}>
          <div className="relative w-full h-full">
            {/* Bookmark Item (expand like translate) */}
            <div
              className="absolute top-1/2 left-1/2 origin-center transition-all duration-300 ease-out delay-75"
              style={{
                transform: getTransform('bookmark'),
                width: 40, height: 40
              }}
            >
              <div className={cn(
                "absolute right-0 top-0 w-[40px] h-[40px] rounded-[20px] shadow-md flex items-center justify-center overflow-hidden px-0 transition-[width,box-shadow,padding] duration-300 z-20 hover:w-[90px] hover:justify-between hover:shadow-lg hover:px-2 group",
                isDark ? "bg-neutral-900 text-white" : "bg-white text-gray-900",
                isSaveTypeOpen && "w-[90px] justify-between shadow-lg px-2"
              )}>
                <TooltipWrapper
                  side="top"
                  offset={12}
                  content={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <p>切换剪藏方式</p>
                    </div>
                  }
                >
                  <div className={cn(
                    "w-[40px] h-[40px] items-center justify-center cursor-pointer flex-shrink-0 hover:scale-110 active:scale-90 transition-transform",
                    isDark ? "text-white" : "text-gray-900",
                    isSaveTypeOpen ? "flex" : "hidden group-hover:flex"
                  )}
                    onMouseEnter={() => { handleMouseEnter(); captureSelection(); handleOpenSaveTypeChange() }}
                    onMouseLeave={handleCloseSaveTypeChange}
                  >
                    {saveTypeChangeIcon}
                  </div>
                </TooltipWrapper>

                <TooltipWrapper
                  side="top"
                  offset={12}
                  content={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span>{({
                        allPageSave: "整页剪藏",
                        allPageAISave: "AI整页剪藏",
                        selectSave: "选中剪藏",
                        selectAISave: "AI摘要剪藏"
                      } as Record<string, string>)[saveTypeTip] || "整页剪藏"}</span>
                    </div>
                  }
                >
                  <div className={cn("w-[40px] h-[40px] flex items-center justify-center cursor-pointer flex-shrink-0 hover:scale-110 active:scale-90 transition-transform", isDark ? "text-white" : "text-gray-900")} onMouseEnter={() => { expandStartRef.current = Date.now(); captureSelection() }} 
                    onClick={handleSaveClick}
                  >
                    {bookMarkIcon}
                  </div>
                </TooltipWrapper>


              </div>
            </div>

            {isSaveTypeOpen && (
              <div
                className="absolute z-[2147483647]"
                style={{ top: "50%", transform: "translateY(-50%)", right: "calc(100% + 70px)" }}
                onMouseEnter={() => { handleMouseEnter(); captureSelection(); handleOpenSaveTypeChange() }}
                onMouseLeave={handleCloseSaveTypeChange}
              >
                <SaveTypeChange onChoose={handlePickSaveType} selectedTag=
                  {saveTypeTip as "allPageSave" | "allPageAISave" | "selectSave" | "selectAISave"} />
              </div>
            )}
            {/* Translate Item */}
            <div
              className="absolute top-1/2 left-1/2 origin-center transition-all duration-300 ease-out delay-100"
              style={{
                transform: getTransform('translate'),
                width: 40, height: 40
              }}
            >
              <div className={cn("absolute right-0 top-0 w-[40px] h-[40px] rounded-[20px] shadow-md flex items-center justify-end overflow-hidden transition-[width,box-shadow] duration-300 z-20 hover:w-[90px] hover:justify-between hover:shadow-lg",
                isDark ? "bg-neutral-900 text-white" : "bg-white text-gray-900")}>
                <TooltipWrapper
                  side="top"
                  offset={12}
                  content={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>翻译为：</span>
                      <span style={{ marginLeft: 4 }}>{languageLang}</span>
                    </div>
                  }
                >
                  <div className="w-[40px] h-[40px] flex items-center justify-center cursor-pointer flex-shrink-0 hover:scale-110 active:scale-90 transition-transform" onClick={handleLanguage}>
                    {languageIcon}
                  </div>
                </TooltipWrapper>

                <TooltipWrapper
                  side="top"
                  offset={8}
                  content={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span>{isTranslated ? '显示原文' : '翻译为：'}</span>
                      {!isTranslated && (
                        <span style={{ marginLeft: 4 }}>{translateLang}</span>
                      )}
                      {/* <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 10 }}>Alt+T</span> */}
                    </div>
                  }
                >

                  <div className="w-[40px] h-[40px] flex items-center justify-center cursor-pointer flex-shrink-0 hover:scale-110 active:scale-90 transition-transform" 
                  onClick={handleTranslate}>
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
              <MenuButton icon={aiIcon} onClick={handleAI} tooltip='ai对话' isDark={isDark} />
            </div>
          </div>
        </div>
      </TooltipProvider>

      {/* 主图标 */}
      <div
        className={cn("relative w-[40px] h-[40px] rounded-full shadow-md cursor-pointer hover:shadow-xl transition-shadow group",
          isDark ? "bg-neutral-900 text-white" : "bg-white text-gray-900")}
        onMouseDown={handleMouseDown}
        onClick={handleMain}
      >
        <AiOutlineRobot color='currentColor' size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20px] h-[20px] transition-transform duration-300 ease-in-out group-hover:scale-105 group-active:scale-90" />
        <div
          className={cn(
            "absolute -right-2.5 -top-2.5 w-4 h-4 rounded-full shadow flex items-center justify-center font-bold cursor-pointer transition-transform scale-0 text-[10px]",
            isDark ? "bg-neutral-900 text-gray-200 hover:bg-gray-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300",
            isMenuOpen && "scale-100"
          )}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleOpenSettings}
        >
          -
        </div>
        {loading && (
          <div className="absolute left-[48px] top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-md bg-black/80 text-white px-2 py-1 text-[11px] shadow animate-fade-in">
            <div className="w-3 h-3 rounded-full border-2 border-white/60 border-t-transparent animate-spin"></div>
            <span>{loadingType === "full" || loadingType === "selection" ? "AI处理中…" : "保存中…"}</span>
          </div>
        )}
      </div>

      {/* 打开设置面板 */}
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



export default floatButton;

