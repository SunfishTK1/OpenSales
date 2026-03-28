import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STAGES = ['research', 'outreach', 'responded', 'discovery_call', 'high_intent', 'demo', 'negotiation', 'pilot', 'closed']
const STAGE_COLORS = {
  research: '#94a3b8', outreach: '#60a5fa', responded: '#34d399',
  discovery_call: '#a78bfa', high_intent: '#f59e0b', demo: '#fb923c',
  negotiation: '#f43f5e', pilot: '#10b981', closed: '#22c55e',
}
const ACTION_META = {
  email_draft:   { label: 'Email drafted',   color: '#1d4ed8', bg: '#eff6ff' },
  research:      { label: 'Researched',       color: '#6d28d9', bg: '#f5f3ff' },
  score:         { label: 'Scored',           color: '#92400e', bg: '#fef3c7' },
  stage_change:  { label: 'Stage updated',    color: '#166534', bg: '#f0fdf4' },
  schedule_call: { label: 'Call scheduled',   color: '#0f766e', bg: '#f0fdfa' },
  intent_score:  { label: 'Intent scored',    color: '#c2410c', bg: '#fff7ed' },
  spin_demo:     { label: 'Demo generated',   color: '#be185d', bg: '#fdf2f8' },
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

function DonutChart({ segments, size = 100, thickness = 16 }) {
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

const card = { background: '#fff', border: '2px solid #09090b', boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6 }

const sectionLabel = { fontSize: 11, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.07em' }
const linkBtn = { fontSize: 11, fontWeight: 700, color: '#09090b', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }

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
        { data: calls },
        { data: topProspects },
      ] = await Promise.all([
        supabase.from('prospects').select('stage, score, status'),
        supabase.from('communications').select('channel, direction, status'),
        supabase.from('tasks').select('id').eq('status', 'pending'),
        supabase.from('agent_runs').select('id, action, reasoning, prospect_id, created_at').order('created_at', { ascending: false }).limit(8),
        supabase.from('prospects').select('id, name, company'),
        supabase.from('calls').select('agent_name, call_status, duration_ms').eq('call_status', 'ended'),
        supabase.from('prospects').select('id, name, company, stage, score, status').order('score', { ascending: false }).limit(5),
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

      const agentMap = {}
      ;(calls ?? []).forEach(c => {
        const name = c.agent_name || 'Unknown'
        if (!agentMap[name]) agentMap[name] = { calls: 0, totalMs: 0 }
        agentMap[name].calls++
        agentMap[name].totalMs += c.duration_ms || 0
      })
      const agentLeaderboard = Object.entries(agentMap)
        .map(([name, stats]) => ({ name, calls: stats.calls, avgMin: Math.round(stats.totalMs / stats.calls / 60000 * 10) / 10 }))
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 5)

      setData({
        total: ps.length, closed: byStage.closed, byStage,
        active: ps.filter(p => p.status === 'active').length,
        cold: ps.filter(p => p.status === 'cold').length,
        rejected: ps.filter(p => p.status === 'rejected').length,
        replyRate, avgScore,
        pendingTasks: (tasks ?? []).length,
        recentRuns: recentRuns ?? [],
        pById,
        agentLeaderboard,
        topProspects: topProspects ?? [],
        totalCalls: (calls ?? []).length,
      })
    }
    load()

    const ch = supabase.channel('dash-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospects' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_runs' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  if (!data) return <div style={{ padding: 40, color: '#71717a', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Loading...</div>

  const maxStage = Math.max(...Object.values(data.byStage), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {[
          { label: 'In Pipeline',    value: data.total - data.closed, accent: '#2563eb', nav: 'prospects' },
          { label: 'Deals Closed',   value: data.closed,              accent: '#22c55e', nav: 'prospects' },
          { label: 'Reply Rate',     value: `${data.replyRate}%`,     accent: '#f59e0b' },
          { label: 'Avg Fit Score',  value: `${data.avgScore}/100`,   accent: '#f97316' },
          { label: 'Total Calls',    value: data.totalCalls,          accent: '#8b5cf6', nav: 'calls' },
        ].map(({ label, value, accent, nav }) => (
          <div key={label} onClick={() => nav && onNavigate?.(nav)} style={{
            ...card, padding: '18px 20px',
            borderLeft: `4px solid ${accent}`,
            cursor: nav ? 'pointer' : 'default',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', marginBottom: 10 }}>{label}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: '#09090b', letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Pipeline + Status + Approvals */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 10 }}>

        {/* Funnel */}
        <div style={{ ...card, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={sectionLabel}>Pipeline by Stage</span>
            <button onClick={() => onNavigate?.('prospects')} style={linkBtn}>View all →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {STAGES.map(stage => (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: STAGE_COLORS[stage], flexShrink: 0 }} />
                <div style={{ width: 110, fontSize: 12, fontWeight: 500, color: '#52525b', textTransform: 'capitalize', flexShrink: 0 }}>
                  {stage.replace(/_/g, ' ')}
                </div>
                <div style={{ flex: 1, height: 8, background: '#f5f5f0', border: '1px solid #e4e4e7', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', background: STAGE_COLORS[stage],
                    width: `${(data.byStage[stage] / maxStage) * 100}%`,
                    opacity: data.byStage[stage] === 0 ? 0.15 : 1,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                <div style={{ width: 22, fontSize: 13, fontWeight: 700, color: '#09090b', textAlign: 'right', flexShrink: 0 }}>{data.byStage[stage]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Prospect status donut */}
          <div style={{ ...card, padding: '20px 22px', flex: 1 }}>
            <div style={{ ...sectionLabel, marginBottom: 14 }}>Prospect Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <DonutChart segments={[
                { value: data.active,   color: '#2563eb' },
                { value: data.cold,     color: '#94a3b8' },
                { value: data.rejected, color: '#f43f5e' },
              ]} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {[
                  { label: 'Active',   value: data.active,   color: '#2563eb' },
                  { label: 'Cold',     value: data.cold,     color: '#94a3b8' },
                  { label: 'Rejected', value: data.rejected, color: '#f43f5e' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#52525b', fontWeight: 500, flex: 1 }}>{label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#09090b' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pending approvals */}
          <div onClick={() => onNavigate?.('tasks')} style={{
            ...card, padding: '20px 22px', cursor: 'pointer',
            background: data.pendingTasks > 0 ? '#fffbeb' : '#fff',
            borderColor: data.pendingTasks > 0 ? '#f59e0b' : '#09090b',
          }}>
            <div style={{ ...sectionLabel, marginBottom: 8 }}>Pending Approvals</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: data.pendingTasks > 0 ? '#92400e' : '#09090b', lineHeight: 1 }}>
                {data.pendingTasks}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: data.pendingTasks > 0 ? '#92400e' : '#71717a' }}>
                {data.pendingTasks > 0 ? 'need review →' : 'all clear'}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Top Leads + Agent Leaderboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 10 }}>

        <div style={{ ...card, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={sectionLabel}>Top Leads</span>
            <button onClick={() => onNavigate?.('prospects')} style={linkBtn}>View all →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.topProspects.length === 0 && <div style={{ fontSize: 12, color: '#71717a' }}>No scored prospects yet.</div>}
            {data.topProspects.map((p, i) => (
              <div key={p.id} onClick={() => onNavigate?.('prospects')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <div style={{ width: 20, fontSize: 12, fontWeight: 700, color: '#d4d4d8', textAlign: 'right', flexShrink: 0 }}>#{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#09090b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#71717a', fontWeight: 500 }}>{p.company}</div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#52525b', textTransform: 'capitalize', flexShrink: 0, background: '#f5f5f0', padding: '2px 7px', borderRadius: 3, border: '1px solid #e4e4e7' }}>
                  {p.stage?.replace(/_/g, ' ')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <div style={{ width: 52, height: 6, background: '#f5f5f0', border: '1px solid #e4e4e7', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${p.score ?? 0}%`, background: '#2563eb', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#09090b', width: 24 }}>{p.score ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card, padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={sectionLabel}>Agent Leaderboard</span>
            <button onClick={() => onNavigate?.('calls')} style={linkBtn}>All calls →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {data.agentLeaderboard.length === 0 && <div style={{ fontSize: 12, color: '#71717a' }}>No completed calls yet.</div>}
            {data.agentLeaderboard.map((agent, i) => {
              const maxCalls = data.agentLeaderboard[0]?.calls || 1
              return (
                <div key={agent.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 16, fontSize: 11, fontWeight: 700, color: '#d4d4d8', flexShrink: 0 }}>#{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#09090b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                      {agent.name}
                    </div>
                    <div style={{ height: 5, background: '#f5f5f0', border: '1px solid #e4e4e7', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(agent.calls / maxCalls) * 100}%`, background: '#8b5cf6', borderRadius: 2 }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#09090b', flexShrink: 0, textAlign: 'right', minWidth: 28 }}>
                    {agent.calls}
                    <span style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}> calls</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* Recent AI Activity — full width */}
      <div style={{ ...card, padding: '20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={sectionLabel}>Recent AI Activity</span>
          <button onClick={() => onNavigate?.('activity')} style={linkBtn}>See all →</button>
        </div>
        {data.recentRuns.length === 0 ? (
          <div style={{ fontSize: 12, color: '#71717a' }}>No activity yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 24px' }}>
            {data.recentRuns.map(run => {
              const p = data.pById[run.prospect_id]
              const meta = ACTION_META[run.action]
              return (
                <div key={run.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid #f4f4f5' }}>
                  {meta && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                      color: meta.color, background: meta.bg,
                      textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0, marginTop: 1,
                    }}>{meta.label}</span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#09090b', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p ? p.name : '—'}
                        {p?.company && <span style={{ fontWeight: 400, color: '#71717a' }}> · {p.company}</span>}
                      </span>
                      <span style={{ fontSize: 10, color: '#a1a1aa', fontWeight: 500, flexShrink: 0 }}>{timeAgo(run.created_at)}</span>
                    </div>
                    {run.reasoning && (
                      <div style={{ fontSize: 11, color: '#71717a', marginTop: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
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
  )
}
