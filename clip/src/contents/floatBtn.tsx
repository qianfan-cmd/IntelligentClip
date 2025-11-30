import React, { useState, useRef, useCallback, useEffect, type CSSProperties } from 'react';
import { Storage } from '@plasmohq/storage';
import cssText from 'data-text:./floatBtn.css';
import { AiOutlineRobot } from "react-icons/ai";
import { MdGTranslate } from "react-icons/md";
import { CiBookmark } from "react-icons/ci";
import { AiFillAliwangwang } from "react-icons/ai";
import { FaExchangeAlt } from "react-icons/fa";//语言切换图标
import { TooltipProvider } from "@/components/ui/tooltip"
import { TooltipWrapper } from "@/components/ui/tooltip-wrapper"
import type { PlasmoCSConfig, PlasmoGetShadowHostId } from "plasmo"
import { ClipStore } from "@/lib/clip-store"
import { extractContent, extractSelectedContent } from "@/core/index"
import type { ExtractedContent } from "@/core/types"
import { Provider, useAtomValue } from "jotai"
import { openAIKeyAtom } from "@/lib/atoms/openai"
import { usePort } from "@plasmohq/messaging/hook"

//在所有网页中运行
export const config = {
  matches: ["<all_urls>"] 
}


// 吸附常量
const BUTTON_SIZE: number = 40;
const RIGHT_MARGIN: number = (document.documentElement.clientWidth - BUTTON_SIZE - 40 + 7.5)// * window.devicePixelRatio;//固定右侧间隔,适配缩放
const TOP_MARGIN: number = 20;
const BOTTOM_MARGIN: number = 20;
const INITIAL_POSITION = { x: RIGHT_MARGIN, y: 200 };

const floatButton = () => {
  const [position, setPosition] = useState(INITIAL_POSITION);//按钮位置
  const [isDragging, setIsDragging] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);//悬浮按钮是否被禁用
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);//设置界面开关
  const [translateLang, setTranslateLang] = useState<string>('en-US');
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);//菜单隐藏时间
  const offsetRef = useRef({ x: 0, y: 0 });//计算当前位置
  const containerRef = useRef<HTMLDivElement>(null);//获取div元素
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingType, setLoadingType] = useState<"full" | "selection" | "direct-full" | "direct-selection" | null>(null)
  const openAIKey = useAtomValue(openAIKeyAtom)
  const port = usePort("page-completion")
  const extractedContentRef = useRef<ExtractedContent | null>(null)
  const requestTypeRef = useRef<"full" | "selection" | null>(null)
  const Z_INDEX = 2147483640

    // 检查扩展上下文
  const checkContext = (): boolean => {
    try {
      return !!chrome.runtime?.id
    } catch {
      return false
    }
  }

  // 菜单按钮组件
const MenuButton = ({ icon, onClick, tooltip }: { icon: React.ReactNode; onClick: () => void; tooltip: string|React.ReactNode }) => (
  <TooltipWrapper side="left" text={typeof tooltip === 'string' ? tooltip as string : undefined} content={typeof tooltip !== 'string' ? tooltip as React.ReactNode : undefined}>
    <button
      className="clipMenuButton"
      onClick={onClick}
    >
      {icon}
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
  } as CSSProperties)
  
  document.body.appendChild(notification)
  setTimeout(() => {
    notification.style.opacity = "0"
    notification.style.transition = "opacity 0.3s"
    setTimeout(() => notification.remove(), 300)
  }, type === "error" ? 5000 : 3000)
}

  // --- 拖拽开始 ---
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDragging(true);

    offsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position.x, position.y]);

  // --- 拖拽移动 ---
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    let newX = e.clientX - offsetRef.current.x;
    let newY = e.clientY - offsetRef.current.y;

    const iconWidth = containerRef.current?.offsetWidth || 0;
    const iconHeight = containerRef.current?.offsetHeight || 0;

    // 限制在屏幕中
    newX = Math.max(0, Math.min(newX, window.innerWidth - iconWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - iconHeight));

    setPosition({ x: newX, y: newY });
  }, [isDragging]);

 //动态计算右侧吸附位置
function getRightMargin() {
  const dpr = window.devicePixelRatio;

  const buttonSize = BUTTON_SIZE;

  // 视觉间隔
  const visualMargin = 20;

 //滚动条宽度
  const scropWidth = window.innerWidth - document.documentElement.clientWidth

  // CSS 像素无需 × DPR，它本来就按视觉像素工作
  return window.innerWidth - scropWidth - buttonSize - visualMargin - dpr * 7.5;
}

  //自动吸附
  const handleMouseUp = useCallback((position: { x: number; y: number }) => {
    if (isDragging) {
      // 自动吸附回右侧
      //对顶部和做一个限制，防止按钮移动到网页外面被遮挡
      let topLimit: number;
      if (position.y <= 0) {
         topLimit = TOP_MARGIN;
      } else if (position.y > document.documentElement.clientHeight - BUTTON_SIZE / 2) {
        topLimit = document.documentElement.clientHeight - BUTTON_SIZE - BOTTOM_MARGIN;
      } else {
         topLimit = position.y;
      }
      
      console.log(position.y);
      setPosition(() => ({
        x: getRightMargin(),
        y: topLimit
      }));
    }

    setIsDragging(false);
  }, [isDragging]);

  let lastRatio = window.devicePixelRatio;//缩放比例

  // 监听窗口缩放事件，重新计算吸附位置
