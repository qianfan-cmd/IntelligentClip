import React, { useEffect, useState } from "react"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "./components"
import { AiFillAliwangwang } from "react-icons/ai"
import { FiRefreshCcw } from "react-icons/fi"
import { RxCross2 } from "react-icons/rx"
import "./style.css"

function Popup() {
  const [data, setData] = useState("")
  const openHomepage = async () => {
    const url = chrome.runtime.getURL("tabs/history.html")
    await chrome.tabs.create({ url })
  }

  // 刷新当前 Popup 页面
  const handleRefresh = () => {
    window.location.reload()
  }

  // 关闭当前 Popup
  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault()
    window.close()
  }

  // 显示浏览器中的浮窗：给当前标签页的内容脚本发送显示指令
  const showFloat = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab.id) {
      await chrome.tabs.sendMessage(tab.id, { type: "clip:show-float" })
    }
  }

  // 切换浏览器中的浮窗显示状态
  const toggleFloat = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab.id) {
      await chrome.tabs.sendMessage(tab.id, { type: "clip:toggle-float" })
    }
  }

  // 启动时检查登录状态：已登录则切换浮窗显示状态并关闭 Popup
  useEffect(() => {
    chrome.storage.local.get(["clip_logged_in"]).then(async (res) => {
      if (res.clip_logged_in) {
        await toggleFloat()
        window.close()
      }
    })
  }, [])

  // 登录：写入登录状态，显示浮窗，跳转主页并关闭 Popup
  const handleSignIn = async () => {
    await chrome.storage.local.set({ clip_logged_in: true })
    await showFloat()
    const url = chrome.runtime.getURL("tabs/history.html")
    await chrome.tabs.create({ url })
    window.close()
  }

  return (
    <div className="w-[360px] h-[500px] flex flex-col bg-[#ffff] bg-gradient-to-b from-blue-100 from-0% to-violet-100 to-50% border-0">
      <div className="w-full h-[50px] flex items-center justify-between px-4">
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 rounded-full hover:bg-gray-200 leading-none p-0 transition-transform duration-200 hover:scale-110 hover:brightness-105 hover:shadow-md active:scale-95"
          onClick={openHomepage}
          aria-label="打开扩展主页"
        >
          <AiFillAliwangwang className="w-5 h-5 text-black" />
        </Button>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 rounded-full hover:bg-gray-200 leading-none p-0 transition-transform duration-200 hover:scale-110 hover:brightness-105 hover:shadow-md active:scale-95"
            onClick={handleRefresh}
            aria-label="刷新"
          >
            <FiRefreshCcw className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 rounded-full hover:bg-gray-200 leading-none p-0 transition-transform duration-200 hover:scale-110 hover:brightness-105 hover:shadow-md active:scale-95"
            onClick={handleClose}
            aria-label="关闭"
          >
            <RxCross2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="w-full h-[300px] flex-1 p-4 flex flex-col text-center items-center justify-center overflow-auto">
        <p className="text-gray-900 text-lg font-medium leading-relaxed tracking-wide text-pretty antialiased drop-shadow-sm first-letter:text-blue-600 first-letter:font-semibold first-letter:text-2xl">Chrome剪藏是一个基于Chrome浏览器的插件，用于剪藏网页上的内容。</p>
        <p className="mt-2 text-gray-600 text-sm leading-relaxed antialiased">剪藏的内容可以在插件的侧边栏中查看和管理。</p>
      </div>

      <div className="w-full h-[50px] flex items-center justify-center -mt-3 px-4">
        <Button size="default" className="bg-black text-white text-lg transition-transform duration-200 hover:scale-110 hover:brightness-105 hover:shadow-md active:scale-95" onClick={handleSignIn}>Sign in</Button>
      </div>
    </div>
  )
}


export default Popup
