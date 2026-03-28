import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Markdown from 'react-markdown'

export default function CRM() {
  const [prospects, setProspects] = useState([])
  const [selected, setSelected] = useState(null)
  const [comms, setComms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('prospects')
        .select('*')
        .order('created_at', { ascending: false })
      setProspects(data || [])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selected) { setComms([]); return }
    async function loadComms() {
      const { data } = await supabase
        .from('communications')
        .select('*')
        .eq('prospect_id', selected.id)
        .order('created_at', { ascending: false })
      setComms(data || [])
    }
    loadComms()
  }, [selected?.id])

  // Extract call summaries from notes
  function getCallSummaries(notes) {
    if (!notes) return []
    const parts = notes.split(/\[Call Summary — /)
    return parts.slice(1).map(p => {
      const dateEnd = p.indexOf(']')
      const date = p.slice(0, dateEnd)
      const rest = p.slice(dateEnd + 1).trim()
      // Take until next [Call Summary or end
      const nextIdx = rest.indexOf('\n[Call Summary')
      const body = nextIdx >= 0 ? rest.slice(0, nextIdx).trim() : rest.trim()
      return { date, body }
    })
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#09090b', letterSpacing: '-0.3px', margin: 0, textTransform: 'uppercase' }}>
          CRM
        </h1>
        <p style={{ fontSize: 12, color: '#71717a', margin: '6px 0 0', fontWeight: 500 }}>
          Prospect profiles enriched with AI call summaries.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Prospect list */}
        <div style={{
          width: 320, flexShrink: 0,
          background: '#fff', border: '2px solid #09090b',
          boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6,
          overflow: 'hidden',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase',
            letterSpacing: '0.1em', padding: '14px 16px 10px',
            borderBottom: '2px solid #09090b', background: '#f5f5f0',
          }}>
            Prospects
          </div>
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#71717a', fontSize: 12 }}>Loading...</div>
            ) : prospects.map((p, i) => {
              const isSelected = selected?.id === p.id
              const hasSummary = p.notes && p.notes.includes('[Call Summary')
              return (
                <div
                  key={p.id}
                  onClick={() => setSelected(p)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer',
                    background: isSelected ? '#09090b' : '#fff',
                    color: isSelected ? '#fff' : '#09090b',
                    borderBottom: i < prospects.length - 1 ? '1px solid #e5e5e0' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f5f5f0' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#fff' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                    {hasSummary && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, textTransform: 'uppercase',
                        padding: '2px 6px', borderRadius: 3,
                        background: isSelected ? '#166534' : '#f0fdf4',
                        color: isSelected ? '#fff' : '#166534',
                        border: `1.5px solid ${isSelected ? '#166534' : '#166534'}`,
                      }}>Call</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: isSelected ? '#a1a1aa' : '#71717a', fontWeight: 500, marginTop: 2 }}>
                    {p.company || '—'} · {p.stage}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div style={{ flex: 1 }}>
          {!selected ? (
            <div style={{
              background: '#fff', border: '2px solid #09090b',
              boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6,
              padding: 40, textAlign: 'center', color: '#71717a', fontSize: 12, fontWeight: 500,
            }}>
              Select a prospect to view their CRM profile.
            </div>
          ) : (
            <div style={{
              background: '#fff', border: '2px solid #09090b',
              boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6,
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 20px', borderBottom: '2px solid #09090b', background: '#f5f5f0',
              }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#09090b' }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: '#71717a', fontWeight: 500, marginTop: 2 }}>
                  {selected.title || ''}{selected.title && selected.company ? ' at ' : ''}{selected.company || ''}
                </div>
              </div>

              <div style={{ padding: '16px 20px' }}>
                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Stage</div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                      padding: '2px 8px', borderRadius: 3, border: '1.5px solid #09090b',
                      background: '#f5f5f0',
                    }}>{selected.stage}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Fit Score</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{selected.score ?? '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Intent</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{selected.intent_score ?? '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Status</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{selected.status}</div>
                  </div>
                </div>

                {/* Call Summaries */}
                {(() => {
                  const summaries = getCallSummaries(selected.notes)
                  if (summaries.length === 0) return null
                  return (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 10 }}>
                        Call Summaries
                      </div>
                      {summaries.map((s, i) => (
                        <div key={i} style={{
                          padding: 14, border: '2px solid #09090b', borderRadius: 4,
                          background: '#fff', marginBottom: 10,
                          boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#71717a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {s.date}
                          </div>
                          <div style={{ fontSize: 12, lineHeight: 1.7, color: '#09090b', fontWeight: 500 }} className="summary-md">
                            <Markdown>{s.body}</Markdown>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Notes (non-summary part) */}
                {selected.notes && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>
                      Notes
                    </div>
                    <div style={{
                      fontSize: 12, lineHeight: 1.6, color: '#09090b', fontWeight: 500,
                      padding: 12, border: '2px solid #09090b', borderRadius: 4, background: '#f5f5f0',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {selected.notes.replace(/\[Call Summary — [\s\S]*?(?=\n\n|$)/g, '').trim() || 'No additional notes.'}
                    </div>
                  </div>
                )}

                {/* Communications */}
                {comms.length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 10 }}>
                      Communications
                    </div>
                    {comms.map(c => (
                      <div key={c.id} style={{
                        padding: '10px 14px', borderBottom: '1px solid #e5e5e0',
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                      }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                          padding: '2px 6px', borderRadius: 3,
                          background: c.channel === 'call' ? '#eff6ff' : '#f5f5f0',
                          color: c.channel === 'call' ? '#1d4ed8' : '#52525b',
                          border: `1.5px solid ${c.channel === 'call' ? '#1d4ed8' : '#52525b'}`,
                          flexShrink: 0, marginTop: 2,
                        }}>{c.channel}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#09090b' }}>
                            {c.subject || c.channel}
                          </div>
                          <div style={{ fontSize: 11, color: '#71717a', fontWeight: 500, marginTop: 2 }}>
                            {c.content?.slice(0, 120)}{c.content?.length > 120 ? '...' : ''}
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: '#a1a1aa', flexShrink: 0, fontWeight: 500 }}>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .summary-md h1, .summary-md h2, .summary-md h3 { font-size: 13px; font-weight: 700; margin: 10px 0 4px; }
        .summary-md p { margin: 0 0 8px; }
        .summary-md ul, .summary-md ol { margin: 0 0 8px; padding-left: 18px; }
        .summary-md li { margin-bottom: 4px; }
        .summary-md strong { font-weight: 700; }
      `}</style>
    </div>
  )
}
