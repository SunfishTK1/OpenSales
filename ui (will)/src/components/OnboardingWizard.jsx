import { useState } from 'react'
import { supabase } from '../lib/supabase'

const STEPS = [
  { key: 'company_name',      label: 'Company name',          placeholder: 'Acme Corp' },
  { key: 'industry',          label: 'Industry',              placeholder: 'SaaS, HR Tech, Fintech...' },
  { key: 'target_market',     label: 'Who is your buyer?',    placeholder: 'Mid-market HR teams, 200–2000 employees' },
  { key: 'value_proposition', label: 'Value proposition',     placeholder: 'We reduce time-to-hire by 40% with AI workforce analytics' },
  { key: 'goal',              label: 'Sales goal',            placeholder: '20 enterprise demos/month, $500K ARR this year' },
  { key: 'tone',              label: 'Outreach tone',         placeholder: 'Professional but direct. No fluff.' },
  { key: 'commission_rate',   label: 'Commission rate (%)',   placeholder: '15', type: 'number' },
]

export default function OnboardingWizard({ onClose, onComplete }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const current = STEPS[step]
  const value = answers[current?.key] ?? ''
  const isLast = step === STEPS.length - 1

  function next() { if (step < STEPS.length - 1) setStep(s => s + 1); else submit() }
  function back() { if (step > 0) setStep(s => s - 1) }

  async function submit() {
    setSaving(true)
    await supabase.from('company_config').insert({
      company_name: answers.company_name,
      industry: answers.industry,
      target_market: answers.target_market,
      value_proposition: answers.value_proposition,
      goal: answers.goal,
      tone: answers.tone,
      commission_rate: parseFloat(answers.commission_rate) || null,
    })
    setSaving(false)
    setDone(true)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 10, width: '100%', maxWidth: 480,
          border: '1px solid #e4e4e7',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px 0',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Company Setup · {done ? 'Complete' : `${step + 1} / ${STEPS.length}`}
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#09090b', margin: 0, letterSpacing: '-0.2px' }}>
              {done ? 'You\'re set up.' : 'Tell us about your business'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', fontSize: 20, lineHeight: 1, padding: 0, marginTop: 2 }}
          >×</button>
        </div>

        {/* Progress */}
        <div style={{ padding: '12px 22px 0' }}>
          <div style={{ height: 2, background: '#f4f4f5', borderRadius: 1 }}>
            <div style={{
              height: '100%', borderRadius: 1, background: '#2563eb',
              width: `${done ? 100 : (step / STEPS.length) * 100}%`,
              transition: 'width 0.25s ease',
            }} />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 22px', minHeight: 130 }}>
          {done ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: '#f0fdf4',
                border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>✓</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#09090b' }}>Config saved to Supabase</div>
                <div style={{ fontSize: 13, color: '#71717a', marginTop: 2 }}>The AI agent will use this to personalize all outreach.</div>
              </div>
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: 13.5, fontWeight: 500, color: '#09090b', marginBottom: 8 }}>
                {current.label}
              </label>
              <input
                autoFocus
                type={current.type ?? 'text'}
                placeholder={current.placeholder}
                value={value}
                onChange={e => setAnswers(prev => ({ ...prev, [current.key]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter' && value.trim()) next() }}
                style={{
                  width: '100%', padding: '9px 12px', fontSize: 14,
                  border: '1px solid #e4e4e7', borderRadius: 6, outline: 'none',
                  color: '#09090b', background: '#fff',
                  boxShadow: '0 0 0 0px #2563eb',
                  transition: 'border-color 0.1s, box-shadow 0.1s',
                }}
                onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#e4e4e7'; e.target.style.boxShadow = '0 0 0 0px transparent' }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid #f4f4f5',
        }}>
          {!done ? (
            <>
              <button
                onClick={back}
                disabled={step === 0}
                style={{
                  background: 'none', border: 'none', cursor: step === 0 ? 'default' : 'pointer',
                  fontSize: 13, color: step === 0 ? '#d4d4d8' : '#71717a', padding: 0, fontWeight: 500,
                }}
              >← Back</button>
              <button
                onClick={next}
                disabled={!value.trim() || saving}
                style={{
                  padding: '8px 18px', fontSize: 13.5, fontWeight: 600,
                  background: !value.trim() || saving ? '#e4e4e7' : '#09090b',
                  color: !value.trim() || saving ? '#a1a1aa' : '#fff',
                  border: 'none', borderRadius: 6, cursor: !value.trim() || saving ? 'default' : 'pointer',
                  transition: 'background 0.1s',
                }}
              >{saving ? 'Saving...' : isLast ? 'Finish' : 'Continue'}</button>
            </>
          ) : (
            <button
              onClick={onClose}
              style={{
                marginLeft: 'auto', padding: '8px 18px', fontSize: 13.5, fontWeight: 600,
                background: '#09090b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
              }}
            >Done</button>
          )}
        </div>
      </div>
    </div>
  )
}
