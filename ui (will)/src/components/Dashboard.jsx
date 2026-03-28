import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function Stat({ label, value, sub }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8,
      padding: '18px 20px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#09090b', letterSpacing: '-0.5px', lineHeight: 1 }}>
        {value ?? '—'}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    async function fetch() {
      const [
        { count: total },
        { count: emailsSent },
        { count: emailsOpened },
        { count: emailsReplied },
        { count: rejections },
        { count: discoveryCalls },
        { count: highIntent },
        { count: lateStage },
      ] = await Promise.all([
        supabase.from('prospects').select('*', { count: 'exact', head: true }),
        supabase.from('communications').select('*', { count: 'exact', head: true }).eq('channel', 'email').eq('direction', 'outbound'),
        supabase.from('communications').select('*', { count: 'exact', head: true }).eq('channel', 'email').eq('status', 'opened'),
        supabase.from('communications').select('*', { count: 'exact', head: true }).eq('channel', 'email').eq('status', 'replied'),
        supabase.from('prospects').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('type', 'discovery_call'),
        supabase.from('prospects').select('*', { count: 'exact', head: true }).eq('stage', 'high_intent'),
        supabase.from('prospects').select('*', { count: 'exact', head: true }).in('stage', ['negotiation', 'pilot', 'closed']),
      ])
      setStats({ total, emailsSent, emailsOpened, emailsReplied, rejections, discoveryCalls, highIntent, lateStage })
    }
    fetch()
  }, [])

  const hitRate = stats && stats.emailsSent > 0
    ? `${Math.round((stats.emailsReplied / stats.emailsSent) * 100)}%`
    : '0%'

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#09090b', letterSpacing: '-0.3px', margin: 0 }}>Pipeline Overview</h1>
        <p style={{ fontSize: 13, color: '#71717a', margin: '4px 0 0' }}>Real-time metrics from your AI sales pipeline.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <Stat label="Total Prospects" value={stats?.total ?? '—'} />
        <Stat label="Emails Sent" value={stats?.emailsSent ?? '—'} />
        <Stat label="Reply Rate" value={stats ? hitRate : '—'} sub={`${stats?.emailsReplied ?? 0} replies`} />
        <Stat label="Opened" value={stats?.emailsOpened ?? '—'} />
        <Stat label="Rejections" value={stats?.rejections ?? '—'} />
        <Stat label="Discovery Calls" value={stats?.discoveryCalls ?? '—'} />
        <Stat label="High Intent" value={stats?.highIntent ?? '—'} />
        <Stat label="Negotiation / Closed" value={stats?.lateStage ?? '—'} />
      </div>

      {/* Stage funnel */}
      <FunnelSection />
    </div>
  )
}

const STAGES = ['research', 'outreach', 'responded', 'discovery_call', 'high_intent', 'demo', 'negotiation', 'pilot', 'closed']

function FunnelSection() {
  const [counts, setCounts] = useState([])

  useEffect(() => {
    async function load() {
      const results = await Promise.all(
        STAGES.map(stage =>
          supabase.from('prospects').select('*', { count: 'exact', head: true }).eq('stage', stage)
            .then(({ count }) => ({ stage, count: count ?? 0 }))
        )
      )
      setCounts(results)
    }
    load()
  }, [])

  const max = Math.max(...counts.map(c => c.count), 1)

  return (
    <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8, padding: '20px 24px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
        Funnel by Stage
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {counts.map(({ stage, count }) => (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 110, fontSize: 12, color: '#52525b', textTransform: 'capitalize', flexShrink: 0 }}>
              {stage.replace('_', ' ')}
            </div>
            <div style={{ flex: 1, height: 6, background: '#f4f4f5', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3, background: '#2563eb',
                width: `${(count / max) * 100}%`,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ width: 28, fontSize: 12, fontWeight: 600, color: '#09090b', textAlign: 'right', flexShrink: 0 }}>
              {count}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
