import React, { useState, useRef, useCallback, useEffect } from 'react'; // 引入 React 核心 hooks
import { useI18n } from '@/lib/use-i18n'; // 引入国际化支持 Hook
import { Storage } from '@plasmohq/storage'; // 引入 Plasmo 存储库，用于持久化数据
import styleText from "data-text:../style.css" // 引入全局样式文件
import type { PlasmoGetShadowHostId } from "plasmo" // 引入 Plasmo 类型定义
import { AiOutlineRobot } from "react-icons/ai"; // 引入机器人图标
import { MdGTranslate } from "react-icons/md"; // 引入谷歌翻译图标
import { CiBookmark } from "react-icons/ci"; // 引入书签图标
import { AiFillAliwangwang } from "react-icons/ai"; // 引入阿里旺旺图标（用于AI对话）
import { FaExchangeAlt } from "react-icons/fa"; // 引入交换图标
import { TooltipProvider } from "@/components/ui/tooltip" // 引入 Tooltip 提供者
import { TooltipWrapper } from "@/components/ui/tooltip-wrapper" // 引入 Tooltip 包装器
import { ClipStore } from "@/lib/clip-store" // 引入剪藏存储库
import { extractContent, extractSelectedContent } from "@/core/index" // 引入内容提取核心函数
import type { ExtractedContent } from "@/core/types" // 引入提取内容的类型定义
// 【修复】使用统一的 API 配置模块，解决跨页面不同步问题
import { useApiConfig } from "@/lib/api-config-store" // 引入统一的 API 配置 Hook
import { usePort } from "@plasmohq/messaging/hook" // 引入 Plasmo 消息端口 Hook
import { cn } from "@/lib/utils" // 引入类名合并工具
import { RiExchangeBoxLine } from "react-icons/ri"; // 引入交换盒子图标
import { SaveTypeChange } from "@/components/saveType-change" // 引入保存类型切换组件
import { storage as secureStorage } from "@/lib/atoms/storage" // 引入安全存储模块
import { DialogOverlay } from '@radix-ui/react-dialog'; // 引入 Dialog 遮罩层（未使用）
import { translateCurrentPage } from "~/contents/pageTranslator" // 引入页面翻译核心函数

/**
 * 浮动按钮组件配置
 * 匹配所有 URL，确保在任何页面都能加载
 */
export const config = {
  matches: ["<all_urls>"] // 匹配规则：所有 URL
}

// 独立的 Shadow Host，提升到全页最顶层，防止样式冲突
export const getShadowHostId: PlasmoGetShadowHostId = () => "plasmo-inline" // 定义 Shadow DOM 的 ID

/**
 * 获取注入的样式
 * 强制设置 host 的定位和层级，防止被页面原有样式覆盖
 */
export const getStyle = () => {
  const style = document.createElement('style') // 创建 style 标签
  // 设置样式内容，强制 position 和 z-index
  style.textContent = `${styleText}\n:host(#plasmo-inline){position:relative!important;z-index:auto!important;pointer-events:none!important;}`
  return style // 返回 style 元素
}

// 定义常量
const BUTTON_SIZE: number = 40; // 按钮尺寸（像素）
// 计算右边距，考虑滚动条宽度和设备像素比
const RIGHT_MARGIN: number = (window.innerWidth - (window.innerWidth - document.documentElement.clientWidth) - BUTTON_SIZE - window.devicePixelRatio * 7.5)
const TOP_MARGIN: number = 20; // 顶部边距
const BOTTOM_MARGIN: number = 20; // 底部边距
const INITIAL_POSITION = { x: RIGHT_MARGIN, y: 200 }; // 初始位置坐标
const Z_INDEX = 2147483640 // 极高的 z-index，确保在最顶层

// 菜单按钮组件
const MenuButton = ({ icon, onClick, tooltip, isDark }: { icon: React.ReactNode; onClick: () => void; tooltip: string | React.ReactNode; isDark?: boolean }) => ( // 通用菜单按钮，支持提示与主题色
  <TooltipWrapper side="left" text={typeof tooltip === 'string' ? tooltip as string : undefined} content={typeof tooltip !== 'string' ? tooltip as React.ReactNode : undefined}>
    {/* 此处有修改（单位由默认的 rem 换算成 px）：p-[12px] */}
    <button
      className={cn(
        "p-[12px] border-none rounded-full shadow-md cursor-pointer transition-colors duration-150 outline-none overflow-hidden w-[40px] h-[40px] flex items-center justify-center hover:scale-110 active:scale-90 group",
        isDark ? "bg-neutral-900 text-white" : "bg-white text-gray-900" // 根据主题色切换样式
      )}
      onClick={onClick} // 点击事件处理器
    >
      <div className="transform transition-transform duration-300 group-hover:scale-110">
        {icon} {/* 渲染图标 */}
      </div>
    </button>
  </TooltipWrapper>
);

