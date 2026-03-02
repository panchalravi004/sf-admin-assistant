import { useState, useEffect } from 'react'
import { MessageSquare, Trash2, Plus, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { ChatService } from '../../services/apiServices'

export default function ChatHistory({ sfOrgId, currentSessionId, onSelectSession }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    if (!sfOrgId) { setSessions([]); return }
    setLoading(true)
    ChatService.getSessions(sfOrgId)
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [sfOrgId])

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation()
    await ChatService.deleteSession(sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (currentSessionId === sessionId) onSelectSession?.(null)
  }

  const handleNew = () => {
    onSelectSession?.(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <h3 className="text-sm font-semibold text-slate-100">Sessions</h3>
        <button onClick={handleNew} className="btn-ghost p-1.5" title="New Session">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
          </div>
        ) : !sfOrgId ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[12px] text-slate-500">Select an org to view sessions</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-500">No sessions yet</p>
          </div>
        ) : (
          sessions.map(session => (
            <button
              key={session.id}
              onClick={() => onSelectSession?.(session.id)}
              className={clsx(
                'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-l-2 group',
                currentSessionId === session.id
                  ? 'bg-slate-800/60 border-brand-500'
                  : 'border-transparent hover:bg-slate-800/30 hover:border-slate-600'
              )}
            >
              <MessageSquare className={clsx(
                'w-4 h-4 mt-0.5 flex-shrink-0',
                currentSessionId === session.id ? 'text-brand-400' : 'text-slate-500'
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-200 truncate">{session.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-500">
                    {formatDistanceToNow(new Date(session.updated_at || session.created_at), { addSuffix: true })}
                  </span>
                  {session.messageCount != null && (
                    <>
                      <span className="text-[10px] text-slate-600">·</span>
                      <span className="text-[10px] text-slate-500">{session.messageCount} msgs</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={e => handleDelete(e, session.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-900/40 text-slate-500 hover:text-red-400 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

