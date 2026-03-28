import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STAGES = ['research', 'outreach', 'responded', 'discovery_call', 'high_intent', 'demo', 'negotiation', 'pilot', 'closed']
const STAGE_COLORS = {
  research: '#94a3b8', outreach: '#60a5fa', responded: '#34d399',
  discovery_call: '#a78bfa', high_intent: '#f59e0b', demo: '#fb923c',
  negotiation: '#f43f5e', pilot: '#10b981', closed: '#22c55e',
}
const ACTION_LABELS = {
  email_draft: 'Email drafted', research: 'Researched', score: 'Scored',
  stage_change: 'Stage updated', schedule_call: 'Call scheduled',
  intent_score: 'Intent scored', spin_demo: 'Demo generated',
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

function DonutChart({ segments, size = 120, thickness = 22 }) {
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
        const el = (
          <circle key={i} cx={cx} cy={cx} r={r} fill="none"
            stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
          />
        )
        offset += dash
        return el
      })}
    </svg>
  )
}

function ScoreBar({ buckets, maxVal }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {buckets.map(({ label, count, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 52, fontSize: 10, color: '#71717a', flexShrink: 0, fontWeight: 600 }}>{label}</div>
          <div style={{ flex: 1, height: 8, background: '#f5f5f0', border: '1px solid #e4e4e7', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2, background: color,
              width: maxVal > 0 ? `${(count / maxVal) * 100}%` : '0%',
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ width: 20, fontSize: 11, fontWeight: 700, color: '#09090b', textAlign: 'right', flexShrink: 0 }}>{count}</div>
        </div>
      ))}
    </div>
  )
}

