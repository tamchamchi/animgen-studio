import { useState } from 'react';
import { CharacterCreator } from './components/CharacterCreator';
import { AnimationStudio } from './components/AnimationStudio';
import { GameZone } from './components/GameZone';
import { Bot, Clapperboard, Menu, Gamepad2, Sparkles } from 'lucide-react';
import { GuideModal } from './components/ui/GuideModal';

function App() {
  const [activeModule, setActiveModule] = useState<'character' | 'animation' | 'game'>('character');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleSessionInit = (id: string) => {
    setSessionId(id);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Bot className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-xl text-white">AnimGen<span className="text-indigo-500">.io</span></span>
            </div>

            <div className="hidden md:flex items-center space-x-1">
              <NavButton
                active={activeModule === 'character'}
                onClick={() => setActiveModule('character')}
                icon={<Bot size={16} />}
                label="Character"
              />
              <NavButton
                active={activeModule === 'animation'}
                onClick={() => setActiveModule('animation')}
                icon={<Clapperboard size={16} />}
                label="Animation"
              />
              <NavButton
                active={activeModule === 'game'}
                onClick={() => setActiveModule('game')}
                icon={<Gamepad2 size={16} />}
                label="Game Zone"
              />
              <div className="h-6 w-[1px] bg-slate-800 mx-2" />
              <button
                onClick={() => setShowGuide(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 rounded-lg text-sm font-bold transition-all shadow-lg shadow-indigo-500/5"
              >
                <Sparkles size={16} />
                User Guide
              </button>
            </div>

            <div className="md:hidden">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-400"><Menu /></button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className={`${activeModule === 'character' ? 'block' : 'hidden'}`}>
          <CharacterCreator />
        </div>
        <div className={`${activeModule === 'animation' ? 'block' : 'hidden'}`}>
          <AnimationStudio onSessionInit={handleSessionInit} />
        </div>
        <div className={`${activeModule === 'game' ? 'block' : 'hidden'}`}>
          <GameZone sessionId={sessionId} isGameReady={!!sessionId} />
        </div>
      </main>

      {/* Pop-up Guide (Separate Component) */}
      <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
      ${active ? 'bg-slate-800 text-white shadow-inner border border-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
  >
    {icon}
    {label}
  </button>
);

export default App;