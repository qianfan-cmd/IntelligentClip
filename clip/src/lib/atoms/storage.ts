/**
 * Plasmo SecureStorage 配置
 * 
 * 【注意】此 storage 主要用于向后兼容旧数据
 * 新代码请使用 @/lib/api-config-store 中的统一存储方案
 * 
 * 已知问题：
 * - SecureStorage 的 setPassword 在某些情况下是异步的
 * - 如果在密码设置完成前读取数据，可能返回 undefined
 * 
 * @deprecated 新代码请使用 @/lib/api-config-store
 */
import { SecureStorage } from "@plasmohq/storage/secure"

export const storage = new SecureStorage()

// 立即设置密码
// TODO: 未来应使用更安全的密码管理方案
storage.setPassword("password")
