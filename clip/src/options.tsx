import { Provider, useAtom } from "jotai"
import { feishuConfigAtom } from "@/lib/atoms/feishu"
import { openAIKeyAtom } from "@/lib/atoms/openai"
import { Save, AlertTriangle } from "lucide-react"
import { useState } from "react"
import "./style.css"

function OptionsPanel() {
  const [feishuConfig, setFeishuConfig] = useAtom(feishuConfigAtom)
  const [openAIKey, setOpenAIKey] = useAtom(openAIKeyAtom)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    // Atoms automatically persist to storage
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100 p-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">⚙️ Extension Settings</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Configure your API keys and integration settings.
          </p>
        </div>

        <div className="space-y-8">
          {/* OpenAI Settings */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              🤖 OpenAI Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  value={openAIKey || ""}
                  onChange={(e) => setOpenAIKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required for AI summarization and chat features.
                </p>
              </div>
            </div>
          </section>

          {/* Feishu/Lark Settings */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="text-blue-500">📄</span> Feishu / Lark Bitable
            </h2>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <p className="font-medium mb-1">安全提示</p>
                <p>
                  配置信息本地存储在浏览器中。App Secret 具有较高权限，请妥善保管。
                  系统将使用 App ID 和 App Secret 自动获取 tenant_access_token（有效期 2 小时，自动缓存）。
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  App Token（Base Token）
                </label>
                <input
                  type="text"
                  value={feishuConfig.appToken}
                  onChange={(e) => setFeishuConfig({ ...feishuConfig, appToken: e.target.value })}
                  placeholder="bascn..."
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  在多维表格 URL 中找到：/base/<b>bascn...</b>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Table ID（表格 ID）
                </label>
                <input
                  type="text"
                  value={feishuConfig.tableId}
                  onChange={(e) => setFeishuConfig({ ...feishuConfig, tableId: e.target.value })}
                  placeholder="tbl..."
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  在表格 URL 参数中找到：?table=<b>tbl...</b>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  App ID（应用 ID）
                </label>
                <input
                  type="text"
                  value={feishuConfig.appId}
                  onChange={(e) => setFeishuConfig({ ...feishuConfig, appId: e.target.value })}
                  placeholder="cli_..."
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  在飞书开放平台 - 开发配置 - 应用凭证中获取
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  App Secret（应用密钥）
                </label>
                <input
                  type="password"
                  value={feishuConfig.appSecret}
                  onChange={(e) => setFeishuConfig({ ...feishuConfig, appSecret: e.target.value })}
                  placeholder="输入应用密钥..."
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  在飞书开放平台 - 开发配置 - 应用凭证中获取，系统将自动获取 tenant_access_token
                </p>
              </div>
            </div>
          </section>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              <Save className="h-4 w-4" />
              {saved ? "Saved!" : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Options() {
  return (
    <Provider>
      <OptionsPanel />
    </Provider>
  )
}
