import { useState } from 'react'
import Dashboard from './components/Dashboard'
import ProspectTable from './components/ProspectTable'
import ProspectDetail from './components/ProspectDetail'
import ActivityFeed from './components/ActivityFeed'
import TaskQueue from './components/TaskQueue'
import OnboardingWizard from './components/OnboardingWizard'

const NAV = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'prospects', label: 'Prospects' },
  { id: 'activity', label: 'Activity' },
  { id: 'tasks', label: 'Approvals' },
]

export default function App() {
  const [view, setView] = useState('dashboard')
  const [selectedProspect, setSelectedProspect] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  function handleSelectProspect(p) {
    setSelectedProspect(p)
    if (view !== 'prospects') setView('prospects')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#0a0a0a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #1f1f1f' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, background: '#2563eb', borderRadius: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px'
            }}>OS</div>
            <span style={{ color: '#fafafa', fontWeight: 600, fontSize: 14, letterSpacing: '-0.2px' }}>OpenSales</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 10px 4px' }}>
            Pipeline
          </div>
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '7px 10px',
                borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 500,
                background: view === item.id ? '#1f1f1f' : 'transparent',
                color: view === item.id ? '#fafafa' : '#a1a1aa',
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={e => { if (view !== item.id) { e.target.style.background = '#141414'; e.target.style.color = '#e4e4e7' } }}
              onMouseLeave={e => { if (view !== item.id) { e.target.style.background = 'transparent'; e.target.style.color = '#a1a1aa' } }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid #1f1f1f' }}>
          <button
            onClick={() => setShowOnboarding(true)}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 6,
              border: '1px solid #27272a', background: 'transparent',
              color: '#a1a1aa', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
              textAlign: 'left', transition: 'border-color 0.1s, color 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.color = '#e4e4e7' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#a1a1aa' }}
          >
            Company setup
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', background: '#f4f4f5' }}>
        {/* Top bar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: '#f4f4f5', borderBottom: '1px solid #e4e4e7',
          padding: '0 28px', height: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#09090b' }}>
            {NAV.find(n => n.id === view)?.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', background: '#22c55e',
              boxShadow: '0 0 0 2px #dcfce7'
            }} />
            <span style={{ fontSize: 12, color: '#71717a' }}>Live</span>
          </div>
        </div>

        <div style={{ padding: '24px 28px', maxWidth: 1080 }}>
          {view === 'dashboard' && <Dashboard />}
          {view === 'prospects' && <ProspectTable onSelect={handleSelectProspect} />}
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
