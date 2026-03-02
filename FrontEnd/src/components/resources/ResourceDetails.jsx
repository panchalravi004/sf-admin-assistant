import { Box, Hash, Shield, Code2, GitBranch, ExternalLink, Copy, ChevronRight, Check } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

const MOCK_DETAILS = {
  'Account': {
    type: 'Standard Object',
    apiName: 'Account',
    label: 'Account',
    fieldsCount: 87,
    customFieldsCount: 23,
    recordCount: '45,231',
    description: 'Represents an individual account, which is an organization or person involved with your business.',
    fields: [
      { name: 'Id', type: 'ID', required: true, custom: false },
      { name: 'Name', type: 'Text(255)', required: true, custom: false },
      { name: 'Industry', type: 'Picklist', required: false, custom: false },
      { name: 'AnnualRevenue', type: 'Currency', required: false, custom: false },
      { name: 'Legacy_ID__c', type: 'Text(18)', required: false, custom: true, lastUsed: 'Never' },
      { name: 'Segment__c', type: 'Picklist', required: false, custom: true, lastUsed: '3 days ago' },
    ]
  },
  'Fields': {
    type: 'Metadata Collection',
    description: 'All fields for this object.',
  },
  'Validation Rules': {
    type: 'Metadata Collection',
    description: 'Business rules that verify data before committing.',
  },
  'System Administrator': {
    type: 'Profile',
    apiName: 'Admin',
    usersAssigned: 8,
    description: 'Full administrative access to all Salesforce features and data.',
    permissions: [
      { name: 'Modify All Data', enabled: true, risk: 'critical' },
      { name: 'Manage Users', enabled: true, risk: 'high' },
      { name: 'View All Data', enabled: true, risk: 'high' },
      { name: 'API Enabled', enabled: true, risk: 'low' },
    ]
  },
  'AccountTriggerHandler': {
    type: 'Apex Class',
    apiName: 'AccountTriggerHandler',
    lines: 284,
    coverage: '73%',
    lastModified: '2024-01-15',
    description: 'Handler class for Account trigger. Processes before and after insert/update operations.',
  },
}

export default function ResourceDetails({ selected }) {
  const [copied, setCopied] = useState(false)

  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
          <Box className="w-6 h-6 text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-400 mb-1">Select a resource</p>
        <p className="text-[12px] text-slate-600">Click any item in the explorer to view its details</p>
      </div>
    )
  }

  const detail = MOCK_DETAILS[selected.name] || {
    type: selected.hasChildren ? 'Category' : 'Resource',
    apiName: selected.name.replace(/\s/g, '_'),
    description: `Details for ${selected.name} in the selected org.`,
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(detail.apiName || selected.name)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-5 py-4 border-b border-slate-800 flex-shrink-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-[11px] text-slate-500 mb-2">
          {selected.path?.split('/').map((part, i, arr) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3" />}
              <span className={i === arr.length - 1 ? 'text-slate-300' : ''}>{part}</span>
            </span>
          ))}
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{selected.name}</h2>
            <span className="badge badge-gray mt-1">{detail.type}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {detail.apiName && (
              <button onClick={handleCopy} className="btn-ghost text-[12px]" title="Copy API name">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
            <button className="btn-ghost text-[12px]" title="Open in Salesforce">
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-4 space-y-5">
        {/* Description */}
        {detail.description && (
          <p className="text-[13px] text-slate-400 leading-relaxed">{detail.description}</p>
        )}

        {/* Key stats */}
        {(detail.fieldsCount || detail.usersAssigned || detail.lines) && (
          <div className="grid grid-cols-3 gap-2">
            {detail.fieldsCount && (
              <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                <p className="text-base font-bold text-slate-100">{detail.fieldsCount}</p>
                <p className="text-[10px] text-slate-500">Total Fields</p>
              </div>
            )}
            {detail.customFieldsCount && (
              <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                <p className="text-base font-bold text-slate-100">{detail.customFieldsCount}</p>
                <p className="text-[10px] text-slate-500">Custom Fields</p>
              </div>
            )}
            {detail.recordCount && (
              <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                <p className="text-base font-bold text-slate-100">{detail.recordCount}</p>
                <p className="text-[10px] text-slate-500">Records</p>
              </div>
            )}
            {detail.usersAssigned && (
              <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                <p className="text-base font-bold text-slate-100">{detail.usersAssigned}</p>
                <p className="text-[10px] text-slate-500">Users</p>
              </div>
            )}
            {detail.lines && (
              <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                <p className="text-base font-bold text-slate-100">{detail.lines}</p>
                <p className="text-[10px] text-slate-500">Lines</p>
              </div>
            )}
            {detail.coverage && (
              <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                <p className="text-base font-bold text-slate-100">{detail.coverage}</p>
                <p className="text-[10px] text-slate-500">Coverage</p>
              </div>
            )}
          </div>
        )}

        {/* Fields list */}
        {detail.fields && (
          <div>
            <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Fields</h4>
            <div className="space-y-1">
              {detail.fields.map(field => (
                <div key={field.name} className="flex items-center justify-between px-3 py-2
                  rounded-lg bg-slate-800/40 hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-2">
                    <Hash className="w-3 h-3 text-slate-600" />
                    <span className={clsx(
                      'text-[13px] font-mono',
                      field.custom ? 'text-brand-400' : 'text-slate-300'
                    )}>{field.name}</span>
                    {field.custom && <span className="badge badge-blue text-[9px]">custom</span>}
                    {field.required && <span className="badge badge-red text-[9px]">required</span>}
                    {field.lastUsed === 'Never' && <span className="badge badge-yellow text-[9px]">unused</span>}
                  </div>
                  <span className="text-[11px] text-slate-500">{field.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Permissions list */}
        {detail.permissions && (
          <div>
            <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Permissions</h4>
            <div className="space-y-1">
              {detail.permissions.map(perm => (
                <div key={perm.name} className="flex items-center justify-between px-3 py-2
                  rounded-lg bg-slate-800/40">
                  <div className="flex items-center gap-2">
                    <div className={clsx('w-1.5 h-1.5 rounded-full', perm.enabled ? 'bg-emerald-400' : 'bg-slate-600')} />
                    <span className="text-[13px] text-slate-300">{perm.name}</span>
                  </div>
                  <span className={clsx('badge', {
                    critical: 'badge-red',
                    high: 'badge-yellow',
                    low: 'badge-gray',
                  }[perm.risk])}>
                    {perm.risk}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
