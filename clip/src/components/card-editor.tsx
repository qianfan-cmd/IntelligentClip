/**
 * 卡片编辑器 - 用于创建和编辑复习卡片
 */

import React, { useState, useEffect } from "react"
import type { ReviewCard, CardType } from "@/lib/review/types"
import { X, Save, Sparkles } from "lucide-react"
import { getCardTypeLabel, getCardTypeIcon } from "@/lib/review/card-generator"

interface CardEditorProps {
  /** 初始卡片数据（编辑模式） */
  initialCard?: ReviewCard
  /** 保存回调 */
  onSave: (card: ReviewCard) => void
  /** 取消回调 */
  onCancel: () => void
  /** 标题 */
  title?: string
}

const CARD_TYPES: CardType[] = ['qa', 'cloze', 'summary', 'keypoint']

export function CardEditor({ initialCard, onSave, onCancel, title }: CardEditorProps) {
  const [type, setType] = useState<CardType>(initialCard?.type || 'qa')
  const [question, setQuestion] = useState(initialCard?.question || '')
  const [answer, setAnswer] = useState(initialCard?.answer || '')
  const [hint, setHint] = useState(initialCard?.hint || '')

  // 当初始卡片变化时更新状态
  useEffect(() => {
    if (initialCard) {
      setType(initialCard.type)
      setQuestion(initialCard.question)
      setAnswer(initialCard.answer)
      setHint(initialCard.hint || '')
    }
  }, [initialCard])

  const handleSave = () => {
    if (!question.trim() || !answer.trim()) {
      alert('问题和答案不能为空')
      return
    }

    const card: ReviewCard = {
      type,
      question: question.trim(),
      answer: answer.trim(),
      hint: hint.trim() || undefined
    }

    onSave(card)
  }

  const getPlaceholder = (type: CardType, field: 'question' | 'answer') => {
    const placeholders = {
      qa: {
        question: '输入问题，例如：什么是组件化开发？',
        answer: '输入答案，例如：将 UI 拆分为独立、可复用的部分...'
      },
      cloze: {
        question: '输入填空题，用 ___ 表示空白，例如：React 使用 ___ 来管理状态',
        answer: '输入答案，例如：useState Hook'
      },
      summary: {
        question: '输入需要总结的主题，例如：总结这篇文章的核心观点',
        answer: '输入总结内容'
      },
      keypoint: {
        question: '输入要点标题，例如：React Hooks 的关键规则',
        answer: '输入要点列表（可以分多行）'
      }
    }
    return placeholders[type][field]
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#0f172a] border-b border-white/10 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-slate-50">
              {title || (initialCard ? '编辑卡片' : '新建卡片')}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* 卡片类型 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              卡片类型
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CARD_TYPES.map((t) => {
                const Icon = getCardTypeIcon(t)
                const label = getCardTypeLabel(t)
                const isSelected = type === t
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`
                      p-3 rounded-xl border transition-all
                      ${isSelected 
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' 
                        : 'bg-[#1e293b] border-white/5 text-slate-400 hover:border-white/10'
                      }
                    `}
                  >
                    <Icon className="h-5 w-5 mx-auto mb-1" />
                    <div className="text-xs">{label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 问题 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              问题/提示
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={getPlaceholder(type, 'question')}
              className="w-full px-4 py-3 bg-[#1e293b] border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all resize-none"
              rows={3}
            />
          </div>

          {/* 答案 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              答案
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={getPlaceholder(type, 'answer')}
              className="w-full px-4 py-3 bg-[#1e293b] border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all resize-none"
              rows={4}
            />
          </div>

          {/* 提示（可选） */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              提示 <span className="text-slate-500 text-xs">(可选)</span>
            </label>
            <textarea
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="输入提示内容，帮助回忆答案..."
              className="w-full px-4 py-3 bg-[#1e293b] border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all resize-none"
              rows={2}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#0f172a] border-t border-white/10 p-6 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl bg-[#1e293b] text-slate-300 hover:bg-[#334155] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 transition-all flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
