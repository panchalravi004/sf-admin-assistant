import { useState } from 'react'
import {
  ChevronRight, ChevronDown, Box, Hash, Shield, Code2,
  GitBranch, Users, Layers, Workflow, FileCode2
} from 'lucide-react'
import clsx from 'clsx'

const RESOURCE_TREE = {
  'Objects': {
    icon: Box,
    children: {
      'Account': {
        icon: Box,
        children: {
          'Fields': { icon: Hash, children: null },
          'Validation Rules': { icon: Shield, children: null },
          'Page Layouts': { icon: Layers, children: null },
        }
      },
      'Contact': {
        icon: Box,
        children: {
          'Fields': { icon: Hash, children: null },
          'Validation Rules': { icon: Shield, children: null },
        }
      },
      'Opportunity': {
        icon: Box,
        children: {
          'Fields': { icon: Hash, children: null },
          'Validation Rules': { icon: Shield, children: null },
          'Page Layouts': { icon: Layers, children: null },
        }
      },
      'Case': {
        icon: Box,
        children: {
          'Fields': { icon: Hash, children: null },
        }
      },
      'Custom Objects (32)': { icon: Box, children: null },
    }
  },
  'Permission Sets': {
    icon: Shield,
    children: {
      'Data_Analyst': { icon: Shield, children: null },
      'Sales_Manager': { icon: Shield, children: null },
      'Read_Only_Access': { icon: Shield, children: null },
    }
  },
  'Profiles': {
    icon: Users,
    children: {
      'System Administrator': { icon: Users, children: null },
      'Standard User': { icon: Users, children: null },
      'Sales Rep': { icon: Users, children: null },
      'Custom Admin': { icon: Users, children: null },
    }
  },
  'Apex Classes': {
    icon: Code2,
    children: {
      'AccountTriggerHandler': { icon: FileCode2, children: null },
      'OpportunityService': { icon: FileCode2, children: null },
      'UserUtility': { icon: FileCode2, children: null },
    }
  },
  'Flows': {
    icon: GitBranch,
    children: {
      'Account_Auto_Update': { icon: Workflow, children: null },
      'Lead_Assign_Flow': { icon: Workflow, children: null },
      'Opportunity_Stage_Alert': { icon: Workflow, children: null },
    }
  },
}

function TreeNode({ name, node, onSelect, selectedPath, path = '' }) {
  const [open, setOpen] = useState(false)
  const currentPath = path ? `${path}/${name}` : name
  const hasChildren = node.children && Object.keys(node.children).length > 0
  const Icon = node.icon || Box
  const isSelected = selectedPath === currentPath
  const isParentSelected = selectedPath?.startsWith(currentPath + '/')

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setOpen(o => !o)
          onSelect({ name, type: name, path: currentPath, hasChildren })
        }}
        className={clsx(
          'flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-[13px] transition-colors group',
          isSelected
            ? 'bg-slate-800 text-slate-100'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
        )}
      >
        {hasChildren
          ? (open
            ? <ChevronDown className="w-3 h-3 flex-shrink-0 text-slate-500" />
            : <ChevronRight className="w-3 h-3 flex-shrink-0 text-slate-500" />)
          : <span className="w-3 flex-shrink-0" />
        }
        <Icon className={clsx(
          'w-3.5 h-3.5 flex-shrink-0',
          isSelected ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-400'
        )} />
        <span className="truncate">{name}</span>
      </button>

      {hasChildren && open && (
        <div className="ml-4 border-l border-slate-800 pl-2 mt-0.5 space-y-0.5">
          {Object.entries(node.children).map(([childName, childNode]) => (
            <TreeNode
              key={childName}
              name={childName}
              node={childNode}
              onSelect={onSelect}
              selectedPath={selectedPath}
              path={currentPath}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ResourceTree({ onSelect, selectedPath }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <p className="text-sm font-semibold text-slate-100">Metadata Explorer</p>
        <p className="text-[11px] text-slate-500 mt-0.5">Click any resource to explore</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {Object.entries(RESOURCE_TREE).map(([name, node]) => (
          <TreeNode
            key={name}
            name={name}
            node={node}
            onSelect={onSelect}
            selectedPath={selectedPath}
          />
        ))}
      </div>
    </div>
  )
}
