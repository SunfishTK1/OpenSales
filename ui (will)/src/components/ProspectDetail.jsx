import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STAGES = ['research', 'outreach', 'responded', 'discovery_call', 'high_intent', 'demo', 'negotiation', 'pilot', 'closed']

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 600, color: '#a1a1aa',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
      }}>{title}</div>
      {children}
    </div>
  )
}

export default function ProspectDetail({ prospect, onClose }) {
  const [comms, setComms] = useState([])
  const [agentRuns, setAgentRuns] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(null)

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
      setTasks(tasksData ?? [])
      setLoading(false)
    }
    load()
  }, [prospect.id])

  async function handleTask(taskId, status) {
    setActioning(taskId)
    await supabase.from('tasks').update({ status }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
    setActioning(null)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex', justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 480, height: '100%', background: '#fff',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 32px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #e4e4e7',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#09090b', letterSpacing: '-0.2px' }}>
              {prospect.name || 'Unknown'}
            </div>
            <div style={{ fontSize: 12.5, color: '#71717a', marginTop: 2 }}>
              {[prospect.title, prospect.company].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#a1a1aa', fontSize: 18, lineHeight: 1, padding: 4,
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px' }}>

          {/* Stage progress */}
          <Section title="Pipeline Stage">
            <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
              {STAGES.map((s, i) => (
                <div
                  key={s}
                  title={s.replace('_', ' ')}
                  style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: i <= stageIndex ? '#2563eb' : '#e4e4e7',
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#71717a' }}>
              {prospect.stage?.replace('_', ' ')} · step {stageIndex + 1} of {STAGES.length}
            </div>
          </Section>

          {/* Meta */}
          <Section title="Details">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
              {[
                ['Email', prospect.email],
                ['Industry', prospect.industry],
                ['Fit Score', `${prospect.score ?? 0} / 100`],
                ['Intent Score', `${prospect.intent_score ?? 0} / 100`],
                ['Source', prospect.source],
                ['Status', prospect.status],
              ].map(([k, v]) => v && (
                <div key={k}>
                  <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 1 }}>{k}</div>
                  <div style={{ fontSize: 13, color: '#09090b', fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Pending tasks */}
          {tasks.length > 0 && (
            <Section title={`Pending Approval (${tasks.filter(t => t.status === 'pending').length})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tasks.map(task => (
                  <div key={task.id} style={{
                    border: '1px solid #e4e4e7', borderRadius: 6, padding: '12px 14px',
                    borderLeft: task.status === 'pending' ? '3px solid #f59e0b' : task.status === 'approved' ? '3px solid #22c55e' : '3px solid #ef4444',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#09090b', textTransform: 'capitalize' }}>
                          {task.type?.replace(/_/g, ' ')}
                        </div>
                        {task.payload?.subject && (
                          <div style={{ fontSize: 12, color: '#52525b', marginTop: 3 }}>{task.payload.subject}</div>
                        )}
                        {task.payload?.body && (
                          <div style={{ fontSize: 11.5, color: '#a1a1aa', marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {task.payload.body}
                          </div>
                        )}
                        {task.scheduled_for && (
                          <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 4 }}>
                            {new Date(task.scheduled_for).toLocaleString()}
                          </div>
                        )}
                      </div>
                      {task.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            disabled={actioning === task.id}
                            onClick={() => handleTask(task.id, 'approved')}
                            style={{
                              padding: '5px 12px', fontSize: 12, fontWeight: 500,
                              background: '#09090b', color: '#fff', border: 'none',
                              borderRadius: 5, cursor: 'pointer', opacity: actioning === task.id ? 0.5 : 1,
                            }}
                          >Approve</button>
                          <button
                            disabled={actioning === task.id}
                            onClick={() => handleTask(task.id, 'rejected')}
                            style={{
                              padding: '5px 12px', fontSize: 12, fontWeight: 500,
                              background: '#fff', color: '#71717a',
                              border: '1px solid #e4e4e7', borderRadius: 5, cursor: 'pointer',
                              opacity: actioning === task.id ? 0.5 : 1,
                            }}
                          >Reject</button>
                        </div>
                      ) : (
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                          background: task.status === 'approved' ? '#f0fdf4' : '#fef2f2',
                          color: task.status === 'approved' ? '#166534' : '#b91c1c',
                        }}>{task.status}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Comms timeline */}
          <Section title="Communications">
            {loading ? (
              <div style={{ fontSize: 13, color: '#a1a1aa' }}>Loading...</div>
            ) : !comms.length ? (
              <div style={{ fontSize: 13, color: '#a1a1aa' }}>No communications yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {comms.map(c => (
                  <div key={c.id} style={{
                    border: '1px solid #e4e4e7', borderRadius: 6, padding: '10px 14px',
                    borderLeft: c.direction === 'inbound' ? '3px solid #2563eb' : '3px solid #e4e4e7',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#52525b' }}>
                        {c.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                      </span>
                      <span style={{ fontSize: 11, color: '#a1a1aa' }}>{c.channel}</span>
                      <StatusPill status={c.status} />
                      <span style={{ fontSize: 11, color: '#a1a1aa', marginLeft: 'auto' }}>{timeAgo(c.created_at)}</span>
                    </div>
                    {c.subject && <div style={{ fontSize: 12.5, fontWeight: 500, color: '#09090b', marginBottom: 3 }}>{c.subject}</div>}
                    {c.content && <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.5 }}>{c.content}</div>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Agent reasoning */}
          <Section title="Agent Log">
            {!agentRuns.length ? (
              <div style={{ fontSize: 13, color: '#a1a1aa' }}>No agent activity for this prospect.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {agentRuns.map(r => (
                  <div key={r.id} style={{ border: '1px solid #e4e4e7', borderRadius: 6, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: r.reasoning ? 4 : 0 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: '#09090b', textTransform: 'capitalize' }}>
                        {r.action?.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: 11, color: '#a1a1aa', marginLeft: 'auto' }}>{timeAgo(r.created_at)}</span>
                    </div>
                    {r.reasoning && <p style={{ fontSize: 12, color: '#71717a', margin: 0, lineHeight: 1.5 }}>{r.reasoning}</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {prospect.notes && (
            <Section title="Research Notes">
              <div style={{ fontSize: 12.5, color: '#52525b', lineHeight: 1.6, background: '#fafafa', border: '1px solid #e4e4e7', borderRadius: 6, padding: '10px 14px' }}>
                {prospect.notes}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    sent:      { color: '#71717a', bg: '#f4f4f5' },
    delivered: { color: '#52525b', bg: '#f4f4f5' },
    opened:    { color: '#1d4ed8', bg: '#eff6ff' },
    replied:   { color: '#166534', bg: '#f0fdf4' },
    bounced:   { color: '#b91c1c', bg: '#fef2f2' },
    rejected:  { color: '#b91c1c', bg: '#fef2f2' },
  }
  const s = map[status] ?? map.sent
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 500, padding: '1px 6px', borderRadius: 3,
      background: s.bg, color: s.color,
    }}>{status}</span>
  )
}
