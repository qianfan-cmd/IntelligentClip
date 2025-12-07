/**
 * AI 复习助手 - 复习页面
 * 
 * 基于艾宾浩斯记忆曲线的智能复习系统
 */

import React, { useEffect, useState, useCallback, useMemo } from "react"
import { ReviewStore } from "@/lib/review/review-store"
import { generateReviewCards, isCardsCacheValid, getCardTypeLabel, getCardTypeIcon } from "@/lib/review/card-generator"
import { calculateMemoryStrength, formatNextReviewDate, getReviewStatus } from "@/lib/review/sm2-algorithm"
import type { ReviewWithClip, ReviewCard, ReviewRating, ReviewRecord } from "@/lib/review/types"
import { 
  Brain, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Loader2,
  Clock,
  Target,
  Trophy,
  Sparkles,
  ArrowLeft,
  ExternalLink,
  Pause,
  Play,
  SkipForward,
  Trash2,
  Edit,
  Plus
} from "lucide-react"
import { CardEditor } from "@/components/card-editor"
import "../style.css"

// ============================================
// 主题配置
// ============================================

const theme = {
  pageBg: "bg-gradient-to-br from-[#0b1021] via-[#0c1530] to-[#0b1021]",
  cardBg: "bg-[#0f172a] backdrop-blur-md",
  cardBorder: "border border-white/10",
  textPrimary: "text-slate-50",
  textSecondary: "text-slate-200",
  textMuted: "text-slate-400",
  textFaint: "text-slate-500",
  accentPurple: "text-purple-300",
  accentGreen: "text-emerald-300",
  accentYellow: "text-amber-300",
  accentRed: "text-red-300",
}

const DAY_MS = 24 * 60 * 60 * 1000

// ============================================
// 复习页面组件
// ============================================