// 通知组件
function showNotification(message: string, type: "success" | "error" | "warning" | "loading" = "success") { // 顶部通知（加载提示/成功/错误）
  // 定义不同类型的颜色配置
  const colors = {
    success: { bg: "#10b981", text: "#ffffff" }, // 成功：绿色
    error: { bg: "#ef4444", text: "#ffffff" },   // 错误：红色
    warning: { bg: "#f59e0b", text: "#ffffff" }, // 警告：黄色
    loading: { bg: "#111827", text: "#ffffff" }, // 加载：深色
  }

  const notification = document.createElement("div") // 创建通知容器
  // 设置通知样式
  Object.assign(notification.style, {
    position: "fixed", // 固定定位
    top: "20px", // 顶部距离
    right: "20px", // 右侧距离
    background: colors[type].bg, // 背景色
    color: colors[type].text, // 文字颜色
    padding: "12px 20px", // 内边距
    borderRadius: "8px", // 圆角
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)", // 阴影
    zIndex: String(Z_INDEX + 10), // 层级高于按钮
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', // 字体
    fontSize: "14px", // 字号
    fontWeight: "500", // 字重
    animation: "fadeIn 0.3s ease-out", // 进入动画
    display: "inline-flex", // 布局方式
    alignItems: "center", // 垂直居中
    gap: "8px" // 间距
  })

  // 注入通知相关的关键帧动画样式
  if (!document.getElementById("clip-notify-style")) {
    const styleEl = document.createElement("style") // 创建样式标签
    styleEl.id = "clip-notify-style" // 设置 ID
    styleEl.textContent = `@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}` // 定义旋转动画
    document.head.appendChild(styleEl) // 插入到 head
  }

  // 如果是加载状态，添加旋转的 loading 图标
  if (type === "loading") {
    const spinner = document.createElement("div") // 创建 spinner
    Object.assign(spinner.style, {
      width: "12px",
      height: "12px",
      border: "2px solid rgba(255,255,255,0.6)", // 边框
      borderTopColor: "transparent", // 顶部透明形成缺口
      borderRadius: "50%", // 圆形
      animation: "spin 1s linear infinite" // 应用旋转动画
    })
    notification.appendChild(spinner) // 添加 spinner 到通知
  }

  const textSpan = document.createElement("span") // 创建文本 span
  textSpan.textContent = message // 设置文本内容
  notification.appendChild(textSpan) // 添加文本到通知

  document.body.appendChild(notification) // 将通知挂载到 body

  // 如果是 loading 类型，返回一个关闭函数供外部手动调用
  if (type === "loading") {
    return () => {
      notification.style.opacity = "0" // 渐隐
      notification.style.transition = "opacity 0.2s" // 过渡效果
      setTimeout(() => notification.remove(), 200) // 移除 DOM
    }
  }
  // 其他类型自动消失
  setTimeout(() => {
    notification.style.opacity = "0" // 渐隐
    notification.style.transition = "opacity 0.3s" // 过渡效果
    setTimeout(() => notification.remove(), 300) // 移除 DOM
  }, type === "error" ? 5000 : 3000) // 错误显示 5s，其他 3s
  return () => { } // 返回空函数
}

/**
 * 悬浮按钮主组件
 * 包含拖拽、吸附、菜单展开、翻译控制、剪藏控制等核心逻辑
 */
const floatButton = () => { // 悬浮按钮主组件
  const { t } = useI18n();
  const [position, setPosition] = useState(INITIAL_POSITION);//悬浮按钮当前位置
  const [isDragging, setIsDragging] = useState(false);//是否正在拖拽
  const [isSnapping, setIsSnapping] = useState(false)//是否正在吸附动画中
  const [isMenuOpen, setIsMenuOpen] = useState(false);//是否打开环形菜单
  const [isEnabled, setIsEnabled] = useState(true);//是否启用按钮（全局/站点开关）
  const [hiddenByPanel, setHiddenByPanel] = useState(false);//是否被侧边栏面板隐藏
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);//是否打开设置小面板
  const [translateLang, setTranslateLang] = useState<string>('zh-CN');//当前翻译目标语言
  const [languageLang, setLanguageLang] = useState<string>('en-US');//语言切换按钮显示的语言
  const [isTranslating, setIsTranslating] = useState(false);//是否正在进行翻译请求
  const [saveTypeTip, setSaveTypeTip] = useState<string>("一键保存");//当前保存类型提示文本
  const [isSaveTypeOpen, setIsSaveTypeOpen] = useState<boolean>(false);//是否打开保存类型选择菜单
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);//菜单自动隐藏的定时器引用
  const saveTypeHideTimeout = useRef<NodeJS.Timeout | null>(null);//保存类型面板自动隐藏的定时器引用
  const offsetRef = useRef({ x: 0, y: 0 });//拖拽时的鼠标偏移量
  const containerRef = useRef<HTMLDivElement>(null);//按钮容器的 DOM 引用
  const [loading, setLoading] = useState(false)//全局加载状态（用于剪藏等）
  const [loadingType, setLoadingType] = useState<"full" | "selection" | "direct-full" | "direct-selection" | null>(null)//加载的具体类型
  // 【修复】使用统一的 API 配置模块，包含加载状态
  const { apiKey: openAIKey, isLoading: isApiKeyLoading } = useApiConfig() // 获取 API Key 配置
  const port = usePort("page-completion") // 连接到 page-completion 端口
  const extractedContentRef = useRef<ExtractedContent | null>(null)//缓存提取的内容
  const requestTypeRef = useRef<"full" | "selection" | null>(null)//缓存当前的请求类型
  const [isDark, setIsDark] = useState<boolean>(() => { //检测系统深色模式
    try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches } catch { return false }
  })
  const lastDragTimeRef = useRef<number>(0)//记录上次拖拽结束时间，防止点击事件冲突
  const dragMovedRef = useRef<boolean>(false)//标记拖拽过程中是否发生了位移
  const expandStartRef = useRef<number>(0)//记录菜单展开时间
  const chosenSaveActionRef = useRef<(() => Promise<void> | void) | null>(null)//缓存当前选中的保存动作函数
  const loadingNotifyDismissRef = useRef<(() => void) | null>(null);//加载通知的关闭函数引用
  const selectedTextRef = useRef<string>("")//缓存选中的文本内容
  const snapAnimRef = useRef<number | null>(null)//吸附动画的 requestAnimationFrame ID

