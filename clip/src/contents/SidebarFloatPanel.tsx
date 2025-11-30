import React, { useEffect, useState } from "react"
import { Button } from "~components"
import { FiRefreshCcw, FiGrid, FiSettings } from "react-icons/fi"
import { RxCross2 } from "react-icons/rx"
import { AiFillAliwangwang } from "react-icons/ai"
import { RiMessage2Line, RiMagicLine } from "react-icons/ri"
import { TbSquareRoundedX } from "react-icons/tb"
import { VscFileCode } from "react-icons/vsc"
import "../style.css"

export const config = {
  matches: ["<all_urls>"]
}

function FloatClip() {
  const [visible, setVisible] = useState(true)
  const [title, setTitle] = useState("Chaos")
  
  const openHomepage = () => {
    const url = chrome.runtime.getURL("sidepanel.html")
    window.open(url, "_blank", "noopener,noreferrer")
  }

  useEffect(() => {
    const handler = (msg: any) => {
      if (msg?.type === "clip:show-float") setVisible(true)
      if (msg?.type === "clip:hide-float") setVisible(false)
      if (msg?.type === "clip:toggle-float") setVisible((v) => !v)
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  if (!visible) return null

  return (
    <div
      className="SidebarFloatPanel"
      style={{
        position: "fixed",
        top: 0,
        right: 0, // 调整右侧位置，避免超出屏幕
        height: "100vh",
        width: "26rem", // 适当缩减宽度，确保完全显示
        zIndex: 2147483647,
        backgroundColor: "#ffffff",
        borderLeft: "1px solid #e5e7eb",
        boxShadow: "-4px 0 12px rgba(0, 0, 0, 0.05)",
        display: "flex",
        flexDirection: "column",
        borderRadius: 16,
        overflow: "hidden"
      }}>
      <div
        className="SidebarFloatPanel-header"
        style={{
          width: "100%",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 12,
          paddingLeft: 24,
          paddingRight: 24, 
          borderBottom: "1px solid #f1f1f1",
          backgroundColor: "#fafafa"
        }}
      >
        <div
          className="SidebarFloatPanel-logoSection"
          style={{ display: "flex", alignItems: "center", gap: 5 }}
        >
          <div className="SidebarFloatPanel-appLogo">
            <AiFillAliwangwang className="w-5 h-5 text-gray-700" />
          </div>
          <div
            className="SidebarFloatPanel-titleContainer"
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="SidebarFloatPanel-panelTitle"
            />
            <button className="SidebarFloatPanel-dropdownBtn">▼</button>
          </div>
        </div>
        <div
          className="SidebarFloatPanel-headerActions"
          style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}
        >
          <Button 
            variant="ghost" 
            size="icon" 
            className="SidebarFloatPanel-headerBtn"
            aria-label="刷新"
          >
            <FiRefreshCcw className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="SidebarFloatPanel-headerBtn SidebarFloatPanel-closeBtn"
            aria-label="关闭" 
            onClick={() => setVisible(false)}
          >
            <RxCross2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div
        className="SidebarFloatPanel-body"
        style={{ 
          flex: 1, 
          padding: "20px 24px", // 统一内边距为24px，右侧不再使用56px
          display: "flex", 
          flexDirection: "column", 
          gap: 24 
        }}
      >
        <div
          className="SidebarFloatPanel-inputGroup"
          style={{ display: "flex", gap: 12, width: "100%" }}
        >
          <input 
            type="text" 
            placeholder="豆包" 
            className="SidebarFloatPanel-mainInput"
          />
          <Button className="SidebarFloatPanel-saveBtn">保存</Button>
        </div>
        
        <div className="SidebarFloatPanel-contentSection">
          <div className="SidebarFloatPanel-sectionTitle">
          </div>
          {/* 可添加更多内容 */}
        </div>
      </div>

      <div
        className="SidebarFloatPanel-footer"
        style={{ 
          width: "100%", 
          height: 56, 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-evenly", 
          gap: 12, 
          padding: "0 24px", // 底部右侧内边距也调整为24px
          borderTop: "1px solid #f1f1f1", 
          backgroundColor: "#fafafa" 
        }}
      >
        <Button variant="ghost" size="icon" className="SidebarFloatPanel-footerBtn" aria-label="功能1">
          <VscFileCode className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="SidebarFloatPanel-footerBtn" aria-label="消息">
          <RiMessage2Line className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="SidebarFloatPanel-footerBtn" aria-label="魔法">
          <RiMagicLine className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="SidebarFloatPanel-footerBtn" aria-label="布局">
          <FiGrid className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="SidebarFloatPanel-footerBtn" aria-label="设置">
          <FiSettings className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="SidebarFloatPanel-footerBtn" aria-label="关闭">
          <TbSquareRoundedX className="w-5 h-5" />
        </Button>
      </div>
    </div>
  )
}

export default FloatClip