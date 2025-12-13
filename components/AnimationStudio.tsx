import { useState } from 'react';
import { FileUpload } from './ui/FileUpload';
import { PlayCircle, Layers, User, CheckCircle2, Loader2, ArrowRight, Download, Check } from 'lucide-react';
import {
    AnimationAction,
    AnimationStep1Response,
    AnimationStep2Response,
    AnimationStep3Response
} from '../types';
import {
    initAnimationSession,
    runAnimationStep1,
    runAnimationStep2,
    runAnimationStep3,
    FILE_BASE_URL
} from '../services/api';

const STEPS = [
    { id: 0, title: 'Init', icon: User, desc: 'Upload Character' },
    { id: 1, title: 'Decompose', icon: Layers, desc: 'Separate Parts' },
    { id: 2, title: 'Pose', icon: User, desc: 'Estimate Skeleton' },
    { id: 3, title: 'Animate', icon: PlayCircle, desc: 'Generate Video' }
];

export const AnimationStudio: React.FC = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [animId, setAnimId] = useState<string | null>(null);
    const [initFile, setInitFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    // Changed to array for multiple selections
    const [selectedActions, setSelectedActions] = useState<AnimationAction[]>([AnimationAction.STAND]);

    // Results State
    const [step1Result, setStep1Result] = useState<AnimationStep1Response | null>(null);
    const [step2Result, setStep2Result] = useState<AnimationStep2Response | null>(null);
    // Changed to array to hold multiple animation results
    const [step3Results, setStep3Results] = useState<AnimationStep3Response[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    const getFullUrl = (path: string) => path.startsWith('http') ? path : `${FILE_BASE_URL}${path}`;

    const handleInit = async () => {
        if (!initFile) {
            setError("Please select a file first.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            addLog("Initializing session...");
            const res = await initAnimationSession(initFile);
            addLog(`Session initialized. ID: ${res.id}`);
            setAnimId(res.id);
            setCurrentStep(1);
        } catch (e: any) {
            setError(e.message);
            addLog(`Error: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleStep1 = async () => {
        if (!animId) return;
        setLoading(true);
        setError(null);
        try {
            addLog(`Step 1: Decomposing character (ID: ${animId})...`);
            const res = await runAnimationStep1(animId);
            setStep1Result(res);
            addLog("Step 1 Complete: Mask and texture generated.");
            setCurrentStep(2);
        } catch (e: any) {
            setError(e.message);
            addLog(`Error Step 1: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleStep2 = async () => {
        if (!animId) return;
        setLoading(true);
        setError(null);
        try {
            addLog(`Step 2: Estimating pose...`);
            const res = await runAnimationStep2(animId);
            setStep2Result(res);
            addLog("Step 2 Complete: Skeleton rig generated.");
            setCurrentStep(3);
        } catch (e: any) {
            setError(e.message);
            addLog(`Error Step 2: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const toggleAction = (action: AnimationAction) => {
        setSelectedActions(prev => {
            if (prev.includes(action)) {
                return prev.filter(a => a !== action);
            } else {
                return [...prev, action];
            }
        });
    };

    const handleStep3 = async () => {
        if (!animId) return;
        if (selectedActions.length === 0) {
            setError("Please select at least one action.");
            return;
        }

        setLoading(true);
        setError(null);
        setStep3Results([]);

        try {
            addLog(`Step 3: Rendering ${selectedActions.length} animations...`);

            // Run all selected animations in parallel
            const promises = selectedActions.map(action => runAnimationStep3(animId, action));
            const results = await Promise.all(promises);

            setStep3Results(results);
            addLog(`Step 3 Complete: ${results.length} animations generated.`);
        } catch (e: any) {
            setError(e.message);
            addLog(`Error Step 3: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setCurrentStep(0);
        setAnimId(null);
        setLogs([]);
        setStep1Result(null);
        setStep2Result(null);
        setStep3Results([]);
        setInitFile(null);
        setSelectedActions([AnimationAction.STAND]);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Animation Studio</h2>
                    <p className="text-slate-400">Sequential pipeline to bring static characters to life.</p>
                </div>
                {animId && (
                    <div className="bg-slate-800 px-4 py-2 rounded-full text-xs font-mono text-slate-400 border border-slate-700">
                        Session: {animId.slice(0, 8)}...
                    </div>
                )}
            </div>

            {/* Stepper Visual */}
            <div className="relative mb-12">
                {/* Background Line: top-6 aligns with the center of h-12 (48px) icons */}
                <div className="absolute top-6 left-0 w-full h-1 bg-slate-800 -translate-y-1/2 rounded-full z-0"></div>
                {/* Progress Line */}
                <div
                    className="absolute top-6 left-0 h-1 bg-indigo-600 -translate-y-1/2 rounded-full z-0 transition-all duration-500"
                    style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
                ></div>

                <div className="relative z-10 flex justify-between w-full">
                    {STEPS.map((step) => {
                        const Icon = step.icon;
                        const isActive = currentStep === step.id;
                        const isCompleted = currentStep > step.id;

                        return (
                            <div key={step.id} className="flex flex-col items-center gap-2 group cursor-pointer" onClick={() => isCompleted && setCurrentStep(step.id)}>
                                <div
                                    className={`
                    w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300
                    ${isActive ? 'bg-indigo-600 border-indigo-900 shadow-lg shadow-indigo-600/50 scale-110' : ''}
                    ${isCompleted ? 'bg-indigo-600 border-indigo-600' : ''}
                    ${!isActive && !isCompleted ? 'bg-slate-800 border-slate-700' : ''}
                  `}
                                >
                                    {isCompleted ? <CheckCircle2 size={20} className="text-white" /> : <Icon size={20} className={isActive || isCompleted ? 'text-white' : 'text-slate-500'} />}
                                </div>
                                <div className="text-center">
                                    <p className={`text-sm font-semibold ${isActive || isCompleted ? 'text-white' : 'text-slate-500'}`}>{step.title}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Main Control Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 min-h-[500px] flex flex-col">

                        {/* Step 0: Upload */}
                        {currentStep === 0 && (
                            <div className="space-y-6 text-center max-w-md mx-auto w-full my-auto">
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold text-white">Initialize Session</h3>
                                    <p className="text-slate-400 text-sm">Upload a full-body character image to begin.</p>
                                </div>
                                <FileUpload onFileSelect={setInitFile} />
                                <button
                                    onClick={handleInit}
                                    disabled={!initFile || loading}
                                    className="btn-primary w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                                    Start Session
                                </button>
                            </div>
                        )}

                        {/* Step 1: Decompose */}
                        {currentStep === 1 && (
                            <div className="flex flex-col h-full gap-6">
                                <div className="text-center">
                                    <h3 className="text-xl font-bold text-white">Step 1: Decomposition</h3>
                                    <p className="text-slate-400 text-sm">Separate character texture and generate a mask.</p>
                                </div>

                                {step1Result ? (
                                    <div className="grid grid-cols-2 gap-4 flex-1">
                                        <div className="space-y-2">
                                            <p className="text-xs text-slate-500 text-center uppercase font-semibold">Mask</p>
                                            <div className="aspect-square bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                                                <img src={getFullUrl(step1Result.mask_url)} className="w-full h-full object-contain" alt="Mask" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-xs text-slate-500 text-center uppercase font-semibold">Texture</p>
                                            <div className="aspect-square bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                                                <img src={getFullUrl(step1Result.texture_url)} className="w-full h-full object-contain" alt="Texture" />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-slate-600 border-2 border-dashed border-slate-700 rounded-xl bg-slate-900/50">
                                        <p>Results will appear here...</p>
                                    </div>
                                )}

                                {!step1Result ? (
                                    <button
                                        onClick={handleStep1}
                                        disabled={loading}
                                        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2 mt-auto"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : <Layers size={18} />}
                                        Process Decomposition
                                    </button>
                                ) : (
                                    <button onClick={() => setCurrentStep(2)} className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium flex items-center justify-center gap-2">
                                        Next Step <ArrowRight size={18} />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Step 2: Pose */}
                        {currentStep === 2 && (
                            <div className="flex flex-col h-full gap-6">
                                <div className="text-center">
                                    <h3 className="text-xl font-bold text-white">Step 2: Pose Estimation</h3>
                                    <p className="text-slate-400 text-sm">Generate skeletal rig and joint configuration.</p>
                                </div>

                                {step2Result ? (
                                    <div className="flex-1 flex flex-col items-center justify-center">
                                        <div className="space-y-2 w-full max-w-sm">
                                            <p className="text-xs text-slate-500 text-center uppercase font-semibold">Skeleton Visualization</p>
                                            <div className="aspect-[3/4] bg-slate-900 rounded-lg overflow-hidden border border-slate-700 relative">
                                                <img src={getFullUrl(step2Result.pose_viz_url)} className="w-full h-full object-contain" alt="Pose Viz" />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-slate-600 border-2 border-dashed border-slate-700 rounded-xl bg-slate-900/50">
                                        <p>Skeleton preview will appear here...</p>
                                    </div>
                                )}

                                {!step2Result ? (
                                    <button
                                        onClick={handleStep2}
                                        disabled={loading}
                                        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2 mt-auto"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : <User size={18} />}
                                        Generate Skeleton
                                    </button>
                                ) : (
                                    <button onClick={() => setCurrentStep(3)} className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium flex items-center justify-center gap-2">
                                        Next Step <ArrowRight size={18} />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Step 3: Animate */}
                        {currentStep === 3 && (
                            <div className="flex flex-col h-full gap-6">
                                <div className="text-center">
                                    <h3 className="text-xl font-bold text-white">Step 3: Animation</h3>
                                    <p className="text-slate-400 text-sm">Select motions to generate.</p>
                                </div>

                                <div className="flex-1 flex flex-col gap-6">
                                    {step3Results.length > 0 ? (
                                        <div className="w-full h-full overflow-y-auto pr-1">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {step3Results.map((res, idx) => (
                                                    <div key={idx} className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-xl group relative">
                                                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-xs font-bold text-white z-10 border border-white/10">
                                                            {res.action.toUpperCase().replace('_', ' ')}
                                                        </div>
                                                        <div className="aspect-square bg-slate-800/50 flex items-center justify-center">
                                                            <img src={getFullUrl(res.gif_url)} className="w-full h-full object-contain" alt={res.action} />
                                                        </div>
                                                        <a
                                                            href={getFullUrl(res.gif_url)}
                                                            download
                                                            target="_blank"
                                                            className="absolute bottom-2 right-2 p-2 bg-indigo-600 hover:bg-indigo-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                        >
                                                            <Download size={16} />
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center gap-2">
                                                <CheckCircle2 className="text-green-500" size={16} />
                                                <span className="text-sm font-bold text-green-400">Successfully generated {step3Results.length} animations</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center gap-6 h-full">
                                            <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 w-full max-w-lg shadow-lg">
                                                <label className="block text-left text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Select Motions (Multiple)</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {Object.values(AnimationAction).map(action => {
                                                        const isSelected = selectedActions.includes(action);
                                                        return (
                                                            <button
                                                                key={action}
                                                                onClick={() => toggleAction(action)}
                                                                className={`
                                                            px-2 py-3 rounded-lg text-xs sm:text-sm font-medium transition-all border
                                                            flex flex-col items-center justify-center gap-1
                                                            ${isSelected
                                                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-900/50'
                                                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:border-slate-600'}
                                                        `}
                                                            >
                                                                {isSelected && <Check size={14} className="mb-0.5" />}
                                                                {action.toUpperCase().replace('_', ' ')}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-3 text-center">
                                                    Selected: {selectedActions.length} actions
                                                </p>
                                            </div>
                                            <div className="hidden md:flex aspect-video w-full max-w-sm items-center justify-center text-slate-600 border-2 border-dashed border-slate-700 rounded-xl bg-slate-900/50">
                                                <p>Output Preview</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {!step3Results.length ? (
                                    <button
                                        onClick={handleStep3}
                                        disabled={loading || selectedActions.length === 0}
                                        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : <PlayCircle size={18} />}
                                        {loading ? 'Rendering...' : 'Render Animations'}
                                    </button>
                                ) : (
                                    <button onClick={reset} className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium flex items-center justify-center gap-2">
                                        Start New Session
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
                            <strong>Error:</strong> {error}
                        </div>
                    )}
                </div>

                {/* Sidebar / Logs */}
                <div className="bg-black/20 rounded-2xl border border-slate-800 p-6 flex flex-col h-full max-h-[600px]">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Session Logs</h3>
                    <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs text-slate-500 pr-2">
                        {logs.length === 0 && <p className="italic opacity-50">Waiting to start...</p>}
                        {logs.map((log, i) => (
                            <div key={i} className="break-words border-l-2 border-slate-700 pl-2 py-1">
                                {log}
                            </div>
                        ))}
                    </div>
                    {/* Session Info Summary */}
                    {animId && (
                        <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500 space-y-1">
                            <p><span className="text-slate-400">ID:</span> {animId}</p>
                            <p><span className="text-slate-400">Step 1:</span> {step1Result ? 'Done' : 'Pending'}</p>
                            <p><span className="text-slate-400">Step 2:</span> {step2Result ? 'Done' : 'Pending'}</p>
                            <p><span className="text-slate-400">Step 3:</span> {step3Results.length > 0 ? `Done (${step3Results.length})` : 'Pending'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};