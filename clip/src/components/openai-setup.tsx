/**
 * OpenAISetup - API Key 设置组件
 * 用于首次设置或更新 LLM API Key
 */
import { openAIKeyAtom } from "@/lib/atoms/openai"
import { useSetAtom } from "jotai"
import React from "react"
import { Key, Sparkles } from "lucide-react"

import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

interface OpenAISetupProps {}

export default function OpenAISetup({}: OpenAISetupProps) {
  const setOpenAIKey = useSetAtom(openAIKeyAtom)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const onClick = async () => {
    const input = inputRef.current
    if (!input || !input.value.trim()) return
    
    setIsLoading(true)
    // 模拟验证延迟
    await new Promise(resolve => setTimeout(resolve, 300))
    setOpenAIKey(input.value.trim())
    setIsLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onClick()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* 图标和标题 */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              配置 AI 助手
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              输入您的 API Key 以启用 AI 功能
            </p>
          </div>
        </div>

        {/* 输入表单 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label 
              htmlFor="apiKey" 
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              API Key
            </Label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                ref={inputRef}
                id="apiKey"
                type="password"
                placeholder="sk-xxxxxx..."
                className="pl-10 h-11 bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
                onKeyDown={handleKeyDown}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              您的 API Key 将安全地存储在本地
            </p>
          </div>

          <Button 
            onClick={onClick} 
            disabled={isLoading}
            className="w-full h-11 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-medium shadow-md"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                验证中...
              </span>
            ) : (
              "保存并开始使用"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
