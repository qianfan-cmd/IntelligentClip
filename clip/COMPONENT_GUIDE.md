# shadcn/ui 组件库使用指南

## 📚 目录
1. [快速配置](#快速配置)
2. [项目结构](#项目结构)
3. [文件夹和文件说明](#文件夹和文件说明)
4. [如何使用组件](#如何使用组件)
5. [添加新组件](#添加新组件)
6. [常见问题](#常见问题)

---

## 快速配置

### 📦 前置要求

- 已有 Plasmo + React + TypeScript + Tailwind 的项目

### 🚀 shadcn/ui 自动配置

#### **步骤 1：安装依赖**

```bash
npm install -D shadcn @radix-ui/react-slot @radix-ui/react-primitive
npm install -D class-variance-authority clsx tailwind-merge
```

#### **步骤 2：自动生成组件**

```bash
# 添加 Button 组件
npx shadcn@latest add button

# 添加 Card 组件
npx shadcn@latest add card

# 添加 Input 组件
npx shadcn@latest add input

# 或一次性添加多个
npx shadcn@latest add button card input
```

完成！shadcn/ui 会自动生成所有必需的文件和配置。

### 📖 官方文档

- **shadcn/ui CLI 文档**：https://ui.shadcn.com/docs/cli
- **完整组件库**：https://ui.shadcn.com/docs/components/accordion

---

```
clip/
├── src/
│   ├── components/              # 💡 UI 组件库（核心）
│   │   ├── index.ts            # 组件导出入口
│   │   └── ui/                 # shadcn/ui 基础组件
│   │       ├── button.tsx      # 按钮组件
│   │       ├── card.tsx        # 卡片组件
│   │       └── input.tsx       # 输入框组件
│   ├── lib/                     # 📦 工具函数
│   │   └── utils.ts            # CSS 类名合并工具
│   ├── hooks/                   # 🪝 自定义 React Hooks（待开发）
│   ├── view/                    # 👁️  业务相关的复合组件（待开发）
│   ├── popup.tsx               # 🎯 插件主入口
│   └── style.css               # 🎨 全局样式（Tailwind 指令）
├── tailwind.config.js           # ⚙️ Tailwind CSS 配置
├── postcss.config.js            # ⚙️ PostCSS 配置（处理 CSS）
├── components.json              # ⚙️ shadcn/ui 配置
├── tsconfig.json                # ⚙️ TypeScript 配置（含路径别名）
└── package.json                 # 📋 项目依赖和脚本
```

---

## 文件夹和文件说明

### 🎯 **`src/components/`** - UI 组件库（最重要！）

这是团队共享的组件库，所有 UI 组件都存放在这里。

#### **`src/components/index.ts`** - 组件导出入口

**作用**：统一导出所有组件，让使用者可以简洁地导入

**内容示例**：
```typescript
export { Button, buttonVariants } from "./ui/button"
export type { ButtonProps } from "./ui/button"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./ui/card"

export { Input } from "./ui/input"
```

**使用方式**：
```tsx
// ✅ 推荐：简洁的导入
import { Button, Card, Input } from "~components"

// ❌ 不推荐：冗长的导入
import { Button } from "~components/ui/button"
import { Card } from "~components/ui/card"
```

---

#### **`src/components/ui/button.tsx`** - 按钮组件

**作用**：提供统一风格的按钮组件

**支持的变体（variants）**：
- `default` - 默认按钮（蓝色）
- `outline` - 边框按钮
- `ghost` - 幽灵按钮（无背景）
- `secondary` - 次级按钮
- `destructive` - 危险按钮（红色）
- `link` - 链接按钮

**支持的尺寸（sizes）**：
- `default` - 默认高度 40px
- `sm` - 小尺寸 36px
- `lg` - 大尺寸 44px
- `icon` - 图标按钮 40x40px

**使用示例**：
```tsx
import { Button } from "~components"

export function MyComponent() {
  return (
    <>
      {/* 默认按钮 */}
      <Button>点击我</Button>

      {/* 不同变体 */}
      <Button variant="outline">边框按钮</Button>
      <Button variant="ghost">幽灵按钮</Button>
      <Button variant="destructive">删除</Button>

      {/* 不同尺寸 */}
      <Button size="sm">小按钮</Button>
      <Button size="lg">大按钮</Button>

      {/* 禁用状态 */}
      <Button disabled>禁用按钮</Button>

      {/* 组合使用 */}
      <Button variant="outline" size="lg" disabled>
        不可用的大按钮
      </Button>

      {/* 自定义类名 */}
      <Button className="w-full">全宽按钮</Button>
    </>
  )
}
```

---

#### **`src/components/ui/card.tsx`** - 卡片组件

**作用**：提供统一风格的卡片容器，用来组织和展示内容

**包含的子组件**：
- `Card` - 卡片外壳
- `CardHeader` - 头部区域
- `CardTitle` - 标题
- `CardDescription` - 描述文字
- `CardContent` - 主要内容区域
- `CardFooter` - 页脚区域

**使用示例**：
```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~components"
import { Button } from "~components"

export function MyCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>卡片标题</CardTitle>
        <CardDescription>这是卡片描述</CardDescription>
      </CardHeader>

      <CardContent>
        <p>这是卡片的主要内容区域</p>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button>保存</Button>
        <Button variant="outline">取消</Button>
      </CardFooter>
    </Card>
  )
}
```

---

#### **`src/components/ui/input.tsx`** - 输入框组件

**作用**：提供美化后的输入框，支持所有原生 HTML input 属性

**支持的类型**：
- `text` - 文本输入
- `email` - 邮箱输入
- `password` - 密码输入
- `number` - 数字输入
- `search` - 搜索输入
- 等所有 HTML input 类型

**使用示例**：
```tsx
import { Input } from "~components"
import { useState } from "react"

export function MyForm() {
  const [text, setText] = useState("")
  const [email, setEmail] = useState("")

  return (
    <>
      {/* 基础输入框 */}
      <Input
        placeholder="输入文本..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {/* 邮箱输入 */}
      <Input
        type="email"
        placeholder="输入邮箱..."
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {/* 禁用状态 */}
      <Input disabled placeholder="禁用的输入框" />

      {/* 自定义类名 */}
      <Input className="w-full" placeholder="全宽输入框" />
    </>
  )
}
```

---

### 📦 **`src/lib/utils.ts`** - 工具函数

**作用**：提供 CSS 类名合并工具

**内容**：
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**为什么需要？**
- Tailwind CSS 类名可能冲突，`cn()` 帮你智能合并
- 处理条件类名

**使用示例**：
```tsx
import { cn } from "~/lib/utils"

export function Button({ disabled, className }) {
  return (
    <button
      className={cn(
        "px-4 py-2 rounded-md",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      按钮
    </button>
  )
}
```

---

### 🪝 **`src/hooks/`** - 自定义 Hooks（待开发）

**用途**：存放项目特定的 React Hooks

**示例**（未来可能添加）：
```tsx
// useStorage.ts - 使用 Plasmo 存储的 Hook
export function useClipStorage(key: string) {
  const [data, setData] = useStorage(key)
  return [data, setData]
}

// useClipboard.ts - 剪贴板操作 Hook
export function useClipboard() {
  const copy = (text: string) => navigator.clipboard.writeText(text)
  return { copy }
}
```

---

### 👁️ **`src/view/`** - 业务组件（待开发）

**用途**：存放业务相关的复合组件（由多个 UI 组件组成）

**示例**（未来可能添加）：
```tsx
// ClipForm.tsx - 剪藏表单（由 Card + Input + Button 组成）
export function ClipForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>新建剪藏</CardTitle>
      </CardHeader>
      <CardContent>
        <Input placeholder="输入要保存的内容..." />
      </CardContent>
    </Card>
  )
}
```

---

### 🎨 **`src/style.css`** - 全局样式

**包含**：
```css
@tailwind base;      /* 基础样式重置 */
@tailwind components; /* Tailwind 组件 */
@tailwind utilities;  /* Tailwind 工具类 */
```

**重要**：修改这个文件时要小心，全局样式会影响整个应用

---

### ⚙️ **配置文件**

#### **`tailwind.config.js`** - Tailwind CSS 配置
```javascript
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",  // 扫描这些文件找出使用的类名
    "./build/**/*.html"             // 也扫描构建输出
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

#### **`postcss.config.js`** - PostCSS 配置
```javascript
export default {
  plugins: {
    tailwindcss: {},  // 处理 @tailwind 指令
    autoprefixer: {}, // 添加浏览器前缀
  },
}
```

#### **`components.json`** - shadcn/ui 配置
```json
{
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/style.css"
  },
  "aliases": {
    "@/components": "src/components",
    "@/lib": "src/lib",
    "@/utils": "src/lib/utils"
  }
}
```

#### **`tsconfig.json` - 路径别名**
```json
{
  "compilerOptions": {
    "paths": {
      "~*": ["./src/*"],
      "~components/*": ["./src/components/*"],
      "~lib/*": ["./src/lib/*"],
      "~hooks/*": ["./src/hooks/*"]
    }
  }
}
```

---

## 如何使用组件

### ✅ 在 `popup.tsx` 或其他组件中使用

```tsx
import React, { useState } from "react"

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "~components"

import "./style.css"

export function MyPopup() {
  const [data, setData] = useState("")

  return (
    <div className="w-96 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Clip</CardTitle>
          <CardDescription>Chrome 剪藏插件</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="clip-input" className="text-sm font-medium">
              剪藏内容
            </label>
            <Input
              id="clip-input"
              placeholder="输入或粘贴内容..."
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button className="flex-1">保存</Button>
            <Button variant="outline" className="flex-1">
              取消
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default MyPopup
```

---

## 添加新组件

### 方法 1：手动添加（推荐用于定制组件）

1. **在 `src/components/ui/` 中创建新文件**，例如 `src/components/ui/checkbox.tsx`

```tsx
import * as React from "react"
import { cn } from "~/lib/utils"

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <input
      type="checkbox"
      className={cn(
        "h-4 w-4 rounded border border-primary",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
```

2. **在 `src/components/index.ts` 中导出**

```typescript
export { Checkbox } from "./ui/checkbox"
export type { CheckboxProps } from "./ui/checkbox"
```

3. **在任何地方使用**

```tsx
import { Checkbox } from "~components"

export function MyComponent() {
  return <Checkbox defaultChecked />
}
```

### 方法 2：从 shadcn/ui 官方库添加（使用 CLI）

> 当 `components.json` 配置正确时可用此方法快速添加官方预制组件
> 
> 📖 **官方文档**：https://ui.shadcn.com/docs/cli

**步骤**：

```bash
# 添加单个组件
npx shadcn@latest add checkbox

# 添加多个组件
npx shadcn@latest add checkbox radio toggle

# 查看可用组件列表
npx shadcn@latest --help
```

**常用组件示例**：

```bash
# 表单相关
npx shadcn@latest add checkbox     # 复选框
npx shadcn@latest add radio        # 单选框
npx shadcn@latest add switch       # 开关

# 选择器
npx shadcn@latest add select       # 下拉选择
npx shadcn@latest add combobox     # 组合框（支持搜索）

# 对话框
npx shadcn@latest add dialog       # 模态对话框
npx shadcn@latest add alert-dialog # 警告对话框

# 弹出/菜单
npx shadcn@latest add popover      # 弹出框
npx shadcn@latest add dropdown-menu # 下拉菜单

# 标签页
npx shadcn@latest add tabs         # 标签页
npx shadcn@latest add accordion    # 手风琴

# 提示
npx shadcn@latest add toast        # 吐司提示
npx shadcn@latest add sonner       # Sonner 吐司库
npx shadcn@latest add tooltip      # 工具提示

# 加载/进度
npx shadcn@latest add progress     # 进度条
npx shadcn@latest add skeleton     # 骨架屏

# 其他
npx shadcn@latest add badge        # 徽章
npx shadcn@latest add avatar       # 头像
npx shadcn@latest add pagination   # 分页
```

**完整组件库**: https://ui.shadcn.com/docs/components/accordion

**CLI 添加后会自动**：
1. 下载组件代码到 `src/components/ui/`
2. 安装必要的依赖
3. 自动更新 `src/components/index.ts`（可选）

**使用添加的组件**：

```tsx
import { Checkbox } from "~components"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~components"

export function MyForm() {
  return (
    <>
      <Checkbox id="agree" />
      <label htmlFor="agree">我同意条款</label>

      <Select>
        <SelectTrigger>
          <SelectValue placeholder="选择选项" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">选项 1</SelectItem>
          <SelectItem value="option2">选项 2</SelectItem>
        </SelectContent>
      </Select>
    </>
  )
}
```

**如果 CLI 出错**：

```bash
# 清除缓存并重试
rm -r node_modules/.pnpm
npx shadcn@latest add checkbox --force

# 或手动复制：访问 https://ui.shadcn.com/docs/components/accordion
# 复制源代码到 src/components/ui/ 目录即可
```

---

## 常见问题

### Q1: 导入时用 `~components` 和 `~/components` 有什么区别？

**A**: 在 `tsconfig.json` 中定义了路径别名：
- `~*` → `./src/*`（最通用）
- `~components/*` → `./src/components/*`（针对 components）

所以两种都可以用，但推荐用 `~components` 更清晰。

```tsx
// 都可以工作
import { Button } from "~components"
import { Button } from "~/components"
import { Button } from "~/components/ui/button"
```

---

### Q2: 如何自定义组件样式？

**A**: 使用 `cn()` 函数和 Tailwind 类名：

```tsx
import { Button } from "~components"
import { cn } from "~/lib/utils"

export function MyButton() {
  return (
    <Button className={cn(
      "bg-gradient-to-r from-blue-500 to-purple-600",
      "hover:shadow-lg"
    )}>
      自定义按钮
    </Button>
  )
}
```

---

### Q3: 如何修改全局主题颜色？

**A**: 编辑 `tailwind.config.js` 的 `theme.extend` 部分：

```javascript
export default {
  theme: {
    extend: {
      colors: {
        primary: "#3b82f6",
        secondary: "#8b5cf6",
      },
    },
  },
}
```

然后在 Tailwind 类名中使用：

```tsx
<Button className="bg-primary hover:bg-secondary">
  自定义颜色按钮
</Button>
```

---

### Q4: 组件库中找不到我需要的组件怎么办？

**A**: 有两个选择：

1. **自己创建**：按 [添加新组件](#添加新组件) 的步骤创建
2. **去 shadcn/ui 官网找**：https://ui.shadcn.com/

shadcn/ui 有 50+ 个预制组件，包括：
- Checkbox、Radio、Toggle
- Select、Combobox
- Dialog、Alert Dialog、Sheet
- Tabs、Accordion
- Toast、Popover
- 等等...

当 CLI 问题解决后，可以用 CLI 快速添加这些组件。

---

### Q5: 开发时如何启动项目？

**A**:
```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run package  # 打包为 .zip（用于发布到商店）
```

---

### Q6: 我的组件有 TypeScript 错误怎么办？

**A**: 检查以下几点：

1. **检查类型导入**：
```tsx
import { Button } from "~components"
import type { ButtonProps } from "~components"  // ✅ 用 type 导入类型

export function MyButton(props: ButtonProps) {
  return <Button {...props} />
}
```

2. **检查 tsconfig.json 的路径别名是否正确**

3. **重启 VS Code** 让 TypeScript 服务器重新检查

---

## 🎯 开发规范建议

### 文件位置指南

| 文件类型 | 放在哪里 | 示例 |
|---------|---------|------|
| 基础 UI 组件 | `src/components/ui/` | `button.tsx`, `input.tsx` |
| 自定义 React Hooks | `src/hooks/` | `useClipboard.ts` |
| 复合业务组件 | `src/view/` | `ClipForm.tsx`, `ClipList.tsx` |
| 工具函数 | `src/lib/` | `utils.ts`, `constants.ts` |
| 页面/入口 | `src/` | `popup.tsx`, `options.tsx` |

### 导入顺序规范（Prettier 会自动排序）

```tsx
// 1. React 和外部库
import React, { useState } from "react"

// 2. 空行

// 3. shadcn/ui 和 Plasmo
import { useStorage } from "@plasmohq/storage"

// 4. 空行

// 5. 项目内部导入（用别名）
import { Button, Card } from "~components"
import { cn } from "~/lib/utils"
import { useClipboard } from "~/hooks"

// 6. 空行

// 7. 样式
import "./style.css"
```

---

## 📖 有用的资源

- **Tailwind CSS 文档**：https://tailwindcss.com/docs
- **shadcn/ui 官网**：https://ui.shadcn.com/
- **Radix UI 文档**：https://www.radix-ui.com/
- **Plasmo 文档**：https://docs.plasmo.com/

---

## ❓ 还有问题？

如果遇到问题，请检查：

1. ✅ 确保所有依赖都已安装（`npm install`）
2. ✅ 确保开发服务器正在运行（`npm run dev`）
3. ✅ 尝试重启 VS Code 和开发服务器
4. ✅ 检查浏览器控制台和终端的错误信息

---

**最后更新**: 2025-11-23
