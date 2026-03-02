import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { ChatService } from '../../services/apiServices'

const STATUS_CONFIG = {
  success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-900/10 border-emerald-900/30' },
  error:   { icon: XCircle,      color: 'text-red-400',     bg: 'bg-red-900/10 border-red-900/30'         },
  pending: { icon: Clock,        color: 'text-yellow-400',  bg: 'bg-yellow-900/10 border-yellow-900/30'   },
}

function LogItem({ log }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending
  const Icon = cfg.icon

  let params = null
  try { params = log.params_json ? JSON.parse(log.params_json) : null } catch {}
  let result = null
  try { result = log.result_json ? JSON.parse(log.result_json) : null } catch {}

  return (
    <div className={clsx('border rounded-xl p-3 text-[12px]', cfg.bg)}>
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <Icon className={clsx('w-3.5 h-3.5 flex-shrink-0', cfg.color)} />
        <span className="font-mono text-slate-200 flex-1 truncate">{log.tool_name}</span>
        {log.duration_ms != null && (
          <span className="text-slate-500 text-[10px] flex-shrink-0">{log.duration_ms}ms</span>
        )}
        {expanded
          ? <ChevronDown className="w-3 h-3 text-slate-500" />
          : <ChevronRight className="w-3 h-3 text-slate-500" />
        }
      </div>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {params && (
            <div>
              <p className="text-[10px] text-slate-500 mb-0.5">Params</p>
              <pre className="text-[10px] text-slate-300 bg-slate-900/60 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(params, null, 2)}
              </pre>
            </div>
          )}
          {log.status === 'error' && log.error && (
            <div>
              <p className="text-[10px] text-red-400 mb-0.5">Error</p>
              <p className="text-[11px] text-red-300">{log.error}</p>
            </div>
          )}
          {result && log.status === 'success' && (
            <div>
              <p className="text-[10px] text-slate-500 mb-0.5">Result</p>
              <pre className="text-[10px] text-slate-300 bg-slate-900/60 rounded p-2 overflow-x-auto max-h-32 whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ActionPreview({ actionLogs = [], sessionId }) {
  const [historicLogs, setHistoricLogs] = useState([])

  // Load historic logs when a session is selected
  useEffect(() => {
    if (!sessionId) { setHistoricLogs([]); return }
    ChatService.getSessionLogs(sessionId)
      .then(setHistoricLogs)
      .catch(() => setHistoricLogs([]))
  }, [sessionId])

  // Live logs (from actionLogs prop) override historic when same id
  const merged = (() => {
    const map = new Map()
    historicLogs.forEach(l => map.set(l.id, l))
    actionLogs.forEach(l => map.set(l.id, l))
    return [...map.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  })()

  const pendingCount = merged.filter(l => l.status === 'pending').length

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <h3 className="text-sm font-semibold text-slate-100">Tool Executions</h3>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="badge badge-yellow">{pendingCount} running</span>
          )}
          {merged.length > 0 && (
            <span className="text-[11px] text-slate-500">{merged.length} total</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {merged.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No tool calls yet</p>
            <p className="text-[12px] text-slate-600 mt-1">
              Salesforce tool executions appear here in real time
            </p>
          </div>
        ) : (
          merged.map(log => <LogItem key={log.id} log={log} />)
        )}
      </div>
    </div>
  )
}

