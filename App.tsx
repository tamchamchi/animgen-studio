import { useState } from 'react';
import { CharacterCreator } from './components/CharacterCreator';
import { AnimationStudio } from './components/AnimationStudio';
import { GameZone } from './components/GameZone';
import { Bot, Clapperboard, Menu, Gamepad2, Sparkles, X } from 'lucide-react';
import { GuideModal } from './components/ui/GuideModal';

function App() {
  const [activeModule, setActiveModule] = useState<'character' | 'animation' | 'game'>('character');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  // State shared between modules
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isAnimationFinished, setIsAnimationFinished] = useState(false);

  const handleSessionInit = (id: string) => {
    setSessionId(id);
    setIsAnimationFinished(false);
  };

  const handleAnimationComplete = () => {
    setIsAnimationFinished(true);
  };

  // New handler to reset animation status when game resources are loaded
  const handleGameResourcesLoaded = () => {
    setIsAnimationFinished(true); // Assuming if resources load, the game can start, effectively "resetting" the animation dependency
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30 font-inter">
      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setActiveModule('character')}>
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Bot className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight text-white">AnimGen<span className="text-indigo-500">.io</span></span>
            </div>

            {/* Desktop Navigation */}
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

              <div className="h-6 w-[1px] bg-slate-800 mx-3" />

              <button
                onClick={() => setShowGuide(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 rounded-lg text-sm font-bold transition-all shadow-lg shadow-indigo-500/5 active:scale-95"
              >
                <Sparkles size={16} />
                User Guide
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-400 hover:text-white transition-colors"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 py-4 space-y-2 animate-in slide-in-from-top duration-200">
            <MobileNavButton
              active={activeModule === 'character'}
              onClick={() => { setActiveModule('character'); setMobileMenuOpen(false); }}
              icon={<Bot size={18} />}
              label="Character Creator"
            />
            <MobileNavButton
              active={activeModule === 'animation'}
              onClick={() => { setActiveModule('animation'); setMobileMenuOpen(false); }}
              icon={<Clapperboard size={18} />}
              label="Animation Studio"
            />
            <MobileNavButton
              active={activeModule === 'game'}
              onClick={() => { setActiveModule('game'); setMobileMenuOpen(false); }}
              icon={<Gamepad2 size={18} />}
              label="Game Zone"
            />
            <button
              onClick={() => { setShowGuide(true); setMobileMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-600/10 text-indigo-400 font-bold text-sm border border-indigo-500/30"
            >
              <Sparkles size={18} /> User Guide
            </button>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
        <div className={`transition-all duration-300 ${activeModule === 'character' ? 'opacity-100 scale-100' : 'hidden opacity-0 scale-95'}`}>
          <CharacterCreator />
        </div>
        <div className={`transition-all duration-300 ${activeModule === 'animation' ? 'opacity-100 scale-100' : 'hidden opacity-0 scale-95'}`}>
          <AnimationStudio
            onSessionInit={handleSessionInit}
            onStep3Complete={handleAnimationComplete}
          />
        </div>
        <div className={`transition-all duration-300 ${activeModule === 'game' ? 'opacity-100 scale-100' : 'hidden opacity-0 scale-95'}`}>
          <GameZone
            sessionId={sessionId}
            isGameReady={isAnimationFinished}
            onResourcesLoaded={handleGameResourcesLoaded} // Pass the new handler
          />
        </div>
      </main>

      {/* Pop-up Guide */}
      <GuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto px-4 py-8 border-t border-slate-900 text-center">
        <p className="text-slate-600 text-xs">AnimGen.io © 2025 • Powered by MMLab</p>
      </footer>
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 border
      ${active
        ? 'bg-slate-800 text-white shadow-inner border-slate-700'
        : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border-transparent'}`}
  >
    {icon}
    {label}
  </button>
);

const MobileNavButton = ({ active, onClick, icon, label }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all
      ${active ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 hover:bg-slate-800/30 hover:text-white'}`}
  >
    {icon}
    {label}
  </button>
);

export default App;