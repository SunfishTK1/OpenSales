import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function TaskModal({ task, prospect, onClose, onAction }) {
  const [subject, setSubject] = useState(task.payload?.subject || '')
  const [body, setBody] = useState(task.payload?.body || task.payload?.demo_plan || task.payload?.notes || '')
  const [actioning, setActioning] = useState(false)

  async function handle(status) {
    setActioning(true)
    const updatedPayload = { ...task.payload }
    if (task.payload?.subject !== undefined) updatedPayload.subject = subject
    if (task.payload?.body !== undefined) updatedPayload.body = body
    if (task.payload?.demo_plan !== undefined) updatedPayload.demo_plan = body
    if (task.payload?.notes !== undefined) updatedPayload.notes = body

    await supabase.from('tasks').update({ status, payload: updatedPayload }).eq('id', task.id)
    onAction(task.id, status)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 560,
        padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#09090b', textTransform: 'capitalize' }}>
              {task.type?.replace(/_/g, ' ')}
            </div>
            {prospect && (
              <div style={{ fontSize: 13, color: '#71717a', marginTop: 2 }}>
                {prospect.name} · {prospect.company}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', fontSize: 20, lineHeight: 1, padding: 0 }}>✕</button>
        </div>

        {/* Subject */}
        {task.payload?.subject !== undefined && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6,
                border: '1px solid #e4e4e7', outline: 'none', color: '#09090b',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Body / notes / demo plan */}
        {body !== undefined && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
              {task.payload?.body !== undefined ? 'Message' : task.payload?.demo_plan !== undefined ? 'Demo Plan' : 'Notes'}
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={8}
              style={{
                width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6,
                border: '1px solid #e4e4e7', outline: 'none', color: '#09090b',
                resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>
        )}

        {/* Scheduled */}
        {task.scheduled_for && (
          <div style={{ fontSize: 12, color: '#71717a' }}>
            Scheduled: {new Date(task.scheduled_for).toLocaleString()}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
          <button
            disabled={actioning}
            onClick={() => handle('rejected')}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 500,
              background: '#fff', color: '#71717a', border: '1px solid #e4e4e7',
              borderRadius: 6, cursor: actioning ? 'not-allowed' : 'pointer',
            }}
          >Reject</button>
          <button
            disabled={actioning}
            onClick={() => handle('approved')}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600,
              background: '#09090b', color: '#fff', border: 'none',
              borderRadius: 6, cursor: actioning ? 'not-allowed' : 'pointer',
              opacity: actioning ? 0.6 : 1,
            }}
          >Approve</button>
        </div>
      </div>
    </div>
  )
}

export default function TaskQueue() {
  const [tasks, setTasks] = useState([])
  const [prospects, setProspects] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)

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

  function handleAction(taskId) {
    setTasks(prev => prev.filter(t => t.id !== taskId))
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
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                style={{
                  background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8,
                  padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 16,
                  borderLeft: '3px solid #f59e0b', cursor: 'pointer',
                  transition: 'box-shadow 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
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
                  {(task.payload?.body || task.payload?.demo_plan || task.payload?.notes) && (
                    <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {task.payload.body || task.payload.demo_plan || task.payload.notes}
                    </div>
                  )}
                  {task.scheduled_for && (
                    <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
                      Scheduled: {new Date(task.scheduled_for).toLocaleString()}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#a1a1aa', flexShrink: 0, alignSelf: 'center' }}>
                  Click to review →
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          prospect={prospects[selectedTask.prospect_id]}
          onClose={() => setSelectedTask(null)}
          onAction={handleAction}
        />
      )}
    </div>
  )
}
