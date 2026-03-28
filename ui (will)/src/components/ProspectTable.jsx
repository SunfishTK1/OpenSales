import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STAGE_STYLES = {
  research:       { color: '#52525b', background: '#f4f4f5', border: '1.5px solid #52525b' },
  outreach:       { color: '#1d4ed8', background: '#eff6ff', border: '1.5px solid #1d4ed8' },
  responded:      { color: '#92400e', background: '#fef3c7', border: '1.5px solid #92400e' },
  discovery_call: { color: '#6d28d9', background: '#f5f3ff', border: '1.5px solid #6d28d9' },
  high_intent:    { color: '#c2410c', background: '#fff7ed', border: '1.5px solid #c2410c' },
  demo:           { color: '#be185d', background: '#fdf2f8', border: '1.5px solid #be185d' },
  negotiation:    { color: '#b91c1c', background: '#fef2f2', border: '1.5px solid #b91c1c' },
  pilot:          { color: '#0f766e', background: '#f0fdfa', border: '1.5px solid #0f766e' },
  closed:         { color: '#166534', background: '#f0fdf4', border: '1.5px solid #166534' },
}

const STATUS_STYLES = {
  active:   { color: '#166534', background: '#f0fdf4', border: '1.5px solid #166534' },
  rejected: { color: '#b91c1c', background: '#fef2f2', border: '1.5px solid #b91c1c' },
  cold:     { color: '#71717a', background: '#f4f4f5', border: '1.5px solid #71717a' },
}

const SORT_OPTIONS = [
  { value: 'recent',      label: 'Most Recent' },
  { value: 'intent_desc', label: 'Intent: High → Low' },
  { value: 'intent_asc',  label: 'Intent: Low → High' },
  { value: 'score_desc',  label: 'Score: High → Low' },
  { value: 'score_asc',   label: 'Score: Low → High' },
]

const STAGE_OPTIONS = ['all', 'research', 'outreach', 'responded', 'discovery_call', 'high_intent', 'demo', 'negotiation', 'pilot', 'closed']
const STATUS_OPTIONS = ['all', 'active', 'rejected', 'cold']