//防抖函数 (占位)

  // 捕获当前选中的文本
  const captureSelection = () => {
    try {
      selectedTextRef.current = window.getSelection()?.toString().trim() || "" // 获取并修剪选中文本
    } catch (e) {
      console.log("选取失败：", e);
      showNotification(t("floatBtnNotificationCaptureSelectionFailed"), "warning")
    }
  }

  // 检查扩展上下文是否有效（防止扩展更新后页面脚本失效）
  const checkContext = (): boolean => {
    try {
      return !!chrome.runtime?.id // 检查 runtime ID 是否存在
    } catch {
      return false // 异常则视为无效
    }
  }

  // URL 标准化处理，去除无关参数
  const normalizeUrl = (u: string): string => {
    try {
      const url = new URL(u) // 解析 URL
      const path = url.pathname.replace(/\/+$/, "") || "/" // 去除末尾斜杠
      
      // 对于依赖查询参数区分内容的网站，保留关键参数
      // context: 百度新闻 mbd.baidu.com (内含 nid)
      // nid: 新闻ID
      const importantParams = ['id', 'vid', 'bvid', 'aid', 'p', 'articleId', 'newsId', 'docid', 'context', 'nid',"wd",
  "word","q","query"] // 关键参数列表
      const params = new URLSearchParams(url.search) // 获取查询参数
      const keptParams = new URLSearchParams() // 存储保留的参数
      
      for (const key of importantParams) {
        const value = params.get(key) // 获取参数值
        if (value) {
          keptParams.set(key, value) // 如果存在则保留
        }
      }
      
      const queryString = keptParams.toString() // 生成新的查询字符串
      return queryString ? `${url.origin}${path}?${queryString}` : `${url.origin}${path}` // 拼接最终 URL
    } catch {
      // 降级处理：只去掉 hash，保留查询参数
      const base = u.split("#")[0] // 去掉 hash
      return base.replace(/\/+$/, "") || "/" // 去掉末尾斜杠
    }
  }

  // 处理鼠标按下事件（开始拖拽）
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation(); // 阻止冒泡
    setIsDragging(true); // 设置拖拽状态
    if (snapAnimRef.current) { // 如果正在进行吸附动画，取消它
      cancelAnimationFrame(snapAnimRef.current)
      snapAnimRef.current = null
    }
    setIsSnapping(false) // 停止吸附状态
    dragMovedRef.current = false // 重置位移标记
    offsetRef.current = { // 计算鼠标相对于按钮左上角的偏移
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position.x, position.y]);

  // 处理鼠标移动事件（拖拽中）
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return; // 如果未开始拖拽，忽略
    setIsMenuOpen(false); // 拖拽时关闭菜单
    let newX = e.clientX - offsetRef.current.x; // 计算新 X 坐标
    let newY = e.clientY - offsetRef.current.y; // 计算新 Y 坐标

    const iconWidth = containerRef.current?.offsetWidth || 0; // 获取按钮宽度
    const iconHeight = containerRef.current?.offsetHeight || 0; // 获取按钮高度

    // 限制拖拽范围在可视窗口内
    newX = Math.max(0, Math.min(newX, window.innerWidth - iconWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - iconHeight));

    setPosition({ x: newX, y: newY }); // 更新位置
    if (!dragMovedRef.current) { // 检查是否发生微小位移（防止误触）
      const dx = Math.abs(newX - (position.x ?? 0))
      const dy = Math.abs(newY - (position.y ?? 0))
      if (dx > 3 || dy > 3) dragMovedRef.current = true // 位移超过 3px 视为拖拽
    }
  }, [isDragging]);

  // 计算吸附到右侧的边距
  function getRightMargin() {
    const dpr = window.devicePixelRatio // 获取设备像素比
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth // 计算滚动条宽度
    const margin = dpr * 7.5 // 基础边距
    const x = window.innerWidth - scrollbarWidth - BUTTON_SIZE - margin // 计算 X 坐标
    return Math.max(0, x) // 确保不为负
  }

  // 处理鼠标松开事件（结束拖拽并吸附）
  const handleMouseUp = useCallback((position: { x: number; y: number }) => {
    if (isDragging && dragMovedRef.current) { // 如果是拖拽结束
      let topLimit: number;
      // 限制 Y 轴吸附范围
      if (position.y <= 0) {
        topLimit = TOP_MARGIN;
      } else if (position.y > document.documentElement.clientHeight - BUTTON_SIZE / 2) {
        topLimit = document.documentElement.clientHeight - BUTTON_SIZE - BOTTOM_MARGIN;
      } else {
        topLimit = position.y;
      }

      const startX = position.x // 起始 X
      const endX = getRightMargin() // 目标 X（右侧）
      const duration = 280 // 动画时长 ms
      setIsDragging(false) // 结束拖拽
      setIsSnapping(true) // 开始吸附
      const start = performance.now() // 动画开始时间
      const ease = (t: number) => 1 - Math.pow(1 - t, 3) // 缓动函数 (cubic ease out)
      // 动画步进函数
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration) // 计算进度
        const x = startX + (endX - startX) * ease(p) // 计算当前 X
        setPosition({ x, y: topLimit }) // 更新位置
        if (p < 1) {
          snapAnimRef.current = requestAnimationFrame(step) // 继续下一帧
        } else {
          setIsSnapping(false) // 动画结束
        }
      }
      snapAnimRef.current = requestAnimationFrame(step) // 启动动画
      lastDragTimeRef.current = Date.now() // 记录结束时间
      return
    }
    setIsDragging(false) // 如果未位移，直接结束拖拽状态
  }, [isDragging])

  // 强制吸附到右侧（用于窗口 resize 等）
  const snapToRight = useCallback(() => {
    const topLimit = Math.max(
      TOP_MARGIN,
      Math.min(position.y, (window.innerHeight || document.documentElement.clientHeight) - BUTTON_SIZE - BOTTOM_MARGIN)
    )
    setPosition({ x: getRightMargin(), y: topLimit })
  }, [position.y])

  // 检查是否在右边缘
  const isAtRightEdge = useCallback(() => {
    return Math.abs(position.x - getRightMargin()) <= 10
  }, [position.x])

  // 监听窗口大小变化和滚动，保持吸附
  useEffect(() => {
    const onResize = () => {
      if (isDragging) return // 拖拽中不重置
      snapToRight() // 执行吸附
    }
    window.addEventListener("resize", onResize)
    const vv = window.visualViewport
    vv?.addEventListener("resize", onResize)
    vv?.addEventListener("scroll", onResize)
    return () => { // 清理监听器
      window.removeEventListener("resize", onResize)
      vv?.removeEventListener("resize", onResize)
      vv?.removeEventListener("scroll", onResize)
    }
  }, [snapToRight])

  // 监听来自页面的消息（控制面板显隐）
  useEffect(() => {
    const pageHandler = (e: MessageEvent) => {
      const d = e?.data as { source?: string; type?: string } | undefined
      if (!d || d.source !== "clip") return // 过滤非插件消息
      if (d.type === "clip:panel-open") setHiddenByPanel(true) // 面板打开时隐藏按钮
      if (d.type === "clip:panel-close" || d.type === "clip:toggle-float") setHiddenByPanel(false) // 面板关闭时显示按钮
    }
    window.addEventListener("message", pageHandler)
    return () => window.removeEventListener("message", pageHandler)
  }, [])

  // Determine menu position mode based on container position
  // 根据按钮位置决定菜单展开方向（防止溢出屏幕）
  const getMenuPositionMode = () => {
    if (!containerRef.current) return 'default';
    const rect = containerRef.current.getBoundingClientRect();
    const topThreshold = 50;
    const bottomThreshold = 50;

    if (rect.top <= topThreshold) return 'topEdge'; // 靠顶，向下展开
    if (rect.top >= window.innerHeight - BUTTON_SIZE - bottomThreshold) return 'bottomEdge'; // 靠底，向上展开
    return 'default'; // 默认
  };

  const menuMode = getMenuPositionMode(); // 获取当前菜单模式

  // 监听系统深色模式变化
  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const cb = (e: MediaQueryListEvent) => setIsDark(e.matches)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    } catch {}
  }, [])

  // Dynamic transforms based on menu mode
  // 根据菜单模式计算各个子菜单项的变换位置
  const getTransform = (type: 'bookmark' | 'translate' | 'ai') => {
    if (!isMenuOpen) return 'translate(-50%, -50%) scale(0)'; // 未打开时缩放为0

    if (menuMode === 'bottomEdge') { // 底部模式
      switch (type) {
        case 'bookmark': return 'translate(calc(100% - 60px), calc(-150% - 20px)) scale(1)';
        case 'translate': return 'translate(-175%, -175%) scale(1)';
        case 'ai': return 'translate(calc(-100% - 40px), -50%) scale(1)';
      }
    } else if (menuMode === 'topEdge') { // 顶部模式
      switch (type) {
        case 'bookmark': return 'translate(calc(-100% - 40px), -50%) scale(1)';
        case 'translate': return 'translate(-175%, 75%) scale(1)';
        case 'ai': return 'translate(-50%, 40px) scale(1)';
      }
    } else {
      // Default // 默认模式（扇形展开）
      switch (type) {
        case 'bookmark': return 'translate(calc(-50% - 20px), calc(-50% - 60px)) scale(1)';
        case 'translate': return 'translate(calc(-50% - 60px), -50%) scale(1)';
        case 'ai': return 'translate(calc(-50% - 15px), calc(-50% + 60px)) scale(1)';
      }
    }
  }

  // 鼠标进入按钮区域，打开菜单
  const handleMouseEnter = () => {
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current); // 清除隐藏定时器
      hideTimeout.current = null;
    }
    setIsMenuOpen(true); // 打开菜单
  }

  // 鼠标离开按钮区域，延时关闭菜单
  const handleMouseLeave = () => {
    hideTimeout.current = setTimeout(() => {
      setIsMenuOpen(false); // 关闭菜单
    }, 200);
  }

  // 全局鼠标监听（用于拖拽）
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // 初始化加载配置（禁用状态、保存模式）
  useEffect(() => {
    const host = window.location.host;
    const storage = new Storage();
    (async () => {
      // 检查全局禁用或站点禁用
      const globalDisabled = await storage.get<boolean>('clipDisableGlobal');
      const siteDisabled = await storage.get<boolean>(`clipDisableSite:${host}`);
      if (globalDisabled || siteDisabled) {
        setIsEnabled(false); // 禁用按钮
      }
      // 读取保存模式配置
      const savedMode = await storage.get<string>('clipSaveMode')
      if (savedMode && ["allPageSave", "allPageAISave", "selectSave", "selectAISave"].includes(savedMode)) {
        setSaveTypeTip(savedMode) // 设置提示
        // 设置对应的处理函数
        chosenSaveActionRef.current =
          savedMode === "allPageSave" ? handleSave :
            savedMode === "allPageAISave" ? handleAISaveFull :
              savedMode === "selectSave" ? handleDirectSaveSelection :
                savedMode === "selectAISave" ? handleAISaveSelection :
                  handleSave
      }
    })();
  }, []);

  // 点击主按钮逻辑（打开侧边栏）
  const handleMain = () => {
    if (Date.now() - lastDragTimeRef.current < 150) return // 防止拖拽结束时误触
    try {
      window.postMessage({ source: "clip", type: "clip:show-float" }, "*") // 发送消息给页面脚本
    } catch (e) {
      console.log("悬浮窗打开请求发送失败：", e);
    }
    if (!checkContext()) return
    try {
      chrome.runtime.sendMessage({ type: "clip:show-float" }, () => {}) // 发送消息给后台
    } catch (e) {
      console.log(e);
      alert("悬浮窗打开失败");
    }
  }

  // 监听后台端口消息（处理 AI 剪藏结果）
  useEffect(() => {
    if (!port.data || !requestTypeRef.current) return // 无数据或无请求类型则跳过
    if (port.data.isEnd) { // 接收完成
      loadingNotifyDismissRef.current?.() // 关闭加载通知
      loadingNotifyDismissRef.current = null
      const summary = port.data.message?.replace(/\nEND$/, "").replace(/END$/, "") || "" // 获取摘要内容
      const content = extractedContentRef.current
      if (!checkContext()) { // 检查上下文
        setLoading(false)
        setLoadingType(null)
        // showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
        showNotification(t("floatBtnNotificationExtensionReloaded"), "warning")
        return
      }
      // 保存到 ClipStore
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
        // 通知其他页面刷新
        chrome.runtime.sendMessage({ action: 'clips-updated' }).catch(() => {})
        
        setLoading(false)
        setLoadingType(null)
        requestTypeRef.current = null
        const imgCount = content?.images?.length || 0
        // showNotification(`✅ 剪藏成功！${imgCount > 0 ? `（含${imgCount}张图片）` : ""}`, "success")
        const picNumInfo = t("floatBtnNotificationPictureContaining") + imgCount + t("floatBtnNotificationPictureCount")
        showNotification(t("floatBtnNotificationClipSuccess") + (imgCount > 0 ? picNumInfo : ""), "success")
      }).catch((err) => {
        setLoading(false)
        setLoadingType(null)
        // showNotification("❌ 保存失败: " + err.message, "error")
        showNotification(t("floatBtnNotificationSaveFailed") + err.message, "error")
      })
    } else if (port.data.error) { // 接收错误
      loadingNotifyDismissRef.current?.()
      loadingNotifyDismissRef.current = null
      setLoading(false)
      setLoadingType(null)
      // showNotification("❌ AI 处理失败", "error")
      showNotification(t("floatBtnNotificationAIProcessFailed"), "error")
    }
  }, [port.data])

  //直接保存整页
  const handleSave = async () => {
    if (!checkContext()) {
      // showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
      showNotification(t("floatBtnNotificationExtensionReloaded"), "warning")
      return
    }
    //检查当前网页是否保存过
    try {
      const content = await extractContent() // 提取内容
      try {
        const contentUrlNorm = content?.url ? normalizeUrl(content.url) : null
        if (contentUrlNorm) {
          const latest = await ClipStore.getAll() // 获取所有剪藏
          if (latest.some((c) => normalizeUrl(c.url) === contentUrlNorm)) { // 查重
            setLoading(false)
            setLoadingType(null)
            // showNotification("⚠️ 当前页面已保存", "warning")
            showNotification(t("floatBtnNotificationAlreadySaved"), "warning")
            return
          }
        }
      } catch (e) {
        console.log(e);
        // showNotification("❌ 检查剪藏失败:Error")
        showNotification(t("floatBtnNotificationCheckFailed") + e.message, "error")
        return
      }
      setLoading(true)
      setLoadingType("direct-full")

      // 添加到存储
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
      
      // 通知其他页面刷新
      chrome.runtime.sendMessage({ action: 'clips-updated' }).catch(() => {})
      
      setLoading(false)
      setLoadingType(null)
      const imgCount = content?.images?.length || 0
      //showNotification(`✅ 已直接保存整页！${imgCount > 0 ? `（含${imgCount}张图片）` : ""}`, "success")
      const picNumInfo = t("floatBtnNotificationPictureContaining") + imgCount + t("floatBtnNotificationPictureCount")
      showNotification(t("floatBtnNotificationAllPageSaveSuccess") + (imgCount > 0 ? picNumInfo : ""), "success")
    } catch (e) {
      console.error("❌ Direct save error:", e)
      setLoading(false)
      setLoadingType(null)
      // showNotification("❌ 保存失败", "error")
      showNotification(t("floatBtnNotificationSaveFailed") + e.message, "error")
    }
  }

  //打开切换保存类型面板
  const handleOpenSaveTypeChange = () => {
    if (saveTypeHideTimeout.current) {
      clearTimeout(saveTypeHideTimeout.current) // 清除关闭定时器
      saveTypeHideTimeout.current = null
    }
    if (Date.now() - expandStartRef.current < 180) return // 防止展开动画冲突
    setIsSaveTypeOpen(true); // 打开面板
  }

  //关闭切换保存类型面板
  const handleCloseSaveTypeChange = () => {
    if (saveTypeHideTimeout.current) {
      clearTimeout(saveTypeHideTimeout.current)
    }
    saveTypeHideTimeout.current = setTimeout(() => { // 延时关闭
      setIsSaveTypeOpen(false)
      saveTypeHideTimeout.current = null
    }, 200)
  }

  const handleTranslate = () => { // 点击翻译/显示原文的统一入口
  if (isTranslating) return;//若翻译已经启动则不翻译
  if (!isTranslated) { // 如果当前未翻译，则开始翻译
    setIsTranslating(true);
    // const dismiss = showNotification("正在翻译可视区域…", "loading");
    const dismiss = showNotification(t("floatBtnNotificationTranslating"), "loading");
    loadingNotifyDismissRef.current = dismiss;
    /* LLM 诊断暂时禁用
    try { 
      chrome.runtime.sendMessage({ action: "diagnose-llm" }, (resp) => { 
        try { 
          console.log("[LLM 诊断]", resp) 
          if (resp?.error || (resp?.status && resp.status !== 200)) {
             showNotification(`LLM 诊断异常: ${resp.error || resp.status}`, "warning")
          }
        } catch {} 
      }) 
    } catch {}
    */
    /** 启动定时器，延迟600ms秒执行，该函数负责节点扫描、并发调度、分批翻译、结果写回与恢复原文。
     * 在暂停的同时异步发送消息给内容脚本（chrome.runtime.sendMessage)=>跳转到pageTranslator接受消息
     * 如果消息回调到达表示通道正常，就清除计时器（此时就可以正常发送请求了）否则600ms后就走前端直启直接调用translateCurrentPage开始翻译
     * 这里做了一个兜底。（chrome扩展的后台service worker可能挂起，消息到达存在抖动，做了一个直接调用的兜底可以保证稳定
     * 防止报错channel closed
    */
    const safety = setTimeout(() => { 
      try { translateCurrentPage(translateLang) // 兜底：直接调用翻译函数

      } catch (e) {
        console.error("❌ 翻译失败:", e)
      } }, 600);
    chrome.runtime.sendMessage({ type: "TRANSLATE_PAGE", translateLang }, () => { clearTimeout(safety) });//发送翻译请求给 Content Script
  } else { // 如果当前已翻译，则恢复原文
    // const dismiss = showNotification("正在恢复原文…", "loading")
    const dismiss = showNotification(t("floatBtnNotificationRestoringOriginal"), "loading")
    loadingNotifyDismissRef.current = dismiss;
    setIsTranslated(false);
    const restoreSafety = setTimeout(() => { // 兜底恢复
      try { loadingNotifyDismissRef.current?.(); } catch {}
      loadingNotifyDismissRef.current = null;
      setIsTranslating(false);
    }, 500);
    try { window.postMessage({ source: "clip", type: "clip:translate-restore" }, "*") } catch {} // 通知页面恢复
    chrome.runtime.sendMessage({ type: "TRANSLATE_RESTORE" }, () => { try { clearTimeout(restoreSafety) } catch {} }) // 通知后台恢复
  }
}

  const [isTranslated, setIsTranslated] = useState(false);//是否已翻译

  //监听页面线程和扩展后台的消息，更新按钮状态和loading通知
  useEffect(() => {
    const handler = (msg: any) => {
      if (msg?.type === "CLIP_TRANSLATE_FIRST") {//翻译完成事件（首屏）
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
        try { loadingNotifyDismissRef.current?.() } catch {}
        loadingNotifyDismissRef.current = null
        setIsTranslating(false)
        setIsTranslated(false)
      }
    }
    chrome.runtime.onMessage.addListener(handler); // 监听后台消息
    const pageHandler = (e: MessageEvent) => {
      const d = e?.data as any;//e.data是postMessage传入的对象
      if (!d || d.source !== "clip") return
      if (d.type === "clip:translate-first") { // 页面首屏翻译完成
        try { loadingNotifyDismissRef.current?.() } catch {}
        loadingNotifyDismissRef.current = null
        setIsTranslating(false)
        setIsTranslated(true)
      }
      if (d.type === "clip:translate-restore-ack") { // 页面恢复确认
        try { loadingNotifyDismissRef.current?.() } catch {}
        loadingNotifyDismissRef.current = null
        setIsTranslating(false)
        setIsTranslated(false)
      }
      if (d.type === "clip:translate-restored") { // 页面恢复完成
        setIsTranslated(false)
      }
    }
    window.addEventListener("message", pageHandler) // 监听窗口消息
    return () => {
      chrome.runtime.onMessage.removeListener(handler)
      window.removeEventListener("message", pageHandler)
    }
  }, [])

  // 监听 URL 变化，自动恢复原文
  useEffect(() => {
    const lastHrefRef = { current: window.location.href }
    const notifyUrlChange = () => { // URL 变化处理函数
      const href = window.location.href
      if (href !== lastHrefRef.current) {
        lastHrefRef.current = href
        if (isTranslated && !isTranslating) { // 如果已翻译且不在翻译中
          // const dismiss = showNotification("正在恢复原文…", "loading")
          const dismiss = showNotification(t("floatBtnNotificationRestoringOriginal"), "loading")
          loadingNotifyDismissRef.current = dismiss
          setIsTranslated(false) // 重置状态
          const restoreSafety = setTimeout(() => { // 兜底清理
            try { loadingNotifyDismissRef.current?.() } catch {}
            loadingNotifyDismissRef.current = null
            setIsTranslating(false)
          }, 500)
          try { window.postMessage({ source: "clip", type: "clip:translate-restore" }, "*") } catch {} // 触发恢复
          try { chrome.runtime.sendMessage({ type: "TRANSLATE_RESTORE" }, () => { try { clearTimeout(restoreSafety) } catch {} }) } catch {} // 触发后台恢复
        }
      }
    }
    // Monkey Patch history API 以检测 pushState/replaceState (SPA路由跳转)
    const origPush = history.pushState
    const origReplace = history.replaceState
    try {
      history.pushState = function(...args: any[]) { const r = origPush.apply(history, args as any); notifyUrlChange(); return r }
      history.replaceState = function(...args: any[]) { const r = origReplace.apply(history, args as any); notifyUrlChange(); return r }
    } catch {}
    window.addEventListener('popstate', notifyUrlChange) // 监听浏览器后退/前进
    window.addEventListener('hashchange', notifyUrlChange) // 监听 hash 变化
    const tick = () => { notifyUrlChange(); setTimeout(tick, 1000) } // 轮询兜底（防止某些框架绕过 history API）
    setTimeout(tick, 1000)
    return () => { // 还原 Patch 和移除监听
      try { history.pushState = origPush } catch {}
      try { history.replaceState = origReplace } catch {}
      window.removeEventListener('popstate', notifyUrlChange)
      window.removeEventListener('hashchange', notifyUrlChange)
    }
  }, [isTranslated, isTranslating])


  const handleAI = () => { // 点击 AI 对话按钮
    if (Date.now() - lastDragTimeRef.current < 150) return // 防误触
    try {
      window.postMessage({ source: "clip", type: "clip:show-float-chat" }, "*") // 通知页面打开 AI 对话框
      const sel = window.getSelection()?.toString().trim() || "" // 获取选中文本
      try {
        window.dispatchEvent(new CustomEvent('clip-send-to-chat', { detail: { text: sel } })) // 发送选中文本到聊天
      } catch (e) {
        console.log(e);
        // alert("悬浮窗打开失败");
        alert(t("floatBtnFloatingWindowOpenFailed"))
      }

    } catch (e) {
      console.log("悬浮窗打开请求发送失败：", e);
    }
    if (!checkContext()) return
    try {
      chrome.runtime.sendMessage({ type: "clip:show-float" }, () => {}) // 备用：通知后台
    } catch (e) {
      console.log(e);
      //alert("悬浮窗打开失败");
      alert(t("floatBtnFloatingWindowOpenFailed"))
    }
  }

  // 处理保存类型切换选择
  const handlePickSaveType = (payload: { tag: "allPageSave" | "allPageAISave" | "selectSave" | "selectAISave" }) => {
    setSaveTypeTip(payload.tag) // 更新提示
    // 更新当前动作引用
    chosenSaveActionRef.current =
      payload.tag === "allPageSave" ? handleSave :
        payload.tag === "allPageAISave" ? handleAISaveFull :
          payload.tag === "selectSave" ? handleDirectSaveSelection :
            payload.tag === "selectAISave" ? handleAISaveSelection :
              handleSave
    const storage = new Storage()
    storage.set('clipSaveMode', payload.tag) // 持久化选择
  }

  // 点击书签/保存按钮
  const handleSaveClick = async () => {
    expandStartRef.current = Date.now() // 记录点击时间
    const fn = chosenSaveActionRef.current
    if (fn) {
      await Promise.resolve(fn()) // 执行当前选中的保存动作
    } else {
      await handleSave() // 默认动作
    }
  }
  //整页保存(AI)
  const handleAISaveFull = async () => {
    if (!checkContext()) {
      //showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
      showNotification(t("floatBtnNotificationExtensionReloaded"), "warning")
      return
    }
    const key = await getOpenAIKeySafely() // 获取 API Key
    if (!key) {
      // showNotification("⚠️ 请先在设置中配置 API Key", "warning")
      showNotification(t("floatBtnNotificationNoApiKey"), "warning")
      return
    }
    setLoading(true)
    setLoadingType("full")
    requestTypeRef.current = "full"
    // loadingNotifyDismissRef.current = showNotification("AI处理中…", "loading")
    loadingNotifyDismissRef.current = showNotification(t("floatBtnNotificationAIProcessing"), "loading")
    try {
      const content = await extractContent() // 提取整页内容
      extractedContentRef.current = content
      port.send({ // 发送 AI 请求
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
      // showNotification("❌ 剪藏失败", "error")
      showNotification(t("floatBtnNotificationClipFailed"), "error")
    }
  }
  // 剪藏选中内容（AI摘要）
  const handleAISaveSelection = async () => {
    const liveText = window.getSelection()?.toString().trim()
    const selectedText = (selectedTextRef.current || liveText || "").trim()
    if (!selectedText || selectedText.length < 10) {
      //showNotification("⚠️ 请先选中一些文字（至少10个字符）", "warning")
      showNotification(t("floatBtnNotificationSelectText"), "warning")
      return
    }
    if (!checkContext()) {
      // showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
      showNotification(t("floatBtnNotificationExtensionReloaded"), "warning")
      return
    }
    const key = await getOpenAIKeySafely()
    if (!key) {
      // showNotification("⚠️ 请先在设置中配置 API Key", "warning")
      showNotification(t("floatBtnNotificationNoApiKey"), "warning")
      return
    }
    setLoading(true)
    setLoadingType("selection")
    requestTypeRef.current = "selection"
    // loadingNotifyDismissRef.current = showNotification("AI处理中…", "loading")
    loadingNotifyDismissRef.current = showNotification(t("floatBtnNotificationAIProcessing"), "loading")
    try {
      const selectedContent = extractSelectedContent() // 提取选中内容
      extractedContentRef.current = {
        title: document.title,
        text: selectedText,
        html: selectedText,
        snippet: selectedText.slice(0, 500),
        url: window.location.href,
        metadata: {},
        images: selectedContent?.images || []
      }
      port.send({ // 发送 AI 请求
        prompt: "请用中文对以下内容进行简洁总结。",
        model: "qwen3-max",
        context: { metadata: { title: document.title }, text: selectedText, openAIKey: key }
      })
    } catch (e) {
      console.error("❌ Clip error:", e)
      setLoading(false)
      setLoadingType(null)
      //showNotification("❌ 剪藏失败", "error")
      showNotification(t("floatBtnNotificationClipFailed"), "error")
    }
  }

  // 直接保存选中内容（不使用AI）
  const handleDirectSaveSelection = async () => {
    const liveText = window.getSelection()?.toString().trim()
    const selectedText = (selectedTextRef.current || liveText || "").trim()
    if (!selectedText || selectedText.length < 10) {
      // showNotification("⚠️ 请先选中一些文字（至少10个字符）", "warning")
      showNotification(t("floatBtnNotificationSelectText"), "warning")
      return
    }
    if (!checkContext()) {
      // showNotification("⚠️ 扩展已重载，请刷新页面", "warning")
      showNotification(t("floatBtnNotificationExtensionReloaded"), "warning")
      return
    }
    setLoading(true)
    setLoadingType("direct-selection")
    try {
      const selectedContent = extractSelectedContent() // 提取选中内容
      const images = selectedContent?.images || []
      await ClipStore.add({ // 保存到 Store
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
      
      // 通知其他页面刷新
      chrome.runtime.sendMessage({ action: 'clips-updated' }).catch(() => {})
      
      setLoading(false)
      setLoadingType(null)
      const imgCount = images.length
      // showNotification(`✅ 已直接保存选中内容！${imgCount > 0 ? `（含${imgCount}张图片）` : ""}`, "success")
      const imgCountInfo = t("floatBtnNotificationPictureContaining") + imgCount + t("floatBtnNotificationPictureCount")
      showNotification(t("floatBtnNotificationSelectionSaveSuccess") + (imgCount > 0 ? imgCountInfo : ""), "success")
    } catch (e) {
      console.error("❌ Direct save error:", e)
      setLoading(false)
      setLoadingType(null)
      // showNotification("❌ 保存失败", "error")
      showNotification(t("floatBtnNotificationSaveFailed"), "error")
    }
  }

  // 切换目标语言
  const handleLanguage = () => {
    setLanguageLang(translateLang) // 交换显示
    const next = translateLang === 'en-US' ? 'zh-CN' : 'en-US'
    setTranslateLang(next) // 设置新目标语言
  }

  if (!isEnabled || hiddenByPanel) return null; // 如果禁用或被隐藏，不渲染

  // 打开小设置面板
  const handleOpenSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSettingsOpen((v) => !v);
  };

  // 隐藏一次（刷新后恢复）
  const handleHideOnce = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEnabled(false);
  };

  // 在此网站禁用
  const handleDisableSite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const storage = new Storage();
    await storage.set(`clipDisableSite:${window.location.host}`, true);
    setIsEnabled(false);
  };

  // 全局禁用
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

  // 定义图标组件
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
      onMouseEnter={handleMouseEnter} // 鼠标移入展开
      onMouseLeave={handleMouseLeave} // 鼠标移出收起
    >
      <TooltipProvider delayDuration={0}>
        <div className={cn(
          "absolute inset-0 w-full h-full pointer-events-none opacity-0 transition-opacity duration-300 ease-out",
          isMenuOpen && "pointer-events-auto opacity-100 cursor-pointer" // 菜单打开时显示
        )}>
          <div className="relative w-full h-full">
            {/* Bookmark Item (expand like translate) */}
            <div
              className="absolute top-1/2 left-1/2 origin-center transition-all duration-300 ease-out delay-75"
              style={{
                transform: getTransform('bookmark'), // 应用位置变换
                width: 40, height: 40
              }}
            >
              {/* 此处有修改（单位由默认的 rem 换算成了 px）： hover:px-[8px] */}
              <div className={cn(
                "absolute right-0 top-0 w-[40px] h-[40px] rounded-[20px] shadow-md flex items-center justify-center overflow-hidden px-0 transition-[width,box-shadow,padding] duration-300 z-20 hover:w-[90px] hover:justify-between hover:shadow-lg hover:px-[8px] group",
                isDark ? "bg-neutral-900 text-white" : "bg-white text-gray-900",
                isSaveTypeOpen && "w-[90px] justify-between shadow-lg px-[8px]" // 面板打开时保持展开
              )}>
                <TooltipWrapper
                  side="top"
                  offset={12}
                  content={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {/* 切换剪藏方式 */}
                      <p>{t("floatBtnBookmarkToggleTooltip")}</p>
                    </div>
                  }
                >
                  <div className={cn(
                    "w-[40px] h-[40px] items-center justify-center cursor-pointer flex-shrink-0 hover:scale-110 active:scale-90 transition-transform",
                    isDark ? "text-white" : "text-gray-900",
                    isSaveTypeOpen ? "flex" : "hidden group-hover:flex" // 控制显示
                  )}
                    onMouseEnter={() => { handleMouseEnter(); captureSelection(); handleOpenSaveTypeChange() }} // 悬停打开类型选择
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
                      {/** 整页剪藏  AI 整页剪藏  选中剪藏  AI 选中剪藏 */}
                      <span>{({ 
                        allPageSave: t("floatBtnSaveTypeAllPage"),
                        allPageAISave: t("floatBtnSaveTypeAllPageAI"),
                        selectSave: t("floatBtnSaveTypeSelect"),
                        selectAISave: t("floatBtnSaveTypeSelectAI")
                      } as Record<string, string>)[saveTypeTip] || t("floatBtnSaveTypeFull")}</span>
                    </div>
                  }
                >
                  <div className={cn("w-[40px] h-[40px] flex items-center justify-center cursor-pointer flex-shrink-0 hover:scale-110 active:scale-90 transition-transform", isDark ? "text-white" : "text-gray-900")} onMouseEnter={() => { expandStartRef.current = Date.now(); captureSelection() }} 
                    onClick={handleSaveClick} // 执行保存
                  >
                    {bookMarkIcon}
                  </div>
                </TooltipWrapper>


              </div>
            </div>

            {isSaveTypeOpen && (
              <div
                className="absolute z-[2147483647]"
                style={{ top: "50%", transform: "translateY(-50%)", right: "calc(100% + 70px)" }} // 定位到左侧
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
                transform: getTransform('translate'), // 应用位置变换
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
                      {/** 翻译为： */}
                      <span style={{ fontWeight: 600 }}>{t("floatBtnTranslateLanguageTooltip")}</span>
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
                      {/** <span>{isTranslated ? '显示原文' : '翻译为：'}</span> */}
                      <span>{isTranslated ? t("floatBtnShowOriginalTextTooltip") : t("floatBtnTranslateLanguageTooltip")}</span>
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
              style={{ transform: getTransform('ai') }} // 应用位置变换
            >
              {/** AI 对话 */}
              <MenuButton icon={aiIcon} onClick={handleAI} tooltip={t("floatBtnAIChatTooltip")} isDark={isDark} />
            </div>
          </div>
        </div>
      </TooltipProvider>

      {/* 主图标 */}
      <div
        className={cn("relative w-[40px] h-[40px] rounded-full shadow-md cursor-pointer hover:shadow-xl transition-shadow group",
          isDark ? "bg-neutral-900 text-white" : "bg-white text-gray-900")}
        onMouseDown={handleMouseDown} // 绑定拖拽
        onClick={handleMain} // 绑定点击
      >
        <AiOutlineRobot color='currentColor' size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20px] h-[20px] transition-transform duration-300 ease-in-out group-hover:scale-105 group-active:scale-90" />
        {/* 此处有修改（单位由默认的 rem 换算成了 px）：-right-[10px] -top-[10px] w-[16px] h-[16px] */}
        <div
          className={cn(
            "absolute -right-[10px] -top-[10px] w-[16px] h-[16px] rounded-full shadow flex items-center justify-center font-bold cursor-pointer transition-transform scale-0 text-[10px]",
            isDark ? "bg-neutral-900 text-gray-200 hover:bg-gray-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300",
            isMenuOpen && "scale-100" // 菜单打开时显示设置按钮
          )}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleOpenSettings} // 打开设置
        >
          -
        </div>
        {/* 下面几行有修改（单位由默认的 rem 换算成了 px）：gap-[4px] px-[8px] py-[4px] w-[12px] h-[12px]*/}
        {loading && ( // 显示 loading 状态条
          <div className="absolute left-[48px] top-1/2 -translate-y-1/2 flex items-center gap-[4px] rounded-md bg-black/80 text-white px-[8px] py-[4px] text-[11px] shadow animate-fade-in">
            <div className="w-[12px] h-[12px] rounded-full border-2 border-white/60 border-t-transparent animate-spin"></div>
            {/** <span>{loadingType === "full" || loadingType === "selection" ? "AI处理中…" : "保存中…"}</span> */}
            <span>{loadingType === "full" || loadingType === "selection" ? t("floatBtnLoadingAIProcessing") : t("floatBtnLoadingSaving")}</span>
          </div>
        )}
      </div>

      {/* 打开设置面板 */}
      {isSettingsOpen && (
        <div
          className="absolute top-[24px] right-[20px] w-[180px] bg-gray-800 text-gray-200 rounded-[10px] shadow-xl py-[6px] z-[2147483647] text-[13px] leading-snug"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 下面有修改（单位由默认的 rem 换算成了 px）：px-3 py-4 => px-[12px] py-[8px] */}
          {/** 隐藏直到下次访问 */}
          <div className="px-[12px] py-[8px] cursor-pointer hover:bg-white/5 transition-colors" onClick={handleHideOnce}>{t("floatBtnSettingsHideOnce")}</div>
          {/** 在此网站禁用 */}
          <div className="px-[12px] py-[8px] cursor-pointer hover:bg-white/5 transition-colors" onClick={handleDisableSite}>{t("floatBtnSettingsDisableSite")}</div>
          {/** 全局禁用 */}
          <div className="px-[12px] py-[8px] cursor-pointer hover:bg-white/5 transition-colors" onClick={handleDisableGlobal}>{t("floatBtnSettingsDisableGlobal")}</div>
          <div className="h-px bg-white/10 my-[6px] mx-[12px]"></div>
          {/** 您可以在此处重新启用 设置 */}
          <div className="px-[12px] py-[6px] text-gray-400 text-[12px]">{t("floatBtnSettingsReenableTip")}</div>
        </div>
      )}


    </div>
  );
};



export default floatButton;
