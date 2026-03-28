import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function StatCard({ label, value, color }) {
  return (
    <div className={`rounded-xl p-5 border ${color} bg-white shadow-sm`}>
      <div className="text-3xl font-bold text-gray-800">{value ?? '—'}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      const [
        { count: totalProspects },
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
      setStats({ totalProspects, emailsSent, emailsOpened, emailsReplied, rejections, discoveryCalls, highIntent, lateStage })
      setLoading(false)
    }
    fetchStats()
  }, [])

  if (loading) return <div className="text-gray-400 p-8">Loading stats...</div>

  const hitRate = stats.emailsSent > 0
    ? `${Math.round((stats.emailsReplied / stats.emailsSent) * 100)}%`
    : '0%'

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-700 mb-6">Pipeline Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Prospects" value={stats.totalProspects} color="border-gray-200" />
        <StatCard label="Emails Sent" value={stats.emailsSent} color="border-blue-200" />
        <StatCard label="Reply Rate" value={hitRate} color="border-green-200" />
        <StatCard label="Emails Opened" value={stats.emailsOpened} color="border-indigo-200" />
        <StatCard label="Rejections" value={stats.rejections} color="border-red-200" />
        <StatCard label="Discovery Calls" value={stats.discoveryCalls} color="border-purple-200" />
        <StatCard label="High Intent" value={stats.highIntent} color="border-orange-200" />
        <StatCard label="Negotiation / Closed" value={stats.lateStage} color="border-teal-200" />
      </div>
    </div>
  )
}
