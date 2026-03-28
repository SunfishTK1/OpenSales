import { useState, useEffect, useRef } from 'react'

const STATUS_COLORS = {
  registered: { color: '#92400e', background: '#fef3c7' },
  ongoing:    { color: '#166534', background: '#f0fdf4' },
  ended:      { color: '#52525b', background: '#f4f4f5' },
  error:      { color: '#b91c1c', background: '#fef2f2' },
}

function StatusBadge({ status }) {
  const style = STATUS_COLORS[status] ?? STATUS_COLORS.ended
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 11.5, fontWeight: 500, ...style,
    }}>
      {status || 'unknown'}
    </span>
  )
}

function formatDuration(ms) {
  if (!ms) return '—'
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function formatPhone(number) {
  if (!number) return '—'
  const digits = number.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return number
}

function TranscriptView({ transcript, transcriptEndRef }) {
  if (!transcript || transcript.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#a1a1aa', fontSize: 13 }}>
        No transcript available yet.
      </div>
    )
  }

  return (
    <div style={{
      maxHeight: 360, overflowY: 'auto', padding: '12px 16px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {transcript.map((entry, i) => {
        const isAgent = entry.role === 'agent'
        return (
          <div key={i} style={{
            display: 'flex',
            justifyContent: isAgent ? 'flex-start' : 'flex-end',
          }}>
            <div style={{
              maxWidth: '75%',
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.5,
              color: '#09090b',
              background: isAgent ? '#eff6ff' : '#f4f4f5',
              borderLeft: isAgent ? '3px solid #2563eb' : '3px solid #a1a1aa',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 600, color: '#71717a',
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
              }}>
                {isAgent ? 'Agent' : 'User'}
              </div>
              {entry.content}
            </div>
          </div>
        )
      })}
      <div ref={transcriptEndRef} />
    </div>
  )
}

