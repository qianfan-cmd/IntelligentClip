// React Hook for internationalization

import { useState, useEffect } from "react";
import { getMessage, getUserLanguage } from "./i18n";
import { LanguageCode } from "./atoms/language";

// 自定义Hook，用于获取翻译文本
export function useI18n() {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>("zh_CN");
  const [isLoading, setIsLoading] = useState(true);

  // 加载翻译文本
  const loadTranslations = async () => {
    try {
      setIsLoading(true);
      const language = await getUserLanguage();
      setCurrentLanguage(language);

      // 加载语言文件
      const response = await fetch(chrome.runtime.getURL(`_locales/${language}/messages.json`));
      if (!response.ok) {
        throw new Error(`Failed to load language file for ${language}`);
      }

      const languageData = await response.json();
      
      // 构建翻译映射
      const newTranslations: Record<string, string> = {};
      for (const key in languageData) {
        if (languageData[key].message) {
          newTranslations[key] = languageData[key].message;
        }
      }

      setTranslations(newTranslations);
    } catch (error) {
      console.error("Failed to load translations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 初始化加载翻译文本
  useEffect(() => {
    loadTranslations();
  }, []);

  // 监听语言变化
  useEffect(() => {
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === "local" && (changes.preferredLocale || changes.languageConfig)) {
        // 语言变化时重新加载翻译文本
        loadTranslations();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // 获取翻译文本
  const t = (messageName: string): string => {
    return translations[messageName] || chrome.i18n.getMessage(messageName) || messageName;
  };

  return {
    t,
    currentLanguage,
    isLoading,
    reloadTranslations: loadTranslations
  };
}
