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

    const ch = supabase.channel('tasks-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        supabase.from('tasks').select('*').eq('status', 'pending').order('created_at', { ascending: false })
          .then(({ data }) => setTasks(data ?? []))
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function handleTask(taskId, status) {
    setActioning(taskId)
    await supabase.from('tasks').update({ status }).eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setActioning(null)
  }

  if (loading) return <div style={{ padding: 40, color: '#a1a1aa', fontSize: 13 }}>Loading...</div>

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#09090b', letterSpacing: '-0.3px', margin: 0 }}>
          Approvals
          {tasks.length > 0 && (
            <span style={{
              marginLeft: 8, fontSize: 12, fontWeight: 600,
              background: '#fef3c7', color: '#92400e',
              padding: '2px 8px', borderRadius: 10, verticalAlign: 'middle',
            }}>{tasks.length} pending</span>
          )}
        </h1>
        <p style={{ fontSize: 13, color: '#71717a', margin: '3px 0 0' }}>Review and approve actions before the AI executes them.</p>
      </div>

      {!tasks.length ? (
        <div style={{
          background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8,
          padding: 48, textAlign: 'center', color: '#a1a1aa', fontSize: 13,
        }}>
          No pending approvals. All clear.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map(task => {
            const p = prospects[task.prospect_id]
            return (
              <div key={task.id} style={{
                background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8,
                padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 16,
                borderLeft: '3px solid #f59e0b',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#09090b', textTransform: 'capitalize' }}>
                      {task.type?.replace(/_/g, ' ')}
                    </span>
                    {p && (
                      <span style={{
                        fontSize: 11.5, background: '#eff6ff', color: '#1d4ed8',
                        padding: '1px 7px', borderRadius: 4, fontWeight: 500,
                      }}>{p.name} · {p.company}</span>
                    )}
                    <span style={{ fontSize: 11.5, color: '#a1a1aa', marginLeft: 'auto' }}>
                      {new Date(task.created_at).toLocaleString()}
                    </span>
                  </div>
                  {task.payload?.subject && (
                    <div style={{ fontSize: 13, color: '#3f3f46', fontWeight: 500, marginBottom: 2 }}>
                      {task.payload.subject}
                    </div>
                  )}
                  {task.payload?.body && (
                    <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {task.payload.body}
                    </div>
                  )}
                  {task.scheduled_for && (
                    <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
                      Scheduled: {new Date(task.scheduled_for).toLocaleString()}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }}>
                  <button
                    disabled={actioning === task.id}
                    onClick={() => handleTask(task.id, 'approved')}
                    style={{
                      padding: '6px 14px', fontSize: 12.5, fontWeight: 500,
                      background: '#09090b', color: '#fff', border: 'none',
                      borderRadius: 6, cursor: 'pointer', opacity: actioning === task.id ? 0.5 : 1,
                    }}
                  >Approve</button>
                  <button
                    disabled={actioning === task.id}
                    onClick={() => handleTask(task.id, 'rejected')}
                    style={{
                      padding: '6px 14px', fontSize: 12.5, fontWeight: 500,
                      background: '#fff', color: '#71717a',
                      border: '1px solid #e4e4e7', borderRadius: 6, cursor: 'pointer',
                      opacity: actioning === task.id ? 0.5 : 1,
                    }}
                  >Reject</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
