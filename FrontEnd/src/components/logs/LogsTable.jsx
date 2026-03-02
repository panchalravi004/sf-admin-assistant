import { useState } from 'react'
import {
  CheckCircle2, XCircle, Clock, ChevronDown, Filter, X
} from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'

const STATUS_CONFIG = {
  success: { badge: 'badge-green', icon: CheckCircle2, iconColor: 'text-emerald-400' },
  error:   { badge: 'badge-red',   icon: XCircle,       iconColor: 'text-red-400' },
  pending: { badge: 'badge-yellow',icon: Clock,         iconColor: 'text-yellow-400' },
}

const DEFAULT_FILTERS = { status: 'all' }

export default function LogsTable({ logs = [], loading = false, onSelectLog }) {
  const [filters, setFilters]       = useState(DEFAULT_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }))
  const resetFilters = () => setFilters(DEFAULT_FILTERS)

  const filtered = logs.filter(l => {
    if (filters.status !== 'all' && l.status !== filters.status) return false
    return true
  })
  const hasActiveFilters = filters.status !== 'all'

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(o => !o)}
            className={clsx('btn-secondary text-[13px] gap-2', hasActiveFilters && 'border-brand-600 text-brand-400')}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {hasActiveFilters && <span className="w-1.5 h-1.5 bg-brand-400 rounded-full" />}
          </button>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="btn-ghost text-[13px]">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
        <span className="text-[12px] text-slate-500">{filtered.length} results</span>
      </div>

      {/* Filters row */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 p-4 bg-slate-900 border border-slate-800 rounded-xl animate-fade-in">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Status</label>
            <select
              value={filters.status}
              onChange={e => setFilter('status', e.target.value)}
              className="select text-[13px] py-1.5"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="card text-center py-16">
          <div className="w-8 h-8 border-2 border-brand-600/30 border-t-brand-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading logs…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-400">
            {hasActiveFilters ? 'No logs match your filters' : 'No logs yet'}
          </p>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="btn-ghost mt-3 text-[13px]">Clear filters</button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="table-header">Timestamp</th>
                  <th className="table-header">Tool</th>
                  <th className="table-header">Session</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Duration</th>
                  <th className="table-header text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => {
                  const statusCfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending
                  const StatusIcon = statusCfg.icon
                  return (
                    <tr key={log.id} className="table-row">
                      <td className="table-cell whitespace-nowrap text-[12px] text-slate-400">
                        {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                      </td>
                      <td className="table-cell">
                        <span className="text-[11px] font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                          {log.tool_name}
                        </span>
                      </td>
                      <td className="table-cell text-[12px] text-slate-500">
                        …{log.session_id?.slice(-8)}
                      </td>
                      <td className="table-cell">
                        <span className={clsx('badge flex items-center gap-1 w-fit', statusCfg.badge)}>
                          <StatusIcon className={clsx('w-2.5 h-2.5', statusCfg.iconColor)} />
                          {log.status}
                        </span>
                      </td>
                      <td className="table-cell text-[12px] text-slate-500">
                        {log.duration_ms != null ? `${log.duration_ms}ms` : '—'}
                      </td>
                      <td className="table-cell text-right">
                        <button
                          onClick={() => onSelectLog?.(log)}
                          className="btn-ghost text-[12px] py-1 px-2"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

