import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STAGES = ['research', 'outreach', 'responded', 'discovery_call', 'high_intent', 'demo', 'negotiation', 'pilot', 'closed']
const STAGE_COLORS = {
  research: '#94a3b8', outreach: '#60a5fa', responded: '#34d399',
  discovery_call: '#a78bfa', high_intent: '#f59e0b', demo: '#fb923c',
  negotiation: '#f43f5e', pilot: '#10b981', closed: '#22c55e',
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

function DonutChart({ segments, size = 100, thickness = 20 }) {
  const r = (size - thickness) / 2
  const cx = size / 2
  const circumference = 2 * Math.PI * r
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  let offset = 0
  if (total === 0) return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e4e4e7" strokeWidth={thickness} />
    </svg>
  )
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circumference
        const el = <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={seg.color} strokeWidth={thickness} strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset} />
        offset += dash
        return el
      })}
    </svg>
  )
}

const nbCard = { background: '#fff', border: '2px solid #09090b', boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6 }

export default function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    async function load() {
      const [
        { data: prospects },
        { data: comms },
        { data: tasks },
        { data: recentRuns },
        { data: pList },
      ] = await Promise.all([
        supabase.from('prospects').select('stage, score, status'),
        supabase.from('communications').select('channel, direction, status'),
        supabase.from('tasks').select('id, type, status, scheduled_for, prospect_id').eq('status', 'pending').order('created_at', { ascending: false }).limit(4),
        supabase.from('agent_runs').select('id, action, reasoning, prospect_id, created_at').order('created_at', { ascending: false }).limit(4),
        supabase.from('prospects').select('id, name, company'),
      ])

      const pById = {}
      ;(pList ?? []).forEach(p => { pById[p.id] = p })

      const ps = prospects ?? []
      const cs = comms ?? []

      const byStage = Object.fromEntries(STAGES.map(s => [s, 0]))
      ps.forEach(p => { if (byStage[p.stage] !== undefined) byStage[p.stage]++ })

      const emailsOut = cs.filter(c => c.channel === 'email' && c.direction === 'outbound').length
      const emailsIn = cs.filter(c => c.direction === 'inbound').length
      const replyRate = emailsOut > 0 ? Math.round((emailsIn / emailsOut) * 100) : 0

      const scored = ps.filter(p => p.score > 0)
      const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length) : 0

      setData({
        total: ps.length,
        closed: byStage.closed,
        byStage,
        active: ps.filter(p => p.status === 'active').length,
        cold: ps.filter(p => p.status === 'cold').length,
        rejected: ps.filter(p => p.status === 'rejected').length,
        replyRate, avgScore,
        pendingTasks: (tasks ?? []).length,
        upcomingTasks: tasks ?? [],
        recentRuns: recentRuns ?? [],
        pById,
      })
    }
    load()

    const ch = supabase.channel('dash-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospects' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_runs' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  if (!data) return (
    <div style={{ padding: 40, color: '#71717a', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      Loading...
    </div>
  )

  const maxStage = Math.max(...Object.values(data.byStage), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div style={{ marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#09090b', margin: 0, textTransform: 'uppercase' }}>Pipeline Overview</h1>
        <p style={{ fontSize: 12, color: '#71717a', margin: '6px 0 0', fontWeight: 500 }}>Real-time metrics from your AI sales pipeline.</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Active Prospects', value: data.total - data.closed, accent: '#2563eb', nav: 'prospects' },
          { label: 'Reply Rate', value: `${data.replyRate}%`, accent: '#22c55e' },
          { label: 'Avg Fit Score', value: `${data.avgScore}/100`, accent: '#f59e0b' },
          { label: 'Deals Closed', value: data.closed, accent: '#10b981', nav: 'prospects' },
        ].map(({ label, value, accent, nav }) => (
          <div
            key={label}
            onClick={() => nav && onNavigate?.(nav)}
            className={nav ? 'nb-btn-sm' : ''}
            style={{
              ...nbCard,
              padding: '18px 20px',
              borderLeft: `4px solid ${accent}`,
              cursor: nav ? 'pointer' : 'default',
              transition: 'transform 0.05s, box-shadow 0.05s',
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>{label}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: '#09090b', letterSpacing: '-0.5px' }}>{value}</div>
            {nav && <div style={{ fontSize: 10, color: accent, marginTop: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>View →</div>}
          </div>
        ))}
      </div>

      {/* Funnel + Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12 }}>

        <div style={{ ...nbCard, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pipeline</div>
            <button onClick={() => onNavigate?.('prospects')} style={{ fontSize: 10, color: '#09090b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>View all →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {STAGES.map(stage => (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLORS[stage], flexShrink: 0, border: '1px solid rgba(0,0,0,0.15)' }} />
                <div style={{ width: 110, fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, flexShrink: 0 }}>
                  {stage.replace(/_/g, ' ')}
                </div>
                <div style={{ flex: 1, height: 8, background: '#f5f5f0', border: '1px solid #e4e4e7', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2, background: STAGE_COLORS[stage],
                    width: `${(data.byStage[stage] / maxStage) * 100}%`,
                    opacity: data.byStage[stage] === 0 ? 0.15 : 1,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                <div style={{ width: 22, fontSize: 12, fontWeight: 700, color: '#09090b', textAlign: 'right', flexShrink: 0 }}>{data.byStage[stage]}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div style={{ ...nbCard, padding: '18px 20px', flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <DonutChart segments={[
                { value: data.active, color: '#2563eb' },
                { value: data.cold, color: '#94a3b8' },
                { value: data.rejected, color: '#f43f5e' },
              ]} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { label: 'Active', value: data.active, color: '#2563eb' },
                  { label: 'Cold', value: data.cold, color: '#94a3b8' },
                  { label: 'Rejected', value: data.rejected, color: '#f43f5e' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: color, border: '1px solid rgba(0,0,0,0.2)' }} />
                    <span style={{ fontSize: 11, color: '#52525b', fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#09090b', marginLeft: 'auto', paddingLeft: 12 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            onClick={() => onNavigate?.('tasks')}
            className="nb-btn-sm"
            style={{
              ...nbCard,
              padding: '16px 20px', cursor: 'pointer',
              background: data.pendingTasks > 0 ? '#fffbeb' : '#fff',
              borderColor: data.pendingTasks > 0 ? '#f59e0b' : '#09090b',
              transition: 'transform 0.05s, box-shadow 0.05s',
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Pending Approvals</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: data.pendingTasks > 0 ? '#92400e' : '#09090b' }}>{data.pendingTasks}</span>
              {data.pendingTasks > 0 && <span style={{ fontSize: 11, color: '#92400e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>need review →</span>}
            </div>
          </div>

        </div>
      </div>

      {/* Activity + Tasks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        <div style={{ ...nbCard, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recent Activity</div>
            <button onClick={() => onNavigate?.('activity')} style={{ fontSize: 10, color: '#09090b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>See all →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.recentRuns.length === 0 && <div style={{ fontSize: 12, color: '#71717a', fontWeight: 500 }}>No activity yet.</div>}
            {data.recentRuns.map(run => {
              const p = data.pById[run.prospect_id]
              return (
                <div key={run.id} style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#09090b', border: '2px solid #09090b', marginTop: 4, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#09090b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {run.action?.replace(/_/g, ' ')}
                      {p && <span style={{ fontWeight: 500, color: '#71717a', textTransform: 'none', letterSpacing: 'normal' }}> · {p.name}</span>}
                      <span style={{ fontSize: 10, color: '#71717a', float: 'right', fontWeight: 500, textTransform: 'none', letterSpacing: 'normal' }}>{timeAgo(run.created_at)}</span>
                    </div>
                    {run.reasoning && (
                      <div style={{ fontSize: 11, color: '#52525b', marginTop: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', fontWeight: 500 }}>
                        {run.reasoning}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ ...nbCard, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Upcoming Tasks</div>
            <button onClick={() => onNavigate?.('tasks')} style={{ fontSize: 10, color: '#09090b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>See all →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.upcomingTasks.length === 0 && <div style={{ fontSize: 12, color: '#71717a', fontWeight: 500 }}>No pending tasks.</div>}
            {data.upcomingTasks.map(task => {
              const p = data.pById[task.prospect_id]
              return (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#f5f5f0', border: '1.5px solid #e4e4e7', borderRadius: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b', flexShrink: 0, border: '1px solid rgba(0,0,0,0.2)' }} />
                  <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#09090b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {task.type?.replace(/_/g, ' ')}
                    {p && <span style={{ fontWeight: 500, color: '#71717a', textTransform: 'none', letterSpacing: 'normal' }}> · {p.name}</span>}
                  </div>
                  {task.scheduled_for && (
                    <span style={{ fontSize: 10, color: '#71717a', flexShrink: 0, fontWeight: 500 }}>
                      {new Date(task.scheduled_for).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
