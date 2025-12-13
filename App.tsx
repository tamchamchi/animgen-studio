import React, { useState } from 'react';
import { CharacterCreator } from './components/CharacterCreator';
import { AnimationStudio } from './components/AnimationStudio';
import { Bot, Clapperboard, Menu } from 'lucide-react';

function App() {
  const [activeModule, setActiveModule] = useState<'character' | 'animation'>('character');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
      
      {/* Navigation Bar */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Bot className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight text-white">AnimGen<span className="text-indigo-500">.io</span></span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-1">
              <button
                onClick={() => setActiveModule('character')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2
                  ${activeModule === 'character' 
                    ? 'bg-slate-800 text-white shadow-inner' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
              >
                <Bot size={16} />
                Character Creator
              </button>
              <button
                onClick={() => setActiveModule('animation')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2
                  ${activeModule === 'animation' 
                    ? 'bg-slate-800 text-white shadow-inner' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
              >
                <Clapperboard size={16} />
                Animation Studio
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <Menu />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-900 px-2 py-3 space-y-1">
            <button
                onClick={() => { setActiveModule('character'); setMobileMenuOpen(false); }}
                className={`w-full text-left px-3 py-3 rounded-md text-base font-medium flex items-center gap-2
                  ${activeModule === 'character' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
              >
                <Bot size={18} /> Character Creator
            </button>
            <button
                onClick={() => { setActiveModule('animation'); setMobileMenuOpen(false); }}
                className={`w-full text-left px-3 py-3 rounded-md text-base font-medium flex items-center gap-2
                  ${activeModule === 'animation' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
              >
                <Clapperboard size={18} /> Animation Studio
            </button>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className={`transition-opacity duration-300 ${activeModule === 'character' ? 'block' : 'hidden'}`}>
           <CharacterCreator />
        </div>
        <div className={`transition-opacity duration-300 ${activeModule === 'animation' ? 'block' : 'hidden'}`}>
           <AnimationStudio />
        </div>
      </main>

    </div>
  );
}

export default App;