function Badge({ label, styleObj }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 3,
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      ...styleObj,
    }}>
      {label}
    </span>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '7px 10px', fontSize: 12, fontWeight: 600,
          border: '2px solid #09090b', borderRadius: 4,
          background: '#fff', color: '#09090b', cursor: 'pointer', outline: 'none',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export default function ProspectTable({ onSelect }) {
  const [prospects, setProspects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [stageFilter, setStageFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    supabase.from('prospects').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setProspects(data ?? []); setLoading(false) })

    const ch = supabase.channel('prospects-table')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospects' }, () => {
        supabase.from('prospects').select('*').order('created_at', { ascending: false })
          .then(({ data }) => setProspects(data ?? []))
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const activeFilterCount = [stageFilter !== 'all', statusFilter !== 'all', sortBy !== 'recent'].filter(Boolean).length

  const filtered = prospects
    .filter(p => !filter || [p.name, p.company, p.stage, p.email].some(v => v?.toLowerCase().includes(filter.toLowerCase())))
    .filter(p => stageFilter === 'all' || p.stage === stageFilter)
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .sort((a, b) => {
      if (sortBy === 'intent_desc') return (b.intent_score ?? 0) - (a.intent_score ?? 0)
      if (sortBy === 'intent_asc')  return (a.intent_score ?? 0) - (b.intent_score ?? 0)
      if (sortBy === 'score_desc')  return (b.score ?? 0) - (a.score ?? 0)
      if (sortBy === 'score_asc')   return (a.score ?? 0) - (b.score ?? 0)
      return new Date(b.created_at) - new Date(a.created_at)
    })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#09090b', letterSpacing: '-0.3px', margin: 0, textTransform: 'uppercase' }}>Prospects</h1>
          <p style={{ fontSize: 12, color: '#71717a', margin: '4px 0 0', fontWeight: 500 }}>{prospects.length} total in pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search prospects..."
            style={{
              padding: '7px 12px', fontSize: 12, fontWeight: 500,
              border: '2px solid #09090b', borderRadius: 4,
              background: '#fff', outline: 'none', width: 200, color: '#09090b',
            }}
          />
          <button
            onClick={() => setShowFilters(v => !v)}
            className="nb-btn-sm"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', fontSize: 11, fontWeight: 700,
              border: '2px solid #09090b',
              borderRadius: 4,
              background: activeFilterCount > 0 ? '#09090b' : '#fff',
              color: activeFilterCount > 0 ? '#fff' : '#09090b',
              cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              boxShadow: '3px 3px 0 0 rgba(0,0,0,1)',
              transition: 'transform 0.05s, box-shadow 0.05s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M2 4h12M4 8h8M6 12h4" strokeLinecap="round"/>
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span style={{
                background: '#fff', color: '#09090b', borderRadius: 10,
                fontSize: 9, fontWeight: 700, padding: '1px 5px', lineHeight: 1.4,
              }}>{activeFilterCount}</span>
            )}
          </button>
        </div>
      </div>

      {showFilters && (
        <div style={{
          background: '#fff',
          border: '2px solid #09090b',
          boxShadow: '4px 4px 0 0 rgba(0,0,0,1)',
          borderRadius: 6,
          padding: '16px 18px', marginBottom: 14,
          display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          <FilterSelect label="Sort by" value={sortBy} onChange={setSortBy}
            options={SORT_OPTIONS.map(o => ({ value: o.value, label: o.label }))} />
          <FilterSelect label="Stage" value={stageFilter} onChange={setStageFilter}
            options={STAGE_OPTIONS.map(v => ({ value: v, label: v === 'all' ? 'All stages' : v.replace('_', ' ') }))} />
          <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter}
            options={STATUS_OPTIONS.map(v => ({ value: v, label: v === 'all' ? 'All statuses' : v }))} />
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setSortBy('recent'); setStageFilter('all'); setStatusFilter('all') }}
              className="nb-btn-sm"
              style={{
                padding: '7px 14px', fontSize: 11, fontWeight: 700,
                border: '2px solid #09090b', borderRadius: 4,
                background: '#fff', color: '#09090b', cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                alignSelf: 'flex-end',
                boxShadow: '3px 3px 0 0 rgba(0,0,0,1)',
                transition: 'transform 0.05s, box-shadow 0.05s',
              }}
            >
              Reset
            </button>
          )}
        </div>
      )}

      <div style={{
        background: '#fff',
        border: '2px solid #09090b',
        boxShadow: '4px 4px 0 0 rgba(0,0,0,1)',
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#71717a', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Loading...</div>
        ) : !filtered.length ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#71717a', fontSize: 12, fontWeight: 500 }}>
            {filter || activeFilterCount > 0 ? 'No prospects match your filters.' : 'No prospects yet. They\'ll appear once the AI starts researching.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #09090b' }}>
                {['Name', 'Company', 'Stage', 'Score', 'Intent', 'Status'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left', fontWeight: 700,
                    fontSize: 9, color: '#71717a', textTransform: 'uppercase',
                    letterSpacing: '0.1em', background: '#f5f5f0',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p)}
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid #e4e4e7' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f5f0'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ fontWeight: 700, color: '#09090b' }}>{p.name || '—'}</div>
                    {p.title && <div style={{ fontSize: 10, color: '#71717a', marginTop: 2, fontWeight: 500 }}>{p.title}</div>}
                  </td>
                  <td style={{ padding: '11px 16px', color: '#3f3f46', fontWeight: 500 }}>{p.company || '—'}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <Badge label={p.stage?.replace('_', ' ')} styleObj={STAGE_STYLES[p.stage] ?? STAGE_STYLES.research} />
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <ScoreBar value={p.score ?? 0} />
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <ScoreBar value={p.intent_score ?? 0} color="#ea580c" />
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <Badge label={p.status} styleObj={STATUS_STYLES[p.status] ?? STATUS_STYLES.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function ScoreBar({ value, color = '#09090b' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ width: 52, height: 6, background: '#f5f5f0', border: '1px solid #d4d4d8', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#52525b', width: 24 }}>{value}</span>
    </div>
  )
}
