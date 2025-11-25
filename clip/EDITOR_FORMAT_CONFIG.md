# 编辑器自动格式化配置指南

本文档提供了在不同编辑器中设置自动格式化的配置指南，确保在使用 `Ctrl+S` 保存文件时自动应用项目的格式化规则。

## VS Code 配置

已在项目中创建了 `.vscode/settings.json` 文件，配置了自动格式化功能。

要使其生效，请确保：

1. 安装 Prettier 扩展: `esbenp.prettier-vscode`
2. 重新加载 VS Code 以应用工作区设置

现在，每次使用 `Ctrl+S` 保存文件时，VS Code 将自动使用项目中的 Prettier 配置进行格式化。

## WebStorm / IntelliJ IDEA 配置

1. 确保已安装 Prettier 插件
2. 打开设置 (File > Settings 或 Ctrl+Alt+S)
3. 导航至 Languages & Frameworks > JavaScript > Prettier
4. 选择 "On save" 选项
5. 确保 "Run for files" 包含相关文件类型

## Sublime Text 配置

1. 安装 Package Control
2. 安装以下包：
   - SublimeJSPrettier
   - JsPrettier
3. 配置 JsPrettier 以使用项目的 .prettierrc.mjs 文件
4. 添加键盘快捷键以在保存时运行格式化

## Vim / Neovim 配置

在你的 `.vimrc` 或 `init.vim` 中添加：

```vim
" 使用 coc.nvim 插件
let g:coc_filetype_map = {
  'typescript': 'typescriptreact',
  'javascript': 'javascriptreact',
}

" 在保存时格式化
au BufWritePre *.js,*.jsx,*.ts,*.tsx,*.json,*.css,*.scss,*.html CocCommand editor.action.formatDocument
```

## Atom 配置

1. 安装 atom-prettier 包
2. 配置为在保存时自动格式化
3. 确保使用项目的 .prettierrc.mjs 配置

## 命令行格式化

你也可以使用以下命令手动格式化整个项目：

```bash
npx prettier --write .
```

## 故障排除

如果自动格式化不工作，请检查：

1. 是否已安装 Prettier 扩展/插件
2. 编辑器是否正确识别了项目的 .prettierrc.mjs 文件
3. 编辑器的格式化设置是否启用了 "保存时格式化" 选项
4. 检查是否有冲突的格式化插件或设置
