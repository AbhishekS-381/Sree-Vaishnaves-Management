'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'
import { Lock, ArrowRight, Loader2 } from 'lucide-react'

const initialState = {
  error: '',
}

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, initialState)

  return (
    <div className="min-h-screen bg-[#131018] flex items-center justify-center p-4">
      <div className="bg-[#1e1b2e] max-w-sm w-full rounded-2xl shadow-[0_0_50px_rgba(192,132,252,0.1)] border border-[#3b3054] overflow-hidden">
        <div className="p-8 pb-6 text-center">
          <div className="mx-auto h-16 w-16 bg-[#3b3054] rounded-2xl flex items-center justify-center text-[#d8b4fe] mb-6 shadow-lg shadow-[#c084fc]/10 ring-1 ring-[#c084fc]/20">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-[#a090b8] text-sm">Enter your username and password to access sree vaishnaves portal.</p>
        </div>

        <form action={formAction} className="p-8 pt-0">
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="sr-only">Username</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="block w-full text-center text-lg font-bold py-3 rounded-xl bg-[#131018] border-2 border-[#3b3054] text-white focus:border-[#c084fc] outline-none transition-all placeholder:font-normal placeholder:text-base placeholder:text-slate-600 mb-4"
                placeholder="Username"
                autoFocus
              />
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="block w-full text-center text-lg font-bold py-3 rounded-xl bg-[#131018] border-2 border-[#3b3054] text-white focus:border-[#c084fc] outline-none transition-all placeholder:font-normal placeholder:text-base placeholder:text-slate-600"
                placeholder="Password"
              />
            </div>

            {state?.error && (
              <div className="text-red-300 text-sm text-center font-medium bg-red-900/20 border border-red-900/30 py-2 rounded-lg">
                {state.error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-[#c084fc] text-[#131018] py-4 rounded-xl font-bold hover:bg-[#d8b4fe] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group shadow-lg shadow-[#c084fc]/20"
            >
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Access Portal
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-[#5a5070]">Sree Vaishnaves v1.0 • Protected System</p>
          </div>
        </form>
      </div>
    </div>
  )
}
