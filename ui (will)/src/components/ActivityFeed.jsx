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

  if (loading) return (
    <div style={{ padding: 40, color: '#71717a', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      Loading...
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h1 className="mono" style={{ fontSize: 20, fontWeight: 700, color: '#09090b', letterSpacing: '-0.3px', margin: 0, textTransform: 'uppercase' }}>Agent Activity</h1>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 10px', borderRadius: 3,
          border: '2px solid #16a34a', background: '#f0fdf4',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
          <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live</span>
        </div>
      </div>

      {!runs.length ? (
        <div style={{
          background: '#fff',
          border: '2px solid #09090b',
          boxShadow: '4px 4px 0 0 rgba(0,0,0,1)',
          borderRadius: 6,
          padding: 48, textAlign: 'center', color: '#71717a', fontSize: 12, fontWeight: 500,
        }}>
          No agent activity yet. This feed updates in real time.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {runs.map((run) => {
            const p = prospects[run.prospect_id]
            return (
              <div
                key={run.id}
                style={{
                  background: '#fff',
                  border: '2px solid #09090b',
                  boxShadow: '3px 3px 0 0 rgba(0,0,0,1)',
                  borderRadius: 6,
                  padding: '12px 16px',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#09090b', border: '2px solid #09090b',
                  marginTop: 4, flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#09090b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {ACTION_LABELS[run.action] ?? run.action?.replace(/_/g, ' ')}
                    </span>
                    {p && (
                      <span style={{
                        fontSize: 10, color: '#1d4ed8', background: '#eff6ff',
                        padding: '2px 8px', borderRadius: 3,
                        fontWeight: 700, border: '1.5px solid #1d4ed8',
                        textTransform: 'uppercase', letterSpacing: '0.03em',
                      }}>
                        {p.name} · {p.company}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: '#71717a', marginLeft: 'auto', fontWeight: 500 }}>
                      {timeAgo(run.created_at)}
                    </span>
                  </div>
                  {run.reasoning && (
                    <p style={{ fontSize: 11, color: '#52525b', margin: '6px 0 0', lineHeight: 1.6, fontWeight: 500 }}>
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