export default function ReviewPage() {
  // 复习状态
  const [dueReviews, setDueReviews] = useState<ReviewWithClip[]>([])
  const [allReviews, setAllReviews] = useState<ReviewWithClip[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isListView, setIsListView] = useState(false)
  
  // 卡片状态
  const [currentCards, setCurrentCards] = useState<ReviewCard[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isGeneratingCards, setIsGeneratingCards] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  
  // 卡片评分记录（每张卡片的评分）
  const [cardRatings, setCardRatings] = useState<ReviewRating[]>([])
  
  // 统计状态
  const [completedCount, setCompletedCount] = useState(0)
  const [sessionStartTime, setSessionStartTime] = useState(Date.now())
  
  // 完成状态
  const [isComplete, setIsComplete] = useState(false)
  
  // 卡片编辑器状态
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null)
  
  // 目标卡片索引（用于搜索跳转）
  const [targetCardIndex, setTargetCardIndex] = useState<number>(0)
  
  const currentReview = dueReviews[currentIndex]
  const currentCard = currentCards[currentCardIndex]
  
  // 加载复习内容
  useEffect(() => {
    loadAllReviews()
  }, [])
  
  // 当前复习项变化时加载卡片
  useEffect(() => {
    if (currentReview) {
      loadOrGenerateCards(currentReview)
    }
  }, [currentReview?.review.id])
  
  const loadAllReviews = async () => {
    setIsLoading(true)
    try {
      const [all, due] = await Promise.all([
        ReviewStore.getWithClips(),
        ReviewStore.getDueTodayWithClips()
      ])

      setAllReviews(all)
      setDueReviews(due)
      setIsComplete(due.length === 0)
    } catch (err) {
      console.error("Failed to load reviews:", err)
    } finally {
      setIsLoading(false)
    }
  }
  
  const loadOrGenerateCards = async (reviewData: ReviewWithClip) => {
    console.log("[ReviewPage] loadOrGenerateCards", {
      reviewId: reviewData.review.id,
      clipId: reviewData.clip.id,
      hasCached: !!reviewData.review.cards,
      cachedAt: reviewData.review.cardsGeneratedAt,
      cacheValid: isCardsCacheValid(reviewData.review.cardsGeneratedAt),
      targetCardIndex
    })
    // 检查缓存
    if (reviewData.review.cards && isCardsCacheValid(reviewData.review.cardsGeneratedAt)) {
      setCurrentCards(reviewData.review.cards)
      setCurrentCardIndex(targetCardIndex)
      setShowAnswer(false)
      console.log("[ReviewPage] using cached cards", { count: reviewData.review.cards.length, startAt: targetCardIndex })
      return
    }
    
    // 生成新卡片
    setIsGeneratingCards(true)
    try {
      console.log("[ReviewPage] generating cards via AI")
      const cards = await generateReviewCards(reviewData)
      console.log("[ReviewPage] generated cards", { count: cards.length })
      setCurrentCards(cards)
      setCurrentCardIndex(targetCardIndex)
      setShowAnswer(false)
      
      // 缓存卡片
      await ReviewStore.updateCards(reviewData.review.id, cards)
      console.log("[ReviewPage] cached cards to ReviewStore")
    } catch (err) {
      console.error("Failed to generate cards:", err)
      // 使用空卡片
      setCurrentCards([{
        type: 'summary',
        question: '请回顾这篇内容的主要信息',
        answer: reviewData.clip.summary || reviewData.clip.title
      }])
    } finally {
      setIsGeneratingCards(false)
    }
  }
  
  // 处理评分
  const handleRating = async (rating: ReviewRating) => {
    if (!currentReview) return
    
    // 记录当前卡片的评分
    const newRatings = [...cardRatings]
    newRatings[currentCardIndex] = rating
    setCardRatings(newRatings)
    
    console.log("[ReviewPage] card rated", {
      cardIndex: currentCardIndex,
      rating,
      totalCards: currentCards.length,
      ratingsCollected: newRatings.filter(r => r !== undefined).length
    })
    
    // 检查是否还有更多卡片
    const hasMoreCards = currentCardIndex < currentCards.length - 1
    
    if (hasMoreCards) {
      // 如果还有更多卡片，显示下一张卡片
      setCurrentCardIndex(i => i + 1)
      setShowAnswer(false)
    } else {
      // 当前复习项的所有卡片都完成了，计算平均评分并提交
      try {
        // 计算平均评分（四舍五入到最接近的整数评分）
        const validRatings = newRatings.filter(r => r !== undefined) as ReviewRating[]
        const avgRating = validRatings.reduce((sum, r) => sum + r, 0 as number) / validRatings.length
        const finalRating = Math.round(avgRating) as ReviewRating
        
        console.log("[ReviewPage] submitting review", {
          cardRatings: newRatings,
          avgRating,
          finalRating
        })
        
        await ReviewStore.submitReview(currentReview.review.id, finalRating)
        setCompletedCount(c => c + 1)
        
        // 清空评分记录
        setCardRatings([])
        
        // 下一个复习项
        if (currentIndex < dueReviews.length - 1) {
          setTargetCardIndex(0)
          setCurrentIndex(i => i + 1)
          setShowAnswer(false)
          setCurrentCardIndex(0)
        } else {
          setIsComplete(true)
        }
      } catch (err) {
        console.error("Failed to submit review:", err)
      }
    }
  }
  
  // 跳过当前项
  const handleSkip = () => {
    // 清空评分记录
    setCardRatings([])
    
    if (currentIndex < dueReviews.length - 1) {
      setTargetCardIndex(0)
      setCurrentIndex(i => i + 1)
      setShowAnswer(false)
      setCurrentCardIndex(0)
    } else {
      setIsComplete(true)
    }
  }
  
  // 下一张卡片
  const nextCard = () => {
    if (currentCardIndex < currentCards.length - 1) {
      setCurrentCardIndex(i => i + 1)
      setShowAnswer(false)
    }
  }
  
  // 上一张卡片
  const prevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(i => i - 1)
      setShowAnswer(false)
    }
  }

  // 复习计划分组
  const groupedReviews = useMemo(() => {
    const now = Date.now()
    const due: ReviewWithClip[] = []
    const upcoming: ReviewWithClip[] = []
    const paused: ReviewWithClip[] = []

    for (const item of allReviews) {
      if (item.review.paused) {
        paused.push(item)
        continue
      }
      if (item.review.nextReviewDate <= now) {
        due.push(item)
      } else {
        upcoming.push(item)
      }
    }

    const sortByDate = (a: ReviewWithClip, b: ReviewWithClip) => a.review.nextReviewDate - b.review.nextReviewDate
    return {
      due: due.sort(sortByDate),
      upcoming: upcoming.sort(sortByDate),
      paused: paused.sort(sortByDate)
    }
  }, [allReviews])

  const getStatusBadge = (item: ReviewWithClip) => {
    if (item.review.paused) return { label: "已暂停", color: "bg-gray-500/20 text-gray-300" }
    const now = Date.now()
    if (item.review.nextReviewDate <= now) return { label: "待复习", color: "bg-amber-500/20 text-amber-300" }
    return { label: "即将复习", color: "bg-blue-500/20 text-blue-300" }
  }

  const getDistanceLabel = (item: ReviewWithClip) => {
    const diff = item.review.nextReviewDate - Date.now()
    if (item.review.paused) return "已暂停"
    if (diff <= 0) {
      const overdue = Math.ceil(Math.abs(diff) / DAY_MS)
      return overdue > 0 ? `逾期 ${overdue} 天` : "立即复习"
    }
    const days = Math.ceil(diff / DAY_MS)
    if (days === 1) return "明天"
    if (days < 7) return `${days} 天后`
    return `${Math.ceil(days / 7)} 周后`
  }

  const startReviewFrom = (item: ReviewWithClip, initialCardIndex: number = 0) => {
    const baseDue = groupedReviews.due
    const queue = [item, ...baseDue.filter(r => r.review.id !== item.review.id)]

    setTargetCardIndex(initialCardIndex)
    setDueReviews(queue)
    setCurrentIndex(0)
    setCompletedCount(0)
    setSessionStartTime(Date.now())
    setIsComplete(false)
    setIsListView(false)
    setShowAnswer(false)
    setCurrentCardIndex(initialCardIndex)
    setCurrentCards([])
    setCardRatings([])  // 重置评分记录
  }
  
  // ============================================
  // 卡片管理功能
  // ============================================
  
  const handleDeleteCard = async () => {
    if (!currentReview || currentCardIndex === null) return
    
    const confirmed = confirm(`确定要删除这张卡片吗？`)
    if (!confirmed) return
    
    const updatedReview = await ReviewStore.deleteCard(currentReview.review.id, currentCardIndex)
    if (updatedReview) {
      const newCards = updatedReview.cards || []
      setCurrentCards(newCards)
      
      // 如果删除后没有卡片了，切换到下一个复习项
      if (newCards.length === 0) {
        handleSkip()
      } else if (currentCardIndex >= newCards.length) {
        setCurrentCardIndex(newCards.length - 1)
      }
      setShowAnswer(false)
    }
  }
  
  const handleEditCard = () => {
    setEditingCardIndex(currentCardIndex)
    setIsEditorOpen(true)
  }
  
  const handleAddCard = () => {
    setEditingCardIndex(null)
    setIsEditorOpen(true)
  }
  
  const handleSaveCard = async (card: ReviewCard) => {
    if (!currentReview) return
    
    let updatedReview: ReviewRecord | null = null
    
    if (editingCardIndex !== null) {
      // 编辑现有卡片
      updatedReview = await ReviewStore.updateCard(currentReview.review.id, editingCardIndex, card)
    } else {
      // 添加新卡片
      updatedReview = await ReviewStore.addCard(currentReview.review.id, card)
    }
    
    if (updatedReview) {
      setCurrentCards(updatedReview.cards || [])
      if (editingCardIndex === null) {
        // 新增的卡片，跳转到最后一张
        setCurrentCardIndex((updatedReview.cards?.length || 1) - 1)
      }
    }
    
    setIsEditorOpen(false)
    setEditingCardIndex(null)
    setShowAnswer(false)
  }
  
  // ============================================
  // 渲染
  // ============================================
  
  if (isLoading) {
    return (
      <div className={`min-h-screen ${theme.pageBg} flex items-center justify-center`}>
        <div className="text-center">
          <Loader2 className={`h-12 w-12 ${theme.accentPurple} animate-spin mx-auto mb-4`} />
          <p className={theme.textSecondary}>加载复习内容...</p>
        </div>
      </div>
    )
  }
  
  const showCompletion = !isListView && (isComplete || dueReviews.length === 0)
  
  return (
    <div className={`min-h-screen ${theme.pageBg} p-6`}>
      <div className="max-w-3xl mx-auto">
        {/* 卡片编辑器 */}
        {isEditorOpen && (
          <CardEditor
            initialCard={editingCardIndex !== null ? currentCards[editingCardIndex] : undefined}
            onSave={handleSaveCard}
            onCancel={() => {
              setIsEditorOpen(false)
              setEditingCardIndex(null)
            }}
            title={editingCardIndex !== null ? '编辑卡片' : '新建卡片'}
          />
        )}
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className={`text-xl font-bold ${theme.textPrimary}`}>AI 复习助手</h1>
              <p className={`text-sm ${theme.textMuted}`}>
                今日待复习: {dueReviews.length} | 已完成: {completedCount}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {!isListView && dueReviews.length > 0 && (
              <div className="flex items-center gap-2">
                <div className={`text-sm ${theme.textMuted}`}>
                  {currentIndex + 1} / {dueReviews.length}
                </div>
                <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / Math.max(dueReviews.length, 1)) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <button
              onClick={() => setIsListView(v => !v)}
              className="px-3 py-2 rounded-xl bg-white/10 text-sm text-white hover:bg-white/20 transition-colors border border-white/10"
            >
              {isListView ? "返回复习" : "查看全部复习卡片"}
            </button>
          </div>
        </header>
        {isListView ? (
          <ReviewListView 
            grouped={groupedReviews}
            allReviews={allReviews}
            getStatusBadge={getStatusBadge}
            getDistanceLabel={getDistanceLabel}
            onStart={startReviewFrom}
          />
        ) : showCompletion ? (
          <CompletionScreen 
            completedCount={completedCount} 
            sessionDuration={Date.now() - sessionStartTime}
            onBack={() => setIsListView(true)}
          />
        ) : (
          /* Main Card */
          <div className={`${theme.cardBg} ${theme.cardBorder} rounded-2xl overflow-hidden`}>
            {/* Clip Info */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className={`text-lg font-semibold ${theme.textPrimary} truncate`}>
                    {currentReview?.clip.title}
                  </h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full bg-white/10 ${theme.textMuted}`}>
                      {currentReview?.clip.source}
                    </span>
                    <span className={`text-xs ${theme.textFaint}`}>
                      <Clock className="h-3 w-3 inline mr-1" />
                      {new Date(currentReview?.clip.createdAt || 0).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>
                <a 
                  href={currentReview?.clip.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className={`p-2 rounded-lg hover:bg-white/10 ${theme.textMuted} hover:${theme.textPrimary} transition-colors`}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              
              {/* Memory Strength */}
              <div className="mt-4 flex items-center gap-3">
                <span className={`text-xs ${theme.textMuted}`}>记忆强度</span>
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  {(() => {
                    const strength = calculateMemoryStrength(currentReview?.review!)
                    const isNew = currentReview?.review.totalReviews === 0
                    return (
                      <div 
                        className={`h-full transition-all ${
                          isNew 
                            ? 'bg-gray-500' 
                            : 'bg-gradient-to-r from-red-500 via-yellow-500 to-green-500'
                        }`}
                        style={{ width: `${isNew ? 100 : strength}%` }}
                      />
                    )
                  })()}
                </div>
                <span className={`text-xs ${theme.textMuted}`}>
                  {currentReview?.review.totalReviews === 0 
                    ? '待评估' 
                    : `${calculateMemoryStrength(currentReview?.review!)}%`
                  }
                </span>
              </div>
            </div>
            
            {/* Card Content */}
            <div className="p-6 min-h-[300px] flex flex-col">
              {isGeneratingCards ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Sparkles className={`h-8 w-8 ${theme.accentPurple} animate-pulse mx-auto mb-3`} />
                    <p className={theme.textMuted}>AI 正在生成复习卡片...</p>
                  </div>
                </div>
              ) : currentCard ? (
                <>
                  {/* Card Type Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-xs px-2 py-1 rounded-full bg-purple-500/20 ${theme.accentPurple}`}>
                      {getCardTypeIcon(currentCard.type)} {getCardTypeLabel(currentCard.type)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${theme.textFaint}`}>
                        卡片 {currentCardIndex + 1} / {currentCards.length}
                      </span>
                      {/* 卡片操作按钮 */}
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={handleAddCard}
                          className={`p-1.5 rounded-lg hover:bg-green-500/20 ${theme.textMuted} hover:text-green-300 transition-colors`}
                          title="添加新卡片"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={handleEditCard}
                          className={`p-1.5 rounded-lg hover:bg-blue-500/20 ${theme.textMuted} hover:text-blue-300 transition-colors`}
                          title="编辑卡片"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={handleDeleteCard}
                          className={`p-1.5 rounded-lg hover:bg-red-500/20 ${theme.textMuted} hover:text-red-300 transition-colors`}
                          title="删除卡片"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Question */}
                  <div className="flex-1">
                    <h3 className={`text-lg ${theme.textPrimary} mb-4`}>
                      {currentCard.question}
                    </h3>
                    
                    {currentCard.hint && !showAnswer && (
                      <p className={`text-sm ${theme.textFaint} italic`}>
                        💡 提示: {currentCard.hint}
                      </p>
                    )}
                    
                    {/* Answer */}
                    {showAnswer && (
                      <div className={`mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20`}>
                        <p className={`text-sm font-medium ${theme.accentGreen} mb-2`}>答案</p>
                        <p className={`${theme.textSecondary} whitespace-pre-wrap`}>
                          {currentCard.answer}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Card Navigation */}
                  {currentCards.length > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      {currentCards.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setCurrentCardIndex(idx)
                            setShowAnswer(false)
                          }}
                          className={`w-2 h-2 rounded-full transition-all ${
                            idx === currentCardIndex 
                              ? 'bg-purple-500 w-6' 
                              : 'bg-white/20 hover:bg-white/40'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className={theme.textMuted}>无复习卡片</p>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="p-6 border-t border-white/10">
              {!showAnswer ? (
                <div className="flex gap-3">
                  <button
                    onClick={handleSkip}
                    className={`flex-1 py-3 rounded-xl ${theme.textMuted} bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center gap-2`}
                  >
                    <SkipForward className="h-4 w-4" />
                    跳过
                  </button>
                  <button
                    onClick={() => setShowAnswer(true)}
                    className="flex-[3] py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium hover:from-purple-500 hover:to-indigo-500 transition-colors flex items-center justify-center gap-2"
                  >
                    显示答案
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <p className={`text-center text-sm ${theme.textMuted} mb-4`}>
                    你答对了吗？
                    {currentCardIndex < currentCards.length - 1 && (
                      <span className="block mt-1 text-xs text-purple-300">
                        评分后将显示下一张卡片 ({currentCardIndex + 1}/{currentCards.length})
                      </span>
                    )}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    <RatingButton 
                      rating={0}
                      label="忘了"
                      emoji="😵"
                      color="red"
                      onClick={handleRating}
                    />
                    <RatingButton 
                      rating={3}
                      label="困难"
                      emoji="😓"
                      color="yellow"
                      onClick={handleRating}
                    />
                    <RatingButton 
                      rating={4}
                      label="记得"
                      emoji="😊"
                      color="green"
                      onClick={handleRating}
                    />
                    <RatingButton 
                      rating={5}
                      label="简单"
                      emoji="🤩"
                      color="emerald"
                      onClick={handleRating}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 列表视图组件
type GroupedReviews = { due: ReviewWithClip[]; upcoming: ReviewWithClip[]; paused: ReviewWithClip[] }

interface ReviewListViewProps {
  grouped: GroupedReviews
  allReviews: ReviewWithClip[]
  onStart: (item: ReviewWithClip, cardIndex?: number) => void
  getStatusBadge: (item: ReviewWithClip) => { label: string; color: string }
  getDistanceLabel: (item: ReviewWithClip) => string
}

function ReviewListView({ grouped, allReviews, onStart, getStatusBadge, getDistanceLabel }: ReviewListViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{
    review: ReviewRecord
    cardIndex: number
    card: ReviewCard
  }>>([])
  const [isSearching, setIsSearching] = useState(false)
  
  // 搜索卡片
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    
    setIsSearching(true)
    const results = await ReviewStore.searchCards(searchQuery.trim())
    setSearchResults(results)
    setIsSearching(false)
  }
  
  const renderSection = (title: string, items: ReviewWithClip[], emptyText: string, accent: string) => (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold ${theme.textPrimary}`}>{title}</h3>
        <span className={`text-xs ${theme.textMuted}`}>{items.length} 项</span>
      </div>
      {items.length === 0 ? (
        <div className="p-4 rounded-xl border border-white/5 text-center text-sm text-gray-400 bg-white/5">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const strength = calculateMemoryStrength(item.review)
            const badge = getStatusBadge(item)
            return (
              <div key={item.review.id} className={`${theme.cardBg} ${theme.cardBorder} rounded-2xl p-4`}> 
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${badge.color}`}>{badge.label}</span>
                      <span className="text-[11px] text-gray-400">{getDistanceLabel(item)}</span>
                    </div>
                    <h4 className={`text-base font-semibold ${theme.textPrimary} truncate`}>{item.clip.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                      <span className="px-2 py-0.5 rounded-full bg-white/5">{item.clip.source}</span>
                      <span>{formatNextReviewDate(item.review)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => onStart(item)}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-medium hover:from-purple-500 hover:to-indigo-500"
                    >
                      {item.review.nextReviewDate <= Date.now() ? "立即复习" : "提前复习"}
                    </button>
                    <div className="text-[11px] text-gray-400">复习 {item.review.totalReviews} 次</div>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>记忆强度</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" style={{ width: `${strength}%` }} />
                    </div>
                    <span className="text-gray-300">{strength}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    <span>下次复习</span>
                    <span className="text-gray-200">{formatNextReviewDate(item.review)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )

  return (
    <div className={`${theme.cardBg} ${theme.cardBorder} rounded-2xl p-6`}>
      {/* 搜索框 */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索卡片内容..."
            className="flex-1 px-4 py-2 bg-[#1e293b] border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : '搜索'}
          </button>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('')
                setSearchResults([])
              }}
              className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
            >
              清除
            </button>
          )}
        </div>
        
        {/* 搜索结果 */}
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-sm text-slate-400 mb-2">找到 {searchResults.length} 张卡片</div>
            {searchResults.map(({ review, cardIndex, card }, idx) => {
              // 找到对应的 ReviewWithClip 对象
              const reviewWithClip = allReviews.find(r => r.review.id === review.id)
              
              return (
                <div 
                  key={`${review.id}-${cardIndex}`} 
                  onClick={() => {
                    if (reviewWithClip) {
                      onStart(reviewWithClip, cardIndex)
                      // 清除搜索状态
                      setSearchQuery('')
                      setSearchResults([])
                    }
                  }}
                  className="p-3 bg-[#1e293b] border border-white/10 rounded-xl hover:border-purple-500/50 hover:bg-[#1e293b]/80 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                          {getCardTypeLabel(card.type)}
                        </span>
                        <span className="text-xs text-slate-500">卡片 #{cardIndex + 1}</span>
                      </div>
                      <div className="text-sm text-slate-200 mb-1 group-hover:text-purple-200 transition-colors">{card.question}</div>
                      <div className="text-xs text-slate-400 truncate">{card.answer}</div>
                    </div>
                    <div className="flex-shrink-0">
                      <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        
        {searchQuery && searchResults.length === 0 && !isSearching && (
          <div className="mt-4 text-center text-sm text-slate-400 py-4">未找到匹配的卡片</div>
        )}
      </div>
      
      {/* 统计卡片 */} 
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="text-xs text-gray-400 mb-1">待复习</div>
          <div className="text-2xl font-bold text-amber-300">{grouped.due.length}</div>
        </div>
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="text-xs text-gray-400 mb-1">即将复习</div>
          <div className="text-2xl font-bold text-blue-300">{grouped.upcoming.length}</div>
        </div>
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="text-xs text-gray-400 mb-1">已暂停</div>
          <div className="text-2xl font-bold text-gray-200">{grouped.paused.length}</div>
        </div>
      </div>

      {renderSection("待复习", grouped.due, "今天没有待复习内容", "text-amber-300")}
      {renderSection("即将复习", grouped.upcoming, "未来暂无计划", "text-blue-300")}
      {renderSection("已暂停", grouped.paused, "暂无暂停的复习计划", "text-gray-300")}
    </div>
  )
}

// ============================================
// 子组件
// ============================================

interface RatingButtonProps {
  rating: ReviewRating
  label: string
  emoji: string
  color: 'red' | 'yellow' | 'green' | 'emerald'
  onClick: (rating: ReviewRating) => void
}

function RatingButton({ rating, label, emoji, color, onClick }: RatingButtonProps) {
  const colorClasses = {
    red: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30',
    yellow: 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border-yellow-500/30',
    green: 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/30',
    emerald: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30',
  }
  
  return (
    <button
      onClick={() => onClick(rating)}
      className={`py-3 px-2 rounded-xl border transition-all ${colorClasses[color]} flex flex-col items-center gap-1`}
    >
      <span className="text-xl">{emoji}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

interface CompletionScreenProps {
  completedCount: number
  sessionDuration: number
  onBack: () => void
}

function CompletionScreen({ completedCount, sessionDuration, onBack }: CompletionScreenProps) {
  const minutes = Math.floor(sessionDuration / 60000)
  
  return (
    <div className={`min-h-screen ${theme.pageBg} flex items-center justify-center p-6`}>
      <div className={`${theme.cardBg} ${theme.cardBorder} rounded-2xl p-8 max-w-md w-full text-center`}>
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mx-auto mb-6">
          <Trophy className="h-10 w-10 text-white" />
        </div>
        
        <h2 className={`text-2xl font-bold ${theme.textPrimary} mb-2`}>
          {completedCount > 0 ? '太棒了！' : '今日已完成'}
        </h2>
        <p className={`${theme.textMuted} mb-8`}>
          {completedCount > 0 
            ? `你已完成 ${completedCount} 个复习任务` 
            : '没有待复习的内容，休息一下吧！'
          }
        </p>
        
        {completedCount > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className={`p-4 rounded-xl bg-white/5`}>
              <CheckCircle2 className={`h-6 w-6 ${theme.accentGreen} mx-auto mb-2`} />
              <div className={`text-2xl font-bold ${theme.textPrimary}`}>{completedCount}</div>
              <div className={`text-xs ${theme.textMuted}`}>完成数量</div>
            </div>
            <div className={`p-4 rounded-xl bg-white/5`}>
              <Clock className={`h-6 w-6 ${theme.accentPurple} mx-auto mb-2`} />
              <div className={`text-2xl font-bold ${theme.textPrimary}`}>{minutes || '<1'}</div>
              <div className={`text-xs ${theme.textMuted}`}>分钟</div>
            </div>
          </div>
        )}
        
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className={`flex-1 py-3 rounded-xl ${theme.textMuted} bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center gap-2`}
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <button
            onClick={() => window.location.href = chrome.runtime.getURL('tabs/history.html')}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium hover:from-purple-500 hover:to-indigo-500 transition-colors"
          >
            查看全部剪藏
          </button>
        </div>
      </div>
    </div>
  )
}
