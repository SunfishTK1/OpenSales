import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STAGES = ['research', 'outreach', 'responded', 'discovery_call', 'high_intent', 'demo', 'negotiation', 'pilot', 'closed']

const STAGE_COLORS = {
  research: '#94a3b8',
  outreach: '#60a5fa',
  responded: '#34d399',
  discovery_call: '#a78bfa',
  high_intent: '#f59e0b',
  demo: '#fb923c',
  negotiation: '#f43f5e',
  pilot: '#10b981',
  closed: '#22c55e',
}

const ACTION_LABELS = {
  email_draft: 'Email drafted',
  research: 'Researched',
  score: 'Scored',
  stage_change: 'Stage updated',
  schedule_call: 'Call scheduled',
  intent_score: 'Intent scored',
  spin_demo: 'Demo generated',
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

function Stat({ label, value, sub, accent }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e4e4e7', borderRadius: 10,
      padding: '16px 18px', borderTop: accent ? `3px solid ${accent}` : undefined,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#09090b', letterSpacing: '-0.5px', lineHeight: 1 }}>
        {value ?? '—'}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    async function load() {
      const [
        { data: prospects },
        { data: comms },
        { data: tasks },
        { data: recentRuns },
        { data: prospectMap },
      ] = await Promise.all([
        supabase.from('prospects').select('stage, score, intent_score, status, rejection_reason, created_at'),
        supabase.from('communications').select('channel, direction, status, created_at'),
        supabase.from('tasks').select('type, status, created_at'),
        supabase.from('agent_runs').select('action, reasoning, prospect_id, created_at').order('created_at', { ascending: false }).limit(6),
        supabase.from('prospects').select('id, name, company'),
      ])

      const pById = {}
      ;(prospectMap ?? []).forEach(p => { pById[p.id] = p })

      const byStage = Object.fromEntries(STAGES.map(s => [s, 0]))
      let totalScore = 0, scoredCount = 0, totalIntent = 0, intentCount = 0
      let active = 0, rejected = 0, cold = 0

      for (const p of prospects ?? []) {
        if (byStage[p.stage] !== undefined) byStage[p.stage]++
        if (p.score > 0) { totalScore += p.score; scoredCount++ }
        if (p.intent_score > 0) { totalIntent += p.intent_score; intentCount++ }
        if (p.status === 'active') active++
        if (p.status === 'rejected') rejected++
        if (p.status === 'cold') cold++
      }

      const emailsOut = (comms ?? []).filter(c => c.channel === 'email' && c.direction === 'outbound').length
      const emailsIn = (comms ?? []).filter(c => c.channel === 'email' && c.direction === 'inbound').length
      const calls = (comms ?? []).filter(c => c.channel === 'call').length
      const opened = (comms ?? []).filter(c => c.status === 'opened').length
      const replied = (comms ?? []).filter(c => c.status === 'replied').length
      const bounced = (comms ?? []).filter(c => c.status === 'bounced').length

      const pendingTasks = (tasks ?? []).filter(t => t.status === 'pending').length
      const approvedTasks = (tasks ?? []).filter(t => t.status === 'approved').length
      const doneTasks = (tasks ?? []).filter(t => t.status === 'done').length

      const highIntent = byStage.high_intent + byStage.demo + byStage.negotiation + byStage.pilot + byStage.closed
      const replyRate = emailsOut > 0 ? Math.round((emailsIn / emailsOut) * 100) : 0

      setData({
        total: (prospects ?? []).length,
        byStage, active, rejected, cold,
        avgScore: scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0,
        avgIntent: intentCount > 0 ? Math.round(totalIntent / intentCount) : 0,
        emailsOut, emailsIn, calls, opened, replied, bounced, replyRate,
        pendingTasks, approvedTasks, doneTasks,
        highIntent, closed: byStage.closed,
        recentRuns: recentRuns ?? [],
        pById,
      })
    }
    load()

    const ch = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospects' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communications' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_runs' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  if (!data) return <div style={{ padding: 40, color: '#a1a1aa', fontSize: 13 }}>Loading...</div>

  const maxStage = Math.max(...Object.values(data.byStage), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <Stat label="Total Prospects" value={data.total} sub={`${data.active} active · ${data.rejected} rejected · ${data.cold} cold`} accent="#2563eb" />
        <Stat label="Reply Rate" value={`${data.replyRate}%`} sub={`${data.emailsIn} replies from ${data.emailsOut} sent`} accent="#22c55e" />
        <Stat label="High Intent" value={data.highIntent} sub={`${data.closed} closed`} accent="#f59e0b" />
        <Stat label="Pending Approvals" value={data.pendingTasks} sub={`${data.approvedTasks} approved · ${data.doneTasks} done`} accent="#f43f5e" />
      </div>

      {/* Second row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <Stat label="Avg Fit Score" value={data.avgScore} sub="out of 100" />
        <Stat label="Avg Intent Score" value={data.avgIntent} sub="post discovery call" />
        <Stat label="Calls Logged" value={data.calls} sub={`${data.emailsOut} emails out`} />
        <Stat label="Opened" value={data.opened} sub={`${data.bounced} bounced`} />
      </div>

      {/* Funnel + Activity side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

        {/* Funnel */}
        <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 10, padding: '18px 22px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
            Pipeline Funnel
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {STAGES.map(stage => {
              const count = data.byStage[stage]
              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 108, fontSize: 12, color: '#52525b', flexShrink: 0, textTransform: 'capitalize' }}>
                    {stage.replace(/_/g, ' ')}
                  </div>
                  <div style={{ flex: 1, height: 8, background: '#f4f4f5', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      background: STAGE_COLORS[stage],
                      width: `${(count / maxStage) * 100}%`,
                      transition: 'width 0.4s ease',
                      opacity: count === 0 ? 0.2 : 1,
                    }} />
                  </div>
                  <div style={{ width: 22, fontSize: 12, fontWeight: 600, color: '#09090b', textAlign: 'right', flexShrink: 0 }}>
                    {count}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent activity */}
        <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 10, padding: '18px 22px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
            Recent Agent Activity
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.recentRuns.length === 0 && (
              <div style={{ fontSize: 13, color: '#a1a1aa' }}>No activity yet.</div>
            )}
            {data.recentRuns.map(run => {
              const p = data.pById[run.prospect_id]
              return (
                <div key={run.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#2563eb',
                    marginTop: 5, flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: '#09090b' }}>
                        {ACTION_LABELS[run.action] ?? run.action?.replace(/_/g, ' ')}
                      </span>
                      {p && (
                        <span style={{ fontSize: 11, color: '#2563eb', background: '#eff6ff', padding: '1px 6px', borderRadius: 4, fontWeight: 500 }}>
                          {p.name}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: '#a1a1aa', marginLeft: 'auto' }}>{timeAgo(run.created_at)}</span>
                    </div>
                    {run.reasoning && (
                      <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 2, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {run.reasoning}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Comms breakdown */}
      <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 10, padding: '18px 22px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
          Communication Breakdown
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {[
            { label: 'Emails Sent', value: data.emailsOut, color: '#2563eb' },
            { label: 'Replies', value: data.emailsIn, color: '#22c55e' },
            { label: 'Opened', value: data.opened, color: '#f59e0b' },
            { label: 'Calls', value: data.calls, color: '#a78bfa' },
            { label: 'Bounced', value: data.bounced, color: '#f43f5e' },
            { label: 'Reply Rate', value: `${data.replyRate}%`, color: '#10b981' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center', padding: '12px 8px', background: '#fafafa', borderRadius: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.5px' }}>{value}</div>
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 4, fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
