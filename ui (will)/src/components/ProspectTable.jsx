import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STAGE_COLORS = {
  research: 'bg-gray-100 text-gray-700',
  outreach: 'bg-blue-100 text-blue-700',
  responded: 'bg-yellow-100 text-yellow-700',
  discovery_call: 'bg-purple-100 text-purple-700',
  high_intent: 'bg-orange-100 text-orange-700',
  demo: 'bg-pink-100 text-pink-700',
  negotiation: 'bg-red-100 text-red-700',
  pilot: 'bg-teal-100 text-teal-700',
  closed: 'bg-green-100 text-green-700',
}

export default function ProspectTable({ onSelect }) {
  const [prospects, setProspects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('prospects').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setProspects(data ?? []); setLoading(false) })

    const channel = supabase.channel('prospects-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prospects' }, () => {
        supabase.from('prospects').select('*').order('created_at', { ascending: false })
          .then(({ data }) => setProspects(data ?? []))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  if (loading) return <div className="text-gray-400 p-8">Loading prospects...</div>
  if (!prospects.length) return (
    <div className="text-center py-16 text-gray-400">
      <div className="text-4xl mb-2">📋</div>
      <div>No prospects yet. They'll appear here once the AI starts researching.</div>
    </div>
  )

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-700 mb-4">Prospects ({prospects.length})</h2>
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Company</th>
              <th className="px-4 py-3 text-left">Stage</th>
              <th className="px-4 py-3 text-left">Score</th>
              <th className="px-4 py-3 text-left">Intent</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {prospects.map(p => (
              <tr
                key={p.id}
                className="hover:bg-blue-50 cursor-pointer transition-colors"
                onClick={() => onSelect(p)}
              >
                <td className="px-4 py-3 font-medium text-gray-800">{p.name || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{p.company || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STAGE_COLORS[p.stage] ?? 'bg-gray-100 text-gray-700'}`}>
                    {p.stage?.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{p.score ?? 0}</td>
                <td className="px-4 py-3 text-gray-600">{p.intent_score ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    p.status === 'cold' ? 'bg-gray-100 text-gray-500' :
                    'bg-green-100 text-green-700'
                  }`}>{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
