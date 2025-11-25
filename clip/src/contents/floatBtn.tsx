import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Storage } from '@plasmohq/storage';
import cssText from 'data-text:./floatBtn.css';
import { AiOutlineRobot } from "react-icons/ai";
import { MdGTranslate } from "react-icons/md";
import { CiBookmark } from "react-icons/ci";
import { AiFillAliwangwang } from "react-icons/ai";

//在所有网页中运行
export const config = {
  matches: ["<all_urls>"] 
}

// 菜单按钮组件
const MenuButton = ({ icon, onClick }: { icon: React.ReactNode; onClick: () => void }) => (
  <button 
    className="clipMenuButton"
    onClick={onClick}
  >
    {icon}
  </button>
);

// 吸附常量
const BUTTON_SIZE = 48;
const RIGHT_MARGIN = 40;

const INITIAL_POSITION = { x: window.innerWidth - 80, y: 200 };

const floatButton = () => {
  const [position, setPosition] = useState(INITIAL_POSITION);//按钮位置
  const [isDragging, setIsDragging] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);//悬浮按钮是否被禁用
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);//设置界面开关
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);//菜单隐藏时间
  const offsetRef = useRef({ x: 0, y: 0 });//计算当前位置
  const containerRef = useRef<HTMLDivElement>(null);//获取div元素

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

  // --- 自动吸附 ---
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      // 自动吸附回右侧
      const rightLimit = window.innerWidth - BUTTON_SIZE - RIGHT_MARGIN;

      setPosition((p) => ({
        x: rightLimit,
        y: p.y
      }));
    }

    setIsDragging(false);
  }, [isDragging]);

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

  const handleSave = () => console.log("执行剪藏/保存操作");
  const handleTranslate = () => console.log("执行翻译操作");
  const handleAI = () => console.log("执行ai对话操作");

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

  const bookMarkIcon = <CiBookmark color='#000000' size={25}/>;
  const translateIcon = <MdGTranslate color='#000000' size={25}/>;
  const aiIcon = <AiFillAliwangwang color='#000000' size={25}/>;

  return (
    <div 
      ref={containerRef}
      className={`clipContainer ${isDragging ? 'isDragging' : ''}`}
      style={{ 
        left: position.x,
        top: position.y,
        // ⭐ 拖拽无动画，吸附有动画
        transition: isDragging ? "none" : "left 0.2s ease-out",
      }}
      onMouseEnter={ handleMouseEnter }
      onMouseLeave={ handleMouseLeave }
    >

      <div className={`clipMenuWrapper ${isMenuOpen ? 'isOpen' : ''} ${changeMenuPositionClass()}`}> 
        <div className="clipMenu">
          <div className="clipMenuItem menuItemBookmark"> 
            <MenuButton icon={bookMarkIcon} onClick={handleSave} />
          </div>
          <div className="clipMenuItem menuItemTranslate">
            <MenuButton icon={translateIcon} onClick={handleTranslate} />
          </div>
          <div className="clipMenuItem menuItemAiIcon">
            <MenuButton icon={aiIcon} onClick={handleSave} />
          </div>
        </div>
      </div>

      {/* 主图标 */}
      <div 
        className="clipMainIconWrapper" 
        onMouseDown={handleMouseDown}
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

