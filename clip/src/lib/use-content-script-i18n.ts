import { useState, useCallback, useEffect } from "react";
import { sendToBackground } from "@plasmohq/messaging";

/**
 * 用于 Content Script 的国际化 Hook
 * 从 Background 获取翻译并支持语言变化监听
 */
export function useContentScriptI18n() {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [currentLanguage, setCurrentLanguage] = useState<string>("zh_CN");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  // 获取翻译文本
  const t = useCallback((messageName: string): string => {
    return translations[messageName] || messageName;
  }, [translations]);
  
  // 从 background 获取翻译
  const loadTranslations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await sendToBackground({
        name: "i18n", 
        body: { action: "get-translations" }
      });
      
      if (response.success && response.data) {
        setTranslations(response.data.translations);
        setCurrentLanguage(response.data.language);
      } else {
        throw new Error("Failed to load translations: Invalid response");
      }
    } catch (error) {
      console.error("Failed to load translations:", error);
      setError(error instanceof Error ? error : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // 初始化加载翻译
  useEffect(() => {
    loadTranslations();
  }, [loadTranslations]);
  
  // 监听语言变化
  useEffect(() => {
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === "local" && (changes.preferredLocale || changes.languageConfig)) {
        loadTranslations();
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [loadTranslations]);
  
  return {
    t,
    translations,
    currentLanguage,
    isLoading,
    error,
    reloadTranslations: loadTranslations
  };
}
