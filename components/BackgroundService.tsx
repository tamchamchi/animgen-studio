import React, { useState } from 'react';
import { FileUpload } from './ui/FileUpload';
import { analyzeBackgroundModel, analyzeBackgroundSvg } from '../services/api';
import { DetectedObject } from '../types';
import { Layers, Scan, Loader2, AlertCircle, Settings2 } from 'lucide-react';

interface BackgroundServiceProps {
  sessionId: string | null;
  onAnalysisComplete: (bgDataUrl: string, platforms: DetectedObject[]) => void;
}

export const BackgroundService: React.FC<BackgroundServiceProps> = ({ sessionId, onAnalysisComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'model' | 'svg'>('model');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Settings
  const [confidence, setConfidence] = useState(0.4);
  const [topK, setTopK] = useState(30);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
  };

  const convertFileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAnalyze = async () => {
    if (!file || !sessionId) {
        setError("Please ensure a session is active and a file is selected.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Perform Analysis
      let results: DetectedObject[] = [];
      if (mode === 'model') {
        results = await analyzeBackgroundModel(sessionId, file, confidence);
      } else {
        results = await analyzeBackgroundSvg(sessionId, file, topK);
      }

      // 2. Convert image for Game Engine
      const dataUrl = await convertFileToDataUrl(file);

      // 3. Pass back to GameZone
      onAnalysisComplete(dataUrl, results);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  if (!sessionId) {
      return (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center text-slate-400">
              <AlertCircle className="mx-auto mb-2 text-slate-500" />
              <p>Initialize an animation session first to use the Level Creator.</p>
          </div>
      );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6 h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-indigo-500/20 p-2 rounded-lg">
            <Layers className="text-indigo-400" size={20} />
        </div>
        <div>
            <h3 className="text-lg font-bold text-white">Level Creator</h3>
            <p className="text-xs text-slate-400">Upload background to auto-generate platforms</p>
        </div>
      </div>

      <div className="space-y-6">
          <div className="space-y-4">
            <FileUpload 
                label="Upload Background (Image)" 
                onFileSelect={handleFileSelect}
                accept="image/*"
            />
            
            {file && (
                <div className="bg-slate-900/50 p-4 rounded-lg space-y-4 border border-slate-700">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-300">Analysis Mode</span>
                        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                            <button 
                                onClick={() => setMode('model')}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${mode === 'model' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                AI Model
                            </button>
                            <button 
                                onClick={() => setMode('svg')}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${mode === 'svg' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                SVG Scan
                            </button>
                        </div>
                    </div>

                    {mode === 'model' ? (
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-slate-400">
                                <span>Confidence Threshold</span>
                                <span>{Math.round(confidence * 100)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0.1" max="0.9" step="0.05"
                                value={confidence}
                                onChange={(e) => setConfidence(parseFloat(e.target.value))}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-slate-400">
                                <span>Top K Polygons</span>
                                <span>{topK}</span>
                            </div>
                            <input 
                                type="range" 
                                min="5" max="100" step="5"
                                value={topK}
                                onChange={(e) => setTopK(parseInt(e.target.value))}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                        </div>
                    )}

                    <button
                        onClick={handleAnalyze}
                        disabled={loading}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <Scan size={16} />}
                        Analyze & Generate Level
                    </button>
                    
                    {error && <p className="text-xs text-red-400">{error}</p>}
                </div>
            )}
          </div>

          {/* Preview / Info */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-center p-4 min-h-[200px]">
             {file ? (
                 <div className="relative w-full h-full max-h-[300px]">
                     <img 
                        src={URL.createObjectURL(file)} 
                        alt="Preview" 
                        className="w-full h-full object-contain rounded" 
                     />
                     <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
                         Preview
                     </div>
                 </div>
             ) : (
                 <div className="text-center text-slate-600">
                     <Settings2 className="mx-auto mb-2 opacity-50" size={32} />
                     <p className="text-sm">Select an image to configure settings</p>
                 </div>
             )}
          </div>
      </div>
    </div>
  );
};
