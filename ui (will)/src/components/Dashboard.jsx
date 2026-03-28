import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function Stat({ label, value, sub }) {
  return (
    <div style={{
      background: '#fff',
      border: '2px solid #09090b',
      boxShadow: '4px 4px 0 0 rgba(0,0,0,1)',
      borderRadius: 6,
      padding: '18px 20px',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: '#09090b', letterSpacing: '-0.5px', lineHeight: 1 }}>
        {value ?? '—'}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#71717a', marginTop: 8, fontWeight: 500 }}>{sub}</div>}
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
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#09090b', letterSpacing: '-0.3px', margin: 0, textTransform: 'uppercase' }}>Pipeline Overview</h1>
        <p style={{ fontSize: 12, color: '#71717a', margin: '6px 0 0', fontWeight: 500 }}>Real-time metrics from your AI sales pipeline.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <Stat label="Total Prospects" value={stats?.total ?? '—'} />
        <Stat label="Emails Sent" value={stats?.emailsSent ?? '—'} />
        <Stat label="Reply Rate" value={stats ? hitRate : '—'} sub={`${stats?.emailsReplied ?? 0} replies`} />
        <Stat label="Opened" value={stats?.emailsOpened ?? '—'} />
        <Stat label="Rejections" value={stats?.rejections ?? '—'} />
        <Stat label="Discovery Calls" value={stats?.discoveryCalls ?? '—'} />
        <Stat label="High Intent" value={stats?.highIntent ?? '—'} />
        <Stat label="Negotiation / Closed" value={stats?.lateStage ?? '—'} />
      </div>

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
    <div style={{
      background: '#fff',
      border: '2px solid #09090b',
      boxShadow: '4px 4px 0 0 rgba(0,0,0,1)',
      borderRadius: 6,
      padding: '20px 24px',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18 }}>
        Funnel by Stage
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {counts.map(({ stage, count }) => (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 110, fontSize: 11, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, flexShrink: 0 }}>
              {stage.replace('_', ' ')}
            </div>
            <div style={{ flex: 1, height: 8, background: '#f5f5f0', border: '1px solid #e4e4e7', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2, background: '#09090b',
                width: `${(count / max) * 100}%`,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ width: 28, fontSize: 12, fontWeight: 700, color: '#09090b', textAlign: 'right', flexShrink: 0 }}>
              {count}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