window.addEventListener("resize", () => {
  if (window.devicePixelRatio !== lastRatio) {
    lastRatio = window.devicePixelRatio;

    // 重新吸附右侧，保证不偏移
    handleMouseUp(position);
  }
});

//当按钮在角落时，改变菜单的显示方向
const changeMenuPositionClass: () => string | null = () => {
  if (!containerRef.current) return '';
  const rect = containerRef.current.getBoundingClientRect();
  const topThreshold = 50; // 判断为最顶端
  const bottomThreshold = 50; // 判断为最底端

  if (rect.top <= topThreshold) return 'menuTopEdge';      // 菜单显示在左下方
  if (rect.top >= window.innerHeight - BUTTON_SIZE - bottomThreshold) return 'menuBottomEdge'; // 菜单显示在左上方
  return ''; // 默认位置
};


//菜单延迟关闭
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
  },200);//延迟2s收回菜单
}

  // 监听全局拖拽
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  //处理按钮禁用方式
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

    // 监听 LLM 响应
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
          images: content?.images  // 保存提取的图片
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

  //直接保存整页
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
        summary: "",  // 无AI摘要
        keyPoints: [],
        tags: [],
        meta: content?.metadata,
        images: content?.images  // 保存提取的图片
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

  //打开设置菜单
  const handleOpenSettings = (e: React.MouseEvent) => { 
    e.stopPropagation(); 
    setIsSettingsOpen((v) => !v);//再点击设置按钮关闭
   };

  //隐藏直到下次访问 
 const handleHideOnce = (e: React.MouseEvent) => { 
  e.stopPropagation(); 
  setIsEnabled(false); 
}; 

 //在当前网站禁用
 const handleDisableSite = async (e: React.MouseEvent) => { 
  e.stopPropagation(); 
  const storage = new Storage(); 
  await storage.set(`clipDisableSite:${window.location.host}`, true); 
  setIsEnabled(false); };

  //全局禁用
  const handleDisableGlobal = async (e: React.MouseEvent) => { 
    e.stopPropagation(); 
    const storage = new Storage(); 
    await storage.set('clipDisableGlobal', true); 
    setIsEnabled(false); 
  };

  const bookMarkIcon = <CiBookmark color='#000000' size={25} className='clipMenuIcon'/>;
  const translateIcon = <MdGTranslate color='#000000' size={25} className='clipMenuIcon'/>;
  const languageIcon = <FaExchangeAlt color='#000000' size={25} className='clipMenuIcon'/>;
  const aiIcon = <AiFillAliwangwang color='#000000' size={25} className='clipMenuIcon'/>;
 

  return (
    <div 
      ref={containerRef}
      className={`clipContainer ${isDragging ? 'isDragging' : ''}`}
      style={{ 
        left: position.x,
        top: position.y,
        // 拖拽无动画，吸附有动画
        transition: isDragging ? "none" : "left 0.2s ease-out",
      }}
      onMouseEnter={ handleMouseEnter }
      onMouseLeave={ handleMouseLeave }
    >

      <TooltipProvider delayDuration={0}>
        <div className={`clipMenuWrapper ${isMenuOpen ? 'isOpen' : ''} ${changeMenuPositionClass()}`}>
          <div className="clipMenu">
          <div className="clipMenuItem menuItemBookmark">
            <MenuButton icon={bookMarkIcon} onClick={handleSave} tooltip='一键保存'/>
          </div>
          <div className="clipMenuItem menuItemTranslate">
            <div className="translate-expand-container">
               <div className="translate-sub-btn" onClick={handleLanguage}>
                 {languageIcon}
               </div>
               
               <TooltipWrapper
                 offset={8}
                 content={
                   <div style={{ display: 'flex', alignItems: 'center' }}>
                     <span style={{ fontWeight: 600 }}>翻译为：</span>
                     <span style={{ marginLeft: 4 }}>{translateLang}</span>
                   </div>
                 }
               >
                 <div className="translate-main-btn" onClick={handleTranslate}>
                   {translateIcon}
                 </div>
               </TooltipWrapper>
            </div>
          </div>
          <div className="clipMenuItem menuItemAiIcon">
            <MenuButton icon={aiIcon} onClick={handleAI} tooltip='ai对话'/>
          </div>
        </div>
        </div>
      </TooltipProvider>

      {/* 主图标 */}
      <div
        className="clipMainIconWrapper"
        onMouseDown={handleMouseDown}
        onClick={handleMain}
      >
        <AiOutlineRobot color='black' size={25} className='clipMainIcon'/>
        <div className={`clipSettingsButton ${isMenuOpen ? 'isOpen' : ''}`} onMouseDown={(e) => e.stopPropagation()} onClick={handleOpenSettings}>-</div>
      </div>

      {isSettingsOpen && (
        <div className="clipSettingsPopover" onMouseDown={(e) => e.stopPropagation()}>
          <div className="clipSettingsItem" onClick={handleHideOnce}>隐藏直到下次访问</div>
          <div className="clipSettingsItem" onClick={handleDisableSite}>在此网站禁用</div>
          <div className="clipSettingsItem" onClick={handleDisableGlobal}>全局禁用</div>
          <div className="clipSettingsDivider"></div>
          <div className="clipSettingsHint">您可以在此处重新启用 设置</div>
        </div>
      )}

    </div>
  );
};

export const getStyle = () => {
  const style = document.createElement('style');
  style.textContent = cssText;
  return style;
};

export default floatButton;

