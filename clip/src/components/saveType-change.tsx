import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AiOutlineRobot } from "react-icons/ai"
import { CiBookmark } from "react-icons/ci"
import { useContentScriptI18n } from "@/lib/use-content-script-i18n" // 引入 Content Script 国际化 Hook
import { cn } from "@/lib/utils" // 引入类名合并工具

type SaveTag = "allPageSave" | "allPageAISave" | "selectSave" | "selectAISave"
type Props = { onChoose?: (payload: { tag: SaveTag }) => void; selectedTag?: SaveTag }

export function SaveTypeChange({ onChoose, selectedTag }: Props) {
  // 使用自定义的 Content Script 国际化 Hook
  const { t } = useContentScriptI18n();
  const [isDark, setIsDark] = useState<boolean>(() => {
    try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches } catch { return false }
  })
  const [selected, setSelected] = useState<SaveTag>("allPageSave")
  useEffect(() => { if (selectedTag) setSelected(selectedTag) }, [selectedTag]);
  // 跟随浏览器主题变更
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches)
    // 兼容不同浏览器事件 API
    if (mq.addEventListener) mq.addEventListener('change', handler)
    else if ((mq as any).addListener) (mq as any).addListener(handler)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler)
      else if ((mq as any).removeListener) (mq as any).removeListener(handler)
    }
  }, [])
  return (
    <div className={cn(isDark ? 'dark' : '', 'w-[220px]')}>
      {/* 此处有修改：rounded-xl => round-[12px] */}
      <Card className={"w-full rounded-[12px] border border-gray-200 bg-white shadow-sm dark:border-white/20 dark:bg-black"}>
        {/* 此处有修改（单位由默认的 rem 换算成了 px）：py-[8px] px-[12px] */}
        <CardHeader className="py-[8px] px-[12px]">
          {/* 此处有修改（单位由默认的 rem 换算成了 px）：text-sm => text-[14px] */}
          {/** <CardTitle className="text-[14px] font-medium text-gray-900 dark:text-gray-100">剪藏方式</CardTitle> */}
          <CardTitle className={"text-[14px] font-medium text-gray-900 dark:text-white"}>{t("saveTypeChangeTitle")}</CardTitle>
        </CardHeader>
        {/* 此处有修改（单位由默认的 rem 换算成了 px）：p-[8px] */}
        <CardContent className="p-[8px]">
          {/* 此处有修改（单位由默认的 rem 换算成了 px）：gap-[8px] */}
          <div className="flex flex-col gap-[8px] justify-center items-center">
            {/* 此处有修改（单位由默认的 rem 换算成了 px）：gap-[6px] rounded-lg => rounded-[8px] px-[10px] py-[8px] text-sm => text-[14px]  下同 */}
            <button onClick={() => { const tag: SaveTag = "allPageSave"; setSelected(tag); onChoose?.({ tag }) }} className={"w-full flex items-center gap-[6px] rounded-[8px] px-[10px] py-[8px] text-[14px] bg-gray-50 text-gray-900 hover:bg-gray-100 dark:bg-black dark:text-white dark:hover:bg-black justify-start"}>
              {/* 此处有修改（单位由默认的 rem 换算成了 px）：w-[16px] h-[16px]  下同 */}
              <CiBookmark className={"w-[16px] h-[16px] text-gray-700 dark:text-white"} />
              {/** <span className="flex-1">整页剪藏</span> */}
              <span className="flex-1">{t("saveTypeChangeAllPageClip")}</span>
              {selected === "allPageSave" && <span className={"ml-auto text-gray-700 dark:text-white"}>✔</span>}
            </button>
             <button onClick={() => { const tag: SaveTag = "allPageAISave"; setSelected(tag); onChoose?.({ tag }) }} className={"w-full flex items-center gap-[6px] rounded-[8px] px-[10px] py-[8px] text-[14px] justify-start bg-gray-50 text-gray-900 hover:bg-gray-100 dark:bg-black dark:text-white dark:hover:bg-black"}>
              <AiOutlineRobot className={"w-[16px] h-[16px] text-gray-700 dark:text-white"} />
              {/** <span className="flex-1">AI整页剪藏</span> */}
              <span className={"flex-1 text-gray-900 dark:text-white"}>{t("saveTypeChangeAllPageAIClip")}</span>
              {selected === "allPageAISave" && <span className={"ml-auto text-gray-700 dark:text-white"}>✔</span>}
            </button>
            <button onClick={() => { const tag: SaveTag = "selectSave"; setSelected(tag); onChoose?.({ tag }) }} className={"w-full flex items-center gap-[6px] rounded-[8px] px-[10px] py-[8px] text-[14px] justify-start bg-gray-50 text-gray-900 hover:bg-gray-100 dark:bg-black dark:text-white dark:hover:bg-black"}>
              <CiBookmark className={"w-[16px] h-[16px] text-gray-700 dark:text-white"} />
              {/** <span className="flex-1">选中剪藏</span> */}
              <span className={"flex-1 text-gray-900 dark:text-white"}>{t("saveTypeChangeSelectClip")}</span>
              {selected === "selectSave" && <span className={"ml-auto text-gray-700 dark:text-white"}>✔</span>}
            </button>
            <button onClick={() => { const tag: SaveTag = "selectAISave"; setSelected(tag); onChoose?.({ tag }) }} className={"w-full flex items-center gap-[6px] rounded-[8px] px-[10px] py-[8px] text-[14px] justify-start bg-gray-50 text-gray-900 hover:bg-gray-100 dark:bg-black dark:text-white dark:hover:bg-black"}>
              <AiOutlineRobot className={"w-[16px] h-[16px] text-gray-700 dark:text-white"} />
              {/** <span className="flex-1">AI选中剪藏</span> */}
              <span className={"flex-1 text-gray-900 dark:text-white"}>{t("saveTypeChangeSelectAIClip")}</span>
              {selected === "selectAISave" && <span className={"ml-auto text-gray-700 dark:text-white"}>✔</span>}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
