"use client"

import { useState } from 'react'
import { MapPin, Phone, Plus, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { GenericEntityModal } from '@/components/GenericEntityModal'
import { addBranch, updateBranch, deleteBranch } from '@/app/actions/branches'

type Branch = { 
  id: string; 
  name: string; 
  address: string; 
  phone: string; 
  status?: string;
  internalStartTime?: string;
  internalEndTime?: string;
  customerStartTime?: string;
  customerEndTime?: string;
}

export default function BranchesClientPage({ branches, isReadOnly = false }: { branches: Branch[], isReadOnly?: boolean }) {
  const [modal, setModal] = useState({ open: false, data: null })

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this branch?')) {
      await deleteBranch(id)
    }
  }

  const handleEdit = (e: React.MouseEvent, b: any) => {
    e.preventDefault()
    e.stopPropagation()
    setModal({ open: true, data: b })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Branches</h1>
          <p className="text-slate-400 mt-1">Manage your restaurant locations.</p>
        </div>
        {!isReadOnly && (
          <button
            onClick={() => setModal({ open: true, data: null })}
            className="bg-primary text-[#131018] px-4 py-2 rounded-lg text-sm font-bold hover:bg-accent transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add Branch
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((branch) => (
          <Link href={`/branches/${branch.id}`} key={branch.id} className="block group">
            <div className="bg-card p-6 rounded-2xl border border-card shadow-lg hover:shadow-primary/10 hover:border-primary/30 transition-all cursor-pointer h-full relative flex flex-col">

              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-bold text-white group-hover:text-accent transition-colors">{branch.name}</h3>
                {branch.status && (
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${branch.status === 'operational' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      branch.status === 'maintenance' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                    {branch.status}
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-3 flex-1">
                <div className="flex items-start gap-3 text-slate-400">
                  <MapPin className="h-5 w-5 shrink-0 group-hover:text-accent transition-colors" />
                  <span className="text-sm">{branch.address}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <Phone className="h-5 w-5 shrink-0 group-hover:text-accent transition-colors" />
                  <span className="text-sm">{branch.phone}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
                {!isReadOnly ? (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => handleEdit(e, branch)}
                      className="p-1.5 hover:bg-[#3b3054] rounded-lg text-slate-500 hover:text-white transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, branch.id)}
                      className="p-1.5 hover:bg-red-900/20 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : <div />}
                <span className="text-xs font-semibold text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                  View Details →
                </span>
              </div>
            </div>
          </Link>
        ))}
        {branches.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 text-center py-12 border-2 border-dashed border-[#3b3054] rounded-2xl text-slate-500">
            No branches found. Add one to get started.
          </div>
        )}
      </div>

      <GenericEntityModal
        isOpen={modal.open}
        onClose={() => setModal({ ...modal, open: false })}
        title="Branch"
        editData={modal.data}
        addAction={addBranch}
        updateAction={updateBranch}
        fields={[
          { name: 'name', label: 'Branch Name', type: 'text', required: true, placeholder: 'e.g. Downtown Location' },
          { name: 'address', label: 'Address', type: 'text', required: true, placeholder: 'e.g. 123 Main St' },
          { name: 'phone', label: 'Phone Number', type: 'text', required: true, placeholder: 'e.g. 555-1234' },
          { name: 'status', label: 'Operational Status', type: 'select', required: true, defaultValue: 'operational', options: [
             { label: 'Operational', value: 'operational' },
             { label: 'Closed', value: 'closed' },
             { label: 'Maintenance', value: 'maintenance' }
          ]},
          { name: 'internalStartTime', label: 'Internal Work Start Time', type: 'time', required: false },
          { name: 'internalEndTime', label: 'Internal Work End Time', type: 'time', required: false },
          { name: 'customerStartTime', label: 'Customer Open Time', type: 'time', required: false },
          { name: 'customerEndTime', label: 'Customer Close Time', type: 'time', required: false }
        ]}
      />
    </div>
  )
}
