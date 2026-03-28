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
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#fff',
        border: '2px solid #09090b',
        boxShadow: '6px 6px 0 0 rgba(0,0,0,1)',
        borderRadius: 8,
        width: '100%', maxWidth: 560,
        padding: 28,
        display: 'flex', flexDirection: 'column', gap: 16,
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#09090b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {task.type?.replace(/_/g, ' ')}
            </div>
            {prospect && (
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 4, fontWeight: 500 }}>
                {prospect.name} · {prospect.company}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            background: '#f5f5f0', border: '2px solid #09090b', cursor: 'pointer',
            color: '#09090b', fontSize: 14, lineHeight: 1, padding: '4px 8px',
            borderRadius: 4, fontWeight: 700,
          }}>✕</button>
        </div>

        {/* Subject */}
        {task.payload?.subject !== undefined && (
          <div>
            <label style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 4,
                border: '2px solid #09090b', outline: 'none', color: '#09090b',
                boxSizing: 'border-box', fontWeight: 500,
                fontFamily: 'inherit',
              }}
            />
          </div>
        )}

        {/* Body / notes / demo plan */}
        {body !== undefined && (
          <div>
            <label style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 6 }}>
              {task.payload?.body !== undefined ? 'Message' : task.payload?.demo_plan !== undefined ? 'Demo Plan' : 'Notes'}
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={8}
              style={{
                width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 4,
                border: '2px solid #09090b', outline: 'none', color: '#09090b',
                resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box',
                fontFamily: 'inherit', fontWeight: 500,
              }}
            />
          </div>
        )}

        {/* Scheduled */}
        {task.scheduled_for && (
          <div style={{ fontSize: 11, color: '#71717a', fontWeight: 500 }}>
            Scheduled: {new Date(task.scheduled_for).toLocaleString()}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
          <button
            disabled={actioning}
            onClick={() => handle('rejected')}
            className="nb-btn-sm"
            style={{
              padding: '8px 18px', fontSize: 11, fontWeight: 700,
              background: '#fff', color: '#09090b',
              border: '2px solid #09090b', borderRadius: 4,
              cursor: actioning ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              boxShadow: '3px 3px 0 0 rgba(0,0,0,1)',
              transition: 'transform 0.05s, box-shadow 0.05s',
            }}
          >Reject</button>
          <button
            disabled={actioning}
            onClick={() => handle('approved')}
            className="nb-btn"
            style={{
              padding: '8px 18px', fontSize: 11, fontWeight: 700,
              background: '#09090b', color: '#fff',
              border: '2px solid #09090b', borderRadius: 4,
              cursor: actioning ? 'not-allowed' : 'pointer',
              opacity: actioning ? 0.6 : 1,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              boxShadow: '4px 4px 0 0 rgba(0,0,0,1)',
              transition: 'transform 0.05s, box-shadow 0.05s',
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

  if (loading) return (
    <div style={{ padding: 40, color: '#71717a', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      Loading...
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="mono" style={{ fontSize: 20, fontWeight: 700, color: '#09090b', letterSpacing: '-0.3px', margin: 0, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 10 }}>
          Approvals
          {tasks.length > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: '#fef3c7', color: '#92400e',
              padding: '3px 8px', borderRadius: 3,
              border: '1.5px solid #92400e',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>{tasks.length} pending</span>
          )}
        </h1>
        <p style={{ fontSize: 12, color: '#71717a', margin: '6px 0 0', fontWeight: 500 }}>Review and approve actions before the AI executes them.</p>
      </div>

      {!tasks.length ? (
        <div style={{
          background: '#fff',
          border: '2px solid #09090b',
          boxShadow: '4px 4px 0 0 rgba(0,0,0,1)',
          borderRadius: 6,
          padding: 48, textAlign: 'center', color: '#71717a', fontSize: 12, fontWeight: 500,
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
                  background: '#fff',
                  border: '2px solid #09090b',
                  boxShadow: '4px 4px 0 0 rgba(0,0,0,1)',
                  borderRadius: 6,
                  padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 16,
                  borderLeft: '4px solid #f59e0b', cursor: 'pointer',
                  transition: 'transform 0.05s, box-shadow 0.05s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-1px, -1px)'; e.currentTarget.style.boxShadow = '5px 5px 0 0 rgba(0,0,0,1)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '4px 4px 0 0 rgba(0,0,0,1)' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#09090b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {task.type?.replace(/_/g, ' ')}
                    </span>
                    {p && (
                      <span style={{
                        fontSize: 10, background: '#eff6ff', color: '#1d4ed8',
                        padding: '2px 8px', borderRadius: 3, fontWeight: 700,
                        border: '1.5px solid #1d4ed8',
                        textTransform: 'uppercase', letterSpacing: '0.03em',
                      }}>{p.name} · {p.company}</span>
                    )}
                    <span style={{ fontSize: 10, color: '#71717a', marginLeft: 'auto', fontWeight: 500 }}>
                      {new Date(task.created_at).toLocaleString()}
                    </span>
                  </div>
                  {task.payload?.subject && (
                    <div style={{ fontSize: 12, color: '#3f3f46', fontWeight: 600, marginBottom: 4 }}>
                      {task.payload.subject}
                    </div>
                  )}
                  {(task.payload?.body || task.payload?.demo_plan || task.payload?.notes) && (
                    <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', fontWeight: 500 }}>
                      {task.payload.body || task.payload.demo_plan || task.payload.notes}
                    </div>
                  )}
                  {task.scheduled_for && (
                    <div style={{ fontSize: 11, color: '#71717a', marginTop: 4, fontWeight: 500 }}>
                      Scheduled: {new Date(task.scheduled_for).toLocaleString()}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#71717a', flexShrink: 0, alignSelf: 'center', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Review →
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
