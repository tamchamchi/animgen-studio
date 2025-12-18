import React, { useState, useRef, useEffect } from 'react';
import { FileUpload } from './ui/FileUpload';
import { analyzeBackgroundModel, analyzeBackgroundSvg } from '../services/api';
import { DetectedObject } from '../types';
import { Layers, Scan, Loader2, AlertCircle, Settings2, Info } from 'lucide-react';

interface BackgroundServiceProps {
    sessionId: string | null;
    onAnalysisComplete: (bgDataUrl: string, platforms: DetectedObject[]) => void;
}

export const BackgroundService: React.FC<BackgroundServiceProps> = ({ sessionId, onAnalysisComplete }) => {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [mode, setMode] = useState<'model' | 'svg'>('model');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detectedResults, setDetectedResults] = useState<DetectedObject[]>([]);

    // Settings
    const [confidence, setConfidence] = useState(0.4);
    const [topK, setTopK] = useState(40);

    // Preview dimensions for polygon scaling
    const previewImgRef = useRef<HTMLImageElement>(null);
    const [previewMeta, setPreviewMeta] = useState({ scale: 1, offsetX: 0, offsetY: 0, width: 0, height: 0 });

    useEffect(() => {
        if (file) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            setDetectedResults([]);
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    const updatePreviewScale = () => {
        const img = previewImgRef.current;
        if (!img || !img.complete) return;

        const naturalWidth = img.naturalWidth;
        const displayWidth = img.clientWidth;
        const displayHeight = img.clientHeight;

        const scale = displayWidth / naturalWidth;

        setPreviewMeta({
            scale: scale,
            offsetX: 0,
            offsetY: 0,
            width: displayWidth,
            height: displayHeight
        });
    };

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
            let results: DetectedObject[] = [];
            if (mode === 'model') {
                results = await analyzeBackgroundModel(sessionId, file, confidence);
            } else {
                results = await analyzeBackgroundSvg(sessionId, file, topK);
            }

            setDetectedResults(results);
            const dataUrl = await convertFileToDataUrl(file);
            onAnalysisComplete(dataUrl, results);

            setTimeout(updatePreviewScale, 100);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Analysis failed.");
        } finally {
            setLoading(false);
        }
    };

    if (!sessionId) {
        return (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center text-slate-400">
                <AlertCircle className="mx-auto mb-2 text-slate-500" />
                <p>Start an animation session before using the Level Creator.</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6 h-full shadow-inner">
            <div className="flex items-center gap-2 mb-4">
                <div className="bg-indigo-500/20 p-2 rounded-lg">
                    <Layers className="text-indigo-400" size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white">Level Creator</h3>
                    <p className="text-xs text-slate-400">Auto-generate platforms</p>
                </div>
            </div>

            <div className="bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-center p-4 min-h-[200px] overflow-hidden relative group">
                {previewUrl ? (
                    <div className="relative inline-block">
                        <img
                            ref={previewImgRef}
                            src={previewUrl}
                            alt="Preview"
                            onLoad={updatePreviewScale}
                            className="max-w-full max-h-[300px] object-contain rounded"
                        />

                        {detectedResults.length > 0 && (
                            <svg
                                className="absolute inset-0 w-full h-full pointer-events-none"
                                viewBox={`0 0 ${previewMeta.width} ${previewMeta.height}`}
                            >
                                {detectedResults.map((obj, i) => {
                                    if (!obj.polygon) return null;
                                    const pointsStr = obj.polygon
                                        .map(p => `${p[0] * previewMeta.scale},${p[1] * previewMeta.scale}`)
                                        .join(' ');
                                    return (
                                        <polygon
                                            key={i}
                                            points={pointsStr}
                                            fill="rgba(0, 255, 17, 0)"
                                            stroke="rgba(26, 255, 0, 1)"
                                            strokeWidth="1"
                                        />
                                    );
                                })}
                            </svg>
                        )}

                        {detectedResults.length > 0 && (
                            <div className="absolute top-2 right-2 bg-indigo-600/80 backdrop-blur-sm text-[10px] text-white px-2 py-0.5 rounded font-bold uppercase tracking-widest shadow-lg">
                                {detectedResults.length} Paths Found
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center text-slate-600">
                        <Settings2 className="mx-auto mb-2 opacity-30" size={32} />
                        <p className="text-sm">Configure background settings</p>
                    </div>
                )}
            </div>

            <div className="space-y-6">
                <div className="space-y-4">
                    <FileUpload
                        label="Upload Background"
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
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${mode === 'model' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        AI Model
                                    </button>
                                    <button
                                        onClick={() => setMode('svg')}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${mode === 'svg' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        SVG Scan
                                    </button>
                                </div>
                            </div>

                            {mode === 'svg' && (
                                <div className="bg-indigo-500/10 border border-indigo-500/30 p-2 rounded-lg flex gap-2 items-start">
                                    <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-indigo-300 italic">
                                        SVG Mode is recommended for generating more walkable surfaces.
                                    </p>
                                </div>
                            )}

                            {mode === 'model' ? (
                                <div className="space-y-2">
                                    <div className="bg-indigo-500/10 border border-indigo-500/30 p-2 rounded-lg flex gap-2 items-start">
                                        <Info size={14} className="text-indigo-400 shrink-0" />
                                        <p className="text-[10px] text-indigo-300 italic">
                                            Lower confidence will detect more objects.
                                        </p>
                                    </div>
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
                                        <span className="text-indigo-400 font-bold">{topK}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="5" max="100" step="1"
                                        value={topK}
                                        onChange={(e) => setTopK(parseInt(e.target.value))}
                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                    <p className="text-[9px] text-slate-500 text-right">
                                        Increase for more walkable regions
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={handleAnalyze}
                                disabled={loading}
                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                            >
                                {loading ? <Loader2 className="animate-spin" size={16} /> : <Scan size={16} />}
                                Analyze & Generate
                            </button>

                            {error && <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded">{error}</p>}
                        </div>
                    )}
                </div>


            </div>
        </div>
    );
};
