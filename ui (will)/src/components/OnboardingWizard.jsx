import { useState } from 'react'
import { supabase } from '../lib/supabase'

const STEPS = [
  { key: 'company_name', label: "What's your company name?", placeholder: 'Acme Corp' },
  { key: 'industry', label: "What industry are you in?", placeholder: 'SaaS / HR Tech / Fintech...' },
  { key: 'target_market', label: "Who is your target customer?", placeholder: 'Mid-market HR teams, 200–2000 employees' },
  { key: 'value_proposition', label: "What's your core value proposition?", placeholder: 'We reduce time-to-hire by 40% using AI-powered workforce analytics' },
  { key: 'goal', label: "What's your sales goal?", placeholder: '20 enterprise demos per month, $500K ARR by end of year' },
  { key: 'tone', label: "What tone should the AI use in outreach?", placeholder: 'Professional but conversational, not salesy' },
  { key: 'commission_rate', label: "What commission rate do you offer? (%)", placeholder: '15' },
]

export default function OnboardingWizard({ onClose, onComplete }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const current = STEPS[step]
  const value = answers[current?.key] ?? ''

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      handleSubmit()
    }
  }

  function handleBack() {
    if (step > 0) setStep(s => s - 1)
  }

  async function handleSubmit() {
    setSaving(true)
    const payload = {
      company_name: answers.company_name,
      industry: answers.industry,
      target_market: answers.target_market,
      value_proposition: answers.value_proposition,
      goal: answers.goal,
      tone: answers.tone,
      commission_rate: parseFloat(answers.commission_rate) || null,
    }
    await supabase.from('company_config').insert(payload)
    setSaving(false)
    setDone(true)
    onComplete?.(payload)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Company Setup</div>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-2xl leading-none">×</button>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Tell us about your business</h2>
          <p className="text-sm text-gray-500 mt-1">The AI will use this to personalize outreach and decisions.</p>
        </div>

        {/* Progress bar */}
        <div className="px-8">
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${done ? 100 : ((step) / STEPS.length) * 100}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-1">{done ? 'Complete' : `Step ${step + 1} of ${STEPS.length}`}</div>
        </div>

        <div className="px-8 py-6 min-h-[160px]">
          {done ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">🎉</div>
              <div className="text-lg font-semibold text-gray-800">You're all set!</div>
              <div className="text-sm text-gray-500 mt-1">Company config saved. The AI is ready to start selling.</div>
            </div>
          ) : (
            <div>
              <label className="block text-base font-medium text-gray-700 mb-3">{current.label}</label>
              <input
                autoFocus
                type={current.key === 'commission_rate' ? 'number' : 'text'}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={current.placeholder}
                value={value}
                onChange={e => setAnswers(prev => ({ ...prev, [current.key]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter' && value.trim()) handleNext() }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex items-center justify-between">
          {!done ? (
            <>
              <button
                onClick={handleBack}
                disabled={step === 0}
                className="text-sm text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleNext}
                disabled={!value.trim() || saving}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving...' : step === STEPS.length - 1 ? 'Finish' : 'Next →'}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="ml-auto px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Start Selling
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
