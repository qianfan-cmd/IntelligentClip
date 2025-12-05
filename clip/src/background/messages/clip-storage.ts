import type { PlasmoMessaging } from "@plasmohq/messaging"
import {
  clipDB,
  ensureDBReady,
  generateUUID,
  type Clip,
  type ClipImage,
  type Folder
} from "@/lib/clip-db"

/**
 * Background script handler for clip storage operations
 * 
 * 【设计说明】
 * Content Script 中使用 IndexedDB 会绑定到当前网页的 origin，
 * 导致不同网站之间数据不共享。通过在 Background Script 中执行
 * 所有 IndexedDB 操作，可以确保数据存储在扩展的 origin 下，
 * 实现跨网站的数据共享。
 * 
 * 【支持的操作】
 * ClipStore:
 *   - clips:getAll, clips:getById, clips:getByUrl, clips:getBySource
 *   - clips:getByFolder, clips:getPaginated, clips:add, clips:update
 *   - clips:delete, clips:deleteMany, clips:addImage, clips:removeImage
 *   - clips:moveToFolder, clips:moveManyToFolder, clips:search, clips:count
 *   - clips:clearAll
 * 
 * FolderStore:
 *   - folders:getAll, folders:getById, folders:create, folders:rename
 *   - folders:update, folders:delete, folders:getClipCount, folders:clearAll
 */

type StorageAction = 
  // ClipStore actions
  | "clips:getAll"
  | "clips:getById"
  | "clips:getByUrl"
  | "clips:getBySource"
  | "clips:getByFolder"
  | "clips:getPaginated"
  | "clips:add"
  | "clips:update"
  | "clips:delete"
  | "clips:deleteMany"
  | "clips:addImage"
  | "clips:removeImage"
  | "clips:moveToFolder"
  | "clips:moveManyToFolder"
  | "clips:search"
  | "clips:count"
  | "clips:clearAll"
  // FolderStore actions
  | "folders:getAll"
  | "folders:getById"
  | "folders:create"
  | "folders:rename"
  | "folders:update"
  | "folders:delete"
  | "folders:getClipCount"
  | "folders:clearAll"

interface StorageRequest {
  action: StorageAction
  payload?: any
}

interface StorageResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

