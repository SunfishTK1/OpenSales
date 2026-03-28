import { useState } from 'react'
import Dashboard from './components/Dashboard'
import ProspectTable from './components/ProspectTable'
import ProspectDetail from './components/ProspectDetail'
import ActivityFeed from './components/ActivityFeed'
import TaskQueue from './components/TaskQueue'
import OnboardingWizard from './components/OnboardingWizard'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'prospects', label: 'Prospects', icon: '👥' },
  { id: 'activity', label: 'Activity Feed', icon: '🤖' },
  { id: 'tasks', label: 'Approvals', icon: '✅' },
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
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-gray-700">
          <div className="font-bold text-lg tracking-tight">OpenSales</div>
          <div className="text-xs text-gray-400 mt-0.5">AI B2B Sales Platform</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                view === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-700">
          <button
            onClick={() => setShowOnboarding(true)}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            ⚙️ Company Setup
          </button>
          <div className="text-xs text-gray-500 mt-2 px-2">Commission-based AI Sales</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {view === 'dashboard' && <Dashboard />}
          {view === 'prospects' && (
            <ProspectTable onSelect={handleSelectProspect} />
          )}
          {view === 'activity' && <ActivityFeed />}
          {view === 'tasks' && <TaskQueue />}
        </div>
      </main>

      {/* Prospect detail slide-over */}
      {selectedProspect && (
        <ProspectDetail
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
        />
      )}

      {/* Onboarding wizard modal */}
      {showOnboarding && (
        <OnboardingWizard
          onClose={() => setShowOnboarding(false)}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
    </div>
  )
}
