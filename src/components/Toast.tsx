"use client"

import { useCallback, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'info'
export type ToastMessage = { id: number; kind: ToastKind; text: string }

/**
 * Minimal, dependency-free toast. Replaces window.alert() so action failures
 * are visible without blocking the page (alert is especially bad on mobile).
 */
export function useToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([])

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = Date.now() + Math.random()
    setMessages(prev => [...prev, { id, kind, text }])
    setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== id))
    }, kind === 'error' ? 6000 : 3000)
  }, [])

  const dismiss = useCallback((id: number) => {
    setMessages(prev => prev.filter(m => m.id !== id))
  }, [])

  return {
    messages,
    dismiss,
    success: useCallback((t: string) => push('success', t), [push]),
    error: useCallback((t: string) => push('error', t), [push]),
    info: useCallback((t: string) => push('info', t), [push]),
  }
}

const STYLES: Record<ToastKind, string> = {
  success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  error: 'bg-red-500/10 border-red-500/30 text-red-300',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
}

export function ToastStack({
  messages,
  onDismiss,
}: {
  messages: ToastMessage[]
  onDismiss: (id: number) => void
}) {
  if (messages.length === 0) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 max-w-sm"
      role="status"
      aria-live="polite"
      data-testid="toast-stack"
    >
      {messages.map(m => (
        <div
          key={m.id}
          className={`px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm text-sm font-medium flex items-start gap-3 animate-in slide-in-from-bottom-2 ${STYLES[m.kind]}`}
        >
          <span className="flex-1">{m.text}</span>
          <button
            onClick={() => onDismiss(m.id)}
            className="opacity-60 hover:opacity-100 transition-opacity shrink-0"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}
