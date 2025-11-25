// src/plasmo.d.ts

// 声明所有以 `data-text:` 开头的模块都导出 string 类型
declare module 'data-text:*' {
  const content: string
  export default content
}

// 如果您还使用了其他 Plasmo 模块，也可以在这里添加声明，例如：
// declare module 'url:*' {
//   const url: string
//   export default url
// }