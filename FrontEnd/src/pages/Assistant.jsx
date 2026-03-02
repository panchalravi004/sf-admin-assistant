import { useState } from 'react'
import { AlertCircle, Building2 } from 'lucide-react'
import clsx from 'clsx'
import ChatWindow from '../components/chat/ChatWindow'
import ChatHistory from '../components/chat/ChatHistory'
import ActionPreview from '../components/chat/ActionPreview'
import { useOrg } from '../context/OrgContext'

export default function Assistant() {
  const { selectedOrg } = useOrg()
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [actionLogs, setActionLogs]             = useState([])

  // Called by ChatWindow when the server returns a new / continuing session id
  const handleSessionChange = (sessionId) => {
    setCurrentSessionId(sessionId)
    setActionLogs([])          // reset logs for the new session
  }

  // Real-time action log updates pushed from ChatWindow via Socket.IO
  const handleActionLog = (log) => {
    setActionLogs(prev => {
      const idx = prev.findIndex(l => l.id === log.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = log
        return updated
      }
      return [...prev, log]
    })
  }

  return (
    <div className="flex flex-col h-full">
      
      {/* 3-panel layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Chat history */}
        <div className="w-64 border-r border-slate-800 bg-slate-950/50 flex-shrink-0 hidden lg:flex flex-col overflow-hidden">
          <ChatHistory
            sfOrgId={selectedOrg?.sf_org_id}
            currentSessionId={currentSessionId}
            onSelectSession={(id) => { setCurrentSessionId(id); setActionLogs([]) }}
          />
        </div>

        {/* Center: Chat interface */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ChatWindow
            selectedOrg={selectedOrg}
            sessionId={currentSessionId}
            onSessionChange={handleSessionChange}
            onActionLog={handleActionLog}
          />
        </div>

        {/* Right: Action preview */}
        <div className="w-72 border-l border-slate-800 bg-slate-950/50 flex-shrink-0 hidden xl:flex flex-col overflow-hidden">
          <ActionPreview actionLogs={actionLogs} sessionId={currentSessionId} />
        </div>
      </div>
    </div>
  )
}

