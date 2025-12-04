/**
 * [已废弃] 原 YouTube 专属右侧面板
 * 
 * 此组件已被统一浮窗系统（SidebarFloatPanel）中的 YouTubePanel 取代。
 * 保留文件供参考，但不再注入到页面中。
 * 
 * 如需恢复，将 matches 改回 ["https://www.youtube.com/*"]
 * 有问题存在就是这边清空以后，manifest的对应match是空数组，这是不允许的这个需要修复
 */
import Extension from "~/components/extension"
import Providers from "~/components/providers"
import { Provider } from "jotai"
import cssText from "data-text:~style.css"
import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo"

const INJECTED_ELEMENT_ID = "#secondary.style-scope.ytd-watch-flexy"

export const getStyle = () => {
  const baseFontSize = 12
  let updatedCssText = cssText.replaceAll(":root", ":host(plasmo-csui)")
  const remRegex = /([\d.]+)rem/g
  updatedCssText = updatedCssText.replace(remRegex, (match, remValue) => {
    const pixels = parseFloat(remValue) * baseFontSize
    return `${pixels}px`
  })
  const style = document.createElement("style")
  style.textContent = updatedCssText
  return style
}

// [禁用] 不再匹配页面，功能已整合到统一浮窗
export const config: PlasmoCSConfig = {
 matches: ["*://never-trigger-this-clip-12345.invalid/*"] // 原为 ["https://www.youtube.com/*"]
}

export const getInlineAnchor: PlasmoGetInlineAnchor = async () => ({
  element: document.querySelector(INJECTED_ELEMENT_ID),
  insertPosition: "afterbegin"
})

export const getShadowHostId = () => "plasmo-inline"

function PlasmoMainUI() {
  return (
    <Provider>
      <Providers>
        <Extension />
      </Providers>
    </Provider>
  )
}

export default PlasmoMainUI
