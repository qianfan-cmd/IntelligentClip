// 自定义国际化工具，用于支持动态语言切换

import { LanguageCode } from "./atoms/language";

// 语言文件缓存
let languageCache: Record<string, Record<string, string>> = {};

// 获取用户选择的语言
async function getUserLanguage(): Promise<LanguageCode> {
  const stored = await chrome.storage.local.get(["preferredLocale", "languageConfig"]);
  
  // 优先使用 languageConfig 中的语言设置
  if (stored.languageConfig && stored.languageConfig.code) {
    return stored.languageConfig.code;
  }
  
  // 兼容旧的 preferredLocale 设置
  if (stored.preferredLocale) {
    return stored.preferredLocale as LanguageCode;
  }
  
  // 默认使用简体中文
  return "zh_CN";
}

// 加载语言文件
async function loadLanguageFile(languageCode: LanguageCode): Promise<Record<string, string>> {
  // 如果语言文件已经在缓存中，直接返回
  if (languageCache[languageCode]) {
    return languageCache[languageCode];
  }

  try {
    // 加载语言文件
    const response = await fetch(chrome.runtime.getURL(`_locales/${languageCode}/messages.json`));
    if (!response.ok) {
      throw new Error(`Failed to load language file for ${languageCode}`);
    }

    const languageData = await response.json();
    
    // 构建翻译映射
    const translations: Record<string, string> = {};
    for (const key in languageData) {
      if (languageData[key].message) {
        translations[key] = languageData[key].message;
      }
    }

    // 缓存语言文件
    languageCache[languageCode] = translations;
    return translations;
  } catch (error) {
    console.error(`Failed to load language file for ${languageCode}:`, error);
    // 如果加载失败，返回默认语言（简体中文）
    return loadLanguageFile("zh_CN");
  }
}

// 自定义 getMessage 函数
async function getMessage(messageName: string): Promise<string> {
  try {
    // 获取用户选择的语言
    const language = await getUserLanguage();
    
    // 加载相应的语言文件
    const translations = await loadLanguageFile(language);
    
    // 返回翻译文本，如果没有找到则使用默认的 chrome.i18n.getMessage()
    return translations[messageName] || chrome.i18n.getMessage(messageName) || messageName;
  } catch (error) {
    console.error(`Failed to get message ${messageName}:`, error);
    // 如果出错，使用默认的 chrome.i18n.getMessage()
    return chrome.i18n.getMessage(messageName) || messageName;
  }
}

// 立即执行函数，预加载默认语言
(async () => {
  const defaultLanguage = await getUserLanguage();
  await loadLanguageFile(defaultLanguage);
})();

export { getMessage, getUserLanguage };
