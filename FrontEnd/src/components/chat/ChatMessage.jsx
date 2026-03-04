import { Bot, User, CheckCircle2, XCircle } from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'

function RiskBadge({ risk }) {
  const map = { low: 'badge-green', medium: 'badge-yellow', high: 'badge-red' }
  return <span className={clsx('badge', map[risk] || 'badge-gray')}>{risk} risk</span>
}

function ActionCard({ action }) {
  const isExecuted = action.status !== 'pending'
  return (
    <div className={clsx(
      'mt-3 rounded-xl border p-3 text-sm',
      action.status === 'approved' ? 'bg-emerald-900/20 border-emerald-800/50' :
      action.status === 'rejected' ? 'bg-slate-800/40 border-slate-700/60 opacity-60' :
      'bg-slate-900 border-slate-700'
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <p className="font-medium text-slate-100 text-[13px]">{action.title}</p>
          <p className="text-slate-400 text-[12px] mt-0.5">{action.description}</p>
        </div>
        <RiskBadge risk={action.risk} />
      </div>
      <p className="text-[11px] text-slate-500 mb-3">
        Affects <span className="text-slate-300 font-medium">{action.affectedCount}</span> records
      </p>
      {!isExecuted ? (
        <div className="flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-800/50 transition-colors">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
          </button>
          <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 transition-colors">
            <XCircle className="w-3.5 h-3.5" /> Reject
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {action.status === 'approved'
            ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400 text-[12px]">Approved for execution</span></>
            : <><XCircle className="w-3.5 h-3.5 text-slate-500" /><span className="text-slate-500 text-[12px]">Rejected</span></>
          }
        </div>
      )}
    </div>
  )
}

/** Parse a markdown table block into { headers, rows } */
function parseTable(lines) {
  const dataLines = lines.filter((_, i) => {
    // skip separator rows like |---|---|
    return !/^\|[\s|:-]+\|$/.test(lines[i])
  })
  const parseRow = (line) =>
    line.replace(/^\||\|$/g, '').split('|').map(c => c.trim())

  const [headerLine, ...bodyLines] = dataLines
  return {
    headers: parseRow(headerLine),
    rows: bodyLines.map(parseRow),
  }
}

function MarkdownTable({ lines }) {
  const { headers, rows } = parseTable(lines)
  return (
    <div className="overflow-x-auto my-2 rounded-lg border border-slate-700">
      <table className="min-w-full text-[12px]">
        <thead>
          <tr className="bg-slate-800/80 border-b border-slate-700">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-slate-300 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={clsx('border-b border-slate-800 last:border-0', ri % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-900/20')}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function inlineFormat(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-100">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="bg-slate-800 text-brand-300 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>')
}

/** Split content into table blocks and text blocks, render each appropriately */
function MessageContent({ content }) {
  const lines = content.split('\n')
  const blocks = []
  let currentText = []
  let currentTable = []
  let inTable = false

  const flushText = () => {
    if (currentText.length) {
      blocks.push({ type: 'text', lines: [...currentText] })
      currentText = []
    }
  }
  const flushTable = () => {
    if (currentTable.length) {
      blocks.push({ type: 'table', lines: [...currentTable] })
      currentTable = []
    }
  }

  for (const line of lines) {
    const isTableRow = /^\|.+\|/.test(line.trim())
    if (isTableRow) {
      if (!inTable) { flushText(); inTable = true }
      currentTable.push(line)
    } else {
      if (inTable) { flushTable(); inTable = false }
      currentText.push(line)
    }
  }
  if (inTable) flushTable(); else flushText()

  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'table') {
          return <MarkdownTable key={i} lines={block.lines} />
        }
        const html = block.lines.map(inlineFormat).join('<br />')
        return (
          <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
        )
      })}
    </>
  )
}

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'
  const time = message.timestamp ? format(new Date(message.timestamp), 'HH:mm') : ''

  return (
    <div className={clsx('flex items-start gap-3 animate-fade-in', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={clsx(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        isUser ? 'bg-brand-700' : 'bg-brand-900'
      )}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-white" />
          : <Bot className="w-3.5 h-3.5 text-brand-400" />
        }
      </div>

      {/* Bubble */}
      <div className={clsx('max-w-[80%] flex flex-col', isUser && 'items-end')}>
        <div className={clsx(
          'rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed',
          isUser
            ? 'bg-brand-700 text-white rounded-tr-sm'
            : 'bg-slate-800 text-slate-200 rounded-tl-sm'
        )}>
          {isUser
            ? <span dangerouslySetInnerHTML={{ __html: inlineFormat(message.content) }} />
            : <MessageContent content={message.content} />
          }
        </div>

        {!isUser && message.actions?.length > 0 && (
          <div className="w-full">
            {message.actions.map(action => <ActionCard key={action.id} action={action} />)}
          </div>
        )}

        <span className="text-[10px] text-slate-600 mt-1 px-1">{time}</span>
      </div>
    </div>
  )
}
