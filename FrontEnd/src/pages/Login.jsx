import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Zap, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../context/AuthContext'
import { AuthService } from '../services/apiServices'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('Please enter your email and password.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const { user, token } = await AuthService.login(form)
      login(token, user)
      navigate('/')
    } catch (err) {
      setError(err?.message || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left panel – branding */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0
        bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800 p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-100">SF Admin Assistant</span>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 leading-snug">
              AI-powered Salesforce<br />administration
            </h1>
            <p className="text-slate-400 mt-3 text-[15px] leading-relaxed">
              Manage permissions, metadata, and governance across all your orgs from one intelligent dashboard.
            </p>
          </div>

          <div className="space-y-3">
            {[
              'Automated permission audits & cleanup',
              'Natural-language admin actions',
              'Multi-org metadata explorer',
              'Full execution audit trail',
            ].map(item => (
              <div key={item} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-brand-900/60 border border-brand-700/60
                  flex items-center justify-center flex-shrink-0">
                  <ArrowRight className="w-2.5 h-2.5 text-brand-400" />
                </div>
                <span className="text-[13px] text-slate-400">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[12px] text-slate-600">
          © 2026 SF Admin Assistant. All rights reserved.
        </p>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-slate-100">SF Admin Assistant</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-100">Welcome back</h2>
            <p className="text-slate-500 mt-1 text-[14px]">Sign in to your account to continue</p>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-900/20
              border border-red-800/50 mb-5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-[13px] text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-slate-400 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="you@company.com"
                className="input text-[13px]"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="••••••••"
                  className="input text-[13px] pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300
                    transition-colors"
                >
                  {showPassword
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye className="w-4 h-4" />
                  }
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={clsx(
                'btn-primary w-full justify-center py-2.5 text-[14px] mt-2',
                loading && 'opacity-70 cursor-not-allowed'
              )}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign in <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </form>

          <p className="text-center text-[13px] text-slate-500 mt-8">
            Don't have an account?{' '}
            <Link to="/signup" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
