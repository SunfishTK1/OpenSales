import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const ACTION_LABELS = {
  email_draft:   'Email drafted',
  research:      'Research completed',
  score:         'Prospect scored',
  stage_change:  'Stage updated',
  schedule_call: 'Call scheduled',
  intent_score:  'Intent scored',
  spin_demo:     'Demo generated',
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

export default function ActivityFeed() {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [prospects, setProspects] = useState({})
  const prospectsRef = useRef({})

  useEffect(() => {
    async function init() {
      const [{ data: runData }, { data: prospectData }] = await Promise.all([
        supabase.from('agent_runs').select('*').order('created_at', { ascending: false }).limit(50),
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

  if (loading) return <div style={{ padding: 40, color: '#a1a1aa', fontSize: 13 }}>Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#09090b', letterSpacing: '-0.3px', margin: 0 }}>Agent Activity</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ position: 'relative', display: 'inline-block', width: 7, height: 7 }}>
            <span style={{
              position: 'absolute', inset: 0, borderRadius: '50%', background: '#22c55e', opacity: 0.4,
              animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
            }} />
            <span style={{ position: 'relative', display: 'block', width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
          </span>
          <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 500 }}>Live</span>
        </div>
      </div>

      {!runs.length ? (
        <div style={{
          background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8,
          padding: 48, textAlign: 'center', color: '#a1a1aa', fontSize: 13,
        }}>
          No agent activity yet. This feed updates in real time.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {runs.map((run, i) => {
            const p = prospects[run.prospect_id]
            return (
              <div
                key={run.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e4e4e7',
                  borderRadius: i === 0 ? '8px 8px 4px 4px' : i === runs.length - 1 ? '4px 4px 8px 8px' : 4,
                  padding: '12px 16px',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}
              >
                {/* Dot */}
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', background: '#2563eb',
                  marginTop: 5, flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#09090b' }}>
                      {ACTION_LABELS[run.action] ?? run.action?.replace(/_/g, ' ')}
                    </span>
                    {p && (
                      <span style={{
                        fontSize: 11.5, color: '#2563eb', background: '#eff6ff',
                        padding: '1px 7px', borderRadius: 4, fontWeight: 500,
                      }}>
                        {p.name} · {p.company}
                      </span>
                    )}
                    <span style={{ fontSize: 11.5, color: '#a1a1aa', marginLeft: 'auto' }}>
                      {timeAgo(run.created_at)}
                    </span>
                  </div>
                  {run.reasoning && (
                    <p style={{ fontSize: 12.5, color: '#71717a', margin: '4px 0 0', lineHeight: 1.5 }}>
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
