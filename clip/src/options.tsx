// 支持扩展国际化版本的 options.tsx
import { Provider, useAtom } from "jotai"
import { feishuConfigAtom } from "@/lib/atoms/feishu"
import { languageConfigAtom, LanguageCode } from "@/lib/atoms/language"
import { useApiConfig } from "@/lib/api-config-store"
import { useI18n } from "@/lib/use-i18n"
import { Save, AlertTriangle, Loader2, CheckCircle } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import {FiHelpCircle} from "react-icons/fi"
import "./style.css"

function OptionsPanel() {
  const [feishuConfig, setFeishuConfig] = useAtom(feishuConfigAtom)
  const [languageConfig, setLanguageConfig] = useAtom(languageConfigAtom)
  const { t, currentLanguage } = useI18n()
  
  // 【修复】使用统一的 API 配置模块，解决跨页面不同步问题
  const { config, isLoading, saveConfig, hasApiKey } = useApiConfig()
  
  // 本地编辑状态（允许用户输入，提交时才保存）
  const [localApiKey, setLocalApiKey] = useState("")
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  
  // 支持的语言列表
  const languages = [
    { code: "zh_CN", name: "简体中文" },
    { code: "zh_TW", name: "繁體中文" },
    { code: "en", name: "English" }
  ] as const
  
  // 处理语言切换
  const handleLanguageChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value as LanguageCode
    
    // 保存用户选择的语言到存储
    setLanguageConfig({ language: newLanguage })
    await chrome.storage.local.set({ preferredLocale: newLanguage })

    // 发送消息通知其他部分更新
    await chrome.runtime.sendMessage({
      type: 'LANGUAGE_CHANGED',
      language: newLanguage
    })
  }, [setLanguageConfig])

  // 当配置加载完成后，同步到本地状态
  useEffect(() => {
    if (!isLoading && config?.apiKey) {
      setLocalApiKey(config.apiKey)
    }
  }, [isLoading, config?.apiKey])

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    
    try {
      // 【修复】使用统一的保存函数，确保所有地方都能读取到
      if (localApiKey.trim()) {
        await saveConfig({
          apiKey: localApiKey.trim(),
          provider: "openai",
          updatedAt: Date.now()
        })
      }
      
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("optionsSaveFailed"))  // 保存失败
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100 p-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            {/* ⚙️ Extension Settings */}
            <h1 className="text-3xl font-bold mb-2">⚙️ {t("optionsExtensionSettingsTitle")}</h1>
            <p className="text-gray-500 dark:text-gray-400 flex items-center justify-center">
              {/* Configure your API keys and integration settings. */}
              {t("optionsSettingsDescription")}
              {/** title="Help"  */}
               <button
                      className={`rounded-lg transition-colors `}
                      onClick={() =>
                        window.open(
                          "https://gitee.com/qyf150128/clip-plugin",
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                      title={t("optionsHelpButtonHint")}>
                      <FiHelpCircle className="w-3 h-3" />
                    </button>
            </p>
          </div>
                   
          {/* 语言选择下拉菜单 */}
          <div className="flex items-center gap-2">
            <label htmlFor="language-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("optionsLanguageLabel") || "语言"}
            </label>
            <select
              id="language-select"
              value={languageConfig.language}
              onChange={handleLanguageChange}
              className="px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-8">
          {/* OpenAI Settings */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              {/* 🤖 OpenAI Configuration */}
              {t("optionsOpenAIConfigTitle")}
              {/* 【新增】显示配置状态 */}
              {isLoading ? (
                <span className="ml-2 flex items-center gap-1 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {/* 加载中... */}
                  {t("optionsLoadingStatus")}
                </span>
              ) : hasApiKey ? (
                <span className="ml-2 flex items-center gap-1 text-sm text-green-500">
                  <CheckCircle className="h-4 w-4" />
                  {/* 已配置 */}
                  {t("optionsAlreadyConfigured")}
                </span>
              ) : null}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {/* OpenAI API Key */}
                  {t("optionsApiKeyLabel")}
                </label>
                {isLoading ? (
                  <div className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 h-10 animate-pulse" />
                ) : (
                  <input
                    type="password"
                    value={localApiKey}
                    onChange={(e) => setLocalApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {/* Required for AI summarization and chat features. */}
                  {t("optionsApiKeyHelp")}
                </p>
                {/* 【新增】显示保存错误 */}
                {saveError && (
                  <p className="text-xs text-red-500 mt-1">
                    ❌ {saveError}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Feishu/Lark Settings */}
          <section className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              {/** <span className="text-blue-500">📄</span> Feishu / Lark Bitable */}
              <span className="text-blue-500">📄</span> {t("optionsFeishuOrLarkConfigTitle")}
            </h2>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                {/* 安全提示 */}
                <p className="font-medium mb-1">{t("optionsFeishuSecurityPromptTitle")}</p>
                <p>
                  {/*配置信息本地存储在浏览器中。App Secret 具有较高权限，请妥善保管。*/}
                  {t("optionsFeishuSecurityPromptContent1")}
                  {/* 系统将使用 App ID 和 App Secret 自动获取 tenant_access_token（有效期 2 小时，自动缓存）。 */}
                  {t("optionsFeishuSecurityPromptContent2")}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {/* Table Token（Base Token） */}
                  {t("optionsFeishuTableTokenLabel")}
                </label>
                <input
                  type="text"
                  value={feishuConfig.appToken}
                  onChange={(e) => setFeishuConfig({ ...feishuConfig, appToken: e.target.value })}
                  placeholder="bascn..."
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {/* 在多维表格 URL 中找到：/base/<b>bascn...</b> */}
                  {t("optionsFeishuTableTokenHelp")}<b>bascn...</b>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {/* Table ID（表格 ID） */}
                  {t("optionsFeishuTableIDLabel")}
                </label>
                <input
                  type="text"
                  value={feishuConfig.tableId}
                  onChange={(e) => setFeishuConfig({ ...feishuConfig, tableId: e.target.value })}
                  placeholder="tbl..."
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {/* 在表格 URL 参数中找到：?table=<b>tbl...</b> */}
                  {t("optionsFeishuTableIDHelp")}<b>tbl...</b>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {/* App ID（应用 ID） */}
                  {t("optionsFeishuAppIDLabel")}
                </label>
                <input
                  type="text"
                  value={feishuConfig.appId}
                  onChange={(e) => setFeishuConfig({ ...feishuConfig, appId: e.target.value })}
                  placeholder="cli_..."
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {/* 在飞书开放平台 - 开发配置 - 应用凭证中获取 */}
                  {t("optionsFeishuAppIDHelp")}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {/* App Secret（应用密钥） */}
                  {t("optionsFeishuAppSecretLabel")}
                </label>
                {/* 输入框占位符：输入应用密钥... */}
                <input
                  type="password"
                  value={feishuConfig.appSecret}
                  onChange={(e) => setFeishuConfig({ ...feishuConfig, appSecret: e.target.value })}
                  placeholder={t("optionsFeishuAppSecretInputPlaceholder")}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {/* 在飞书开放平台 - 开发配置 - 应用凭证中获取，系统将自动获取 tenant_access_token */}
                  {t("optionsFeishuAppSecretHelp")}
                </p>
              </div>
            </div>
          </section>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={saving || isLoading}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {/* {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"} */}
              {saving ? t("optionsSaveButtonSaving") : saved ? t("optionsSaveButtonSaved") : t("optionsSaveButtonToSave")}
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
