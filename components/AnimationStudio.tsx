import { useState } from 'react';
import { FileUpload } from './ui/FileUpload';
import { CharacterTemplates } from './ui/CharacterTemplates';
import {
    PlayCircle,
    Download,
    Check,
    RefreshCw,
    Wand2,
    Activity,
    Loader2
} from 'lucide-react';
import {
    AnimationAction,
    AnimationStep3Response
} from '../types';
import {
    initAnimationSession,
    runAnimationStep1,
    runAnimationStep2,
    runAnimationStep3,
    FILE_BASE_URL
} from '../services/api';

interface AnimationStudioProps {
    onSessionInit?: (id: string) => void;
    onStep3Complete?: () => void;
}

export const AnimationStudio: React.FC<AnimationStudioProps> = ({ onSessionInit, onStep3Complete }) => {
    // currentStep 0: Setup/Initialization, 3: Animation Control
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [pipelineStatus, setPipelineStatus] = useState<string>('');

    const [processingAction, setProcessingAction] = useState<string | null>(null);
    const [animId, setAnimId] = useState<string | null>(null);
    const [initFile, setInitFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [selectedActions, setSelectedActions] = useState<AnimationAction[]>([AnimationAction.STAND]);
    const [step3Results, setStep3Results] = useState<AnimationStep3Response[]>([]);

    const getFullUrl = (path: string) => path.startsWith('http') ? path : `${FILE_BASE_URL}${path}`;

    /**
     * LUỒNG XỬ LÝ TỰ ĐỘNG (PIPELINE CHẠY NGẦM)
     * Chạy liên tục: Khởi tạo -> Phân tách bộ phận -> Xác định khung xương
     */
    const handleStartPipeline = async () => {
        if (!initFile) {
            setError("Please select or upload a character first.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Bước 0: Khởi tạo Session
            setPipelineStatus('Initializing session...');
            const resInit = await initAnimationSession(initFile);
            setAnimId(resInit.id);
            if (onSessionInit) onSessionInit(resInit.id);

            // Bước 1: Phân tách (Chạy ngầm)
            setPipelineStatus('Analyzing & Decomposing character...');
            await runAnimationStep1(resInit.id);

            // Bước 2: Xác định tư thế (Chạy ngầm)
            setPipelineStatus('Building skeleton & rigging...');
            await runAnimationStep2(resInit.id);

            // Hoàn tất chuỗi xử lý ngầm -> Chuyển sang UI Animation
            setPipelineStatus('');
            setCurrentStep(3);

        } catch (e: any) {
            setError(e.message || "An error occurred during preparation.");
        } finally {
            setLoading(false);
        }
    };

    const toggleAction = (action: AnimationAction) => {
        setSelectedActions(prev => prev.includes(action) ? prev.filter(a => a !== action) : [...prev, action]);
    };

    /**
     * TẠO VIDEO ANIMATION (Step 3)
     */
    const handleStep3 = async () => {
        if (!animId) return;
        if (selectedActions.length === 0) {
            setError("Please select at least one motion.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const newResults: AnimationStep3Response[] = [...step3Results];

            for (const action of selectedActions) {
                // Bỏ qua nếu action này đã được tạo trước đó
                if (step3Results.some(r => r.action === action)) continue;

                setProcessingAction(action);
                const res = await runAnimationStep3(animId, action);

                const finalRes: AnimationStep3Response = {
                    action: action,
                    gif_url: res.gif_url,
                    status: 'success'
                };

                newResults.push(finalRes);
                setStep3Results([...newResults]);
            }

            if (onStep3Complete) onStep3Complete();

        } catch (e: any) {
            setError(e.message || "Failed to generate animation.");
        } finally {
            setLoading(false);
            setProcessingAction(null);
        }
    };

    const reset = () => {
        setCurrentStep(0);
        setAnimId(null);
        setStep3Results([]);
        setInitFile(null);
        setPipelineStatus('');
        setSelectedActions([AnimationAction.STAND]);
        setError(null);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header Area */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Animation Studio</h2>
                    <p className="text-slate-400">Bring your static characters to life with Generative AI.</p>
                </div>
                {animId && (
                    <div className="hidden sm:flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-full text-xs font-mono text-indigo-400 border border-slate-700">
                        <Activity size={14} /> Session: {animId.slice(0, 8)}
                    </div>
                )}
            </div>

            <div className="grid lg:grid-cols-3 gap-8 pt-4">
                {/* Main Content (Step 0 or Step 3) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 min-h-[550px] flex flex-col justify-center backdrop-blur-sm shadow-xl relative overflow-hidden">

                        {/* SCREEN 1: UPLOAD & PREPARE */}
                        {currentStep === 0 && (
                            <div className="space-y-8 text-center max-w-md mx-auto w-full animate-in fade-in duration-500">
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-bold text-white">Character Initialization</h3>
                                    <p className="text-slate-400 text-sm">Upload an image or pick a template to begin</p>
                                </div>

                                {!loading ? (
                                    <div className="space-y-6">
                                        <FileUpload
                                            label='Upload your character'
                                            onFileSelect={setInitFile}
                                        />
                                        <button
                                            onClick={handleStartPipeline}
                                            disabled={!initFile}
                                            className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                                        >
                                            <Wand2 size={20} />
                                            PREPARE CHARACTER
                                        </button>
                                    </div>
                                ) : (
                                    <div className="py-12 flex flex-col items-center gap-6">
                                        <div className="relative">
                                            <Loader2 className="animate-spin text-indigo-500" size={64} />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Activity size={24} className="text-indigo-400" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-white font-bold text-xl tracking-wide">{pipelineStatus}</p>
                                            <p className="text-slate-500 text-sm animate-pulse">Our AI is processing geometry...</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SCREEN 2: ANIMATION CONTROL */}
                        {currentStep === 3 && (
                            <div className="flex flex-col h-full gap-8 animate-in slide-in-from-bottom-4 duration-500">
                                <div className="text-center">
                                    <h3 className="text-2xl font-bold text-white">Animate Motion</h3>
                                    <p className="text-slate-400 text-sm">Select motions to apply to your character.</p>
                                </div>

                                <div className="flex-1 space-y-8">
                                    {/* Generated Results */}
                                    {step3Results.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {step3Results.map((res, idx) => (
                                                <div key={idx} className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-2xl group relative">
                                                    <div className="absolute top-3 left-3 bg-indigo-600 px-3 py-1 rounded-full text-[10px] font-black text-white z-10 uppercase tracking-tighter">
                                                        {res.action.replace('_', ' ')}
                                                    </div>
                                                    <div className="aspect-square bg-slate-950 flex items-center justify-center p-4">
                                                        <img src={getFullUrl(res.gif_url)} className="w-full h-full object-contain" alt={res.action} />
                                                    </div>
                                                    <a
                                                        href={getFullUrl(res.gif_url)}
                                                        download
                                                        target="_blank"
                                                        className="absolute bottom-3 right-3 p-3 bg-white text-slate-900 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all shadow-xl hover:scale-110 active:scale-95"
                                                    >
                                                        <Download size={18} />
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Loading State for Action Generation */}
                                    {loading && (
                                        <div className="flex flex-col items-center justify-center p-10 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl border-dashed">
                                            <Loader2 className="animate-spin text-indigo-400 mb-4" size={40} />
                                            <p className="text-indigo-200 font-bold uppercase tracking-widest text-xs">Generating: {processingAction?.replace('_', ' ')}</p>
                                        </div>
                                    )}

                                    {/* Motion Selection Grid */}
                                    {!loading && (
                                        <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700 shadow-inner">
                                            <label className="block text-[10px] font-black text-slate-500 mb-4 uppercase tracking-[0.2em]">Available Motions</label>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {Object.values(AnimationAction).map(action => {
                                                    const isSelected = selectedActions.includes(action);
                                                    const isDone = step3Results.some(r => r.action === action);
                                                    return (
                                                        <button
                                                            key={action}
                                                            onClick={() => toggleAction(action)}
                                                            disabled={isDone}
                                                            className={`px-3 py-4 rounded-xl text-xs font-bold transition-all border flex flex-col items-center gap-2
                                                                ${isDone ? 'bg-green-500/10 border-green-500/50 text-green-500 opacity-50 cursor-not-allowed' :
                                                                    isSelected ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/40' :
                                                                        'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-750'}`}
                                                        >
                                                            {isDone ? <Check size={16} /> : action.toUpperCase().replace('_', ' ')}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Control Buttons */}
                                {!loading && (
                                    <div className="flex gap-4">
                                        <button
                                            onClick={handleStep3}
                                            disabled={selectedActions.length === 0 || selectedActions.every(a => step3Results.some(r => r.action === a))}
                                            className="flex-1 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black tracking-widest flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            <PlayCircle size={20} /> RUN ANIMATION
                                        </button>
                                        <button
                                            onClick={reset}
                                            className="px-6 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <RefreshCw size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Error Feedback */}
                    {error && (
                        <div className="p-4 bg-red-950/40 border border-red-500/50 rounded-xl text-red-200 text-sm animate-in shake-1">
                            <strong>Error:</strong> {error}
                        </div>
                    )}
                </div>

                {/* Right Sidebar: Character Templates */}
                <CharacterTemplates
                    onSelect={(file) => setInitFile(file)}
                    currentFileName={initFile?.name}
                    disabled={loading}
                />
            </div>
        </div>
    );
};