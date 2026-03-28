import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const ACTION_META = {
  email_draft:   { label: 'Email Drafted',       color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', accent: '#2563eb' },
  research:      { label: 'Research',             color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe', accent: '#7c3aed' },
  score:         { label: 'Scored',               color: '#92400e', bg: '#fef3c7', border: '#fde68a', accent: '#f59e0b' },
  stage_change:  { label: 'Stage Updated',        color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', accent: '#22c55e' },
  schedule_call: { label: 'Call Scheduled',       color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4', accent: '#14b8a6' },
  intent_score:  { label: 'Intent Scored',        color: '#c2410c', bg: '#fff7ed', border: '#fed7aa', accent: '#f97316' },
  spin_demo:     { label: 'Demo Generated',       color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8', accent: '#ec4899' },
}

const ALL_ACTIONS = ['all', ...Object.keys(ACTION_META)]

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

function formatDate(ts) {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function ActivityFeed() {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [prospects, setProspects] = useState({})
  const [actionFilter, setActionFilter] = useState('all')
  const prospectsRef = useRef({})

  useEffect(() => {
    async function init() {
      const [{ data: runData }, { data: prospectData }] = await Promise.all([
        supabase.from('agent_runs').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('prospects').select('id, name, company'),
      ])
      setRuns(runData ?? [])
      const pMap = {}
      ;(prospectData ?? []).forEach(p => { pMap[p.id] = p })
      prospectsRef.current = pMap
      setProspects(pMap)
      setLoading(false)
    }
    init()

    const ch = supabase.channel('agent-runs-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_runs' }, ({ new: row }) => {
        setRuns(prev => [row, ...prev])
        if (row.prospect_id && !prospectsRef.current[row.prospect_id]) {
          supabase.from('prospects').select('id, name, company').eq('id', row.prospect_id).single()
            .then(({ data }) => {
              if (data) {
                prospectsRef.current = { ...prospectsRef.current, [data.id]: data }
                setProspects(prev => ({ ...prev, [data.id]: data }))
              }
            })
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const filtered = actionFilter === 'all' ? runs : runs.filter(r => r.action === actionFilter)

  // Group by date
  const grouped = []
  let lastDate = null
  for (const run of filtered) {
    const dateLabel = formatDate(run.created_at)
    if (dateLabel !== lastDate) {
      grouped.push({ type: 'date', label: dateLabel })
      lastDate = dateLabel
    }
    grouped.push({ type: 'run', run })
  }

  if (loading) return (
    <div style={{ padding: 40, color: '#71717a', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Loading...</div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="mono" style={{ fontSize: 20, fontWeight: 700, color: '#09090b', letterSpacing: '-0.3px', margin: 0, textTransform: 'uppercase' }}>Agent Activity</h1>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 3,
            border: '2px solid #16a34a', background: '#f0fdf4',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
            <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live</span>
          </div>
          {runs.length > 0 && (
            <span style={{ fontSize: 11, color: '#71717a', fontWeight: 500 }}>{filtered.length} events</span>
          )}
        </div>

        {/* Action filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALL_ACTIONS.map(action => {
            const meta = ACTION_META[action]
            const isActive = actionFilter === action
            return (
              <button
                key={action}
                onClick={() => setActionFilter(action)}
                style={{
                  padding: '4px 10px', fontSize: 10, fontWeight: 700,
                  borderRadius: 3, cursor: 'pointer',
                  border: isActive
                    ? `2px solid ${meta?.accent ?? '#09090b'}`
                    : '2px solid #e4e4e7',
                  background: isActive ? (meta?.bg ?? '#09090b') : '#fff',
                  color: isActive ? (meta?.color ?? '#fff') : '#71717a',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  transition: 'all 0.1s',
                }}
              >
                {action === 'all' ? 'All' : (meta?.label ?? action.replace(/_/g, ' '))}
              </button>
            )
          })}
        </div>
      </div>

      {!filtered.length ? (
        <div style={{
          background: '#fff', border: '2px solid #09090b',
          boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6,
          padding: 48, textAlign: 'center', color: '#71717a', fontSize: 12, fontWeight: 500,
        }}>
          {actionFilter === 'all' ? 'No agent activity yet. This feed updates in real time.' : `No "${ACTION_META[actionFilter]?.label ?? actionFilter}" events yet.`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {grouped.map((item, idx) => {
            if (item.type === 'date') {
              return (
                <div key={`date-${idx}`} style={{
                  padding: '10px 0 4px', fontSize: 10, fontWeight: 700,
                  color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  {item.label}
                </div>
              )
            }

            const { run } = item
            const p = prospects[run.prospect_id]
            const meta = ACTION_META[run.action] ?? { label: run.action?.replace(/_/g, ' '), color: '#52525b', bg: '#f4f4f5', border: '#e4e4e7', accent: '#71717a' }

            return (
              <div key={run.id} style={{
                background: '#fff', border: '2px solid #09090b',
                boxShadow: '3px 3px 0 0 rgba(0,0,0,1)', borderRadius: 6,
                borderLeft: `4px solid ${meta.accent}`,
                padding: '12px 16px',
                display: 'flex', alignItems: 'flex-start', gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Tags row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: run.reasoning ? 7 : 0, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                      padding: '2px 8px', borderRadius: 3,
                      color: meta.color, background: meta.bg, border: `1.5px solid ${meta.border}`,
                    }}>
                      {meta.label}
                    </span>
                    {p && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 3,
                        color: '#09090b', background: '#f5f5f0', border: '1.5px solid #d4d4d8',
                      }}>
                        {p.name}
                        {p.company && <span style={{ color: '#71717a', fontWeight: 500 }}> · {p.company}</span>}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: '#a1a1aa', fontWeight: 500, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                      {timeAgo(run.created_at)}
                    </span>
                  </div>
                  {/* Reasoning */}
                  {run.reasoning && (
                    <p style={{ fontSize: 12, color: '#52525b', margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
                      {run.reasoning}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
