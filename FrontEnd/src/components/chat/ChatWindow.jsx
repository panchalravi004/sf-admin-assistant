import { useRef, useEffect, useState, useCallback } from 'react'
import { Send, Bot, Plus } from 'lucide-react'
import clsx from 'clsx'
import { io } from 'socket.io-client'
import { API_CONFIG } from '../../services/apiCore'
import { ChatService } from '../../services/apiServices'
import ChatMessage from './ChatMessage'

const QUICK_PROMPTS = [
  'Find users with excessive permissions',
  'Identify unused custom fields',
  'Show inactive users consuming licenses',
  'List Process Builders to migrate',
  'Audit profile duplicates',
  'Analyze Apex class coverage',
]

// Singleton socket — reused across renders
let _socket = null
function getSocket() {
  if (!_socket) {
    _socket = io(API_CONFIG.BASE_URL, { autoConnect: true, transports: ['websocket', 'polling'] })
  }
  return _socket
}

export default function ChatWindow({ selectedOrg, sessionId, onSessionChange, onActionLog }) {
  const [input, setInput]           = useState('')
  const [messages, setMessages]     = useState([])
  const [isSending, setIsSending]   = useState(false)
  const [isTyping, setIsTyping]     = useState(false)
  const messagesEndRef               = useRef(null)
  const inputRef                     = useRef(null)
  const prevSessionRef               = useRef(null)

  // Load messages when sessionId changes
  useEffect(() => {
    if (!sessionId) {
      setMessages([])
      return
    }
    if (sessionId === prevSessionRef.current) return
    prevSessionRef.current = sessionId
    ChatService.getMessages(sessionId)
      .then(msgs => setMessages(msgs.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.created_at,
      }))))
      .catch(() => {})
  }, [sessionId])

  // Socket.IO — join / leave session room for real-time action logs
  useEffect(() => {
    if (!sessionId) return
    const socket = getSocket()
    socket.emit('join_session', sessionId)
    const handler = (log) => onActionLog?.(log)
    socket.on(`action_log`, handler)
    return () => {
      socket.emit('leave_session', sessionId)
      socket.off('action_log', handler)
    }
  }, [sessionId, onActionLog])

  const sendMessage = useCallback(async (text) => {
    if (!selectedOrg?.sf_org_id) return
    const tempId = `tmp_${Date.now()}`
    const userMsg = { id: tempId, role: 'user', content: text, timestamp: new Date().toISOString() }
    setMessages(m => [...m, userMsg])
    setIsSending(true)
    setIsTyping(true)
    try {
      const { sessionId: sid, reply } = await ChatService.sendMessage({
        sfOrgId: selectedOrg.sf_org_id,
        sessionId: sessionId || undefined,
        input_text: text,
      })
      if (sid && sid !== sessionId) onSessionChange?.(sid)
      setIsTyping(false)
      setMessages(m => [...m, {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      }])
    } catch (err) {
      setIsTyping(false)
      setMessages(m => [...m, {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Error: ${err?.message || 'Request failed'}`,
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setIsSending(false)
    }
  }, [selectedOrg, sessionId, onSessionChange])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = async () => {
    if (!input.trim() || isSending) return
    const msg = input.trim()
    setInput('')
    await sendMessage(msg)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleNewSession = () => {
    onSessionChange?.(null)
    setMessages([])
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-900 flex items-center justify-center">
            <Bot className="w-4 h-4 text-brand-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">AI Admin Assistant</p>
            <p className="text-[11px] text-slate-500">
              {messages.length} messages{sessionId ? ` · Session …${sessionId.slice(-6)}` : ' · New session'}
            </p>
          </div>
        </div>
        <button onClick={handleNewSession} className="btn-ghost text-[12px]">
          <Plus className="w-3.5 h-3.5" /> New Session
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
            <div className="w-16 h-16 rounded-2xl bg-brand-900/50 flex items-center justify-center">
              <Bot className="w-8 h-8 text-brand-400" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-semibold text-slate-200 mb-1">Start an admin session</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Ask me to analyze your org, find issues, or execute admin actions for{' '}
                <span className="text-brand-400 font-medium">{selectedOrg?.name || 'the selected org'}</span>.
              </p>
            </div>
            {selectedOrg && (
              <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                {QUICK_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => { setInput(prompt); inputRef.current?.focus() }}
                    className="text-left px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700
                      hover:border-slate-600 rounded-lg text-xs text-slate-300 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
            {isTyping && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-brand-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-brand-400" />
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-5">
                    {[0,1,2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-800 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedOrg ? `Message AI for ${selectedOrg.name}…` : 'Select an org first…'}
              disabled={!selectedOrg}
              rows={1}
              className={clsx(
                'input resize-none pr-12 py-2.5 text-[13px] leading-relaxed',
                'min-h-[40px] max-h-[120px]',
                !selectedOrg && 'opacity-50 cursor-not-allowed'
              )}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending || !selectedOrg}
            className={clsx(
              'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
              input.trim() && !isSending && selectedOrg
                ? 'bg-brand-600 hover:bg-brand-500 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-1.5">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}

