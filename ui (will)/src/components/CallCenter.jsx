import { useState, useEffect, useRef } from 'react'
import Markdown from 'react-markdown'

const STATUS_COLORS = {
  registered: { color: '#92400e', background: '#fef3c7', border: '1.5px solid #92400e' },
  ongoing:    { color: '#166534', background: '#f0fdf4', border: '1.5px solid #166534' },
  ended:      { color: '#52525b', background: '#f4f4f5', border: '1.5px solid #52525b' },
  error:      { color: '#b91c1c', background: '#fef2f2', border: '1.5px solid #b91c1c' },
}

const SENTIMENT_COLORS = {
  Positive: { color: '#166534', background: '#f0fdf4', border: '1.5px solid #166534' },
  Neutral:  { color: '#92400e', background: '#fef3c7', border: '1.5px solid #92400e' },
  Negative: { color: '#b91c1c', background: '#fef2f2', border: '1.5px solid #b91c1c' },
}

const DISCONNECTION_LABELS = {
  user_hangup:            'Hung up',
  agent_hangup:           'Agent ended',
  dial_no_answer:         'No answer',
  dial_failed:            'Dial failed',
  voicemail_reached:      'Voicemail',
  max_duration_reached:   'Max duration',
  inactivity:             'Inactivity timeout',
  machine_detected:       'Machine detected',
  concurrency_limit_reached: 'Concurrency limit',
  error_llm_websocket:    'LLM error',
  error_frontend_corrupted: 'Connection error',
}

function humanizeDisconnect(reason) {
  return DISCONNECTION_LABELS[reason] || reason?.replace(/_/g, ' ') || '—'
}

function parseAnalysis(raw) {
  if (!raw) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return { call_summary: raw } }
  }
  return raw
}

function getCallLabel(call) {
  const name = call?.customer_name || call?.retell_llm_dynamic_variables?.customer_name || call?.collected_variables?.customer_name || call?.metadata?.customer_name
  const number = formatPhone(call?.to_number)
  if (name && number !== '—') return { primary: name, secondary: number }
  if (name) return { primary: name, secondary: null }
  if (number !== '—') return { primary: number, secondary: null }
  return { primary: call?.call_id?.slice(0, 16) + '…' || '—', secondary: null }
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
  padding: '9px 12px', fontSize: 13, fontWeight: 500,
  border: '2px solid #09090b', borderRadius: 4,
  background: '#fff', color: '#09090b', outline: 'none',
  fontFamily: 'inherit',
}

function CallAnalysis({ analysis }) {
  const a = parseAnalysis(analysis)
  if (!a) return null
  const sentiment = a.user_sentiment
  const completion = a.agent_task_completion_rating
  const summary = a.call_summary
  const reason = a.agent_task_completion_rating_reason || a.call_completion_rating_reason

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(sentiment || completion) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sentiment && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 3,
              ...(SENTIMENT_COLORS[sentiment] ?? SENTIMENT_COLORS.Neutral),
            }}>
              {sentiment} sentiment
            </span>
          )}
          {completion && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 3,
              color: completion === 'Complete' ? '#166534' : '#92400e',
              background: completion === 'Complete' ? '#f0fdf4' : '#fef3c7',
              border: completion === 'Complete' ? '1.5px solid #166534' : '1.5px solid #92400e',
            }}>
              Task {completion}
            </span>
          )}
        </div>
      )}
      {summary && (
        <p style={{ fontSize: 12, color: '#09090b', lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
          {summary}
        </p>
      )}
      {reason && (
        <p style={{ fontSize: 11, color: '#71717a', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
          {reason}
        </p>
      )}
    </div>
  )
}

function TranscriptView({ transcript, plainTranscript, isLive, transcriptEndRef }) {
  if ((!transcript || transcript.length === 0) && !plainTranscript) {
    return (
      <div style={{ padding: '28px 20px', textAlign: 'center' }}>
        {isLive ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'liveDot 1.2s infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Call in progress</span>
            </div>
            <div style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 500 }}>Transcript will appear once the call ends.</div>
          </div>
        ) : <span style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 500 }}>No transcript available.</span>}
      </div>
    )
  }

  if ((!transcript || transcript.length === 0) && plainTranscript) {
    return (
      <div style={{ maxHeight: 380, overflowY: 'auto', padding: '16px 20px' }}>
        <div style={{ fontSize: 12, lineHeight: 1.7, color: '#09090b', whiteSpace: 'pre-wrap', fontWeight: 500 }}>
          {plainTranscript}
        </div>
        <div ref={transcriptEndRef} />
      </div>
    )
  }

  return (
    <div style={{ maxHeight: 380, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {transcript.map((entry, i) => {
        const isAgent = entry.role === 'agent'
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, justifyContent: isAgent ? 'flex-start' : 'flex-end' }}>
            {isAgent && (
              <div style={{
                width: 26, height: 26, borderRadius: 4, flexShrink: 0,
                background: '#09090b', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 700, letterSpacing: '0.04em',
              }}>AI</div>
            )}
            <div style={{
              maxWidth: '72%', padding: '9px 13px', borderRadius: 6,
              fontSize: 12, lineHeight: 1.6, color: '#09090b',
              background: isAgent ? '#eff6ff' : '#f5f5f0',
              border: `1.5px solid ${isAgent ? '#bfdbfe' : '#e4e4e7'}`,
            }}>
              {entry.content}
            </div>
            {!isAgent && (
              <div style={{
                width: 26, height: 26, borderRadius: 4, flexShrink: 0,
                background: '#f4f4f5', border: '1.5px solid #e4e4e7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 700, color: '#71717a', letterSpacing: '0.04em',
              }}>YOU</div>
            )}
          </div>
        )
      })}
      <div ref={transcriptEndRef} />
    </div>
  )
}

