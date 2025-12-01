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
import { extractContent, extractSelectedContent } from "@/core/index"
import type { ExtractedContent } from "@/core/types"
import { useAtomValue } from "jotai"
import { openAIKeyAtom } from "@/lib/atoms/openai"
import { usePort } from "@plasmohq/messaging/hook"
import { cn } from "@/lib/utils"
import { RiExchangeBoxLine } from "react-icons/ri";
import { SaveTypeChange } from "@/components/saveType-change"
import { storage as secureStorage } from "@/lib/atoms/storage"

export const config = {
  matches: ["<all_urls>"]
}

const BUTTON_SIZE: number = 40;
const RIGHT_MARGIN: number = (window.innerWidth - (window.innerWidth - document.documentElement.clientWidth) - BUTTON_SIZE - window.devicePixelRatio * 7.5)
const TOP_MARGIN: number = 20;
const BOTTOM_MARGIN: number = 20;
const INITIAL_POSITION = { x: RIGHT_MARGIN, y: 200 };
const Z_INDEX = 2147483640

// 菜单按钮组件
const MenuButton = ({ icon, onClick, tooltip }: { icon: React.ReactNode; onClick: () => void; tooltip: string | React.ReactNode }) => (
  <TooltipWrapper side="left" text={typeof tooltip === 'string' ? tooltip as string : undefined} content={typeof tooltip !== 'string' ? tooltip as React.ReactNode : undefined}>
    <button
      className="p-3 bg-white border-none rounded-full shadow-md cursor-pointer transition-colors duration-150 outline-none overflow-hidden w-[40px] h-[40px] flex items-center justify-center hover:scale-110 active:scale-90 group"
      onClick={onClick}
    >
      <div className="transform transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>
    </button>
  </TooltipWrapper>
);

