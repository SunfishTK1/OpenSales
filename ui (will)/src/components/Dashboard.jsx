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
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f4f4f5" strokeWidth={thickness} />
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

  if (!data) return <div style={{ padding: 40, color: '#a1a1aa', fontSize: 13 }}>Loading...</div>

  const maxStage = Math.max(...Object.values(data.byStage), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: 'Active Prospects', value: data.total - data.closed, accent: '#2563eb', nav: 'prospects' },
          { label: 'Reply Rate', value: `${data.replyRate}%`, accent: '#22c55e' },
          { label: 'Avg Fit Score', value: `${data.avgScore}/100`, accent: '#f59e0b' },
          { label: 'Deals Closed', value: data.closed, accent: '#10b981', nav: 'prospects' },
        ].map(({ label, value, accent, nav }) => (
          <div key={label} onClick={() => nav && onNavigate(nav)} style={{
            background: '#fff', border: '1px solid #e4e4e7', borderRadius: 10,
            padding: '16px 18px', borderTop: `3px solid ${accent}`,
            cursor: nav ? 'pointer' : 'default',
          }}
            onMouseEnter={e => { if (nav) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)' }}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#09090b', letterSpacing: '-0.5px' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Funnel + Status ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 10 }}>

        {/* Funnel */}
        <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 10, padding: '18px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#09090b' }}>Pipeline</div>
            <button onClick={() => onNavigate('prospects')} style={{ fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>View all →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {STAGES.map(stage => (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLORS[stage], flexShrink: 0 }} />
                <div style={{ width: 110, fontSize: 12, color: '#52525b', textTransform: 'capitalize', flexShrink: 0 }}>
                  {stage.replace(/_/g, ' ')}
                </div>
                <div style={{ flex: 1, height: 7, background: '#f4f4f5', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4, background: STAGE_COLORS[stage],
                    width: `${(data.byStage[stage] / maxStage) * 100}%`,
                    opacity: data.byStage[stage] === 0 ? 0.15 : 1,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                <div style={{ width: 20, fontSize: 12, fontWeight: 600, color: '#09090b', textAlign: 'right', flexShrink: 0 }}>{data.byStage[stage]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Status donut + pending tasks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 10, padding: '18px 22px', flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#09090b', marginBottom: 14 }}>Status</div>
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
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                    <span style={{ fontSize: 12, color: '#52525b' }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#09090b', marginLeft: 'auto', paddingLeft: 12 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            onClick={() => onNavigate('tasks')}
            style={{
              background: data.pendingTasks > 0 ? '#fffbeb' : '#fff',
              border: `1px solid ${data.pendingTasks > 0 ? '#fde68a' : '#e4e4e7'}`,
              borderRadius: 10, padding: '16px 22px', cursor: 'pointer',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Pending Approvals</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: data.pendingTasks > 0 ? '#92400e' : '#09090b' }}>{data.pendingTasks}</span>
              {data.pendingTasks > 0 && <span style={{ fontSize: 12, color: '#92400e', fontWeight: 500 }}>need review →</span>}
            </div>
          </div>

        </div>
      </div>

      {/* ── Activity + Tasks ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

        <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 10, padding: '18px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#09090b' }}>Recent Activity</div>
            <button onClick={() => onNavigate('activity')} style={{ fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>See all →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.recentRuns.length === 0 && <div style={{ fontSize: 12, color: '#a1a1aa' }}>No activity yet.</div>}
            {data.recentRuns.map(run => {
              const p = data.pById[run.prospect_id]
              return (
                <div key={run.id} style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb', marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: '#09090b' }}>
                      {run.action?.replace(/_/g, ' ')}
                      {p && <span style={{ fontWeight: 400, color: '#71717a' }}> · {p.name}</span>}
                      <span style={{ fontSize: 11, color: '#a1a1aa', float: 'right' }}>{timeAgo(run.created_at)}</span>
                    </div>
                    {run.reasoning && (
                      <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                        {run.reasoning}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 10, padding: '18px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#09090b' }}>Upcoming Tasks</div>
            <button onClick={() => onNavigate('tasks')} style={{ fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>See all →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.upcomingTasks.length === 0 && <div style={{ fontSize: 12, color: '#a1a1aa' }}>No pending tasks.</div>}
            {data.upcomingTasks.map(task => {
              const p = data.pById[task.prospect_id]
              return (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: '#fafafa', borderRadius: 7 }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, background: '#f59e0b', flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: '#09090b', textTransform: 'capitalize' }}>
                    {task.type?.replace(/_/g, ' ')}
                    {p && <span style={{ fontWeight: 400, color: '#71717a' }}> · {p.name}</span>}
                  </div>
                  {task.scheduled_for && (
                    <span style={{ fontSize: 11, color: '#a1a1aa', flexShrink: 0 }}>
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
