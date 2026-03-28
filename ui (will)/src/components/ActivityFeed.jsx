import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const ACTION_ICONS = {
  email_draft: '✉️',
  research: '🔍',
  score: '📊',
  stage_change: '🔄',
  schedule_call: '📅',
  intent_score: '🎯',
  spin_demo: '🚀',
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
  // ref so the realtime callback always sees current prospect map without stale closure
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

    const channel = supabase.channel('agent-runs-feed')
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

    return () => supabase.removeChannel(channel)
  }, [])

  if (loading) return <div className="text-gray-400 p-8">Loading activity...</div>

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-semibold text-gray-700">Agent Activity</h2>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        <span className="text-xs text-green-600 font-medium">Live</span>
      </div>

      {!runs.length ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-2">🤖</div>
          <div>No agent activity yet. The feed will update live as the AI works.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map(run => {
            const p = prospects[run.prospect_id]
            return (
              <div key={run.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="text-xl mt-0.5">{ACTION_ICONS[run.action] ?? '🤖'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800">{run.action?.replace('_', ' ')}</span>
                      {p && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          {p.name} · {p.company}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">{timeAgo(run.created_at)}</span>
                    </div>
                    {run.reasoning && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{run.reasoning}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
