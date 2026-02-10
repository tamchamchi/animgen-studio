import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FileUpload } from './ui/FileUpload';
import { analyzeBackgroundModel, analyzeBackgroundSvg, convertTextToSpeech} from '../services/api';
import { DetectedObject, LocalDetectedObject } from '../types'; // Cập nhật import
import { Layers, Scan, Loader2, AlertCircle, Settings2, Info, Volume2, Save, X } from 'lucide-react'; // Thêm icon
import Modal from './ui/CreateAudioModal'; // Bạn sẽ cần tạo một component Modal đơn giản

interface BackgroundServiceProps {
    sessionId: string | null;
    onAnalysisComplete: (bgDataUrl: string, platforms: LocalDetectedObject[]) => void; // Cập nhật type
}

// Hàm để tạo màu ngẫu nhiên nhưng dễ nhìn
const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
};

// Hàm giả định gọi API Text-to-Speech
// Trong thực tế, bạn sẽ thay thế bằng cuộc gọi API thật đến backend của mình


export const BackgroundService: React.FC<BackgroundServiceProps> = ({ sessionId, onAnalysisComplete }) => {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [mode, setMode] = useState<'model' | 'svg'>('model');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detectedResults, setDetectedResults] = useState<LocalDetectedObject[]>([]); // Cập nhật type

    // Thay đổi từ Set<string> sang string | null để chỉ cho phép chọn 1 object tại 1 thời điểm
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null); // State mới cho radio button
    const [, setHoveredObjectId] = useState<string | null>(null);

    // Settings
    const [confidence, setConfidence] = useState(0.3);
    const [topK, setTopK] = useState(40);

    // Preview dimensions for polygon scaling
    const previewImgRef = useRef<HTMLImageElement>(null);
    const [previewMeta, setPreviewMeta] = useState({ scale: 1, offsetX: 0, offsetY: 0, width: 0, height: 0 });

    const objectColors = useRef<Map<string, string>>(new Map());

    // --- NEW STATES FOR AUDIO CONFIGURATION ---
    const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
    const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
    const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
    const [currentTtsText, setCurrentTtsText] = useState<string>('');
    const [audioFile, setAudioFile] = useState<File | null>(null); // State để giữ file audio đã chọn
    const [audioLoading, setAudioLoading] = useState(false);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (file) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            setDetectedResults([]);
            objectColors.current.clear();
            setSelectedObjectId(null); // Reset selected object
            return () => URL.revokeObjectURL(url);
        }
    }, [file]);

    const updatePreviewScale = useCallback(() => {
        const img = previewImgRef.current;
        if (!img || !img.complete) return;

        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        const displayWidth = img.clientWidth;
        const displayHeight = img.clientHeight;

        let scale = 1;
        let offsetX = 0;
        let offsetY = 0;

        const aspectRatio = naturalWidth / naturalHeight;
        const containerAspectRatio = displayWidth / displayHeight;

        if (aspectRatio > containerAspectRatio) {
            scale = displayWidth / naturalWidth;
            offsetY = (displayHeight - naturalHeight * scale) / 2;
        } else {
            scale = displayHeight / naturalHeight;
            offsetX = (displayWidth - naturalWidth * scale) / 2;
        }

        setPreviewMeta({
            scale: scale,
            offsetX: offsetX,
            offsetY: offsetY,
            width: displayWidth,
            height: displayHeight
        });
    }, []);

    useEffect(() => {
        window.addEventListener('resize', updatePreviewScale);
        return () => window.removeEventListener('resize', updatePreviewScale);
    }, [updatePreviewScale]);

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
            let results: DetectedObject[] = []; // API trả về DetectedObject
            if (mode === 'model') {
                results = await analyzeBackgroundModel(sessionId, file, confidence);
            } else {
                results = await analyzeBackgroundSvg(sessionId, file, topK);
            }

            // Chuyển đổi từ DetectedObject sang LocalDetectedObject, giữ lại audioUrls đã có
            const newDetectedResults: LocalDetectedObject[] = results.map(obj => {
                const existing = detectedResults.find(d => d.id === obj.id_polygon.toString());
                return {
                    id: obj.id_polygon.toString(),
                    name: obj.name,
                    polygon: obj.polygon,
                    bbox: obj.bbox,
                    audioUrl: existing?.audioUrl || null, // Giữ audioUrl nếu đã có
                    ttsText: existing?.ttsText || null, // Giữ ttsText nếu đã có
                };
            }).filter(o => o.polygon && o.polygon.length > 0); // Lọc bỏ nếu polygon bị null hoặc rỗng

            newDetectedResults.forEach(obj => {
                if (!objectColors.current.has(obj.id.toString())) {
                    objectColors.current.set(obj.id.toString(), getRandomColor());
                }
            });

            setDetectedResults(newDetectedResults);
            const dataUrl = await convertFileToDataUrl(file);
            onAnalysisComplete(dataUrl, newDetectedResults); // Truyền newDetectedResults đã có audioUrl
            setSelectedObjectId(newDetectedResults.length > 0 ? newDetectedResults[0].id.toString() : null); // Mặc định chọn object đầu tiên

            setTimeout(updatePreviewScale, 100);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Analysis failed.");
        } finally {
            setLoading(false);
        }
    };

    // Hàm xử lý khi chọn radio button
    const handleSelectObject = (id: string) => {
        setSelectedObjectId(id);
    };

    const getPolygonCentroid = (points: number[][]): [number, number] => {
        if (points.length === 0) return [0, 0];
        let x = 0;
        let y = 0;
        for (const p of points) {
            x += p[0];
            y += p[1];
        }
        return [x / points.length, y / points.length];
    };

    // --- NEW AUDIO MODAL FUNCTIONS ---
    const openAudioModal = (objectId: string) => {
        setEditingObjectId(objectId);
        const obj = detectedResults.find(d => d.id === objectId);
        setCurrentAudioUrl(obj?.audioUrl || null);
        setCurrentTtsText(obj?.ttsText || '');
        setAudioFile(null); // Reset file upload
        setError(null); // Reset error state for modal
        setIsAudioModalOpen(true);
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.currentTime = 0;
        }
    };

    const closeAudioModal = () => {
        setIsAudioModalOpen(false);
        setEditingObjectId(null);
        setCurrentAudioUrl(null);
        setCurrentTtsText('');
        setAudioFile(null);
        setError(null);
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.currentTime = 0;
            audioPlayerRef.current.src = ''; // Clear src to release memory
        }
    };

    const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('audio/')) {
            setAudioFile(file);
            const url = URL.createObjectURL(file);
            setCurrentAudioUrl(url);
            setCurrentTtsText(''); // Clear TTS text if a file is uploaded
            setError(null);
        } else {
            setAudioFile(null);
            setCurrentAudioUrl(null);
            setError("Invalid file type. Please upload an MP3 audio file.");
        }
    };

    const handleGenerateTts = async () => {
        if (!currentTtsText.trim()) {
            setError("Please enter text for Text-to-Speech.");
            return;
        }
        setAudioLoading(true);
        setError(null);
        setAudioFile(null); // Clear uploaded file if generating TTS
        try {
            const dataUrl = await convertTextToSpeech(currentTtsText);
            setCurrentAudioUrl(dataUrl);
            if (audioPlayerRef.current) {
                audioPlayerRef.current.src = dataUrl;
                audioPlayerRef.current.load();
                audioPlayerRef.current.play().catch(e => console.error("Error playing generated TTS:", e));
            }
        } catch (err: any) {
            console.error("TTS Error:", err);
            setError("Failed to generate speech. " + err.message);
            setCurrentAudioUrl(null);
        } finally {
            setAudioLoading(false);
        }
    };

    const handleSaveAudioConfig = () => {
        if (!editingObjectId) return;

        // Cập nhật detectedResults state cục bộ
        const updatedDetectedResults = detectedResults.map(obj => {
            if (obj.id.toString() === editingObjectId) {
                return {
                    ...obj,
                    audioUrl: currentAudioUrl,
                    // Lưu ttsText chỉ khi có audio và audio đó được tạo từ TTS
                    ttsText: (currentAudioUrl && currentTtsText.trim() && !audioFile) ? currentTtsText : null,
                };
            }
            return obj;
        });

        setDetectedResults(updatedDetectedResults);

        // Gọi onAnalysisComplete để truyền dữ liệu đã cập nhật lên GameZone
        if (file && previewUrl) {
            onAnalysisComplete(previewUrl, updatedDetectedResults);
        }

        closeAudioModal();
    };

    // Auto-create audio player ref
    useEffect(() => {
        if (!audioPlayerRef.current) {
            audioPlayerRef.current = new Audio();
        }
    }, []);


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
                    <h3 className="text-lg font-bold text-white">Map Creator</h3>
                </div>
            </div>

            <div className="bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-center p-4 min-h-[200px] overflow-hidden relative group">
                {previewUrl ? (
                    <div className="relative inline-block"
                        style={{
                            width: `${previewImgRef.current?.clientWidth || 'auto'}px`,
                            height: `${previewImgRef.current?.clientHeight || 'auto'}px`
                        }}>
                        <img
                            ref={previewImgRef}
                            src={previewUrl}
                            alt="Preview"
                            onLoad={updatePreviewScale}
                            className="max-w-full max-h-[300px] object-contain rounded"
                            style={{
                                transform: `translate(${previewMeta.offsetX}px, ${previewMeta.offsetY}px)`
                            }}
                        />

                        {detectedResults.length > 0 && (
                            <svg
                                className="absolute inset-0 w-full h-full"
                                viewBox={`0 0 ${previewImgRef.current?.naturalWidth || 1} ${previewImgRef.current?.naturalHeight || 1}`}
                                style={{
                                    transform: `translate(${previewMeta.offsetX}px, ${previewMeta.offsetY}px)`,
                                    width: previewImgRef.current?.clientWidth,
                                    height: previewImgRef.current?.clientHeight
                                }}
                            >
                                {detectedResults.map((obj) => {
                                    if (!obj.polygon) return null;

                                    // Chỉ render polygon nếu nó được chọn
                                    if (selectedObjectId !== obj.id.toString()) {
                                        return null;
                                    }

                                    const color = objectColors.current.get(obj.id.toString()) || '#FF0000';
                                    const pointsStr = obj.polygon
                                        .map(p => `${p[0]},${p[1]}`)
                                        .join(' ');
                                    const [cx, cy] = getPolygonCentroid(obj.polygon);

                                    const isPolygonTooSmall = (
                                        Math.max(...obj.polygon.map(p => p[0])) - Math.min(...obj.polygon.map(p => p[0])) < 50 ||
                                        Math.max(...obj.polygon.map(p => p[1])) - Math.min(...obj.polygon.map(p => p[1])) < 30
                                    );

                                    return (
                                        <g
                                            key={obj.id.toString()}
                                            onMouseEnter={() => setHoveredObjectId(obj.id.toString())}
                                            onMouseLeave={() => setHoveredObjectId(null)}
                                            className="pointer-events-auto cursor-pointer"
                                        >
                                            <polygon
                                                points={pointsStr}
                                                fill={`${color}66`} // Polygon được chọn luôn có fill đầy đủ hơn
                                                stroke={color}
                                                strokeWidth="3" // Polygon được chọn luôn có stroke lớn hơn
                                                className="transition-all duration-200"
                                            />
                                            {!isPolygonTooSmall && (
                                                <text
                                                    x={cx}
                                                    y={cy}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    fontSize="70"
                                                    fontWeight="bold"
                                                    fill="#f70f0fff"
                                                    stroke="#000000ff"
                                                    strokeWidth="0.5"
                                                    pointerEvents="none"
                                                >
                                                    {obj.id.toString()}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}
                            </svg>
                        )}

                        {detectedResults.length > 0 && selectedObjectId && (
                            <div className="absolute top-2 right-2 bg-indigo-600/80 backdrop-blur-sm text-[10px] text-white px-2 py-0.5 rounded font-bold uppercase tracking-widest shadow-lg">
                                Object {selectedObjectId} Selected
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center text-slate-600">
                        <Settings2 className="mx-auto mb-2 opacity-30" size={32} />
                        <p className="text-sm">Map settings</p>
                    </div>
                )}
            </div>

            {detectedResults.length > 0 && (
                <div className="bg-slate-800 p-4 rounded-lg space-y-2 border border-slate-700 max-h-60 overflow-y-auto">
                    <h4 className="text-sm font-medium text-white mb-2">Select Object Masks</h4>

                    <div className="space-y-2">
                        {detectedResults.map((obj) => {
                            const color = objectColors.current.get(obj.id.toString()) || '#FF0000';
                            return (
                                <div key={obj.id.toString()} className="flex items-center justify-between gap-x-2 p-1 rounded-md hover:bg-slate-700 transition-colors">
                                    <div className="flex items-center gap-x-2 flex-grow">
                                        <input
                                            type="radio"
                                            id={`object-${obj.id.toString()}`}
                                            name="selectedObject" // Tên chung cho radio group
                                            checked={selectedObjectId === obj.id.toString()}
                                            onChange={() => handleSelectObject(obj.id.toString())}
                                            className="form-radio text-indigo-600 h-4 w-4 rounded-full shrink-0"
                                        />
                                        <label
                                            htmlFor={`object-${obj.id.toString()}`}
                                            className="ml-0 text-sm font-medium text-slate-300 flex items-center gap-1 cursor-pointer"
                                        >
                                            <span
                                                className="w-3 h-3 rounded-full inline-block shrink-0"
                                                style={{ backgroundColor: color }}
                                            ></span>
                                            <span className="truncate">
                                                ID: {obj.id.toString()}
                                            </span>
                                        </label>
                                    </div>
                                    <button
                                        onClick={() => openAudioModal(obj.id.toString())}
                                        className="p-1 rounded-full text-slate-500 hover:text-indigo-400 transition-colors shrink-0"
                                        title={`Assign audio to ${obj.id.toString()}`}
                                    >
                                        <Volume2 size={16} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

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

            {/* --- AUDIO CONFIG MODAL --- */}
            <Modal isOpen={isAudioModalOpen} onClose={closeAudioModal}>
                <div className="bg-slate-800 p-6 rounded-lg shadow-xl border border-slate-700 w-full max-w-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white">Configure Audio for Object {editingObjectId}</h3>
                        <button onClick={closeAudioModal} className="text-slate-400 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Option 1: Text-to-Speech */}
                        <div>
                            <label htmlFor="tts-text" className="block text-sm font-medium text-slate-300 mb-1">
                                Text-to-Speech
                            </label>
                            <textarea
                                id="tts-text"
                                rows={3}
                                className="w-full p-2 bg-slate-900 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:border-indigo-500"
                                placeholder="Enter text to convert to speech..."
                                value={currentTtsText}
                                onChange={(e) => setCurrentTtsText(e.target.value)}
                                disabled={audioLoading}
                            ></textarea>
                            <button
                                onClick={handleGenerateTts}
                                disabled={audioLoading || !currentTtsText.trim()}
                                className="mt-2 w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                            >
                                {audioLoading ? <Loader2 className="animate-spin" size={16} /> : <Volume2 size={16} />}
                                Generate Speech
                            </button>
                        </div>

                        <div className="relative flex items-center">
                            <div className="flex-grow border-t border-slate-700"></div>
                            <span className="flex-shrink mx-4 text-slate-400 text-sm">OR</span>
                            <div className="flex-grow border-t border-slate-700"></div>
                        </div>

                        {/* Option 2: Upload MP3 */}
                        <div>
                            <label htmlFor="audio-file-upload" className="block text-sm font-medium text-slate-300 mb-1">
                                Upload MP3 File
                            </label>
                            <input
                                type="file"
                                id="audio-file-upload"
                                accept="audio/mpeg, audio/mp3"
                                onChange={handleAudioFileChange}
                                className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-500 file:text-white hover:file:bg-indigo-600"
                                disabled={audioLoading}
                            />
                        </div>

                        {/* Audio Preview */}
                        {currentAudioUrl && (
                            <div className="mt-4 p-3 bg-slate-700 rounded-md flex items-center justify-between">
                                <span className="text-sm text-slate-300">Audio Preview:</span>
                                <audio controls src={currentAudioUrl} ref={audioPlayerRef} className="w-auto h-8"></audio>
                            </div>
                        )}

                        {error && <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded">{error}</p>}

                        <button
                            onClick={handleSaveAudioConfig}
                            className="mt-4 w-full py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                            disabled={!currentAudioUrl || audioLoading}
                        >
                            <Save size={16} /> Save Audio Configuration
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};