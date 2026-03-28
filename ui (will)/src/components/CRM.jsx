import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Markdown from 'react-markdown'

const STAGE_STYLES = {
  research:       { color: '#52525b', background: '#f4f4f5', border: '1.5px solid #52525b' },
  outreach:       { color: '#1d4ed8', background: '#eff6ff', border: '1.5px solid #1d4ed8' },
  responded:      { color: '#92400e', background: '#fef3c7', border: '1.5px solid #92400e' },
  discovery_call: { color: '#6d28d9', background: '#f5f3ff', border: '1.5px solid #6d28d9' },
  high_intent:    { color: '#c2410c', background: '#fff7ed', border: '1.5px solid #c2410c' },
  demo:           { color: '#be185d', background: '#fdf2f8', border: '1.5px solid #be185d' },
  negotiation:    { color: '#b91c1c', background: '#fef2f2', border: '1.5px solid #b91c1c' },
  pilot:          { color: '#0f766e', background: '#f0fdfa', border: '1.5px solid #0f766e' },
  closed:         { color: '#166534', background: '#f0fdf4', border: '1.5px solid #166534' },
}
const STATUS_STYLES = {
  active:   { color: '#166534', background: '#f0fdf4', border: '1.5px solid #166534' },
  rejected: { color: '#b91c1c', background: '#fef2f2', border: '1.5px solid #b91c1c' },
  cold:     { color: '#71717a', background: '#f4f4f5', border: '1.5px solid #71717a' },
}
const CHANNEL_STYLES = {
  email: { color: '#1d4ed8', background: '#eff6ff', border: '1.5px solid #1d4ed8' },
  call:  { color: '#6d28d9', background: '#f5f3ff', border: '1.5px solid #6d28d9' },
  sms:   { color: '#0f766e', background: '#f0fdfa', border: '1.5px solid #0f766e' },
}

function Badge({ label, styleObj }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 3,
      fontSize: 10, fontWeight: 700, textTransform: 'capitalize',
      letterSpacing: '0.03em', whiteSpace: 'nowrap', ...styleObj,
    }}>
      {label?.replace(/_/g, ' ')}
    </span>
  )
}

function ScoreBar({ value, color = '#2563eb', width = 56 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ width, height: 6, background: '#f5f5f0', border: '1px solid #e4e4e7', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value ?? 0}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#52525b', minWidth: 22 }}>{value ?? 0}</span>
    </div>
  )
}

