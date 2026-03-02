import { useState, useEffect } from 'react'
import { X, CheckCircle2, XCircle, Clock } from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'
import LogsTable from '../components/logs/LogsTable'
import { ChatService } from '../services/apiServices'

export default function Logs() {
  const [logs, setLogs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [selectedLog, setSelectedLog] = useState(null)
  const clearSelectedLog = () => setSelectedLog(null)

  useEffect(() => {
    ChatService.getAllActionLogs()
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [])

  const STATUS_ICON = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    error:   <XCircle className="w-5 h-5 text-red-400" />,
    pending: <Clock className="w-5 h-5 text-yellow-400" />,
  }

  const todaySuccess = logs.filter(l => {
    const isToday = new Date(l.created_at).toDateString() === new Date().toDateString()
    return isToday && l.status === 'success'
  }).length

  const todayErrors = logs.filter(l => {
    const isToday = new Date(l.created_at).toDateString() === new Date().toDateString()
    return isToday && l.status === 'error'
  }).length

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Execution Logs</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            All AI tool executions and metadata operations
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Logs',    value: logs.length,    color: 'text-slate-100' },
          { label: 'Today Success', value: todaySuccess,   color: 'text-emerald-400' },
          { label: 'Today Errors',  value: todayErrors,    color: todayErrors > 0 ? 'text-red-400' : 'text-slate-400' },
          { label: 'Pending',       value: logs.filter(l => l.status === 'pending').length, color: 'text-yellow-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card">
            <p className={clsx('text-2xl font-bold', color)}>{loading ? '—' : value}</p>
            <p className="text-[12px] text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <LogsTable logs={logs} loading={loading} onSelectLog={setSelectedLog} />

      {/* Detail slide-over */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end animate-fade-in" onClick={clearSelectedLog}>
          <div
            className="w-full max-w-lg bg-slate-900 border-l border-slate-700 h-full overflow-y-auto shadow-panel animate-slide-in-right"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <h2 className="text-base font-semibold text-slate-100">Log Details</h2>
              <button onClick={clearSelectedLog} className="btn-ghost p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Status header */}
              <div className="flex items-center gap-3">
                {STATUS_ICON[selectedLog.status]}
                <div>
                  <p className="text-base font-semibold text-slate-100 capitalize">{selectedLog.status}</p>
                  <p className="text-[12px] text-slate-500">
                    {format(new Date(selectedLog.created_at), 'PPpp')}
                  </p>
                </div>
              </div>

              {/* Details grid */}
              <div className="space-y-0 divide-y divide-slate-800 rounded-xl border border-slate-800 overflow-hidden">
                {[
                  ['Log ID', selectedLog.id],
                  ['Tool', selectedLog.tool_name],
                  ['Session', selectedLog.session_id?.slice(-8)],
                  ['Status', selectedLog.status],
                  ['Duration', selectedLog.duration_ms != null ? `${selectedLog.duration_ms}ms` : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between px-4 py-3 bg-slate-900/60">
                    <span className="text-[12px] text-slate-500">{k}</span>
                    <span className="text-[13px] text-slate-200 font-medium text-right ml-4 max-w-[60%] truncate">{v}</span>
                  </div>
                ))}
              </div>

              {/* Params */}
              {selectedLog.params_json && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Parameters</p>
                  <pre className="bg-slate-950 rounded-xl p-4 font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap border border-slate-800">
                    {JSON.stringify(JSON.parse(selectedLog.params_json), null, 2)}
                  </pre>
                </div>
              )}

              {/* Result / Error */}
              {selectedLog.status === 'error' && selectedLog.error && (
                <div>
                  <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wider mb-2">Error</p>
                  <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-4">
                    <p className="text-[13px] text-red-300">{selectedLog.error}</p>
                  </div>
                </div>
              )}
              {selectedLog.result_json && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Result</p>
                  <pre className="bg-slate-950 rounded-xl p-4 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-64 whitespace-pre-wrap border border-slate-800">
                    {JSON.stringify(JSON.parse(selectedLog.result_json), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

