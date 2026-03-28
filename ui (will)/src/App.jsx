import { useState } from 'react'
import Dashboard from './components/Dashboard'
import ProspectTable from './components/ProspectTable'
import ProspectDetail from './components/ProspectDetail'
import ActivityFeed from './components/ActivityFeed'
import TaskQueue from './components/TaskQueue'
import OnboardingWizard from './components/OnboardingWizard'
import CallCenter from './components/CallCenter'
import CRM from './components/CRM'

const NAV = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'prospects', label: 'Prospects' },
  { id: 'calls', label: 'Call Center' },
  { id: 'crm', label: 'CRM' },
  { id: 'activity', label: 'Activity' },
  { id: 'tasks', label: 'Approvals' },
]

export default function App() {
  const [view, setView] = useState('dashboard')
  const [selectedProspect, setSelectedProspect] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('http://localhost:3001/sync/calls')
      const data = await res.json()
      setSyncMsg(`Synced ${data.new_calls_synced} new call${data.new_calls_synced === 1 ? '' : 's'}`)
    } catch {
      setSyncMsg('Sync failed')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 3000)
    }
  }

  function handleSelectProspect(p) {
    setSelectedProspect(p)
    if (view !== 'prospects') setView('prospects')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside style={{
        width: 220, background: '#fff',
        borderRight: '2px solid #09090b',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '2px solid #09090b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.png" alt="OpenSales" style={{ width: 32, height: 32, objectFit: 'contain', display: 'block', border: '2px solid #09090b', borderRadius: 4 }} />
            <span className="mono" style={{ color: '#09090b', fontWeight: 700, fontSize: 14, letterSpacing: '-0.2px', textTransform: 'uppercase' }}>OpenSales</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#71717a',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '4px 10px 6px',
          }}>
            Pipeline
          </div>
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 10px',
                borderRadius: 4,
                border: view === item.id ? '2px solid #09090b' : '2px solid transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: view === item.id ? 700 : 500,
                background: view === item.id ? '#09090b' : 'transparent',
                color: view === item.id ? '#fff' : '#52525b',
                letterSpacing: '0.02em',
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (view !== item.id) { e.target.style.background = '#f5f5f0'; e.target.style.color = '#09090b' } }}
              onMouseLeave={e => { if (view !== item.id) { e.target.style.background = 'transparent'; e.target.style.color = '#52525b' } }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '12px 8px', borderTop: '2px solid #09090b' }}>
          <button
            onClick={() => setShowOnboarding(true)}
            className="nb-btn-sm"
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 4,
              border: '2px solid #09090b', background: '#fff',
              color: '#09090b', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', textAlign: 'left',
              textTransform: 'uppercase', letterSpacing: '0.04em',
              boxShadow: '3px 3px 0 0 rgba(0,0,0,1)',
              transition: 'transform 0.05s, box-shadow 0.05s',
            }}
          >
            Sales Agent Setup
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', background: '#f5f5f0' }}>
        {/* Top bar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: '#f5f5f0', borderBottom: '2px solid #09090b',
          padding: '0 28px', height: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: '#09090b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {NAV.find(n => n.id === view)?.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {syncMsg && (
              <span style={{ fontSize: 11, color: syncMsg.includes('failed') ? '#ef4444' : '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {syncMsg}
              </span>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="nb-btn-sm"
              style={{
                padding: '6px 14px', borderRadius: 4,
                border: '2px solid #09090b',
                background: syncing ? '#e5e5e0' : '#09090b',
                color: syncing ? '#71717a' : '#fff',
                fontSize: 11, fontWeight: 700,
                cursor: syncing ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                boxShadow: '3px 3px 0 0 rgba(0,0,0,1)',
                transition: 'transform 0.05s, box-shadow 0.05s',
              }}
            >
              {syncing ? 'Syncing...' : 'Sync Calls'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', background: '#16a34a',
                boxShadow: '0 0 0 2px #bbf7d0'
              }} />
              <span style={{ fontSize: 11, color: '#52525b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live</span>
            </div>
          </div>
        </div>

        <div style={{ padding: '24px 28px', maxWidth: 1200 }}>
          {view === 'dashboard' && <Dashboard onNavigate={setView} />}
          {view === 'prospects' && <ProspectTable onSelect={handleSelectProspect} />}
          {view === 'calls' && <CallCenter />}
          {view === 'crm' && <CRM />}
          {view === 'activity' && <ActivityFeed />}
          {view === 'tasks' && <TaskQueue />}
        </div>
      </main>

      {selectedProspect && (
        <ProspectDetail prospect={selectedProspect} onClose={() => setSelectedProspect(null)} />
      )}

      {showOnboarding && (
        <OnboardingWizard onClose={() => setShowOnboarding(false)} onComplete={() => setShowOnboarding(false)} />
      )}
    </div>
  )
}