// 通知组件
function showNotification(message: string, type: "success" | "error" | "warning" | "loading" = "success") {
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

const floatButton = () => {
  const [position, setPosition] = useState(INITIAL_POSITION);//悬浮按钮当前位置
  const [isDragging, setIsDragging] = useState(false);//是否拖拽
  const [isMenuOpen, setIsMenuOpen] = useState(false);//是否打开菜单
  const [isEnabled, setIsEnabled] = useState(true);//是否启用按钮
  const [hiddenByPanel, setHiddenByPanel] = useState(false);//是否被面板隐藏
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);//设置面板
  const [translateLang, setTranslateLang] = useState<string>('en-US');//当前翻译语言提示
  const [saveTypeTip, setSaveTypeTip] = useState<string>("一键保存");//当前保存类型提示
  const [isSaveTypeOpen, setIsSaveTypeOpen] = useState<boolean>(false);//切换保存类型菜单
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);//隐藏超时定时器
  const saveTypeHideTimeout = useRef<NodeJS.Timeout | null>(null);//保存类型面板隐藏定时器
  const offsetRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false)
  const [loadingType, setLoadingType] = useState<"full" | "selection" | "direct-full" | "direct-selection" | null>(null)
  const openAIKey = useAtomValue(openAIKeyAtom)
  const port = usePort("page-completion")
  const extractedContentRef = useRef<ExtractedContent | null>(null)
  const requestTypeRef = useRef<"full" | "selection" | null>(null)
  const lastDragTimeRef = useRef<number>(0)
  const dragMovedRef = useRef<boolean>(false)
  const expandStartRef = useRef<number>(0)
  const chosenSaveActionRef = useRef<(() => Promise<void> | void) | null>(null)
  const loadingNotifyDismissRef = useRef<(() => void) | null>(null)
  const selectedTextRef = useRef<string>("")

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

      setPosition(() => ({
        x: getRightMargin(),
        y: topLimit
      }));
      lastDragTimeRef.current = Date.now()
    }
    setIsDragging(false);
  }, [isDragging]);

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
    setPosition((p) => ({ x: getRightMargin(), y: p.y }))
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
  }, [snapToRight, isDragging])

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
      chrome.runtime.sendMessage({ type: "clip:show-float" })
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

  const handleTranslate = () => console.log("执行翻译操作");

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
      chrome.runtime.sendMessage({ type: "clip:show-float" })
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

  const getOpenAIKeySafely = async (): Promise<string | null> => {
    if (openAIKey) return openAIKey
    try {
      const v = await secureStorage.get("openAIKey")
      return (v as string) ?? null
    } catch {
      return openAIKey ?? null
    }
  };

  const bookMarkIcon = <CiBookmark color='#000000' size={24} className="w-[20px] h-[20px] transform scale-100 transition-transform duration-300 hover:scale-115 active:scale-90" />;
  const translateIcon = <MdGTranslate color='#000000' size={24} className="w-[20px] h-[20px] transform scale-100 transition-transform duration-300 hover:scale-115 active:scale-90" />;
  const languageIcon = <FaExchangeAlt color='#000000' size={24} className="w-[20px] h-[20px] transform scale-100 transition-transform duration-300 hover:scale-115 active:scale-90" />;
  const aiIcon = <AiFillAliwangwang color='#000000' size={24} className="w-[20px] h-[20px] transform scale-100 transition-transform duration-300 hover:scale-115 active:scale-90" />;
  const saveTypeChangeIcon = <RiExchangeBoxLine color='#000000' size={24} className="w-[20px] h-[20px] transform scale-100 transition-transform duration-300 hover:scale-115 active:scale-90" />;

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed z-[2147483647] select-none w-[40px] h-[40px] rounded-full transition-opacity duration-200",
        isDragging && "opacity-75 transition-none"
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
                "absolute right-0 top-0 w-[40px] h-[40px] bg-white rounded-[20px] shadow-md flex items-center justify-center overflow-hidden px-0 transition-[width,box-shadow,padding] duration-300 z-20 hover:w-[90px] hover:justify-between hover:shadow-lg hover:px-2 group",
                isSaveTypeOpen && "w-[90px] justify-between shadow-lg px-2"
              )}>
                <TooltipWrapper
                  side="top"
                  offset={12}
                  content={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <p>切换保存方式</p>
                    </div>
                  }
                >
                  <div className={cn(
                    "w-[40px] h-[40px] items-center justify-center cursor-pointer flex-shrink-0 hover:scale-110 active:scale-90 transition-transform",
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
                  <div className="w-[40px] h-[40px] flex items-center justify-center cursor-pointer flex-shrink-0 hover:scale-110 active:scale-90 transition-transform" onMouseEnter={() => { expandStartRef.current = Date.now(); captureSelection() }}
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
              <div className="absolute right-0 top-0 w-[40px] h-[40px] bg-white rounded-[20px] shadow-md flex items-center justify-end overflow-hidden transition-[width,box-shadow] duration-300 z-20 hover:w-[90px] hover:justify-between hover:shadow-lg">
                <TooltipWrapper
                  side="top"
                  offset={12}
                  content={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>翻译为：</span>
                      <span style={{ marginLeft: 4 }}>{translateLang}</span>
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
                      <span>翻译为：</span>
                      <span style={{ marginLeft: 4 }}>{translateLang}</span>
                      {/* <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 10 }}>Alt+T</span> */}
                    </div>
                  }
                >

                  <div className="w-[40px] h-[40px] flex items-center justify-center cursor-pointer flex-shrink-0 hover:scale-110 active:scale-90 transition-transform" onClick={handleTranslate}>
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
              <MenuButton icon={aiIcon} onClick={handleAI} tooltip='ai对话' />
            </div>
          </div>
        </div>
      </TooltipProvider>

      {/* 主图标 */}
      <div
        className="relative w-[40px] h-[40px] rounded-full bg-white shadow-md cursor-pointer hover:shadow-xl transition-shadow group"
        onMouseDown={handleMouseDown}
        onClick={handleMain}
      >
        <AiOutlineRobot color='black' size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20px] h-[20px] transition-transform duration-300 ease-in-out group-hover:scale-105 group-active:scale-90" />
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

export const getStyle = () => {
  const style = document.createElement('style');
  style.textContent = styleText;
  return style;
};

export default floatButton;