export default function CallCenter() {
  const [agents, setAgents] = useState([])
  const [phoneNumbers, setPhoneNumbers] = useState([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [selectedFromNumber, setSelectedFromNumber] = useState('')
  const [toNumber, setToNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [launching, setLaunching] = useState(false)
  const [activeCall, setActiveCall] = useState(null)
  const [liveData, setLiveData] = useState(null)
  const [recentCalls, setRecentCalls] = useState([])
  const [viewingCall, setViewingCall] = useState(null)
  const pollRef = useRef(null)
  const transcriptEndRef = useRef(null)

  // Fetch agents, phone numbers, and recent calls on mount
  useEffect(() => {
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => setAgents(Array.isArray(data) ? data : []))
      .catch(() => {})

    fetch('/api/phone-numbers')
      .then(res => res.json())
      .then(data => setPhoneNumbers(Array.isArray(data) ? data : []))
      .catch(() => {})

    fetch('/api/calls?limit=10')
      .then(res => res.json())
      .then(data => setRecentCalls(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  // Poll live call data
  useEffect(() => {
    if (!activeCall?.call_id) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/calls/${activeCall.call_id}/live`)
        const data = await res.json()
        setLiveData(data)
        if (data.call_status === 'ended' || data.call_status === 'error') {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      } catch {}
    }

    poll()
    pollRef.current = setInterval(poll, 2000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [activeCall?.call_id])

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [liveData?.transcript_object])

  async function handleLaunchCall() {
    setLaunching(true)
    try {
      const res = await fetch('/api/calls/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_number: selectedFromNumber,
          to_number: toNumber,
          agent_id: selectedAgent,
          dynamic_variables: { customer_name: customerName },
        }),
      })
      const data = await res.json()
      setActiveCall(data)
      setLiveData(null)
      setViewingCall(null)
    } catch {}
    setLaunching(false)
  }

  function handleNewCall() {
    setActiveCall(null)
    setLiveData(null)
    setViewingCall(null)
    setToNumber('')
    setCustomerName('')
    // Refresh recent calls
    fetch('/api/calls?limit=10')
      .then(res => res.json())
      .then(data => setRecentCalls(Array.isArray(data) ? data : []))
      .catch(() => {})
  }

  function handleViewCall(call) {
    setViewingCall(call)
    setActiveCall(null)
    setLiveData(null)
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const callDisabled = !selectedAgent || !selectedFromNumber || !toNumber || launching
  const currentCallData = liveData || activeCall
  const callEnded = currentCallData?.call_status === 'ended' || currentCallData?.call_status === 'error'

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#09090b', letterSpacing: '-0.3px', margin: 0 }}>
          Call Center
        </h1>
        <p style={{ fontSize: 13, color: '#71717a', margin: '4px 0 0' }}>
          Launch and monitor AI-powered calls in real time.
        </p>
      </div>

      {/* Launch Call Form */}
      <div style={{
        background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8,
        padding: '20px 24px', marginBottom: 16,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: 16,
        }}>
          Launch Call
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {/* Agent Dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{
              fontSize: 11, fontWeight: 600, color: '#71717a',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>Agent</label>
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              style={{
                padding: '7px 10px', fontSize: 13, border: '1px solid #e4e4e7',
                borderRadius: 6, background: '#fff', color: '#09090b',
                cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="">Select agent...</option>
              {agents.map(a => (
                <option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>
              ))}
            </select>
          </div>

          {/* From Number Dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{
              fontSize: 11, fontWeight: 600, color: '#71717a',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>From Number</label>
            <select
              value={selectedFromNumber}
              onChange={e => setSelectedFromNumber(e.target.value)}
              style={{
                padding: '7px 10px', fontSize: 13, border: '1px solid #e4e4e7',
                borderRadius: 6, background: '#fff', color: '#09090b',
                cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="">Select number...</option>
              {phoneNumbers.map(p => (
                <option key={p.phone_number} value={p.phone_number}>
                  {formatPhone(p.phone_number)}
                </option>
              ))}
            </select>
          </div>

          {/* To Number */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{
              fontSize: 11, fontWeight: 600, color: '#71717a',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>To Number</label>
            <input
              value={toNumber}
              onChange={e => setToNumber(e.target.value)}
              placeholder="+1..."
              style={{
                padding: '7px 10px', fontSize: 13, border: '1px solid #e4e4e7',
                borderRadius: 6, background: '#fff', color: '#09090b', outline: 'none',
              }}
            />
          </div>

          {/* Customer Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{
              fontSize: 11, fontWeight: 600, color: '#71717a',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>Customer Name <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
            <input
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Jane Doe"
              style={{
                padding: '7px 10px', fontSize: 13, border: '1px solid #e4e4e7',
                borderRadius: 6, background: '#fff', color: '#09090b', outline: 'none',
              }}
            />
          </div>
        </div>

        <button
          onClick={handleLaunchCall}
          disabled={callDisabled}
          style={{
            padding: '10px 28px', fontSize: 14, fontWeight: 600, border: 'none',
            borderRadius: 6, background: callDisabled ? '#93c5fd' : '#2563eb',
            color: '#fff', cursor: callDisabled ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {launching ? 'Calling...' : 'Call'}
        </button>
      </div>

      {/* Active Call Panel */}
      {(activeCall || viewingCall) && (
        <div style={{
          background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8,
          padding: '20px 24px', marginBottom: 16,
        }}>
          {/* Active call header */}
          {activeCall && !viewingCall && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 16,
              }}>
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: 6,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    {!callEnded && (
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: currentCallData?.call_status === 'ongoing' ? '#22c55e' : '#f59e0b',
                        display: 'inline-block',
                        animation: currentCallData?.call_status === 'ongoing' ? 'livePulse 1.5s infinite' : 'none',
                      }} />
                    )}
                    {callEnded ? 'Call Ended' : currentCallData?.call_status === 'ongoing' ? 'Live Call' : 'Connecting...'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, color: '#09090b', fontFamily: 'monospace' }}>
                      {activeCall.call_id}
                    </span>
                    <StatusBadge status={currentCallData?.call_status || activeCall.call_status} />
                  </div>
                </div>
                {!callEnded && (
                  <div style={{ fontSize: 12, color: '#71717a' }}>
                    Polling every 2s
                  </div>
                )}
              </div>

              {/* Live Transcript */}
              <div style={{
                fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase',
                letterSpacing: '0.06em', marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                Live Transcript
                {!callEnded && (
                  <span style={{
                    fontSize: 10, fontWeight: 500, color: '#22c55e',
                    textTransform: 'none', letterSpacing: 'normal',
                  }}>streaming</span>
                )}
              </div>
              <div style={{
                border: '1px solid #e4e4e7', borderRadius: 6, marginBottom: 16,
                background: callEnded ? '#fafafa' : '#fff',
                borderColor: !callEnded && currentCallData?.call_status === 'ongoing' ? '#bbf7d0' : '#e4e4e7',
              }}>
                <TranscriptView
                  transcript={liveData?.transcript_object}
                  transcriptEndRef={transcriptEndRef}
                />
              </div>

              {/* Call Ended Summary */}
              {callEnded && currentCallData && (
                <div style={{
                  border: '1px solid #e4e4e7', borderRadius: 6, padding: '16px 20px',
                  background: '#fafafa', marginBottom: 12,
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: 12,
                  }}>
                    Call Summary
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>Duration</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#09090b' }}>
                        {formatDuration(currentCallData.duration_ms)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>Disconnection Reason</div>
                      <div style={{ fontSize: 13, color: '#09090b' }}>
                        {currentCallData.disconnection_reason || '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>Status</div>
                      <StatusBadge status={currentCallData.call_status} />
                    </div>
                  </div>

                  {currentCallData.call_analysis && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>Analysis</div>
                      <pre style={{
                        fontSize: 12, color: '#09090b', lineHeight: 1.5,
                        background: '#f4f4f5', padding: 12, borderRadius: 6,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
                      }}>
                        {typeof currentCallData.call_analysis === 'string'
                          ? currentCallData.call_analysis
                          : JSON.stringify(currentCallData.call_analysis, null, 2)}
                      </pre>
                    </div>
                  )}

                  {currentCallData.recording_url && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 4 }}>Recording Playback</div>
                      <audio controls src={currentCallData.recording_url} style={{ width: '100%' }} />
                    </div>
                  )}

                  <button
                    onClick={handleNewCall}
                    style={{
                      padding: '8px 20px', fontSize: 13, fontWeight: 600, border: 'none',
                      borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer',
                      marginTop: 4,
                    }}
                  >
                    New Call
                  </button>
                </div>
              )}

              <style>{`
                @keyframes livePulse {
                  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
                  50% { opacity: 0.6; box-shadow: 0 0 0 4px rgba(34,197,94,0); }
                }
              `}</style>
            </>
          )}

          {/* Viewing Past Call */}
          {viewingCall && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 16,
              }}>
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: 6,
                  }}>
                    Call Details
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, color: '#09090b', fontFamily: 'monospace' }}>
                      {viewingCall.call_id}
                    </span>
                    <StatusBadge status={viewingCall.call_status} />
                  </div>
                </div>
                <button
                  onClick={() => setViewingCall(null)}
                  style={{
                    padding: '6px 14px', fontSize: 12, border: '1px solid #e4e4e7',
                    borderRadius: 6, background: '#fff', color: '#71717a', cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>

              {/* Past call summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>Duration</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#09090b' }}>
                    {formatDuration(viewingCall.duration_ms)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>To Number</div>
                  <div style={{ fontSize: 13, color: '#09090b' }}>
                    {formatPhone(viewingCall.to_number)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>Disconnection Reason</div>
                  <div style={{ fontSize: 13, color: '#09090b' }}>
                    {viewingCall.disconnection_reason || '—'}
                  </div>
                </div>
              </div>

              {viewingCall.call_analysis && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 2 }}>Analysis</div>
                  <div style={{ fontSize: 13, color: '#09090b', lineHeight: 1.5 }}>
                    {typeof viewingCall.call_analysis === 'string'
                      ? viewingCall.call_analysis
                      : JSON.stringify(viewingCall.call_analysis, null, 2)}
                  </div>
                </div>
              )}

              {viewingCall.recording_url && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 4 }}>Recording</div>
                  <audio controls src={viewingCall.recording_url} style={{ width: '100%' }} />
                </div>
              )}

              <div style={{
                fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase',
                letterSpacing: '0.06em', marginBottom: 8, marginTop: 8,
              }}>
                Transcript
              </div>
              <div style={{
                border: '1px solid #e4e4e7', borderRadius: 6, background: '#fafafa',
              }}>
                <TranscriptView
                  transcript={viewingCall.transcript_object}
                  transcriptEndRef={transcriptEndRef}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Call History */}
      <div style={{
        background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8, overflow: 'hidden',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase',
          letterSpacing: '0.06em', padding: '16px 24px 12px',
        }}>
          Recent Calls
        </div>

        {recentCalls.length === 0 ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: '#a1a1aa', fontSize: 13 }}>
            No calls yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e4e4e7' }}>
                {['Call ID', 'Agent', 'To Number', 'Duration', 'Status', 'Date'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left', fontWeight: 600,
                    fontSize: 11, color: '#71717a', textTransform: 'uppercase',
                    letterSpacing: '0.05em', background: '#fafafa',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentCalls.map((call, i) => (
                <tr
                  key={call.call_id}
                  onClick={() => handleViewCall(call)}
                  style={{
                    borderBottom: i < recentCalls.length - 1 ? '1px solid #f4f4f5' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '11px 16px', fontFamily: 'monospace', color: '#09090b' }}>
                    {call.call_id ? call.call_id.slice(0, 12) + '...' : '—'}
                  </td>
                  <td style={{ padding: '11px 16px', color: '#3f3f46' }}>
                    {call.agent_name || '—'}
                  </td>
                  <td style={{ padding: '11px 16px', color: '#3f3f46' }}>
                    {formatPhone(call.to_number)}
                  </td>
                  <td style={{ padding: '11px 16px', color: '#3f3f46' }}>
                    {formatDuration(call.duration_ms)}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <StatusBadge status={call.call_status} />
                  </td>
                  <td style={{ padding: '11px 16px', color: '#71717a', fontSize: 12 }}>
                    {call.created_at ? new Date(call.created_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
