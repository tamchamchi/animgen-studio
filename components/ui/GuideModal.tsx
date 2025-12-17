import React from 'react';
import { X, Lightbulb, CheckCircle, Bot, Clapperboard, Gamepad2 } from 'lucide-react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const steps = [
    {
      icon: <Bot className="text-indigo-400" size={20} />,
      title: "1. Create Your Character",
      description: "Use the Camera to capture a face or type a text Prompt to generate your unique hero."
    },
    {
      icon: <Clapperboard className="text-indigo-400" size={20} />,
      title: "2. Animation Studio",
      description: "Render all essential actions: standing, running, jumping, speaking, waving, and dancing to fully enable GameZone gameplay."
    },
    {
      icon: <Gamepad2 className="text-indigo-400" size={20} />,
      title: "3. GameZone Setup",
      description: "Upload your background image. In Level Creator, select 'SVG Mode' and increase the 'Top-K' value to define more standing areas for your character."
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <Lightbulb className="text-white" size={24} />
            </div>
            <h3 className="text-xl font-bold text-white">AnimGen Guide</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
                {step.icon}
              </div>
              <div>
                <h4 className="font-bold text-white mb-1 uppercase tracking-tight text-sm">{step.title}</h4>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}

          <button
            onClick={onClose}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 group"
          >
            <CheckCircle size={18} className="text-white group-hover:scale-110 transition-transform" />
            Got it, let's start!
          </button>
        </div>
      </div>
    </div>
  );
};