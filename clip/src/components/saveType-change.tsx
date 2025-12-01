import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AiOutlineRobot } from "react-icons/ai"
import { CiBookmark } from "react-icons/ci"

type SaveTag = "allPageSave" | "allPageAISave" | "selectSave" | "selectAISave"
type Props = { onChoose?: (payload: { tag: SaveTag }) => void; selectedTag?: SaveTag }

export function SaveTypeChange({ onChoose, selectedTag }: Props) {
  const [selected, setSelected] = useState<SaveTag>("allPageSave")
  useEffect(() => { if (selectedTag) setSelected(selectedTag) }, [selectedTag]);
  return (
    <div className="w-[220px]">
      <Card className="w-full rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">保存方式</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="flex flex-col gap-2 justify-center items-center">
            <button onClick={() => { const tag: SaveTag = "allPageSave"; setSelected(tag); onChoose?.({ tag }) }} className="w-full flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm bg-gray-50 text-gray-900 hover:bg-gray-100 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10 justify-start">
              <CiBookmark className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              <span className="flex-1">整页剪藏</span>
              {selected === "allPageSave" && <span className="ml-auto text-gray-700 dark:text-gray-300">✔</span>}
            </button>
             <button onClick={() => { const tag: SaveTag = "allPageAISave"; setSelected(tag); onChoose?.({ tag }) }} className="w-full flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm bg-gray-50 text-gray-900 hover:bg-gray-100 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10 justify-start">
              <AiOutlineRobot className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              <span className="flex-1">AI整页剪藏</span>
              {selected === "allPageAISave" && <span className="ml-auto text-gray-700 dark:text-gray-300">✔</span>}
            </button>
            <button onClick={() => { const tag: SaveTag = "selectSave"; setSelected(tag); onChoose?.({ tag }) }} className="w-full flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm bg-gray-50 text-gray-900 hover:bg-gray-100 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10 justify-start">
              <CiBookmark className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              <span className="flex-1">选中剪藏</span>
              {selected === "selectSave" && <span className="ml-auto text-gray-700 dark:text-gray-300">✔</span>}
            </button>
            <button onClick={() => { const tag: SaveTag = "selectAISave"; setSelected(tag); onChoose?.({ tag }) }} className="w-full flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm bg-gray-50 text-gray-900 hover:bg-gray-100 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10 justify-start">
              <AiOutlineRobot className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              <span className="flex-1">AI选择剪藏</span>
              {selected === "selectAISave" && <span className="ml-auto text-gray-700 dark:text-gray-300">✔</span>}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