const handler: PlasmoMessaging.MessageHandler<StorageRequest, StorageResponse> = async (req, res) => {
  const { action, payload } = req.body || {} as StorageRequest
  
  if (!action) {
    res.send({ success: false, error: "Missing action" })
    return
  }
  
  console.log(`[ClipStorage] Action: ${action}`, payload ? JSON.stringify(payload).slice(0, 100) : "")
  
  try {
    await ensureDBReady()
    
    let result: any
    
    switch (action) {
      // ============================================
      // ClipStore Operations
      // ============================================
      
      case "clips:getAll": {
        result = await clipDB.clips
          .orderBy("createdAt")
          .reverse()
          .toArray()
        break
      }
      
      case "clips:getById": {
        const { id } = payload
        result = await clipDB.clips.get(id)
        break
      }
      
      case "clips:getByUrl": {
        const { url } = payload
        result = await clipDB.clips
          .where("url")
          .equals(url)
          .first()
        break
      }
      
      case "clips:getBySource": {
        const { source } = payload
        result = await clipDB.clips
          .where("source")
          .equals(source)
          .reverse()
          .sortBy("createdAt")
        break
      }
      
      case "clips:getByFolder": {
        const { folderId } = payload
        if (folderId === undefined || folderId === null) {
          result = await clipDB.clips
            .filter(c => c.folderId === undefined || c.folderId === null)
            .reverse()
            .sortBy("createdAt")
        } else {
          result = await clipDB.clips
            .where("folderId")
            .equals(folderId)
            .reverse()
            .sortBy("createdAt")
        }
        break
      }
      
      case "clips:getPaginated": {
        const { page = 1, pageSize = 50 } = payload || {}
        const total = await clipDB.clips.count()
        const offset = (page - 1) * pageSize
        
        const clips = await clipDB.clips
          .orderBy("createdAt")
          .reverse()
          .offset(offset)
          .limit(pageSize)
          .toArray()
        
        result = {
          clips,
          total,
          hasMore: offset + clips.length < total
        }
        break
      }
      
      case "clips:add": {
        const clipData = payload as Omit<Clip, "id" | "createdAt">
        const newClip: Clip = {
          ...clipData,
          id: generateUUID(),
          createdAt: Date.now()
        }
        await clipDB.clips.add(newClip)
        console.log("[ClipStorage] Clip added:", newClip.id)
        result = newClip
        break
      }
      
      case "clips:update": {
        const { id, updates } = payload
        const updateData = {
          ...updates,
          updatedAt: Date.now()
        }
        const count = await clipDB.clips.update(id, updateData)
        if (count === 0) {
          result = null
        } else {
          result = await clipDB.clips.get(id)
        }
        break
      }
      
      case "clips:delete": {
        const { id } = payload
        await clipDB.clips.delete(id)
        console.log("[ClipStorage] Clip deleted:", id)
        result = true
        break
      }
      
      case "clips:deleteMany": {
        const { ids } = payload
        await clipDB.clips.bulkDelete(ids)
        console.log("[ClipStorage] Clips deleted:", ids.length)
        result = true
        break
      }
      
      case "clips:addImage": {
        const { clipId, image } = payload as { clipId: string; image: ClipImage }
        const clip = await clipDB.clips.get(clipId)
        if (!clip) {
          result = null
        } else {
          const images = clip.images || []
          images.push(image)
          await clipDB.clips.update(clipId, {
            images,
            updatedAt: Date.now()
          })
          result = await clipDB.clips.get(clipId)
        }
        break
      }
      
      case "clips:removeImage": {
        const { clipId, imageIndex } = payload
        const clip = await clipDB.clips.get(clipId)
        if (!clip) {
          result = null
        } else {
          const images = [...(clip.images || [])]
          if (imageIndex < 0 || imageIndex >= images.length) {
            result = null
          } else {
            images.splice(imageIndex, 1)
            await clipDB.clips.update(clipId, {
              images,
              updatedAt: Date.now()
            })
            result = await clipDB.clips.get(clipId)
          }
        }
        break
      }
      
      case "clips:moveToFolder": {
        const { clipId, folderId } = payload
        const count = await clipDB.clips.update(clipId, {
          folderId,
          updatedAt: Date.now()
        })
        result = count > 0 ? await clipDB.clips.get(clipId) : null
        break
      }
      
      case "clips:moveManyToFolder": {
        const { clipIds, folderId } = payload
        const now = Date.now()
        await clipDB.transaction('rw', clipDB.clips, async () => {
          for (const id of clipIds) {
            await clipDB.clips.update(id, { folderId, updatedAt: now })
          }
        })
        console.log("[ClipStorage] Moved clips to folder:", clipIds.length, folderId)
        result = true
        break
      }
      
      case "clips:search": {
        const { keyword } = payload
        if (!keyword || !keyword.trim()) {
          result = await clipDB.clips
            .orderBy("createdAt")
            .reverse()
            .toArray()
        } else {
          const lowerKeyword = keyword.toLowerCase()
          result = await clipDB.clips
            .filter(clip => {
              const title = (clip.title || "").toLowerCase()
              const summary = (clip.summary || "").toLowerCase()
              const snippet = (clip.rawTextSnippet || "").toLowerCase()
              return title.includes(lowerKeyword) ||
                     summary.includes(lowerKeyword) ||
                     snippet.includes(lowerKeyword)
            })
            .reverse()
            .sortBy("createdAt")
        }
        break
      }
      
      case "clips:count": {
        result = await clipDB.clips.count()
        break
      }
      
      case "clips:clearAll": {
        await clipDB.clips.clear()
        console.warn("[ClipStorage] All clips cleared!")
        result = true
        break
      }
      
      // ============================================
      // FolderStore Operations
      // ============================================
      
      case "folders:getAll": {
        result = await clipDB.folders
          .orderBy("createdAt")
          .toArray()
        break
      }
      
      case "folders:getById": {
        const { id } = payload
        result = await clipDB.folders.get(id)
        break
      }
      
      case "folders:create": {
        const { name, color } = payload
        const newFolder: Folder = {
          id: generateUUID(),
          name,
          createdAt: Date.now(),
          color
        }
        await clipDB.folders.add(newFolder)
        console.log("[ClipStorage] Folder created:", newFolder.id)
        result = newFolder
        break
      }
      
      case "folders:rename": {
        const { id, newName } = payload
        const count = await clipDB.folders.update(id, { name: newName })
        result = count > 0 ? await clipDB.folders.get(id) : null
        break
      }
      
      case "folders:update": {
        const { id, updates } = payload
        const count = await clipDB.folders.update(id, updates)
        result = count > 0 ? await clipDB.folders.get(id) : null
        break
      }
      
      case "folders:delete": {
        const { id } = payload
        await clipDB.transaction('rw', [clipDB.folders, clipDB.clips], async () => {
          await clipDB.folders.delete(id)
          await clipDB.clips
            .where("folderId")
            .equals(id)
            .modify({ folderId: undefined })
        })
        console.log("[ClipStorage] Folder deleted:", id)
        result = true
        break
      }
      
      case "folders:getClipCount": {
        const { folderId } = payload
        result = await clipDB.clips
          .where("folderId")
          .equals(folderId)
          .count()
        break
      }
      
      case "folders:clearAll": {
        await clipDB.folders.clear()
        console.warn("[ClipStorage] All folders cleared!")
        result = true
        break
      }
      
      default:
        throw new Error(`Unknown action: ${action}`)
    }
    
    res.send({ success: true, data: result })
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[ClipStorage] Error in ${action}:`, errorMessage)
    res.send({ success: false, error: errorMessage })
  }
}

export default handler
