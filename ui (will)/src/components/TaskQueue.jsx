import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function TaskQueue() {
  const [tasks, setTasks] = useState([])
  const [prospects, setProspects] = useState({})
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: taskData }, { data: prospectData }] = await Promise.all([
        supabase.from('tasks').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('prospects').select('id, name, company'),
      ])
      setTasks(taskData ?? [])
      const pMap = {}
      ;(prospectData ?? []).forEach(p => { pMap[p.id] = p })
      setProspects(pMap)
      setLoading(false)
    }
    load()

    const channel = supabase.channel('tasks-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        supabase.from('tasks').select('*').eq('status', 'pending').order('created_at', { ascending: false })
          .then(({ data }) => setTasks(data ?? []))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function handleTask(taskId, status) {
    setActioning(taskId)
    await supabase.from('tasks').update({ status }).eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setActioning(null)
  }

  if (loading) return <div className="text-gray-400 p-8">Loading tasks...</div>

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-700 mb-4">
        Pending Approvals <span className="text-sm font-normal text-gray-400">({tasks.length})</span>
      </h2>

      {!tasks.length ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-2">✅</div>
          <div>No pending tasks. All caught up!</div>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const p = prospects[task.prospect_id]
            return (
              <div key={task.id} className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800 capitalize">{task.type?.replace('_', ' ')}</span>
                      {p && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          {p.name} · {p.company}
                        </span>
                      )}
                    </div>
                    {task.payload?.subject && (
                      <div className="text-sm text-gray-600 mt-1 font-medium">{task.payload.subject}</div>
                    )}
                    {task.payload?.body && (
                      <div className="text-xs text-gray-400 mt-1 line-clamp-2">{task.payload.body}</div>
                    )}
                    {task.scheduled_for && (
                      <div className="text-xs text-gray-400 mt-1">📅 {new Date(task.scheduled_for).toLocaleString()}</div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">{new Date(task.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      disabled={actioning === task.id}
                      onClick={() => handleTask(task.id, 'approved')}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      disabled={actioning === task.id}
                      onClick={() => handleTask(task.id, 'rejected')}
                      className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
