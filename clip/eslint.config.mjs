import js from "@eslint/js"
// 2. 确保已安装 eslint-config-prettier
import prettier from "eslint-config-prettier"
import react from "eslint-plugin-react"
import globals from "globals"
// 1. 正确导入必要的包
import tseslint from "typescript-eslint"

export default tseslint.config(
  // 基础配置：定义需要检查的文件和忽略的目录
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx,jsx}"],
    ignores: ["build/", "node_modules/"],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  },

  // 应用 ESLint 自身的推荐规则
  js.configs.recommended,

  // 应用 TypeScript ESLint 的推荐规则
  // 这个配置对象内部已经包含了插件定义和对应的规则
  ...tseslint.configs.recommended,

  // 应用 React 的推荐配置
  {
    files: ["**/*.{jsx,tsx}"], // 明确指定 React 配置只应用于 JSX/TSX 文件
    plugins: {
      react // 在此对象内定义 react 插件
    },
    rules: {
      ...react.configs.recommended.rules,
      // 你可以在此添加或覆盖 React 相关规则
      "react/react-in-jsx-scope": "off"
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  },

  // 关键步骤：在一个配置对象内同时定义 TypeScript ESLint 插件和你想自定义的规则
  {
    files: ["**/*.{ts,tsx}"], // 这个配置专门针对 TypeScript 文件
    plugins: {
      "@typescript-eslint": tseslint.plugin // 在此对象内正确定义 @typescript-eslint 插件
    },
    rules: {
      // 现在 ESLint 能在这个对象内找到插件，所以规则可以正常工作了
      "@typescript-eslint/no-unused-vars": "warn" // 可以根据需要设置为 "error" 或 "warn"
      // 可以在此添加其他 TypeScript 特定规则
    }
  },

  // 最后，使用 eslint-config-prettier 来禁用所有与 Prettier 冲突的规则
  // 这必须是数组中的最后一个元素
  prettier
)
