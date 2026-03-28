import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STAGES = ['research', 'outreach', 'responded', 'discovery_call', 'high_intent', 'demo', 'negotiation', 'pilot', 'closed']
const STAGE_COLORS = {
  research: '#94a3b8', outreach: '#60a5fa', responded: '#34d399',
  discovery_call: '#a78bfa', high_intent: '#f59e0b', demo: '#fb923c',
  negotiation: '#f43f5e', pilot: '#10b981', closed: '#22c55e',
}
const ACTION_META = {
  email_draft:   { label: 'Email Drafted',  color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  research:      { label: 'Research',        color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
  score:         { label: 'Scored',          color: '#92400e', bg: '#fef3c7', border: '#fde68a' },
  stage_change:  { label: 'Stage Updated',   color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  schedule_call: { label: 'Call Scheduled',  color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' },
  intent_score:  { label: 'Intent Scored',   color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' },
  spin_demo:     { label: 'Demo Generated',  color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' },
}
const STATUS_STYLES = {
  active:   { color: '#166534', bg: '#f0fdf4', border: '#22c55e' },
  cold:     { color: '#3730a3', bg: '#eef2ff', border: '#818cf8' },
  rejected: { color: '#b91c1c', bg: '#fef2f2', border: '#f87171' },
}
const COMM_STATUS_STYLES = {
  sent:      { color: '#71717a', bg: '#f4f4f5', border: '#d4d4d8' },
  delivered: { color: '#52525b', bg: '#f4f4f5', border: '#d4d4d8' },
  opened:    { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  replied:   { color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  bounced:   { color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' },
  rejected:  { color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' },
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
      {children}
    </div>
  )
}

function Badge({ style: s, children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
      textTransform: 'uppercase', letterSpacing: '0.04em',
      border: `1.5px solid ${s.border}`,
      color: s.color, background: s.bg,
    }}>{children}</span>
  )
}

export default function ProspectDetail({ prospect, onClose }) {
  const [comms, setComms] = useState([])
  const [agentRuns, setAgentRuns] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(null)

  const stageIndex = STAGES.indexOf(prospect.stage)
  const stageColor = STAGE_COLORS[prospect.stage] ?? '#94a3b8'
  const statusStyle = STATUS_STYLES[prospect.status] ?? STATUS_STYLES.active

  useEffect(() => {
    async function load() {
      const [{ data: commsData }, { data: runsData }, { data: tasksData }] = await Promise.all([
        supabase.from('communications').select('*').eq('prospect_id', prospect.id).order('created_at', { ascending: false }),
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
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end' }}
      onClick={onClose}
    >
      <div
        style={{
          width: 500, height: '100%', background: '#f5f5f0',
          borderLeft: '2px solid #09090b',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 20px', background: '#fff',
          borderBottom: '2px solid #09090b', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: '#09090b', textTransform: 'uppercase', letterSpacing: '-0.2px' }}>
                {prospect.name || 'Unknown'}
              </div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 3, fontWeight: 500 }}>
                {[prospect.title, prospect.company].filter(Boolean).join(' · ') || '—'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
                  background: stageColor + '22', color: stageColor,
                  border: `1.5px solid ${stageColor}`,
                  textTransform: 'capitalize', letterSpacing: '0.04em',
                }}>
                  {prospect.stage?.replace(/_/g, ' ') || 'No stage'}
                </span>
                {prospect.status && (
                  <Badge style={statusStyle}>{prospect.status}</Badge>
                )}
                {prospect.email && (
                  <span style={{ fontSize: 11, color: '#71717a', fontWeight: 500 }}>{prospect.email}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: '#f5f5f0', border: '2px solid #09090b', cursor: 'pointer',
                color: '#09090b', fontSize: 13, lineHeight: 1, padding: '5px 9px',
                borderRadius: 4, fontWeight: 700, flexShrink: 0,
                boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
              }}
            >✕</button>
          </div>

          {/* Score bars */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginTop: 14 }}>
            {[
              { label: 'Fit Score', value: prospect.score ?? 0, color: '#2563eb' },
              { label: 'Intent Score', value: prospect.intent_score ?? 0, color: '#f97316' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#09090b' }}>{value}</span>
                </div>
                <div style={{ height: 5, background: '#e4e4e7', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Stage progress */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', gap: 2, marginBottom: 5 }}>
              {STAGES.map((s, i) => (
                <div
                  key={s}
                  title={s.replace(/_/g, ' ')}
                  style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: i < stageIndex ? '#09090b' : i === stageIndex ? stageColor : '#e4e4e7',
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}>
              Step {stageIndex + 1} of {STAGES.length} — {prospect.stage?.replace(/_/g, ' ')}
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px' }}>

          {/* Details */}
          <div style={{ background: '#fff', border: '2px solid #09090b', boxShadow: '3px 3px 0 0 rgba(0,0,0,1)', borderRadius: 6, padding: '16px 18px', marginBottom: 10 }}>
            <SectionLabel>Details</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
              {[
                ['Industry', prospect.industry],
                ['Source', prospect.source],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 13, color: '#09090b', fontWeight: 500 }}>{v}</div>
                </div>
              ))}
            </div>
            {prospect.notes && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f4f4f5' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Research Notes</div>
                <div style={{ fontSize: 12, color: '#52525b', lineHeight: 1.6, fontWeight: 500 }}>{prospect.notes}</div>
              </div>
            )}
          </div>

          {/* Pending tasks */}
          {tasks.filter(t => t.status === 'pending').length > 0 && (
            <div style={{ background: '#fffbeb', border: '2px solid #f59e0b', boxShadow: '3px 3px 0 0 rgba(0,0,0,1)', borderRadius: 6, padding: '16px 18px', marginBottom: 10 }}>
              <SectionLabel>Pending Approval ({tasks.filter(t => t.status === 'pending').length})</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tasks.filter(t => t.status === 'pending').map(task => (
                  <div key={task.id} style={{
                    background: '#fff', border: '2px solid #09090b', borderRadius: 5,
                    borderLeft: '4px solid #f59e0b', padding: '12px 14px',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#09090b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                      {task.type?.replace(/_/g, ' ')}
                    </div>
                    {task.payload?.subject && (
                      <div style={{ fontSize: 12, color: '#3f3f46', fontWeight: 600, marginBottom: 4 }}>{task.payload.subject}</div>
                    )}
                    {(task.payload?.body || task.payload?.demo_plan || task.payload?.notes) && (
                      <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 8 }}>
                        {task.payload.body || task.payload.demo_plan || task.payload.notes}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        disabled={actioning === task.id}
                        onClick={() => handleTask(task.id, 'approved')}
                        style={{
                          padding: '5px 14px', fontSize: 11, fontWeight: 700,
                          background: '#09090b', color: '#fff',
                          border: '2px solid #09090b', borderRadius: 4,
                          cursor: actioning === task.id ? 'not-allowed' : 'pointer',
                          opacity: actioning === task.id ? 0.5 : 1,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}
                      >Approve</button>
                      <button
                        disabled={actioning === task.id}
                        onClick={() => handleTask(task.id, 'rejected')}
                        style={{
                          padding: '5px 14px', fontSize: 11, fontWeight: 700,
                          background: '#fff', color: '#09090b',
                          border: '2px solid #09090b', borderRadius: 4,
                          cursor: actioning === task.id ? 'not-allowed' : 'pointer',
                          opacity: actioning === task.id ? 0.5 : 1,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}
                      >Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Communications */}
          <div style={{ background: '#fff', border: '2px solid #09090b', boxShadow: '3px 3px 0 0 rgba(0,0,0,1)', borderRadius: 6, padding: '16px 18px', marginBottom: 10 }}>
            <SectionLabel>Communications ({comms.length})</SectionLabel>
            {loading ? (
              <div style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 500 }}>Loading...</div>
            ) : !comms.length ? (
              <div style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 500 }}>No communications yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {comms.map(c => {
                  const ss = COMM_STATUS_STYLES[c.status] ?? COMM_STATUS_STYLES.sent
                  return (
                    <div key={c.id} style={{
                      border: '2px solid #e4e4e7', borderRadius: 5, padding: '10px 14px',
                      borderLeft: c.direction === 'inbound' ? '4px solid #2563eb' : '4px solid #d4d4d8',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: c.subject || c.content ? 6 : 0, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: c.direction === 'inbound' ? '#1d4ed8' : '#52525b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {c.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#71717a', textTransform: 'capitalize', background: '#f5f5f0', padding: '1px 6px', borderRadius: 3, border: '1px solid #e4e4e7' }}>
                          {c.channel}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                          color: ss.color, background: ss.bg, border: `1.5px solid ${ss.border}`,
                        }}>{c.status}</span>
                        <span style={{ fontSize: 10, color: '#a1a1aa', fontWeight: 500, marginLeft: 'auto' }}>{timeAgo(c.created_at)}</span>
                      </div>
                      {c.subject && <div style={{ fontSize: 12, fontWeight: 600, color: '#09090b', marginBottom: 3 }}>{c.subject}</div>}
                      {c.content && <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.5, fontWeight: 500 }}>{c.content}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Agent Log */}
          <div style={{ background: '#fff', border: '2px solid #09090b', boxShadow: '3px 3px 0 0 rgba(0,0,0,1)', borderRadius: 6, padding: '16px 18px', marginBottom: 10 }}>
            <SectionLabel>Agent Log ({agentRuns.length})</SectionLabel>
            {!agentRuns.length ? (
              <div style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 500 }}>No agent activity yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {agentRuns.map(r => {
                  const meta = ACTION_META[r.action] ?? { label: r.action?.replace(/_/g, ' '), color: '#52525b', bg: '#f4f4f5', border: '#e4e4e7' }
                  return (
                    <div key={r.id} style={{
                      border: '2px solid #e4e4e7', borderRadius: 5, padding: '10px 14px',
                      borderLeft: `4px solid ${meta.border ?? '#e4e4e7'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: r.reasoning ? 6 : 0, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                          color: meta.color, background: meta.bg, border: `1.5px solid ${meta.border}`,
                        }}>{meta.label}</span>
                        <span style={{ fontSize: 10, color: '#a1a1aa', fontWeight: 500, marginLeft: 'auto' }}>{timeAgo(r.created_at)}</span>
                      </div>
                      {r.reasoning && (
                        <p style={{ fontSize: 12, color: '#52525b', margin: 0, lineHeight: 1.6, fontWeight: 500 }}>{r.reasoning}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