function CallInfoGrid({ call }) {
  const label = getCallLabel(call)
  const analysis = parseAnalysis(call?.call_analysis)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 9, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Contact</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#09090b' }}>{label.primary}</div>
        {label.secondary && <div style={{ fontSize: 11, color: '#71717a', fontWeight: 500, marginTop: 1 }}>{label.secondary}</div>}
      </div>
      <div>
        <div style={{ fontSize: 9, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Duration</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#09090b' }}>{formatDuration(call?.duration_ms)}</div>
      </div>
      <div>
        <div style={{ fontSize: 9, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Ended</div>
        <div style={{ fontSize: 12, color: '#09090b', fontWeight: 500 }}>{humanizeDisconnect(call?.disconnection_reason)}</div>
      </div>
      <div>
        <div style={{ fontSize: 9, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Sentiment</div>
        {analysis?.user_sentiment ? (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
            ...(SENTIMENT_COLORS[analysis.user_sentiment] ?? SENTIMENT_COLORS.Neutral),
          }}>
            {analysis.user_sentiment}
          </span>
        ) : <span style={{ fontSize: 12, color: '#a1a1aa', fontWeight: 500 }}>—</span>}
      </div>
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
  const [backendOnline, setBackendOnline] = useState(null)
  const pollRef = useRef(null)
  const transcriptEndRef = useRef(null)

  useEffect(() => {
    fetch('/api/agents')
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(data => {
        setBackendOnline(true)
        setAgents(Array.isArray(data) ? data : [])
        return Promise.all([
          fetch('/api/phone-numbers').then(r => r.json()).catch(() => []),
          fetch('/api/calls?limit=20').then(r => r.json()).catch(() => []),
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
          setTimeout(async () => {
            try {
              const r = await fetch(`/api/calls/${activeCall.call_id}/live`)
              setLiveData(await r.json())
            } catch {}
          }, 3000)
        }
      } catch {}
    }
    poll()
    pollRef.current = setInterval(poll, 1000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
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
    setActiveCall(null); setLiveData(null); setViewingCall(null)
    setSummary(null); setLinkedProspect(null)
    setToNumber(''); setCustomerName('')
    if (backendOnline) {
      fetch('/api/calls?limit=20').then(r => r.json()).then(d => setRecentCalls(Array.isArray(d) ? d : [])).catch(() => {})
    }
  }

  function handleViewCall(call) {
    setViewingCall(call); setActiveCall(null); setLiveData(null)
    setSummary(null); setLinkedProspect(null)
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  async function handleSummarize(callData) {
    const transcript = callData?.transcript || callData?.transcript_object?.map(e => `${e.role}: ${e.content}`).join('\n')
    if (!transcript) return
    setSummarizing(true); setSummary(null); setLinkedProspect(null)
    const name = callData?.customer_name || callData?.retell_llm_dynamic_variables?.customer_name || callData?.collected_variables?.customer_name || callData?.metadata?.customer_name || ''
    try {
      const res = await fetch(`/api/calls/${callData.call_id}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, customer_name: name }),
      })
      const data = await res.json()
      setSummary(data.summary || 'Failed to generate summary.')
      if (data.prospect) setLinkedProspect(data.prospect)
    } catch { setSummary('Failed to generate summary.') }
    setSummarizing(false)
  }

  const callDisabled = !selectedAgent || !selectedFromNumber || !toNumber || launching
  const currentCallData = liveData || activeCall
  const callEnded = currentCallData?.call_status === 'ended' || currentCallData?.call_status === 'error'

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="mono" style={{ fontSize: 20, fontWeight: 700, color: '#09090b', letterSpacing: '-0.3px', margin: 0, textTransform: 'uppercase' }}>
          Call Center
        </h1>
        <p style={{ fontSize: 12, color: '#71717a', margin: '6px 0 0', fontWeight: 500 }}>
          Launch and monitor AI-powered outbound calls.
        </p>
      </div>

      {backendOnline === false && (
        <div style={{
          border: '2px solid #92400e', background: '#fef3c7', borderRadius: 6,
          padding: '12px 16px', marginBottom: 16,
          fontSize: 12, fontWeight: 600, color: '#92400e',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>⚠</span> Backend offline — ai-core is not running on port 3000.
        </div>
      )}

      {/* Launch form */}
      <div style={{
        background: '#fff', border: '2px solid #09090b',
        boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6,
        padding: '20px 24px', marginBottom: 14,
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
          New Call
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <FormField label="Agent">
            <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">Select agent...</option>
              {agents.map(a => <option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>)}
            </select>
          </FormField>
          <FormField label="From">
            <select value={selectedFromNumber} onChange={e => setSelectedFromNumber(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">Select number...</option>
              {phoneNumbers.map(p => <option key={p.phone_number} value={p.phone_number}>{formatPhone(p.phone_number)}</option>)}
            </select>
          </FormField>
          <FormField label="To Number">
            <input value={toNumber} onChange={e => setToNumber(e.target.value)} placeholder="+1 (555) 000-0000" style={inputStyle} />
          </FormField>
          <FormField label="Customer Name">
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Jane Doe" style={inputStyle} />
          </FormField>
        </div>
        <button
          onClick={handleLaunchCall}
          disabled={callDisabled}
          className="nb-btn"
          style={{
            width: '100%', padding: '13px', fontSize: 13, fontWeight: 700,
            border: '2px solid #09090b', borderRadius: 4,
            background: callDisabled ? '#e5e5e0' : '#09090b',
            color: callDisabled ? '#71717a' : '#fff',
            cursor: callDisabled ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            boxShadow: callDisabled ? 'none' : '4px 4px 0 0 rgba(0,0,0,1)',
            transition: 'transform 0.05s, box-shadow 0.05s',
          }}
        >
          {launching ? 'Calling...' : '📞 Launch Call'}
        </button>
      </div>

      {/* Active call panel */}
      {activeCall && !viewingCall && (
        <div style={{
          background: '#fff', border: '2px solid #09090b',
          boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6,
          overflow: 'hidden', marginBottom: 14,
        }}>
          {/* Call header bar */}
          <div style={{
            padding: '14px 20px', background: callEnded ? '#f5f5f0' : '#09090b',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {!callEnded && (
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: currentCallData?.call_status === 'ongoing' ? '#4ade80' : '#fbbf24', display: 'inline-block', animation: 'liveDot 1.2s infinite' }} />
              )}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: callEnded ? '#09090b' : '#fff' }}>
                  {getCallLabel(currentCallData ?? activeCall).primary}
                </div>
                {getCallLabel(currentCallData ?? activeCall).secondary && (
                  <div style={{ fontSize: 11, color: callEnded ? '#71717a' : 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                    {getCallLabel(currentCallData ?? activeCall).secondary}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusBadge status={currentCallData?.call_status || activeCall.call_status} />
              {callEnded && (
                <span style={{ fontSize: 13, fontWeight: 700, color: '#09090b' }}>
                  {formatDuration(currentCallData?.duration_ms)}
                </span>
              )}
            </div>
          </div>

          <div style={{ padding: '16px 20px' }}>
            {/* Call analysis — shown immediately when ended */}
            {callEnded && currentCallData?.call_analysis && (
              <div style={{ marginBottom: 16, padding: '14px 16px', background: '#f9f9f8', border: '1.5px solid #e4e4e7', borderRadius: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Call Analysis</div>
                <CallAnalysis analysis={currentCallData.call_analysis} />
              </div>
            )}

            {/* Info grid when ended */}
            {callEnded && currentCallData && (
              <CallInfoGrid call={currentCallData} />
            )}

            {/* Recording */}
            {callEnded && currentCallData?.recording_url && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Recording</div>
                <audio controls src={currentCallData.recording_url} style={{ width: '100%' }} />
              </div>
            )}

            {/* Transcript */}
            <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              Transcript
              {!callEnded && <span style={{ fontSize: 9, fontWeight: 700, color: '#16a34a' }}>● Live</span>}
            </div>
            <div style={{ border: '1.5px solid #e4e4e7', borderRadius: 4, marginBottom: 16, background: '#fafaf9' }}>
              <TranscriptView
                transcript={liveData?.transcript_object}
                plainTranscript={liveData?.transcript}
                isLive={!callEnded}
                transcriptEndRef={transcriptEndRef}
              />
            </div>

            {/* AI summary */}
            {summary && (
              <div style={{ marginBottom: 14, padding: '14px 16px', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>AI Summary</div>
                <div className="summary-md" style={{ fontSize: 12, color: '#09090b', lineHeight: 1.7 }}>
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

            <div style={{ display: 'flex', gap: 8 }}>
              {callEnded && (
                <button onClick={() => handleSummarize(currentCallData)} disabled={summarizing} className="nb-btn" style={{
                  padding: '8px 18px', fontSize: 11, fontWeight: 700,
                  border: '2px solid #09090b', borderRadius: 4,
                  background: summarizing ? '#e5e5e0' : '#fff', color: summarizing ? '#71717a' : '#09090b',
                  cursor: summarizing ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  boxShadow: summarizing ? 'none' : '3px 3px 0 0 rgba(0,0,0,1)',
                  transition: 'transform 0.05s, box-shadow 0.05s',
                }}>
                  {summarizing ? 'Summarizing...' : summary ? 'Re-summarize' : 'Summarize Call'}
                </button>
              )}
              {callEnded && (
                <button onClick={handleNewCall} className="nb-btn" style={{
                  padding: '8px 18px', fontSize: 11, fontWeight: 700,
                  border: '2px solid #09090b', borderRadius: 4,
                  background: '#09090b', color: '#fff', cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  boxShadow: '3px 3px 0 0 rgba(0,0,0,1)',
                  transition: 'transform 0.05s, box-shadow 0.05s',
                }}>
                  New Call
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Viewing past call */}
      {viewingCall && (
        <div style={{
          background: '#fff', border: '2px solid #09090b',
          boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6,
          overflow: 'hidden', marginBottom: 14,
        }}>
          <div style={{
            padding: '14px 20px', background: '#f5f5f0', borderBottom: '2px solid #09090b',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#09090b' }}>
                {getCallLabel(viewingCall).primary}
              </div>
              <div style={{ fontSize: 11, color: '#71717a', fontWeight: 500, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                {getCallLabel(viewingCall).secondary && <span>{getCallLabel(viewingCall).secondary}</span>}
                {viewingCall.agent_name && <span>· {viewingCall.agent_name}</span>}
                {viewingCall.created_at && <span>· {new Date(viewingCall.created_at).toLocaleString()}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge status={viewingCall.call_status} />
              <button onClick={() => setViewingCall(null)} className="nb-btn-sm" style={{
                padding: '5px 12px', fontSize: 11, fontWeight: 700,
                border: '2px solid #09090b', borderRadius: 4,
                background: '#fff', color: '#09090b', cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                boxShadow: '2px 2px 0 0 rgba(0,0,0,1)',
                transition: 'transform 0.05s, box-shadow 0.05s',
              }}>Close</button>
            </div>
          </div>

          <div style={{ padding: '16px 20px' }}>
            <CallInfoGrid call={viewingCall} />

            {viewingCall.call_analysis && (
              <div style={{ marginBottom: 16, padding: '14px 16px', background: '#f9f9f8', border: '1.5px solid #e4e4e7', borderRadius: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Call Analysis</div>
                <CallAnalysis analysis={viewingCall.call_analysis} />
              </div>
            )}

            {viewingCall.recording_url && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Recording</div>
                <audio controls src={viewingCall.recording_url} style={{ width: '100%' }} />
              </div>
            )}

            <div style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Transcript</div>
            <div style={{ border: '1.5px solid #e4e4e7', borderRadius: 4, background: '#fafaf9', marginBottom: 16 }}>
              <TranscriptView
                transcript={viewingCall.transcript_object}
                plainTranscript={viewingCall.transcript}
                isLive={false}
                transcriptEndRef={transcriptEndRef}
              />
            </div>

            {summary && (
              <div style={{ marginBottom: 14, padding: '14px 16px', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>AI Summary</div>
                <div className="summary-md" style={{ fontSize: 12, color: '#09090b', lineHeight: 1.7 }}>
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

            <button onClick={() => handleSummarize(viewingCall)} disabled={summarizing} className="nb-btn" style={{
              padding: '8px 18px', fontSize: 11, fontWeight: 700,
              border: '2px solid #09090b', borderRadius: 4,
              background: summarizing ? '#e5e5e0' : '#fff', color: summarizing ? '#71717a' : '#09090b',
              cursor: summarizing ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              boxShadow: summarizing ? 'none' : '3px 3px 0 0 rgba(0,0,0,1)',
              transition: 'transform 0.05s, box-shadow 0.05s',
            }}>
              {summarizing ? 'Summarizing...' : summary ? 'Re-summarize' : 'Summarize Call'}
            </button>
          </div>
        </div>
      )}

      {/* Call history */}
      <div style={{
        background: '#fff', border: '2px solid #09090b',
        boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', borderRadius: 6, overflow: 'hidden',
      }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase',
          letterSpacing: '0.1em', padding: '14px 20px 12px',
          borderBottom: '2px solid #09090b', background: '#f5f5f0',
        }}>
          Recent Calls {recentCalls.length > 0 && `(${recentCalls.length})`}
        </div>
        {recentCalls.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: '#71717a', fontSize: 12, fontWeight: 500 }}>No calls yet.</div>
        ) : (
          <div>
            {recentCalls.map((call, i) => {
              const label = getCallLabel(call)
              const analysis = parseAnalysis(call.call_analysis)
              return (
                <div
                  key={call.call_id}
                  onClick={() => handleViewCall(call)}
                  style={{
                    padding: '12px 20px', cursor: 'pointer',
                    borderBottom: i < recentCalls.length - 1 ? '1px solid #e4e4e7' : 'none',
                    display: 'flex', alignItems: 'center', gap: 14,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9f9f8'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Status dot */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: call.call_status === 'ended' ? '#d4d4d8' : call.call_status === 'ongoing' ? '#16a34a' : '#f59e0b',
                  }} />

                  {/* Contact */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#09090b' }}>{label.primary}</div>
                    <div style={{ fontSize: 11, color: '#71717a', fontWeight: 500, display: 'flex', gap: 8, marginTop: 1 }}>
                      {label.secondary && <span>{label.secondary}</span>}
                      {call.agent_name && <span>{call.agent_name}</span>}
                    </div>
                  </div>

                  {/* Sentiment */}
                  {analysis?.user_sentiment && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 3, flexShrink: 0,
                      ...(SENTIMENT_COLORS[analysis.user_sentiment] ?? SENTIMENT_COLORS.Neutral),
                    }}>
                      {analysis.user_sentiment}
                    </span>
                  )}

                  {/* Duration */}
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#52525b', flexShrink: 0, minWidth: 40, textAlign: 'right' }}>
                    {formatDuration(call.duration_ms)}
                  </div>

                  {/* Date */}
                  <div style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 500, flexShrink: 0, minWidth: 80, textAlign: 'right' }}>
                    {call.created_at ? new Date(call.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>

                  <div style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 500, flexShrink: 0 }}>→</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes liveDot {
          0%, 80%, 100% { opacity: 0.4; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
        .summary-md h1, .summary-md h2, .summary-md h3 { font-size: 13px; font-weight: 700; margin: 8px 0 4px; }
        .summary-md p { margin: 0 0 6px; }
        .summary-md ul, .summary-md ol { margin: 0 0 6px; padding-left: 18px; }
        .summary-md li { margin-bottom: 3px; }
        .summary-md strong { font-weight: 700; }
      `}</style>
    </div>
  )
}
