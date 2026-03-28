import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STAGES = ['research', 'outreach', 'responded', 'discovery_call', 'high_intent', 'demo', 'negotiation', 'pilot', 'closed']

const STAGE_COLORS = {
  research: 'bg-gray-100 text-gray-700',
  outreach: 'bg-blue-100 text-blue-700',
  responded: 'bg-yellow-100 text-yellow-700',
  discovery_call: 'bg-purple-100 text-purple-700',
  high_intent: 'bg-orange-100 text-orange-700',
  demo: 'bg-pink-100 text-pink-700',
  negotiation: 'bg-red-100 text-red-700',
  pilot: 'bg-teal-100 text-teal-700',
  closed: 'bg-green-100 text-green-700',
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

export default function ProspectDetail({ prospect, onClose }) {
  const [comms, setComms] = useState([])
  const [agentRuns, setAgentRuns] = useState([])
  const [pendingTasks, setPendingTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioningTask, setActioningTask] = useState(null)

  const stageIndex = STAGES.indexOf(prospect.stage)

  useEffect(() => {
    async function load() {
      const [{ data: commsData }, { data: runsData }, { data: tasksData }] = await Promise.all([
        supabase.from('communications').select('*').eq('prospect_id', prospect.id).order('created_at', { ascending: true }),
        supabase.from('agent_runs').select('*').eq('prospect_id', prospect.id).order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').eq('prospect_id', prospect.id).in('status', ['pending', 'approved']).order('created_at', { ascending: false }),
      ])
      setComms(commsData ?? [])
      setAgentRuns(runsData ?? [])
      setPendingTasks(tasksData ?? [])
      setLoading(false)
    }
    load()
  }, [prospect.id])

  async function handleTask(taskId, status) {
    setActioningTask(taskId)
    await supabase.from('tasks').update({ status }).eq('id', taskId)
    setPendingTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
    setActioningTask(null)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="font-semibold text-gray-800 text-lg">{prospect.name || 'Unknown'}</div>
            <div className="text-sm text-gray-500">{prospect.title} · {prospect.company}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Stage progress */}
          <div>
            <div className="text-xs text-gray-500 uppercase font-medium mb-2">Pipeline Stage</div>
            <div className="flex gap-1 flex-wrap">
              {STAGES.map((s, i) => (
                <div
                  key={s}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    i <= stageIndex ? 'bg-blue-500' : 'bg-gray-200'
                  }`}
                  title={s.replace('_', ' ')}
                />
              ))}
            </div>
            <div className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${STAGE_COLORS[prospect.stage] ?? 'bg-gray-100'}`}>
              {prospect.stage?.replace('_', ' ')}
            </div>
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-400">Email</span><br /><span className="text-gray-700">{prospect.email || '—'}</span></div>
            <div><span className="text-gray-400">Industry</span><br /><span className="text-gray-700">{prospect.industry || '—'}</span></div>
            <div><span className="text-gray-400">Fit Score</span><br /><span className="text-gray-700 font-medium">{prospect.score ?? 0} / 100</span></div>
            <div><span className="text-gray-400">Intent Score</span><br /><span className="text-gray-700 font-medium">{prospect.intent_score ?? 0} / 100</span></div>
          </div>

          {/* Pending Tasks (Human Verifier) */}
          {pendingTasks.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase font-medium mb-2">Pending Approval</div>
              <div className="space-y-2">
                {pendingTasks.map(task => (
                  <div key={task.id} className="border border-amber-200 bg-amber-50 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <span className="font-medium text-amber-800 text-sm capitalize">{task.type?.replace('_', ' ')}</span>
                        {task.payload?.subject && <div className="text-xs text-amber-700 mt-0.5">{task.payload.subject}</div>}
                        {task.payload?.body && (
                          <div className="text-xs text-gray-500 mt-1 line-clamp-2">{task.payload.body}</div>
                        )}
                        {task.scheduled_for && (
                          <div className="text-xs text-gray-500 mt-1">📅 {new Date(task.scheduled_for).toLocaleString()}</div>
                        )}
                      </div>
                      {task.status === 'pending' ? (
                        <div className="flex gap-1 shrink-0">
                          <button
                            disabled={actioningTask === task.id}
                            onClick={() => handleTask(task.id, 'approved')}
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            disabled={actioningTask === task.id}
                            onClick={() => handleTask(task.id, 'rejected')}
                            className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          task.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>{task.status}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Communication timeline */}
          <div>
            <div className="text-xs text-gray-500 uppercase font-medium mb-2">Communication Timeline</div>
            {loading ? (
              <div className="text-gray-400 text-sm">Loading...</div>
            ) : !comms.length ? (
              <div className="text-gray-400 text-sm">No communications yet.</div>
            ) : (
              <div className="space-y-2">
                {comms.map(c => (
                  <div key={c.id} className={`rounded-xl p-3 text-sm border ${
                    c.direction === 'inbound' ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-700">{c.direction === 'inbound' ? '← Inbound' : '→ Outbound'}</span>
                      <span className="text-xs text-gray-400">{c.channel}</span>
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                        c.status === 'replied' ? 'bg-green-100 text-green-700' :
                        c.status === 'opened' ? 'bg-blue-100 text-blue-700' :
                        c.status === 'bounced' || c.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{c.status}</span>
                    </div>
                    {c.subject && <div className="font-medium text-gray-600 text-xs mb-1">{c.subject}</div>}
                    {c.content && <div className="text-gray-500 text-xs line-clamp-3">{c.content}</div>}
                    <div className="text-xs text-gray-400 mt-1">{timeAgo(c.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent reasoning */}
          <div>
            <div className="text-xs text-gray-500 uppercase font-medium mb-2">Agent Reasoning</div>
            {!agentRuns.length ? (
              <div className="text-gray-400 text-sm">No agent activity for this prospect yet.</div>
            ) : (
              <div className="space-y-2">
                {agentRuns.map(r => (
                  <div key={r.id} className="rounded-xl p-3 border border-purple-200 bg-purple-50 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-purple-800 capitalize">{r.action?.replace('_', ' ')}</span>
                      <span className="text-xs text-gray-400 ml-auto">{timeAgo(r.created_at)}</span>
                    </div>
                    {r.reasoning && <div className="text-purple-700 text-xs">{r.reasoning}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {prospect.notes && (
            <div>
              <div className="text-xs text-gray-500 uppercase font-medium mb-2">Research Notes</div>
              <div className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3 border border-gray-200">{prospect.notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
