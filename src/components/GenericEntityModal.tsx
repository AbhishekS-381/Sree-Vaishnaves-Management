"use client"

import { useState, useActionState, useEffect, useRef } from 'react'
import { X, Loader2 } from 'lucide-react'

export type FieldDef = {
  name: string
  label: string
  type: 'text' | 'number' | 'color' | 'select' | 'checkbox' | 'time'
  required?: boolean
  options?: { label: string, value: string }[]
  defaultValue?: any
  placeholder?: string
}

type Props = {
  isOpen: boolean
  onClose: () => void
  title: string
  fields: FieldDef[]
  addAction: (prevState: any, fd: FormData) => Promise<any>
  updateAction?: (prevState: any, fd: FormData) => Promise<any>
  editData?: any
  hiddenFields?: Record<string, string>
}

const initialState: any = { message: '', error: '' }

export function GenericEntityModal({ isOpen, onClose, title, fields, addAction, updateAction, editData, hiddenFields }: Props) {
  const isEditing = !!editData;
  const actionToUse = isEditing && updateAction ? updateAction : addAction;
  const [state, formAction, isPending] = useActionState(actionToUse, initialState);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Auto-close on success
  useEffect(() => {
    if (state?.success && isOpen) {
      onCloseRef.current();
    }
  }, [state?.success, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="relative w-full max-w-md max-h-[90vh] flex flex-col bg-[#1e1b2e] rounded-2xl border border-[#3b3054] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 pointer-events-auto">
          <div className="flex items-center justify-between p-6 border-b border-[#3b3054]">
            <h2 className="text-xl font-bold text-white">
              {isEditing ? `Edit ${title}` : `Add New ${title}`}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-[#252033] rounded-lg text-slate-400 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form action={formAction} className="p-6 space-y-4 flex-1 overflow-y-auto">
            {isEditing && <input type="hidden" name="id" value={editData.id} />}
            {hiddenFields && Object.entries(hiddenFields).map(([key, val]) => (
               <input key={key} type="hidden" name={key} value={val} />
            ))}

            {fields.map((field) => (
              <div key={field.name}>
                {field.type === 'checkbox' ? (
                  <label className="flex items-center gap-3 text-sm font-medium text-slate-300 cursor-pointer p-2 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors">
                     <input
                       type="checkbox"
                       name={field.name}
                       defaultChecked={isEditing ? editData[field.name] : field.defaultValue}
                       className="w-4 h-4 rounded border-[#3b3054] text-primary focus:ring-primary bg-[#131018]"
                     />
                     {field.label}
                  </label>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">{field.label}</label>
                    {field.type === 'select' ? (
                      <select
                        name={field.name}
                        defaultValue={isEditing ? editData[field.name] : field.defaultValue || ''}
                        required={field.required}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
                      >
                        <option value="">Select {field.label}</option>
                        {field.options?.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : field.type === 'color' ? (
                      <div className="flex items-center gap-3">
                         <input
                           type="color"
                           name={field.name}
                           defaultValue={isEditing ? editData[field.name] : field.defaultValue || '#64748b'}
                           className="h-10 w-16 p-1 rounded bg-[#131018] border border-[#3b3054] cursor-pointer"
                         />
                         <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Select Color</span>
                      </div>
                    ) : (
                      <input
                        type={field.type}
                        name={field.name}
                        defaultValue={isEditing ? editData[field.name] : field.defaultValue || ''}
                        required={field.required}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none placeholder:text-slate-600"
                      />
                    )}
                  </>
                )}
              </div>
            ))}

            {state?.error && (
              <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-red-300 text-sm font-medium text-center">
                {state.error}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-3 bg-[#c084fc] text-[#131018] font-bold rounded-xl hover:bg-[#d8b4fe] transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : `Create ${title}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
