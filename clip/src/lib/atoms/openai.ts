/**
 * OpenAI Key Atom
 * 
 * 【已废弃】此 atom 已被 `@/lib/api-config-store` 取代
 * 保留此文件仅为向后兼容，新代码请使用 useApiConfig hook
 * 
 * 迁移指南：
 * - 旧: const openAIKey = useAtomValue(openAIKeyAtom)
 * - 新: const { apiKey, isLoading } = useApiConfig()
 * 
 * @deprecated 使用 useApiConfig hook 替代
 */
import { atomWithPlasmoStorage } from "./atom-with-plasmo-storage"

/**
 * @deprecated 使用 useApiConfig hook 替代
 */
export const openAIKeyAtom = atomWithPlasmoStorage<string | null>("openAIKey", null)
