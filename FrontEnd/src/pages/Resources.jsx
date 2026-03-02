import { useState } from 'react'
import { Search } from 'lucide-react'
import ResourceTree from '../components/resources/ResourceTree'
import ResourceDetails from '../components/resources/ResourceDetails'
import { STATIC_ORGS } from '../data/staticData'

export default function Resources() {
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const selectedOrg = STATIC_ORGS[0]

  return (
    <div className="flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-slate-100">Resources Explorer</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            {selectedOrg?.name || 'No org selected'} — Browse metadata
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search metadata…"
            className="input pl-8 text-[13px] py-1.5 w-52"
          />
        </div>
      </div>

      {/* 2-panel layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Tree */}
        <div className="w-64 xl:w-72 border-r border-slate-800 bg-slate-950/50 flex-shrink-0 overflow-hidden">
          <ResourceTree
            onSelect={setSelected}
            selectedPath={selected?.path}
          />
        </div>

        {/* Right: Details */}
        <div className="flex-1 overflow-hidden">
          <ResourceDetails selected={selected} />
        </div>
      </div>
    </div>
  )
}
