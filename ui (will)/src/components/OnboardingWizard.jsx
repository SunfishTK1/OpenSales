import { useState, useEffect, useRef } from 'react'

const SECTIONS = [
  { label: 'Identity', keywords: ['company', 'identity', 'name', 'product', 'representative', 'inbound'] },
  { label: 'Product', keywords: ['value proposition', 'features', 'tier', 'packaging', 'do not mention'] },
  { label: 'Qualify', keywords: ['qualif', 'threshold', 'fallback'] },
  { label: 'Routing', keywords: ['transfer', 'routing', 'closer', 'technical'] },
  { label: 'Objections', keywords: ['objection', 'response', 'handling'] },
  { label: 'Follow-up', keywords: ['follow-up', 'follow up', 'collateral', 'crm', 'reengagement'] },
  { label: 'Variables', keywords: ['variable', 'merge field', 'dynamic'] },
]

function detectSection(text, current) {
  const lower = text.toLowerCase()
  for (let i = SECTIONS.length - 1; i >= 0; i--) {
    if (SECTIONS[i].keywords.some(k => lower.includes(k))) return i + 1
  }
  return current
}

export default function OnboardingWizard({ onClose, onComplete }) {
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [currentSection, setCurrentSection] = useState(0)
  const [done, setDone] = useState(false)
  const [config, setConfig] = useState(null)
  const [saveResult, setSaveResult] = useState(null)
  const [retellResult, setRetellResult] = useState(null)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const chatEndRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const currentAudioRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  // TTS
  function stopTTS() {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
  }

  async function speak(text) {
    stopTTS()
    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      currentAudioRef.current = audio
      audio.onended = () => { URL.revokeObjectURL(url); currentAudioRef.current = null }
      audio.play().catch(() => {})
    } catch {}
  }

  // Start session
  async function startSession() {
    setSending(true)
    try {
      const res = await fetch('/api/session/start', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setMessages([{ role: 'agent', content: 'Error: ' + data.error }])
        setSending(false)
        return
      }
      setSessionId(data.sessionId)
      setMessages([{ role: 'agent', content: data.message }])
      speak(data.message)
      const detected = detectSection(data.message, 0)
      if (detected) setCurrentSection(detected)
    } catch (err) {
      setMessages([{ role: 'agent', content: 'Failed to connect. Make sure ai-core is running on port 3000.' }])
    }
    setSending(false)
  }

  // Send message
  async function sendMessage() {
    if (!input.trim() || !sessionId || done) return
    stopTTS()
    const text = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setSending(true)

    try {
      const res = await fetch(`/api/session/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      if (data.error) {
        setMessages(prev => [...prev, { role: 'agent', content: 'Error: ' + data.error }])
        setSending(false)
        return
      }

      setMessages(prev => [...prev, { role: 'agent', content: data.message }])
      speak(data.message)

      const detected = detectSection(data.message, currentSection)
      if (detected > currentSection) setCurrentSection(detected)

      if (data.config) {
        setDone(true)
        setCurrentSection(8)
        setConfig(data.config)
        setSaveResult(
          data.saved ? { ok: true, id: data.saved.id }
            : data.saveError ? { ok: false, error: data.saveError }
            : null
        )
        setRetellResult(data.retell || null)
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'agent', content: 'Network error: ' + err.message }])
    }
    setSending(false)
  }

  // Voice recording
  async function toggleRecording() {
    stopTTS()
    if (recording) {
      mediaRecorderRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mr

      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstart = () => setRecording(true)
      mr.onstop = async () => {
        setRecording(false)
        stream.getTracks().forEach(t => t.stop())
        if (audioChunksRef.current.length === 0) return

        setTranscribing(true)
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const form = new FormData()
        form.append('audio', blob, 'recording.webm')

        try {
          const res = await fetch('/api/transcribe', { method: 'POST', body: form })
          const data = await res.json()
          if (data.text) setInput(prev => (prev ? prev + ' ' : '') + data.text)
        } catch {}
        setTranscribing(false)
      }

      mr.start()
    } catch {}
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Not started yet ──
  if (!sessionId && messages.length === 0) {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480,
            border: '1px solid #e4e4e7', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            padding: '40px 32px', textAlign: 'center',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #2563eb, #60a5fa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, color: '#fff',
          }}>AI</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#09090b', margin: '0 0 8px', letterSpacing: '-0.3px' }}>
            Configure Your AI Sales Agent
          </h2>
          <p style={{ fontSize: 13.5, color: '#71717a', lineHeight: 1.6, margin: '0 0 24px', maxWidth: 360, marginInline: 'auto' }}>
            An AI interviewer will walk you through 7 sections about your company, then automatically create your outbound voice agent.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px', fontSize: 14, fontWeight: 500,
                border: '1px solid #e4e4e7', borderRadius: 6,
                background: '#fff', color: '#71717a', cursor: 'pointer',
              }}
            >Cancel</button>
            <button
              onClick={startSession}
              disabled={sending}
              style={{
                padding: '10px 24px', fontSize: 14, fontWeight: 600,
                border: 'none', borderRadius: 6,
                background: '#2563eb', color: '#fff', cursor: 'pointer',
              }}
            >{sending ? 'Starting...' : 'Start Onboarding'}</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Chat UI ──
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#fff', borderRadius: 12, width: '100%', maxWidth: 680,
          border: '1px solid #e4e4e7', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #e4e4e7',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#09090b', letterSpacing: '-0.2px' }}>
              Agent Builder
            </div>
            <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 2 }}>
              {done ? 'Complete' : `Section ${Math.min(currentSection, 7)} / 7`}
            </div>
          </div>
          <button
            onClick={() => { stopTTS(); onClose() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', fontSize: 22, lineHeight: 1, padding: 0 }}
          >&times;</button>
        </div>

        {/* Progress bar */}
        <div style={{ padding: '10px 20px', display: 'flex', gap: 4, borderBottom: '1px solid #f4f4f5' }}>
          {SECTIONS.map((s, i) => {
            const idx = i + 1
            const isComplete = done || idx < currentSection
            const isActive = !done && idx === currentSection
            return (
              <div key={s.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  height: 4, width: '100%', borderRadius: 2,
                  background: isComplete ? '#22c55e' : isActive ? '#2563eb' : '#e4e4e7',
                  transition: 'background 0.3s',
                }} />
                <span style={{
                  fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                  color: isComplete ? '#22c55e' : isActive ? '#2563eb' : '#a1a1aa',
                  transition: 'color 0.3s',
                }}>{s.label}</span>
              </div>
            )
          })}
        </div>

        {/* Chat messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((msg, i) => {
            const isAgent = msg.role === 'agent'
            return (
              <div key={i} style={{ display: 'flex', gap: 10, justifyContent: isAgent ? 'flex-start' : 'flex-end' }}>
                {isAgent && (
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #2563eb, #60a5fa)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#fff',
                  }}>AI</div>
                )}
                <div style={{
                  maxWidth: '75%', padding: '10px 14px', borderRadius: 10, fontSize: 13.5, lineHeight: 1.6,
                  color: '#09090b', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: isAgent ? '#eff6ff' : '#f4f4f5',
                  borderTopLeftRadius: isAgent ? 4 : 10,
                  borderTopRightRadius: isAgent ? 10 : 4,
                }}>
                  {msg.content}
                </div>
                {!isAgent && (
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: '#e4e4e7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 600, color: '#52525b',
                  }}>You</div>
                )}
              </div>
            )
          })}

          {/* Typing indicator */}
          {sending && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #2563eb, #60a5fa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff',
              }}>AI</div>
              <div style={{
                padding: '12px 16px', borderRadius: 10, background: '#eff6ff',
                display: 'flex', gap: 4, alignItems: 'center', borderTopLeftRadius: 4,
              }}>
                {[0, 1, 2].map(j => (
                  <div key={j} style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#93c5fd',
                    animation: 'pulse 1.2s infinite',
                    animationDelay: `${j * 0.2}s`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Config complete card */}
        {done && config && (
          <div style={{
            margin: '0 20px 12px', padding: '16px 18px', borderRadius: 8,
            border: '1px solid #bbf7d0', background: '#f0fdf4',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginBottom: 10 }}>
              Configuration Complete
            </div>
            <pre style={{
              fontSize: 11, color: '#166534', background: '#dcfce7', padding: 12,
              borderRadius: 6, maxHeight: 200, overflowY: 'auto', overflowX: 'auto',
              margin: '0 0 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {JSON.stringify(config, null, 2)}
            </pre>

            {saveResult && (
              <div style={{ fontSize: 12.5, marginBottom: 6, color: saveResult.ok ? '#166534' : '#b91c1c' }}>
                {saveResult.ok ? `Saved to Supabase (ID: ${saveResult.id})` : `Save failed: ${saveResult.error}`}
              </div>
            )}
            {retellResult && (
              <div style={{ fontSize: 12.5, color: '#166534', marginBottom: 6 }}>
                Voice Agent Created — {retellResult.agentName} (ID: {retellResult.agentId})
              </div>
            )}

            <button
              onClick={() => { stopTTS(); onComplete?.(); onClose() }}
              style={{
                padding: '8px 20px', fontSize: 13, fontWeight: 600, border: 'none',
                borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer',
                marginTop: 4,
              }}
            >Done</button>
          </div>
        )}

        {/* Input bar */}
        {!done && sessionId && (
          <div style={{
            padding: '12px 20px', borderTop: '1px solid #e4e4e7',
            display: 'flex', gap: 8, alignItems: 'flex-end',
          }}>
            {/* Mic button */}
            <button
              onClick={toggleRecording}
              disabled={sending}
              style={{
                width: 38, height: 38, borderRadius: 8, border: '1px solid #e4e4e7',
                background: recording ? '#fef2f2' : '#fff', cursor: sending ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0, transition: 'all 0.15s',
                color: recording ? '#ef4444' : '#71717a',
                borderColor: recording ? '#fca5a5' : '#e4e4e7',
              }}
              title={recording ? 'Stop recording' : 'Start recording'}
            >
              {recording ? (
                <span style={{ width: 12, height: 12, borderRadius: 2, background: '#ef4444', display: 'block' }} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              )}
            </button>

            {/* Text input */}
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
                rows={1}
                placeholder={transcribing ? 'Transcribing...' : recording ? 'Listening...' : 'Type your answer or click mic to speak...'}
                style={{
                  width: '100%', padding: '9px 12px', fontSize: 13.5,
                  border: '1px solid #e4e4e7', borderRadius: 8, outline: 'none',
                  color: '#09090b', background: '#fff', resize: 'none',
                  maxHeight: 100, lineHeight: 1.5,
                  borderColor: recording ? '#93c5fd' : '#e4e4e7',
                }}
              />
            </div>

            {/* Send button */}
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              style={{
                padding: '9px 18px', fontSize: 13, fontWeight: 600,
                border: 'none', borderRadius: 8,
                background: !input.trim() || sending ? '#e4e4e7' : '#2563eb',
                color: !input.trim() || sending ? '#a1a1aa' : '#fff',
                cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
                flexShrink: 0,
              }}
            >Send</button>
          </div>
        )}
      </div>

      {/* Typing animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
