import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STAGE_STYLES = {
  research:       { color: '#52525b', background: '#f4f4f5' },
  outreach:       { color: '#1d4ed8', background: '#eff6ff' },
  responded:      { color: '#92400e', background: '#fef3c7' },
  discovery_call: { color: '#6d28d9', background: '#f5f3ff' },
  high_intent:    { color: '#c2410c', background: '#fff7ed' },
  demo:           { color: '#be185d', background: '#fdf2f8' },
  negotiation:    { color: '#b91c1c', background: '#fef2f2' },
  pilot:          { color: '#0f766e', background: '#f0fdfa' },
  closed:         { color: '#166534', background: '#f0fdf4' },
}

const STATUS_STYLES = {
  active:   { color: '#166534', background: '#f0fdf4' },
  rejected: { color: '#b91c1c', background: '#fef2f2' },
  cold:     { color: '#71717a', background: '#f4f4f5' },
}

function Badge({ label, styleObj }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11.5,
      fontWeight: 500,
      ...styleObj,
    }}>
      {label}
    </span>
  )
}

export default function ProspectTable({ onSelect }) {
  const [prospects, setProspects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

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

  const filtered = prospects.filter(p =>
    !filter || [p.name, p.company, p.stage, p.email].some(v => v?.toLowerCase().includes(filter.toLowerCase()))
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#09090b', letterSpacing: '-0.3px', margin: 0 }}>Prospects</h1>
          <p style={{ fontSize: 13, color: '#71717a', margin: '3px 0 0' }}>{prospects.length} total in pipeline</p>
        </div>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter prospects..."
          style={{
            padding: '7px 12px', fontSize: 13, border: '1px solid #e4e4e7', borderRadius: 6,
            background: '#fff', outline: 'none', width: 200, color: '#09090b',
          }}
        />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#a1a1aa', fontSize: 13 }}>Loading...</div>
        ) : !filtered.length ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#a1a1aa', fontSize: 13 }}>
            {filter ? 'No prospects match your filter.' : 'No prospects yet. They\'ll appear once the AI starts researching.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e4e4e7' }}>
                {['Name', 'Company', 'Stage', 'Score', 'Intent', 'Status'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left', fontWeight: 600,
                    fontSize: 11, color: '#71717a', textTransform: 'uppercase',
                    letterSpacing: '0.05em', background: '#fafafa',
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
                    borderBottom: i < filtered.length - 1 ? '1px solid #f4f4f5' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ fontWeight: 500, color: '#09090b' }}>{p.name || '—'}</div>
                    {p.title && <div style={{ fontSize: 11.5, color: '#a1a1aa', marginTop: 1 }}>{p.title}</div>}
                  </td>
                  <td style={{ padding: '11px 16px', color: '#3f3f46' }}>{p.company || '—'}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <Badge label={p.stage?.replace('_', ' ')} styleObj={STAGE_STYLES[p.stage] ?? STAGE_STYLES.research} />
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <ScoreBar value={p.score ?? 0} />
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <ScoreBar value={p.intent_score ?? 0} color="#f97316" />
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

function ScoreBar({ value, color = '#2563eb' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ width: 52, height: 4, background: '#f4f4f5', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 12, color: '#71717a', width: 24 }}>{value}</span>
    </div>
  )
}
