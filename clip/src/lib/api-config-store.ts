
import { SecureStorage } from "@plasmohq/storage/secure"
import { useState, useEffect, useCallback, useRef } from "react"

// ============================================
// 类型定义
// ============================================

export interface ApiConfig {
  /** API 密钥 */
  apiKey: string
  /** API 提供商（可扩展） */
  provider?: "openai" | "claude" | "custom"
  /** 自定义 API 基础 URL */
  baseUrl?: string
  /** 最后更新时间 */
  updatedAt?: number
}

interface ApiConfigState {
  /** 配置数据，null 表示未设置 */
  config: ApiConfig | null
  /** 是否正在从存储加载 */
  isLoading: boolean
  /** 加载或保存时的错误信息 */
  error: string | null
}

// ============================================
// 存储配置
// ============================================

/**
 * 统一存储 Key
 * 【重要】所有地方都使用这一个 key，避免多 key 不同步问题
 */
const STORAGE_KEY = "clipper_api_config"

/**
 * 旧版 SecureStorage key（用于迁移）
 */
const LEGACY_SECURE_KEY = "openAIKey"

/**
 * SecureStorage 实例（用于读取旧数据进行迁移）
 */
let secureStorage: SecureStorage | null = null
let secureStorageReady = false

/**
 * 初始化 SecureStorage（延迟初始化，避免阻塞）
 */
async function initSecureStorage(): Promise<SecureStorage> {
  if (secureStorage && secureStorageReady) {
    return secureStorage
  }
  
  secureStorage = new SecureStorage()
  
  // setPassword 可能是异步的，等待完成
  await secureStorage.setPassword("password")
  secureStorageReady = true
  
  return secureStorage
}

// ============================================
// 核心函数
// ============================================

/**
 * 从旧版 SecureStorage 迁移数据
 * 首次升级时会自动执行
 */
async function migrateFromSecureStorage(): Promise<ApiConfig | null> {
  try {
    const storage = await initSecureStorage()
    const legacyKey = await storage.get(LEGACY_SECURE_KEY)
    
    if (legacyKey && typeof legacyKey === "string" && legacyKey.trim()) {
      console.log("[ApiConfigStore] Found legacy API key, migrating...")
      
      const config: ApiConfig = {
        apiKey: legacyKey.trim(),
        provider: "openai",
        updatedAt: Date.now()
      }
      
      // 保存到新存储
      await saveApiConfig(config)
      
      // 【可选】清理旧数据（暂时保留，确保迁移成功）
      // await storage.remove(LEGACY_SECURE_KEY)
      
      console.log("[ApiConfigStore] Migration completed")
      return config
    }
  } catch (err) {
    console.warn("[ApiConfigStore] Migration failed:", err)
  }
  
  return null
}

/**
 * 加载 API 配置
 * 
 * 【加载顺序】
 * 1. 先从 chrome.storage.local 读取新格式数据
 * 2. 如果没有，尝试从旧版 SecureStorage 迁移
 * 3. 都没有则返回 null
 */
export async function loadApiConfig(): Promise<ApiConfig | null> {
  try {
    // 1. 从 chrome.storage.local 读取
    const result = await chrome.storage.local.get(STORAGE_KEY)
    const stored = result[STORAGE_KEY]
    
    if (stored && typeof stored === "object" && stored.apiKey) {
      console.log("[ApiConfigStore] Loaded config from chrome.storage.local")
      return stored as ApiConfig
    }
    
    // 2. 尝试迁移旧数据
    const migrated = await migrateFromSecureStorage()
    if (migrated) {
      return migrated
    }
    
    // 3. 没有配置
    console.log("[ApiConfigStore] No API config found")
    return null
    
  } catch (err) {
    console.error("[ApiConfigStore] Load failed:", err)
    return null
  }
}

/**
 * 保存 API 配置
 * 
 * 【双写策略】
 * 同时写入 chrome.storage.local 和 SecureStorage
 * 确保新旧代码都能读取到
 */
export async function saveApiConfig(config: ApiConfig): Promise<void> {
  if (!config.apiKey || !config.apiKey.trim()) {
    throw new Error("API Key cannot be empty")
  }
  
  const configToSave: ApiConfig = {
    ...config,
    apiKey: config.apiKey.trim(),
    updatedAt: Date.now()
  }
  
  try {
    // 1. 写入 chrome.storage.local（主存储）
    await chrome.storage.local.set({ [STORAGE_KEY]: configToSave })
    console.log("[ApiConfigStore] Saved to chrome.storage.local")
    
    // 2. 同时写入 SecureStorage（兼容旧代码）
    try {
      const storage = await initSecureStorage()
      await storage.set(LEGACY_SECURE_KEY, configToSave.apiKey)
      console.log("[ApiConfigStore] Also saved to SecureStorage for compatibility")
    } catch (secureErr) {
      // SecureStorage 写入失败不影响主逻辑
      console.warn("[ApiConfigStore] SecureStorage write failed (non-critical):", secureErr)
    }
    
  } catch (err) {
    console.error("[ApiConfigStore] Save failed:", err)
    throw err
  }
}