const nbCard = {
  background: '#fff',
  border: '2px solid #09090b',
  boxShadow: '4px 4px 0 0 rgba(0,0,0,1)',
  borderRadius: 6,
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
        supabase.from('prospects').select('*'),
        supabase.from('communications').select('channel, direction, status, created_at'),
        supabase.from('tasks').select('id, type, status, payload, scheduled_for, prospect_id').in('status', ['pending', 'approved']).order('scheduled_for', { ascending: true }).limit(5),
        supabase.from('agent_runs').select('id, action, reasoning, prospect_id, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('prospects').select('id, name, company'),
      ])

      const pById = {}
      ;(pList ?? []).forEach(p => { pById[p.id] = p })

      const ps = prospects ?? []
      const cs = comms ?? []

      const byStage = Object.fromEntries(STAGES.map(s => [s, 0]))
      ps.forEach(p => { if (byStage[p.stage] !== undefined) byStage[p.stage]++ })

      const active = ps.filter(p => p.status === 'active').length
      const rejected = ps.filter(p => p.status === 'rejected').length
      const cold = ps.filter(p => p.status === 'cold').length

      const scoreBuckets = [
        { label: '80–100', count: ps.filter(p => p.score >= 80).length, color: '#22c55e' },
        { label: '60–79', count: ps.filter(p => p.score >= 60 && p.score < 80).length, color: '#f59e0b' },
        { label: '40–59', count: ps.filter(p => p.score >= 40 && p.score < 60).length, color: '#fb923c' },
        { label: '1–39', count: ps.filter(p => p.score > 0 && p.score < 40).length, color: '#f43f5e' },
        { label: 'None', count: ps.filter(p => p.score === 0).length, color: '#e4e4e7' },
      ]

      const emailsOut = cs.filter(c => c.channel === 'email' && c.direction === 'outbound').length
      const emailsIn = cs.filter(c => c.channel === 'email' && c.direction === 'inbound').length
      const calls = cs.filter(c => c.channel === 'call').length
      const replyRate = emailsOut > 0 ? Math.round((emailsIn / emailsOut) * 100) : 0

      const scored = ps.filter(p => p.score > 0)
      const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length) : 0
      const pendingTasks = (tasks ?? []).filter(t => t.status === 'pending').length

      setData({
        total: ps.length, byStage, active, rejected, cold,
        avgScore, emailsOut, emailsIn, calls, replyRate, pendingTasks,
        closed: byStage.closed,
        highIntent: byStage.high_intent + byStage.demo + byStage.negotiation + byStage.pilot + byStage.closed,
        scoreBuckets,
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
  const maxScore = Math.max(...data.scoreBuckets.map(b => b.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div style={{ marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#09090b', letterSpacing: '-0.3px', margin: 0, textTransform: 'uppercase' }}>Pipeline Overview</h1>
        <p style={{ fontSize: 12, color: '#71717a', margin: '6px 0 0', fontWeight: 500 }}>Real-time metrics from your AI sales pipeline.</p>
      </div>

      {/* Row 1: 4 KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'In Pipeline', value: data.total - data.closed, sub: `${data.closed} closed`, accent: '#2563eb', nav: 'prospects' },
          { label: 'Reply Rate', value: `${data.replyRate}%`, sub: `${data.emailsIn} / ${data.emailsOut} emails`, accent: '#22c55e', nav: null },
          { label: 'High Intent', value: data.highIntent, sub: `${data.byStage.negotiation} in negotiation`, accent: '#f59e0b', nav: 'prospects' },
          { label: 'Pending Approvals', value: data.pendingTasks, sub: 'Awaiting review', accent: data.pendingTasks > 0 ? '#f43f5e' : '#09090b', nav: 'tasks' },
        ].map(({ label, value, sub, accent, nav }) => (
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
            <div style={{ fontSize: 30, fontWeight: 700, color: '#09090b', letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, color: '#71717a', marginTop: 8, fontWeight: 500 }}>{sub}</div>
            {nav && <div style={{ fontSize: 10, color: accent, marginTop: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>View →</div>}
          </div>
        ))}
      </div>

      {/* Row 2: Funnel + Status/Score */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>

        {/* Funnel */}
        <div style={{ ...nbCard, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pipeline Funnel</div>
            <button onClick={() => onNavigate?.('prospects')} style={{ fontSize: 10, color: '#09090b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              See all →
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {STAGES.map(stage => {
              const count = data.byStage[stage]
              return (
                <div
                  key={stage}
                  onClick={() => onNavigate?.('prospects')}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderRadius: 4, padding: '2px 4px' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f5f0'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLORS[stage], flexShrink: 0, border: '1px solid rgba(0,0,0,0.15)' }} />
                  <div style={{ width: 108, fontSize: 10, color: '#52525b', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                    {stage.replace(/_/g, ' ')}
                  </div>
                  <div style={{ flex: 1, height: 8, background: '#f5f5f0', border: '1px solid #e4e4e7', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2, background: STAGE_COLORS[stage],
                      width: `${(count / maxStage) * 100}%`, opacity: count === 0 ? 0.2 : 1,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <div style={{ width: 22, fontSize: 12, fontWeight: 700, color: '#09090b', textAlign: 'right', flexShrink: 0 }}>{count}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Status donut + Avg score stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div style={{ ...nbCard, padding: '18px 20px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Prospect Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <DonutChart size={80} thickness={16} segments={[
                { value: data.active, color: '#2563eb' },
                { value: data.cold, color: '#94a3b8' },
                { value: data.rejected, color: '#f43f5e' },
              ]} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Active', value: data.active, color: '#2563eb' },
                  { label: 'Cold', value: data.cold, color: '#94a3b8' },
                  { label: 'Rejected', value: data.rejected, color: '#f43f5e' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0, border: '1px solid rgba(0,0,0,0.2)' }} />
                    <span style={{ fontSize: 11, color: '#52525b', fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#09090b', marginLeft: 'auto', paddingLeft: 8 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ ...nbCard, padding: '18px 20px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Avg Fit Score</div>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-1px', color: data.avgScore >= 80 ? '#22c55e' : data.avgScore >= 60 ? '#f59e0b' : '#f43f5e' }}>
              {data.avgScore}<span style={{ fontSize: 14, color: '#71717a', fontWeight: 500 }}>/100</span>
            </div>
            <div style={{ marginTop: 10, height: 6, background: '#f5f5f0', border: '1px solid #e4e4e7', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: data.avgScore >= 80 ? '#22c55e' : data.avgScore >= 60 ? '#f59e0b' : '#f43f5e', width: `${data.avgScore}%`, transition: 'width 0.5s ease' }} />
            </div>
          </div>

        </div>
      </div>

      {/* Row 3: Score distribution + Outreach summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        <div style={{ ...nbCard, padding: '20px 22px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Score Distribution</div>
          <ScoreBar buckets={data.scoreBuckets} maxVal={maxScore} />
        </div>

        <div style={{ ...nbCard, padding: '20px 22px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Outreach Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { label: 'Emails Sent', value: data.emailsOut, color: '#2563eb' },
              { label: 'Replies', value: data.emailsIn, color: '#22c55e' },
              { label: 'Reply Rate', value: `${data.replyRate}%`, color: '#10b981' },
              { label: 'Calls Logged', value: data.calls, color: '#a78bfa' },
              { label: 'High Intent', value: data.highIntent, color: '#f59e0b' },
              { label: 'Closed', value: data.closed, color: '#22c55e' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                textAlign: 'center', padding: '12px 6px',
                background: '#f5f5f0', border: '2px solid #09090b', borderRadius: 4,
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color, letterSpacing: '-0.5px' }}>{value}</div>
                <div style={{ fontSize: 9, color: '#71717a', marginTop: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Upcoming tasks + Recent activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        <div style={{ ...nbCard, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Upcoming Tasks</div>
            <button onClick={() => onNavigate?.('tasks')} style={{ fontSize: 10, color: '#09090b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              See all →
            </button>
          </div>
          {data.upcomingTasks.length === 0 ? (
            <div style={{ fontSize: 12, color: '#71717a', fontWeight: 500 }}>No upcoming tasks.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.upcomingTasks.map(task => {
                const p = data.pById[task.prospect_id]
                return (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#f5f5f0', border: '1.5px solid #e4e4e7', borderRadius: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: task.status === 'pending' ? '#f59e0b' : '#22c55e', flexShrink: 0, border: '1px solid rgba(0,0,0,0.2)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#09090b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {task.type?.replace(/_/g, ' ')}
                        {p && <span style={{ fontWeight: 500, color: '#71717a', textTransform: 'none' }}> · {p.name}</span>}
                      </div>
                      {task.scheduled_for && (
                        <div style={{ fontSize: 10, color: '#71717a', marginTop: 2, fontWeight: 500 }}>
                          {new Date(task.scheduled_for).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 3,
                      background: task.status === 'pending' ? '#fef3c7' : '#dcfce7',
                      color: task.status === 'pending' ? '#92400e' : '#166534',
                      border: `1.5px solid ${task.status === 'pending' ? '#92400e' : '#166534'}`,
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>{task.status}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ ...nbCard, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recent AI Activity</div>
            <button onClick={() => onNavigate?.('activity')} style={{ fontSize: 10, color: '#09090b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              See all →
            </button>
          </div>
          {data.recentRuns.length === 0 ? (
            <div style={{ fontSize: 12, color: '#71717a', fontWeight: 500 }}>No activity yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.recentRuns.map(run => {
                const p = data.pById[run.prospect_id]
                return (
                  <div key={run.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#09090b', border: '2px solid #09090b', marginTop: 4, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#09090b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                          {ACTION_LABELS[run.action] ?? run.action?.replace(/_/g, ' ')}
                        </span>
                        {p && <span style={{ fontSize: 10, color: '#1d4ed8', background: '#eff6ff', padding: '1px 6px', borderRadius: 3, fontWeight: 700, border: '1.5px solid #1d4ed8' }}>{p.name}</span>}
                        <span style={{ fontSize: 10, color: '#71717a', marginLeft: 'auto', fontWeight: 500 }}>{timeAgo(run.created_at)}</span>
                      </div>
                      {run.reasoning && (
                        <div style={{ fontSize: 11, color: '#52525b', marginTop: 2, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', fontWeight: 500 }}>
                          {run.reasoning}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