function getCallSummaries(notes) {
  if (!notes) return []
  const parts = notes.split(/\[Call Summary — /)
  return parts.slice(1).map(p => {
    const dateEnd = p.indexOf(']')
    const date = p.slice(0, dateEnd)
    const rest = p.slice(dateEnd + 1).trim()
    const nextIdx = rest.indexOf('\n[Call Summary')
    const body = nextIdx >= 0 ? rest.slice(0, nextIdx).trim() : rest.trim()
    return { date, body }
  })
}

function getNonSummaryNotes(notes) {
  if (!notes) return ''
  return notes.replace(/\[Call Summary — [\s\S]*?(?=\n\[Call Summary|$)/g, '').trim()
}

export default function CRM() {
  const [prospects, setProspects] = useState([])
  const [selected, setSelected] = useState(null)
  const [comms, setComms] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('prospects').select('*').order('score', { ascending: false })
      .then(({ data }) => { setProspects(data || []); setLoading(false) })
  }, [])

  useEffect(() => {
    if (!selected) { setComms([]); return }
    supabase.from('communications').select('*')
      .eq('prospect_id', selected.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setComms(data || []))
  }, [selected?.id])

  const filtered = prospects.filter(p =>
    !search || [p.name, p.company, p.stage, p.email].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="mono" style={{ fontSize: 20, fontWeight: 700, color: '#09090b', letterSpacing: '-0.3px', margin: 0, textTransform: 'uppercase' }}>
          CRM
        </h1>
        <p style={{ fontSize: 12, color: '#71717a', margin: '6px 0 0', fontWeight: 500 }}>
          Prospect profiles enriched with AI call summaries.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Sidebar */}
        <div style={{
          width: 300, flexShrink: 0,
          background: '#fff', border: '2px solid #09090b',
          boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6,
          overflow: 'hidden',
        }}>
          {/* Search */}
          <div style={{ padding: '10px 12px', borderBottom: '2px solid #09090b', background: '#f5f5f0' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search prospects..."
              style={{
                width: '100%', padding: '6px 10px', fontSize: 12, fontWeight: 500,
                border: '2px solid #09090b', borderRadius: 4, background: '#fff',
                outline: 'none', color: '#09090b', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#71717a', fontSize: 12 }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#71717a', fontSize: 12 }}>No prospects found.</div>
            ) : filtered.map((p, i) => {
              const isSelected = selected?.id === p.id
              const hasSummary = p.notes?.includes('[Call Summary')
              const stageStyle = STAGE_STYLES[p.stage] ?? STAGE_STYLES.research
              return (
                <div
                  key={p.id}
                  onClick={() => setSelected(p)}
                  style={{
                    padding: '11px 14px', cursor: 'pointer',
                    background: isSelected ? '#09090b' : '#fff',
                    borderBottom: i < filtered.length - 1 ? '1px solid #e4e4e7' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f5f5f0' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#fff' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? '#fff' : '#09090b', lineHeight: 1.3 }}>
                      {p.name}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {hasSummary && (
                        <span style={{
                          fontSize: 8, fontWeight: 700, textTransform: 'uppercase', padding: '2px 5px',
                          borderRadius: 3, background: isSelected ? '#7c3aed' : '#f5f3ff',
                          color: isSelected ? '#fff' : '#6d28d9', border: '1.5px solid #6d28d9',
                        }}>Call</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: isSelected ? '#a1a1aa' : '#71717a', fontWeight: 500, marginBottom: 6 }}>
                    {p.company || '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'capitalize', padding: '1px 6px',
                      borderRadius: 3, letterSpacing: '0.03em',
                      ...(isSelected
                        ? { background: 'rgba(255,255,255,0.15)', color: '#e4e4e7', border: '1.5px solid rgba(255,255,255,0.3)' }
                        : stageStyle
                      ),
                    }}>
                      {p.stage?.replace(/_/g, ' ')}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 36, height: 4, background: isSelected ? 'rgba(255,255,255,0.2)' : '#f5f5f0', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${p.score ?? 0}%`, background: isSelected ? '#60a5fa' : '#2563eb', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: isSelected ? '#93c5fd' : '#52525b' }}>{p.score ?? 0}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!selected ? (
            <div style={{
              background: '#fff', border: '2px solid #09090b',
              boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6,
              padding: '48px 24px', textAlign: 'center', color: '#71717a', fontSize: 12, fontWeight: 500,
            }}>
              Select a prospect to view their profile.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Header card */}
              <div style={{
                background: '#fff', border: '2px solid #09090b',
                boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6,
                padding: '18px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#09090b', letterSpacing: '-0.3px' }}>{selected.name}</div>
                    {(selected.title || selected.company) && (
                      <div style={{ fontSize: 12, color: '#71717a', fontWeight: 500, marginTop: 3 }}>
                        {selected.title}{selected.title && selected.company ? ' · ' : ''}{selected.company}
                      </div>
                    )}
                    {selected.email && (
                      <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{selected.email}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <Badge label={selected.stage} styleObj={STAGE_STYLES[selected.stage] ?? STAGE_STYLES.research} />
                    <Badge label={selected.status} styleObj={STATUS_STYLES[selected.status] ?? STATUS_STYLES.active} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>Fit Score</div>
                    <ScoreBar value={selected.score} width={64} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>Intent Score</div>
                    <ScoreBar value={selected.intent_score} color="#ea580c" width={64} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>LinkedIn</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#09090b' }}>
                      {selected.linkedin_url
                        ? <a href={selected.linkedin_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>View Profile</a>
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>Phone</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#09090b' }}>{selected.phone || '—'}</div>
                  </div>
                </div>
              </div>

              {/* CRM Intel (from call analysis) */}
              {(selected.crm_tags?.length > 0 || selected.product_interest || selected.qualification_score > 0 || selected.primary_use_case) && (
                <div style={{
                  background: '#fff', border: '2px solid #09090b',
                  boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6,
                  overflow: 'hidden',
                }}>
                  <div style={{ padding: '12px 20px', borderBottom: '2px solid #09090b', background: '#f5f5f0', fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Call Intelligence
                  </div>
                  <div style={{ padding: '14px 20px' }}>
                    {/* Tags */}
                    {selected.crm_tags?.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 8 }}>CRM Tags</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {selected.crm_tags.map(tag => (
                            <span key={tag} style={{
                              fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 3,
                              border: '1.5px solid #6d28d9', background: '#f5f3ff', color: '#6d28d9',
                            }}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                      {selected.product_interest && (
                        <div>
                          <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Product Interest</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#09090b' }}>{selected.product_interest}</div>
                        </div>
                      )}
                      {selected.qualification_score > 0 && (
                        <div>
                          <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Qual Score</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#09090b' }}>{selected.qualification_score} / 5</div>
                        </div>
                      )}
                      {selected.expected_maus && (
                        <div>
                          <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Expected MAUs</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#09090b' }}>{selected.expected_maus}</div>
                        </div>
                      )}
                      {selected.primary_use_case && (
                        <div>
                          <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Use Case</div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#09090b' }}>{selected.primary_use_case}</div>
                        </div>
                      )}
                      {selected.competitor && (
                        <div>
                          <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Competitor</div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#09090b' }}>{selected.competitor}</div>
                        </div>
                      )}
                      {selected.follow_up_sequence && (
                        <div>
                          <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Follow-Up</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#09090b' }}>Sequence {selected.follow_up_sequence}</div>
                        </div>
                      )}
                    </div>

                    {selected.objections && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Objections</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#09090b' }}>{selected.objections}</div>
                      </div>
                    )}
                    {selected.next_step && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Next Step</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#09090b' }}>{selected.next_step}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Call summaries */}
              {(() => {
                const summaries = getCallSummaries(selected.notes)
                if (!summaries.length) return null
                return (
                  <div style={{
                    background: '#fff', border: '2px solid #09090b',
                    boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6,
                    overflow: 'hidden',
                  }}>
                    <div style={{ padding: '12px 20px', borderBottom: '2px solid #09090b', background: '#f5f5f0', fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Call Summaries ({summaries.length})
                    </div>
                    <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {summaries.map((s, i) => (
                        <div key={i} style={{
                          padding: '12px 16px', border: '2px solid #09090b', borderRadius: 4,
                          background: '#fafaf9', boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
                        }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6d28d9', display: 'inline-block' }} />
                            {s.date}
                          </div>
                          <div className="summary-md" style={{ fontSize: 12, lineHeight: 1.7, color: '#09090b' }}>
                            <Markdown>{s.body}</Markdown>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Notes */}
              {getNonSummaryNotes(selected.notes) && (
                <div style={{
                  background: '#fff', border: '2px solid #09090b',
                  boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6,
                  overflow: 'hidden',
                }}>
                  <div style={{ padding: '12px 20px', borderBottom: '2px solid #09090b', background: '#f5f5f0', fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Notes
                  </div>
                  <div style={{ padding: '14px 20px', fontSize: 12, lineHeight: 1.7, color: '#09090b', fontWeight: 500, whiteSpace: 'pre-wrap' }}>
                    {getNonSummaryNotes(selected.notes)}
                  </div>
                </div>
              )}

              {/* Communications */}
              {comms.length > 0 && (
                <div style={{
                  background: '#fff', border: '2px solid #09090b',
                  boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6,
                  overflow: 'hidden',
                }}>
                  <div style={{ padding: '12px 20px', borderBottom: '2px solid #09090b', background: '#f5f5f0', fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Communications ({comms.length})
                  </div>
                  <div>
                    {comms.map((c, i) => (
                      <div key={c.id} style={{
                        padding: '12px 20px',
                        borderBottom: i < comms.length - 1 ? '1px solid #e4e4e7' : 'none',
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                      }}>
                        <Badge label={c.channel} styleObj={CHANNEL_STYLES[c.channel] ?? { color: '#52525b', background: '#f5f5f0', border: '1.5px solid #52525b' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#09090b', marginBottom: 2 }}>
                            {c.subject || c.channel}
                          </div>
                          {c.content && (
                            <div style={{ fontSize: 11, color: '#71717a', fontWeight: 500, lineHeight: 1.5 }}>
                              {c.content.slice(0, 140)}{c.content.length > 140 ? '...' : ''}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: '#a1a1aa', flexShrink: 0, fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      <style>{`
        .summary-md h1, .summary-md h2, .summary-md h3 { font-size: 13px; font-weight: 700; margin: 8px 0 4px; }
        .summary-md p { margin: 0 0 6px; }
        .summary-md ul, .summary-md ol { margin: 0 0 6px; padding-left: 18px; }
        .summary-md li { margin-bottom: 3px; }
        .summary-md strong { font-weight: 700; }
      `}</style>
    </div>
  )
}