/**
 * 清除 API 配置
 */
export async function clearApiConfig(): Promise<void> {
  try {
    await chrome.storage.local.remove(STORAGE_KEY)
    
    try {
      const storage = await initSecureStorage()
      await storage.remove(LEGACY_SECURE_KEY)
    } catch {}
    
    console.log("[ApiConfigStore] Config cleared")
  } catch (err) {
    console.error("[ApiConfigStore] Clear failed:", err)
    throw err
  }
}

// ============================================
// React Hook
// ============================================

/**
 * useApiConfig - 统一的 API 配置 Hook
 * 
 * 【使用方式】
 * ```tsx
 * const { config, isLoading, error, saveConfig, refreshConfig } = useApiConfig()
 * 
 * // 正确的判断逻辑
 * if (isLoading) {
 *   return <LoadingSpinner />  // 加载中，不要报错
 * }
 * 
 * if (!config?.apiKey) {
 *   return <SetupApiKeyPrompt />  // 真正未设置
 * }
 * 
 * // 正常使用 config.apiKey
 * ```
 */
export function useApiConfig() {
  const [state, setState] = useState<ApiConfigState>({
    config: null,
    isLoading: true,  // 初始为 true，防止误判
    error: null
  })
  
  // 使用 ref 跟踪组件是否已卸载
  const mountedRef = useRef(true)
  
  /**
   * 加载配置
   */
  const loadConfig = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      
      const config = await loadApiConfig()
      
      if (mountedRef.current) {
        setState({
          config,
          isLoading: false,
          error: null
        })
      }
    } catch (err) {
      if (mountedRef.current) {
        setState({
          config: null,
          isLoading: false,
          error: err instanceof Error ? err.message : "加载配置失败"
        })
      }
    }
  }, [])
  
  /**
   * 保存配置
   */
  const saveConfig = useCallback(async (newConfig: ApiConfig) => {
    try {
      setState(prev => ({ ...prev, error: null }))
      await saveApiConfig(newConfig)
      
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          config: newConfig,
          error: null
        }))
      }
      
      return true
    } catch (err) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : "保存配置失败"
        }))
      }
      return false
    }
  }, [])
  
  /**
   * 刷新配置（手动触发重新加载）
   */
  const refreshConfig = useCallback(() => {
    loadConfig()
  }, [loadConfig])
  
  // 初始加载
  useEffect(() => {
    mountedRef.current = true
    loadConfig()
    
    return () => {
      mountedRef.current = false
    }
  }, [loadConfig])
  
  // 监听 storage 变化，实时同步
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === "local" && changes[STORAGE_KEY]) {
        console.log("[ApiConfigStore] Storage changed, reloading...")
        const newValue = changes[STORAGE_KEY].newValue
        
        if (mountedRef.current) {
          setState({
            config: newValue || null,
            isLoading: false,
            error: null
          })
        }
      }
    }
    
    chrome.storage.onChanged.addListener(handleStorageChange)
    
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])
  
  return {
    /** API 配置，null 表示未设置 */
    config: state.config,
    /** 是否正在加载 - 【重要】加载中时不要判断为"未设置" */
    isLoading: state.isLoading,
    /** 错误信息 */
    error: state.error,
    /** 保存配置 */
    saveConfig,
    /** 刷新配置 */
    refreshConfig,
    /** 快捷方式：获取 API Key */
    apiKey: state.config?.apiKey || null,
    /** 快捷方式：是否已配置 API Key */
    hasApiKey: !state.isLoading && !!state.config?.apiKey
  }
}

// ============================================
// 辅助函数
// ============================================

/**
 * 直接获取 API Key（非响应式，用于一次性调用）
 * 
 * 【注意】这是非响应式的，如果需要实时更新请使用 useApiConfig hook
 */
export async function getApiKey(): Promise<string | null> {
  const config = await loadApiConfig()
  return config?.apiKey || null
}

/**
 * 检查是否已设置 API Key
 */
export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey()
  return !!key && key.trim().length > 0
}
