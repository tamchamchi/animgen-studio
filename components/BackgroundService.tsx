import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FileUpload } from './ui/FileUpload';
import { analyzeBackgroundModel, analyzeBackgroundSvg } from '../services/api';
import { DetectedObject } from '../types'; // Đảm bảo type này đã được cập nhật
import { Layers, Scan, Loader2, AlertCircle, Settings2, Info } from 'lucide-react';

interface BackgroundServiceProps {
    sessionId: string | null;
    onAnalysisComplete: (bgDataUrl: string, platforms: DetectedObject[]) => void;
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

export const BackgroundService: React.FC<BackgroundServiceProps> = ({ sessionId, onAnalysisComplete }) => {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [mode, setMode] = useState<'model' | 'svg'>('model');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detectedResults, setDetectedResults] = useState<DetectedObject[]>([]);

    // TRẠNG THÁI MỚI: Sử dụng Set để lưu trữ các ID của đối tượng đang hiển thị
    const [visibleObjectIds, setVisibleObjectIds] = useState<Set<string>>(new Set());

    // State để quản lý đối tượng đang được HOVER (vẫn giữ để tạo hiệu ứng nổi bật)
    const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);

    // Settings
    const [confidence, setConfidence] = useState(0.3);
    const [topK, setTopK] = useState(40);

    // Preview dimensions for polygon scaling
    const previewImgRef = useRef<HTMLImageElement>(null);
    const [previewMeta, setPreviewMeta] = useState({ scale: 1, offsetX: 0, offsetY: 0, width: 0, height: 0 });

    // Dùng Map để lưu màu sắc cho từng ID đối tượng
    const objectColors = useRef<Map<string, string>>(new Map());

    useEffect(() => {
        if (file) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            setDetectedResults([]);
            objectColors.current.clear(); // Xóa màu khi file mới được chọn
            setVisibleObjectIds(new Set()); // Reset các đối tượng hiển thị
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
            let results: DetectedObject[] = [];
            if (mode === 'model') {
                results = await analyzeBackgroundModel(sessionId, file, confidence);
            } else {
                results = await analyzeBackgroundSvg(sessionId, file, topK);
            }

            results.forEach(obj => {
                // Sử dụng obj.id_polygon và chuyển thành string cho Map
                if (!objectColors.current.has(obj.id_polygon.toString())) {
                    objectColors.current.set(obj.id_polygon.toString(), getRandomColor());
                }
            });

            setDetectedResults(results);
            const dataUrl = await convertFileToDataUrl(file);
            onAnalysisComplete(dataUrl, results);
            setVisibleObjectIds(new Set())

            setTimeout(updatePreviewScale, 100);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Analysis failed.");
        } finally {
            setLoading(false);
        }
    };

    // Hàm để xử lý bật/tắt checkbox
    const handleToggleVisibility = (id: string, isChecked: boolean) => {
        // id nhận vào đã là string
        setVisibleObjectIds(prevIds => {
            const newIds = new Set(prevIds);
            if (isChecked) {
                newIds.add(id);
            } else {
                newIds.delete(id);
            }
            return newIds;
        });
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

                        {/* Render SVG nếu có ít nhất 1 đối tượng được phát hiện (để viewBox luôn đúng) */}
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
                                {/* Lặp qua TẤT CẢ các đối tượng đã phát hiện */}
                                {detectedResults.map((obj) => {
                                    if (!obj.polygon) return null;

                                    // Chỉ render nếu ID của đối tượng nằm trong visibleObjectIds
                                    if (!visibleObjectIds.has(obj.id_polygon.toString())) {
                                        return null;
                                    }

                                    // Lấy màu bằng obj.id_polygon.toString()
                                    const color = objectColors.current.get(obj.id_polygon.toString()) || '#FF0000';
                                    const pointsStr = obj.polygon
                                        .map(p => `${p[0]},${p[1]}`)
                                        .join(' ');
                                    const [cx, cy] = getPolygonCentroid(obj.polygon);

                                    // Check if the polygon is too small to display text
                                    const isPolygonTooSmall = (
                                        Math.max(...obj.polygon.map(p => p[0])) - Math.min(...obj.polygon.map(p => p[0])) < 50 ||
                                        Math.max(...obj.polygon.map(p => p[1])) - Math.min(...obj.polygon.map(p => p[1])) < 30
                                    );

                                    return (
                                        <g
                                            key={obj.id_polygon} // Key là id_polygon
                                            onMouseEnter={() => setHoveredObjectId(obj.id_polygon.toString())} // Truyền string ID
                                            onMouseLeave={() => setHoveredObjectId(null)}
                                            className="pointer-events-auto cursor-pointer"
                                        // Tăng z-index cho đối tượng đang hover nếu muốn
                                        // style={{ zIndex: hoveredObjectId === obj.id_polygon.toString() ? 10 : 1 }}
                                        >
                                            <polygon
                                                points={pointsStr}
                                                fill={`${color}33`} // Giảm độ mờ để dễ nhìn khi chồng layer
                                                stroke={color}
                                                strokeWidth="2"
                                                className="transition-all duration-200"
                                                style={{
                                                    fill: hoveredObjectId === obj.id_polygon.toString() ? `${color}66` : `${color}33`,
                                                    strokeWidth: hoveredObjectId === obj.id_polygon.toString() ? '3' : '2'
                                                }}
                                            />
                                            {!isPolygonTooSmall && ( // Luôn hiển thị ID nếu polygon không quá nhỏ
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
                                                    {obj.id_polygon} {/* Hiển thị trực tiếp number ID */}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}
                            </svg>
                        )}

                        {detectedResults.length > 0 && (
                            <div className="absolute top-2 right-2 bg-indigo-600/80 backdrop-blur-sm text-[10px] text-white px-2 py-0.5 rounded font-bold uppercase tracking-widest shadow-lg">
                                {visibleObjectIds.size} Visible Paths
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

            {/* Danh sách các checkbox */}
            {detectedResults.length > 0 && (
                <div className="bg-slate-800 p-4 rounded-lg space-y-2 border border-slate-700 max-h-60 overflow-y-auto">
                    <h4 className="text-sm font-medium text-white mb-2">Toggle Object Masks</h4>
                    <div className="space-y-2"> {/* Giữ space-y-2 cho Toggle All và dải phân cách */}
                        {/* Checkbox để bật/tắt tất cả */}
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="toggle-all"
                                // Đánh dấu checked nếu số lượng visibleObjectIds bằng tổng số đối tượng
                                // và đảm bảo có đối tượng để tránh chia cho 0
                                checked={visibleObjectIds.size === detectedResults.length && detectedResults.length > 0}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        // Map tất cả id_polygon thành string để thêm vào Set
                                        setVisibleObjectIds(new Set(detectedResults.map(obj => obj.id_polygon.toString())));
                                    } else {
                                        setVisibleObjectIds(new Set());
                                    }
                                }}
                                className="form-checkbox text-indigo-600 h-4 w-4 rounded"
                            />
                            <label htmlFor="toggle-all" className="ml-2 text-sm text-slate-300 font-bold">
                                Toggle All ({visibleObjectIds.size}/{detectedResults.length})
                            </label>
                        </div>
                        <div className="border-t border-slate-700 my-2"></div> {/* Dải phân cách */}
                    </div> {/* Kết thúc div space-y-2 cho phần trên */}

                    {/* Thay đổi ở ĐÂY: Sử dụng grid cho danh sách các checkbox riêng lẻ */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2"> {/* Grid 5 cột, responsive */}
                        {detectedResults.map((obj) => {
                            // Lấy màu bằng obj.id_polygon.toString()
                            const color = objectColors.current.get(obj.id_polygon.toString()) || '#FF0000';
                            return (
                                <div key={obj.id_polygon} className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id={`object-${obj.id_polygon}`} // ID cho input
                                        checked={visibleObjectIds.has(obj.id_polygon.toString())} // Kiểm tra bằng string ID
                                        onChange={(e) => handleToggleVisibility(obj.id_polygon.toString(), e.target.checked)} // Truyền string ID
                                        className="form-checkbox text-indigo-600 h-4 w-4 rounded"
                                    />
                                    <label
                                        htmlFor={`object-${obj.id_polygon}`} // htmlFor cũng là string ID
                                        className="ml-2 text-sm font-medium text-slate-300 flex items-center gap-2"
                                    >
                                        <span
                                            className="w-3 h-3 rounded-full inline-block"
                                            style={{ backgroundColor: color }}
                                        ></span>
                                        {obj.id_polygon} {/* Hiển thị trực tiếp number ID */}
                                    </label>
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
        </div>
    );
};