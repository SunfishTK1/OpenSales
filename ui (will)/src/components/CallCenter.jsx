import { useState, useEffect, useRef } from 'react'
import Markdown from 'react-markdown'

const STATUS_COLORS = {
  registered: { color: '#92400e', background: '#fef3c7', border: '1.5px solid #92400e' },
  ongoing:    { color: '#166534', background: '#f0fdf4', border: '1.5px solid #166534' },
  ended:      { color: '#52525b', background: '#f4f4f5', border: '1.5px solid #52525b' },
  error:      { color: '#b91c1c', background: '#fef2f2', border: '1.5px solid #b91c1c' },
}

function StatusBadge({ status }) {
  const style = STATUS_COLORS[status] ?? STATUS_COLORS.ended
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 3,
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
      ...style,
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

function FormField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  padding: '8px 10px', fontSize: 12, fontWeight: 500,
  border: '2px solid #09090b', borderRadius: 4,
  background: '#fff', color: '#09090b', outline: 'none',
  fontFamily: 'inherit',
}

function TranscriptView({ transcript, plainTranscript, isLive, transcriptEndRef }) {
  if ((!transcript || transcript.length === 0) && !plainTranscript) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#71717a', fontSize: 12, fontWeight: 500 }}>
        {isLive ? (
          <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', background: '#16a34a',
                display: 'inline-block', animation: 'liveDot 1.2s infinite',
              }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#09090b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Call in progress
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#71717a', fontWeight: 500, lineHeight: 1.5 }}>
              Transcript will appear once the call ends.
            </div>
          </div>
        ) : 'No transcript available.'}
      </div>
    )
  }

  // Fall back to plain transcript string if no structured transcript_object
  if ((!transcript || transcript.length === 0) && plainTranscript) {
    return (
      <div style={{ maxHeight: 360, overflowY: 'auto', padding: '12px 16px' }}>
        <div style={{ fontSize: 12, lineHeight: 1.6, color: '#09090b', whiteSpace: 'pre-wrap', fontWeight: 500 }}>
          {plainTranscript}
        </div>
        <div ref={transcriptEndRef} />
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
          <div key={i} style={{ display: 'flex', justifyContent: isAgent ? 'flex-start' : 'flex-end' }}>
            <div style={{
              maxWidth: '75%',
              padding: '8px 12px',
              borderRadius: 4,
              border: '2px solid #09090b',
              fontSize: 12, lineHeight: 1.5, color: '#09090b',
              background: isAgent ? '#f0f7ff' : '#f5f5f0',
              boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, color: '#71717a',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4,
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
  const [summarizing, setSummarizing] = useState(false)
  const [summary, setSummary] = useState(null)
  const [linkedProspect, setLinkedProspect] = useState(null)
  const [backendOnline, setBackendOnline] = useState(null) // null=checking, true, false
  const pollRef = useRef(null)
  const transcriptEndRef = useRef(null)

  useEffect(() => {
    // Single health check — if it fails, mark offline and stop. No retries.
    fetch('/api/agents')
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(data => {
        setBackendOnline(true)
        setAgents(Array.isArray(data) ? data : [])
        return Promise.all([
          fetch('/api/phone-numbers').then(r => r.json()).catch(() => []),
          fetch('/api/calls?limit=10').then(r => r.json()).catch(() => []),
        ])
      })
      .then(([nums, calls]) => {
        setPhoneNumbers(Array.isArray(nums) ? nums : [])
        setRecentCalls(Array.isArray(calls) ? calls : [])
      })
      .catch(() => setBackendOnline(false))
  }, [])

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
          // Re-fetch after 3s to get final transcript + recording (Retell processes post-call)
          setTimeout(async () => {
            try {
              const finalRes = await fetch(`/api/calls/${activeCall.call_id}/live`)
              const finalData = await finalRes.json()
              setLiveData(finalData)
            } catch {}
          }, 3000)
        }
      } catch {}
    }

    poll()
    pollRef.current = setInterval(poll, 1000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [activeCall?.call_id])

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
    setSummary(null)
    setToNumber('')
    setCustomerName('')
    if (backendOnline) {
      fetch('/api/calls?limit=10')
        .then(res => res.json())
        .then(data => setRecentCalls(Array.isArray(data) ? data : []))
        .catch(() => {})
    }
  }

  function handleViewCall(call) {
    setViewingCall(call)
    setActiveCall(null)
    setLiveData(null)
    setSummary(null)
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  async function handleSummarize(callData) {
    const transcript = callData?.transcript
      || callData?.transcript_object?.map(e => `${e.role}: ${e.content}`).join('\n')
    if (!transcript) return
    setSummarizing(true)
    setSummary(null)
    setLinkedProspect(null)

    const customerName = callData?.customer_name
      || callData?.retell_llm_dynamic_variables?.customer_name
      || callData?.collected_variables?.customer_name
      || callData?.metadata?.customer_name
      || ''

    try {
      const res = await fetch(`/api/calls/${callData.call_id}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, customer_name: customerName }),
      })
      const data = await res.json()
      if (data.summary) setSummary(data.summary)
      else setSummary('Failed to generate summary.')
      if (data.prospect) setLinkedProspect(data.prospect)
    } catch {
      setSummary('Failed to generate summary.')
    }
    setSummarizing(false)
  }

  const callDisabled = !selectedAgent || !selectedFromNumber || !toNumber || launching
  const currentCallData = liveData || activeCall
  const callEnded = currentCallData?.call_status === 'ended' || currentCallData?.call_status === 'error'

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#09090b', letterSpacing: '-0.3px', margin: 0, textTransform: 'uppercase' }}>
          Call Center
        </h1>
        <p style={{ fontSize: 12, color: '#71717a', margin: '6px 0 0', fontWeight: 500 }}>
          Launch and monitor AI-powered calls in real time.
        </p>
      </div>

      {backendOnline === false && (
        <div style={{
          border: '2px solid #92400e', background: '#fef3c7', borderRadius: 6,
          padding: '12px 16px', marginBottom: 20,
          fontSize: 12, fontWeight: 600, color: '#92400e',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          Backend offline — ai-core is not running on port 3000. Start it to use the Call Center.
        </div>
      )}

      {/* Launch Call Form */}
      <div style={{
        background: '#fff',
        border: '2px solid #09090b',
        boxShadow: '4px 4px 0 0 rgba(0,0,0,1)',
        borderRadius: 6,
        padding: '20px 24px', marginBottom: 16,
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18 }}>
          Launch Call
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <FormField label="Agent">
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">Select agent...</option>
              {agents.map(a => (
                <option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>
              ))}
            </select>
          </FormField>

          <FormField label="From Number">
            <select
              value={selectedFromNumber}
              onChange={e => setSelectedFromNumber(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">Select number...</option>
              {phoneNumbers.map(p => (
                <option key={p.phone_number} value={p.phone_number}>
                  {formatPhone(p.phone_number)}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="To Number">
            <input
              value={toNumber}
              onChange={e => setToNumber(e.target.value)}
              placeholder="+1..."
              style={inputStyle}
            />
          </FormField>

          <FormField label="Customer Name (optional)">
            <input
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Jane Doe"
              style={inputStyle}
            />
          </FormField>
        </div>

        <button
          onClick={handleLaunchCall}
          disabled={callDisabled}
          className="nb-btn"
          style={{
            padding: '10px 28px', fontSize: 12, fontWeight: 700,
            border: '2px solid #09090b',
            borderRadius: 4,
            background: callDisabled ? '#e5e5e0' : '#09090b',
            color: callDisabled ? '#71717a' : '#fff',
            cursor: callDisabled ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            boxShadow: callDisabled ? 'none' : '4px 4px 0 0 rgba(0,0,0,1)',
            transition: 'transform 0.05s, box-shadow 0.05s',
          }}
        >
          {launching ? 'Calling...' : 'Call'}
        </button>
      </div>

      {/* Active Call Panel */}
      {(activeCall || viewingCall) && (
        <div style={{
          background: '#fff',
          border: '2px solid #09090b',
          boxShadow: '4px 4px 0 0 rgba(0,0,0,1)',
          borderRadius: 6,
          padding: '20px 24px', marginBottom: 16,
        }}>
          {activeCall && !viewingCall && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase',
                    letterSpacing: '0.1em', marginBottom: 8,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    {!callEnded && (
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: currentCallData?.call_status === 'ongoing' ? '#16a34a' : '#f59e0b',
                        display: 'inline-block',
                      }} />
                    )}
                    {callEnded ? 'Call Ended' : currentCallData?.call_status === 'ongoing' ? 'Live Call' : 'Connecting...'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: '#09090b', fontFamily: 'inherit', fontWeight: 600 }}>
                      {activeCall.call_id}
                    </span>
                    <StatusBadge status={currentCallData?.call_status || activeCall.call_status} />
                  </div>
                </div>
                {!callEnded && (
                  <div style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}>Monitoring</div>
                )}
              </div>

              <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                Transcript
                {!callEnded && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>● Live</span>
                )}
              </div>
              <div style={{
                border: '2px solid #09090b', borderRadius: 4, marginBottom: 16,
                background: callEnded ? '#f5f5f0' : '#fff',
              }}>
                <TranscriptView
                  transcript={liveData?.transcript_object}
                  plainTranscript={liveData?.transcript}
                  isLive={!callEnded}
                  transcriptEndRef={transcriptEndRef}
                />
              </div>

              {callEnded && currentCallData && (
                <div style={{
                  border: '2px solid #09090b', borderRadius: 4,
                  padding: '16px 20px', background: '#f5f5f0', marginBottom: 12,
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                    Call Summary
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 9, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Duration</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#09090b' }}>{formatDuration(currentCallData.duration_ms)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Disconnection</div>
                      <div style={{ fontSize: 12, color: '#09090b', fontWeight: 500 }}>{currentCallData.disconnection_reason || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Status</div>
                      <StatusBadge status={currentCallData.call_status} />
                    </div>
                  </div>

                  {currentCallData.call_analysis && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 9, color: '#71717a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Analysis</div>
                      <pre style={{
                        fontSize: 11, color: '#09090b', lineHeight: 1.5,
                        background: '#fff', padding: 12, border: '2px solid #09090b', borderRadius: 4,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'inherit',
                      }}>
                        {typeof currentCallData.call_analysis === 'string'
                          ? currentCallData.call_analysis
                          : JSON.stringify(currentCallData.call_analysis, null, 2)}
                      </pre>
                    </div>
                  )}

                  {currentCallData.recording_url && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 9, color: '#71717a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Recording</div>
                      <audio controls src={currentCallData.recording_url} style={{ width: '100%' }} />
                    </div>
                  )}

                  {summary && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 9, color: '#71717a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>AI Summary</div>
                      <div style={{
                        fontSize: 12, color: '#09090b', lineHeight: 1.7, fontWeight: 500,
                        background: '#fff', padding: 14, border: '2px solid #09090b', borderRadius: 4,
                      }} className="summary-md">
                        <Markdown>{summary}</Markdown>
                      </div>
                      {linkedProspect && (
                        <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                          Saved to CRM — {linkedProspect.name}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => handleSummarize(currentCallData)}
                      disabled={summarizing}
                      className="nb-btn"
                      style={{
                        padding: '8px 20px', fontSize: 11, fontWeight: 700,
                        border: '2px solid #09090b', borderRadius: 4,
                        background: summarizing ? '#e5e5e0' : '#fff',
                        color: summarizing ? '#71717a' : '#09090b',
                        cursor: summarizing ? 'not-allowed' : 'pointer',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        boxShadow: summarizing ? 'none' : '3px 3px 0 0 rgba(0,0,0,1)',
                        transition: 'transform 0.05s, box-shadow 0.05s',
                      }}
                    >
                      {summarizing ? 'Summarizing...' : summary ? 'Re-summarize' : 'Summarize Call'}
                    </button>
                    <button
                      onClick={handleNewCall}
                      className="nb-btn"
                      style={{
                        padding: '8px 20px', fontSize: 11, fontWeight: 700,
                        border: '2px solid #09090b', borderRadius: 4,
                        background: '#09090b', color: '#fff', cursor: 'pointer',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        boxShadow: '3px 3px 0 0 rgba(0,0,0,1)',
                        transition: 'transform 0.05s, box-shadow 0.05s',
                      }}
                    >
                      New Call
                    </button>
                  </div>
                </div>
              )}

              <style>{`
                @keyframes liveDot {
                  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
                  40% { opacity: 1; transform: scale(1); }
                }
                .summary-md h1, .summary-md h2, .summary-md h3 { font-size: 13px; font-weight: 700; margin: 10px 0 4px; }
                .summary-md p { margin: 0 0 8px; }
                .summary-md ul, .summary-md ol { margin: 0 0 8px; padding-left: 18px; }
                .summary-md li { margin-bottom: 4px; }
                .summary-md strong { font-weight: 700; }
              `}</style>
            </>
          )}

          {viewingCall && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                    Call Details
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: '#09090b', fontWeight: 600 }}>
                      {viewingCall.call_id}
                    </span>
                    <StatusBadge status={viewingCall.call_status} />
                  </div>
                </div>
                <button
                  onClick={() => setViewingCall(null)}
                  className="nb-btn-sm"
                  style={{
                    padding: '6px 14px', fontSize: 11, fontWeight: 700,
                    border: '2px solid #09090b', borderRadius: 4,
                    background: '#fff', color: '#09090b', cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    boxShadow: '3px 3px 0 0 rgba(0,0,0,1)',
                    transition: 'transform 0.05s, box-shadow 0.05s',
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Duration</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#09090b' }}>{formatDuration(viewingCall.duration_ms)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>To Number</div>
                  <div style={{ fontSize: 12, color: '#09090b', fontWeight: 500 }}>{formatPhone(viewingCall.to_number)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Disconnection</div>
                  <div style={{ fontSize: 12, color: '#09090b', fontWeight: 500 }}>{viewingCall.disconnection_reason || '—'}</div>
                </div>
              </div>

              {viewingCall.call_analysis && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9, color: '#71717a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Analysis</div>
                  <div style={{ fontSize: 12, color: '#09090b', lineHeight: 1.6, fontWeight: 500 }}>
                    {typeof viewingCall.call_analysis === 'string'
                      ? viewingCall.call_analysis
                      : JSON.stringify(viewingCall.call_analysis, null, 2)}
                  </div>
                </div>
              )}

              {viewingCall.recording_url && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9, color: '#71717a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Recording</div>
                  <audio controls src={viewingCall.recording_url} style={{ width: '100%' }} />
                </div>
              )}

              <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, marginTop: 8 }}>
                Transcript
              </div>
              <div style={{ border: '2px solid #09090b', borderRadius: 4, background: '#f5f5f0', marginBottom: 14 }}>
                <TranscriptView
                  transcript={viewingCall.transcript_object}
                  plainTranscript={viewingCall.transcript}
                  isLive={false}
                  transcriptEndRef={transcriptEndRef}
                />
              </div>

              {summary && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9, color: '#71717a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>AI Summary</div>
                  <div style={{
                    fontSize: 12, color: '#09090b', lineHeight: 1.7, fontWeight: 500,
                    background: '#fff', padding: 14, border: '2px solid #09090b', borderRadius: 4,
                  }} className="summary-md">
                    <Markdown>{summary}</Markdown>
                  </div>
                  {linkedProspect && (
                    <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                      Saved to CRM — {linkedProspect.name}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => handleSummarize(viewingCall)}
                disabled={summarizing}
                className="nb-btn"
                style={{
                  padding: '8px 20px', fontSize: 11, fontWeight: 700,
                  border: '2px solid #09090b', borderRadius: 4,
                  background: summarizing ? '#e5e5e0' : '#fff',
                  color: summarizing ? '#71717a' : '#09090b',
                  cursor: summarizing ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  boxShadow: summarizing ? 'none' : '3px 3px 0 0 rgba(0,0,0,1)',
                  transition: 'transform 0.05s, box-shadow 0.05s',
                }}
              >
                {summarizing ? 'Summarizing...' : summary ? 'Re-summarize' : 'Summarize Call'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Call History */}
      <div style={{
        background: '#fff',
        border: '2px solid #09090b',
        boxShadow: '4px 4px 0 0 rgba(0,0,0,1)',
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase',
          letterSpacing: '0.1em', padding: '16px 24px 12px',
          borderBottom: '2px solid #09090b', background: '#f5f5f0',
        }}>
          Recent Calls
        </div>

        {recentCalls.length === 0 ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: '#71717a', fontSize: 12, fontWeight: 500 }}>
            No calls yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #09090b' }}>
                {['Call ID', 'Agent', 'To Number', 'Duration', 'Status', 'Date'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left', fontWeight: 700,
                    fontSize: 9, color: '#71717a', textTransform: 'uppercase',
                    letterSpacing: '0.1em', background: '#f5f5f0',
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
                    borderBottom: i < recentCalls.length - 1 ? '1px solid #e4e4e7' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f5f0'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '11px 16px', color: '#09090b', fontWeight: 600 }}>
                    {call.call_id ? call.call_id.slice(0, 12) + '...' : '—'}
                  </td>
                  <td style={{ padding: '11px 16px', color: '#3f3f46', fontWeight: 500 }}>
                    {call.agent_name || '—'}
                  </td>
                  <td style={{ padding: '11px 16px', color: '#3f3f46', fontWeight: 500 }}>
                    {formatPhone(call.to_number)}
                  </td>
                  <td style={{ padding: '11px 16px', color: '#3f3f46', fontWeight: 600 }}>
                    {formatDuration(call.duration_ms)}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <StatusBadge status={call.call_status} />
                  </td>
                  <td style={{ padding: '11px 16px', color: '#71717a', fontSize: 11, fontWeight: 500 }}>
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
