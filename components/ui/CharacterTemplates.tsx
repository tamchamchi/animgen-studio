// components/CharacterTemplates.tsx
import React, { useState } from 'react';
import { Users, CheckCircle2, Loader2, Info } from 'lucide-react';
import { CHARACTER_TEMPLATES } from '../../types';

interface CharacterTemplatesProps {
    onSelect: (file: File) => void;
    currentFileName?: string;
    disabled?: boolean;
}

export const CharacterTemplates: React.FC<CharacterTemplatesProps> = ({ onSelect, currentFileName, disabled }) => {
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const handleSelect = async (id: string, imageUrl: string) => {
        if (disabled) return;
        setLoadingId(id);
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            // Create a file object so AnimationStudio can process it like a normal upload
            const file = new File([blob], `template_${id}.png`, { type: "image/png" });
            onSelect(file);
        } catch (err) {
            console.error("Failed to load template:", err);
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 flex flex-col h-full max-h-[600px] backdrop-blur-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-3">
                <Users size={18} className="text-indigo-400" />
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Character Templates</h3>
            </div>

            {/* Pro Tip Box in English */}
            <div className="mb-6 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-700">
                <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                    <strong className="text-indigo-300">Pro Tip:</strong> For the best animation results, upload characters with a similar style to the templates below (standing straight, full-body, and on a simple background).
                </p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-2 gap-3">
                    {CHARACTER_TEMPLATES.map((tpl) => {
                        const isSelected = currentFileName === `template_${tpl.id}.png`;
                        const isLoading = loadingId === tpl.id;

                        return (
                            <button
                                key={tpl.id}
                                onClick={() => handleSelect(tpl.id, tpl.url)}
                                disabled={disabled || isLoading}
                                className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all bg-slate-800/50
                                    ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-700 hover:border-slate-500'}
                                    ${(disabled || isLoading) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}
                                `}
                            >
                                <img
                                    src={tpl.url}
                                    alt={tpl.name}
                                    className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-500"
                                />

                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2">
                                    <p className="text-[9px] font-bold text-white truncate text-center uppercase tracking-tighter">
                                        {tpl.name}
                                    </p>
                                </div>

                                {isLoading && (
                                    <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center backdrop-blur-[1px]">
                                        <Loader2 size={16} className="text-indigo-400 animate-spin" />
                                    </div>
                                )}

                                {isSelected && !isLoading && (
                                    <div className="absolute top-1.5 right-1.5 bg-indigo-500 rounded-full p-0.5 shadow-lg border border-white/20">
                                        <CheckCircle2 size={12} className="text-white" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};