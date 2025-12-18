
import React, { useState, useRef, useEffect } from 'react';
import { FileUpload } from './ui/FileUpload';
import { Sparkles, Image as ImageIcon, Type, Loader2, Download, Move, Save, RotateCcw, Hand, ZoomIn, ZoomOut, Camera, X, RefreshCw, CheckCircle2, Trash2 } from 'lucide-react';
import { createCharacterByFace, createCharacterByPrompt, API_BASE_URL } from '../services/api';
import { CharacterResponse, BODY_TEMPLATES } from '../types';
import { CameraModal } from './ui/CameraModal';

interface CharacterCreatorProps {
  onGenerated?: () => void;
}

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({ onGenerated }) => {
  const [activeTab, setActiveTab] = useState<'face' | 'prompt'>('face');
  const [loading, setLoading] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [result, setResult] = useState<CharacterResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Inputs
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [selectedBodyId, setSelectedBodyId] = useState<string>('default');

  // Camera Modal State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  // Manual Adjustment State
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [facePosition, setFacePosition] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Refs for coordinate calculation
  const editorRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const faceImageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file]);

  const getFullUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${API_BASE_URL}${path}`;
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setIsAdjusting(false);

    try {
      let response;
      if (activeTab === 'face') {
        if (!file) {
          throw new Error("Please upload or capture a face image first.");
        }

        const selectedTemplate = BODY_TEMPLATES.find(t => t.id === selectedBodyId) || BODY_TEMPLATES[0];
        const bodyRes = await fetch(selectedTemplate.src);
        const bodyBlob = await bodyRes.blob();

        response = await createCharacterByFace(file, bodyBlob);
      } else {
        if (!prompt.trim()) {
          throw new Error("Please enter a text prompt.");
        }
        response = await createCharacterByPrompt(prompt);
      }
      setResult(response);
      setFacePosition({ x: 0, y: 0, scale: 1 });
      if (onGenerated) onGenerated();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setError(null);
  };

  // --- Adjustment Logic ---
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - facePosition.x,
      y: e.clientY - facePosition.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setFacePosition(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const saveAdjustment = async () => {
    if (!result?.face_url || !imageContainerRef.current || !faceImageRef.current) {
      setError("Resources missing for adjustment.");
      return;
    }

    setAdjusting(true);
    setError(null);

    try {
      const template = BODY_TEMPLATES.find(t => t.id === selectedBodyId) || BODY_TEMPLATES[0];
      const bodyImg = new Image();
      bodyImg.crossOrigin = "anonymous";
      bodyImg.src = template.src;
      await bodyImg.decode();

      const faceImg = new Image();
      faceImg.crossOrigin = "anonymous";
      faceImg.src = getFullUrl(result.face_url);
      await faceImg.decode();

      const canvas = document.createElement('canvas');
      canvas.width = bodyImg.naturalWidth;
      canvas.height = bodyImg.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not create canvas context");

      ctx.drawImage(bodyImg, 0, 0);

      const containerRect = imageContainerRef.current.getBoundingClientRect();
      const containerW = containerRect.width;
      const containerH = containerRect.height;

      const imgRatio = bodyImg.naturalWidth / bodyImg.naturalHeight;
      const containerRatio = containerW / containerH;

      let renderW, renderH, offsetLeft, offsetTop, scaleFactor;

      if (imgRatio < containerRatio) {
        renderH = containerH;
        renderW = containerH * imgRatio;
        offsetLeft = (containerW - renderW) / 2;
        offsetTop = 0;
        scaleFactor = bodyImg.naturalHeight / renderH;
      } else {
        renderW = containerW;
        renderH = containerW / imgRatio;
        offsetLeft = 0;
        offsetTop = (containerH - renderH) / 2;
        scaleFactor = bodyImg.naturalWidth / renderW;
      }

      const faceBaseW = 128;
      const faceBaseH = faceImageRef.current.naturalHeight * (128 / faceImageRef.current.naturalWidth);

      const visualCenterX = (containerW / 2) + facePosition.x;
      const visualCenterY = 50 + (faceBaseH / 2) + facePosition.y;

      const faceVisualW = faceBaseW * facePosition.scale;
      const faceVisualH = faceBaseH * facePosition.scale;

      const visualLeft = visualCenterX - (faceVisualW / 2);
      const visualTop = visualCenterY - (faceVisualH / 2);

      const relativeLeft = visualLeft - offsetLeft;
      const relativeTop = visualTop - offsetTop;

      const canvasX = relativeLeft * scaleFactor;
      const canvasY = relativeTop * scaleFactor;
      const canvasW = faceVisualW * scaleFactor;
      const canvasH = faceVisualH * scaleFactor;

      ctx.drawImage(faceImg, canvasX, canvasY, canvasW, canvasH);

      const newImageUrl = canvas.toDataURL('image/png');

      setResult(prev => prev ? ({
        ...prev,
        image_url: newImageUrl
      }) : null);

      setIsAdjusting(false);
    } catch (err: any) {
      console.error(err);
      setError("Failed to merge images: " + err.message);
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-white tracking-tight">Create Character</h2>
        <p className="text-slate-400">Generate 3D-ready characters from a reference photo or a text description.</p>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
        {/* Tabs */}
        <div className="grid grid-cols-2 border-b border-slate-700">
          <button
            onClick={() => { setActiveTab('face'); setError(null); }}
            className={`p-4 flex items-center justify-center gap-2 transition-colors font-medium
              ${activeTab === 'face'
                ? 'bg-slate-700/50 text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/30'}`}
          >
            <ImageIcon size={18} />
            From Face
          </button>
          <button
            onClick={() => { setActiveTab('prompt'); setError(null); }}
            className={`p-4 flex items-center justify-center gap-2 transition-colors font-medium
              ${activeTab === 'prompt'
                ? 'bg-slate-700/50 text-indigo-400 border-b-2 border-indigo-500'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/30'}`}
          >
            <Type size={18} />
            From Prompt
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="grid md:grid-cols-2 gap-12 items-start">

            {/* Input Section */}
            <div className="space-y-6">
              {activeTab === 'face' ? (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-medium text-slate-300">1. Face Source</label>
                      {file && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full">
                          <CheckCircle2 size={12} className="text-green-400 animate-pulse" />
                          <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Face Loaded</span>
                        </div>
                      )}
                    </div>

                    {previewUrl ? (
                      <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-left-4">
                        <div className="relative w-20 h-20 shrink-0">
                          <img
                            src={previewUrl}
                            className="w-full h-full object-cover rounded-xl border-2 border-indigo-500 shadow-lg shadow-indigo-500/20"
                            alt="Face Preview"
                          />
                          <div className="absolute -top-1 -right-1 bg-indigo-500 rounded-full p-1 shadow-md">
                            <ImageIcon size={10} className="text-white" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm truncate">{file?.name}</p>
                          <p className="text-slate-500 text-xs">Source file ready for rigging</p>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => setIsCameraModalOpen(true)}
                              className="text-[10px] font-bold text-indigo-400 hover:text-white transition-colors flex items-center gap-1"
                            >
                              <RefreshCw size={12} /> Replace
                            </button>
                            <button
                              onClick={handleRemoveFile}
                              className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                            >
                              <Trash2 size={12} /> Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => setIsCameraModalOpen(true)}
                            className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all group"
                          >
                            <Camera size={24} className="group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-bold uppercase tracking-wider">Use Camera</span>
                          </button>
                          <div className="relative">
                            <FileUpload
                              label="Browse Files"
                              onFileSelect={(f) => setFile(f)}
                            />
                          </div>
                        </div>
                        <p className="text-center text-[10px] text-slate-500 uppercase tracking-widest">Choose a capture method</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-300">2. Select Body Template</label>
                    <div className="grid grid-cols-3 gap-3">
                      {BODY_TEMPLATES.map(tpl => (
                        <button
                          key={tpl.id}
                          onClick={() => setSelectedBodyId(tpl.id)}
                          className={`
                                    relative rounded-lg overflow-hidden border-2 transition-all aspect-[3/4] group
                                    ${selectedBodyId === tpl.id
                              ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                              : 'border-slate-700 hover:border-slate-500'}
                                `}
                        >
                          <img src={tpl.src} alt={tpl.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 bg-black/70 p-1 text-[10px] text-center text-white truncate">
                            {tpl.name}
                          </div>
                          {selectedBodyId === tpl.id && (
                            <div className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full shadow-lg" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-slate-300">Description Prompt</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="E.g., A cyberpunk samurai with neon armor, glowing blue eyes..."
                    className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[160px]"
                  />
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                  <X size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={loading || adjusting || (activeTab === 'face' && !file) || (activeTab === 'prompt' && !prompt.trim())}
                className={`
                  w-full py-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-lg transition-all
                  ${loading
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 disabled:opacity-50 disabled:cursor-not-allowed'}
                `}
              >
                {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {loading ? 'Generating...' : 'Generate Character'}
              </button>
            </div>

            {/* Output Section */}
            <div className="relative">
              {isAdjusting && result && result.face_url ? (
                <div className="bg-slate-900 rounded-xl border border-indigo-500/50 min-h-[500px] flex flex-col overflow-hidden shadow-2xl">
                  <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm text-indigo-300">
                      <Hand size={16} /> Drag to Move
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setIsAdjusting(false)} className="px-3 py-1 text-xs hover:bg-slate-700 rounded text-slate-300">Cancel</button>
                      <button
                        onClick={saveAdjustment}
                        disabled={adjusting}
                        className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center gap-1 disabled:opacity-50"
                      >
                        {adjusting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Apply
                      </button>
                    </div>
                  </div>

                  <div
                    className="flex-1 relative bg-slate-950/50 overflow-hidden flex justify-center py-4 cursor-move"
                    ref={editorRef}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    <div ref={imageContainerRef} className="relative h-[500px] w-full max-w-[400px]">
                      <img
                        src={BODY_TEMPLATES.find(t => t.id === selectedBodyId)?.src || BODY_TEMPLATES[0].src}
                        className="w-full h-full object-contain pointer-events-none opacity-80"
                        alt="Body Template"
                      />
                      <img
                        ref={faceImageRef}
                        src={getFullUrl(result.face_url)}
                        className={`absolute top-[50px] left-1/2 -ml-[64px] w-32 h-auto object-cover border-2 border-indigo-400/50 rounded-full shadow-xl transition-transform duration-75 
                                      ${isDragging ? 'cursor-grabbing scale-[1.02]' : 'cursor-grab'}
                                    `}
                        style={{
                          transform: `translate(${facePosition.x}px, ${facePosition.y}px) scale(${facePosition.scale})`,
                        }}
                        onMouseDown={handleMouseDown}
                        alt="Face Overlay"
                        draggable={false}
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-slate-800 border-t border-slate-700">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-xs font-medium text-slate-400">
                          <span>Scale</span>
                          <span>{(facePosition.scale * 100).toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="2.5"
                          step="0.05"
                          value={facePosition.scale}
                          onChange={(e) => setFacePosition(p => ({ ...p, scale: Number(e.target.value) }))}
                          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
                        <button onClick={() => setFacePosition(p => ({ ...p, scale: Math.max(0.5, p.scale - 0.1) }))} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600">
                          <ZoomOut size={16} />
                        </button>
                        <button onClick={() => setFacePosition(p => ({ ...p, scale: Math.min(2, p.scale + 0.1) }))} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600">
                          <ZoomIn size={16} />
                        </button>
                        <button
                          onClick={() => setFacePosition({ x: 0, y: 0, scale: 1 })}
                          className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors ml-2"
                          title="Reset to default"
                        >
                          <RotateCcw size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 rounded-xl border border-slate-700 min-h-[500px] flex flex-col items-center justify-center relative overflow-hidden group">
                  {result ? (
                    <div className="w-full h-full p-4 flex flex-col gap-4 overflow-y-auto">
                      <div className="relative group/image">
                        <img
                          src={getFullUrl(result.image_url)}
                          alt="Generated Character"
                          className="w-full h-auto rounded-lg shadow-2xl border border-slate-700"
                        />
                        <a
                          href={getFullUrl(result.image_url)}
                          download
                          target="_blank"
                          className="absolute bottom-2 right-2 p-2 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover/image:opacity-100 transition-opacity"
                        >
                          <Download size={16} />
                        </a>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setIsAdjusting(true)}
                          className="flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-bold border border-slate-700 transition-all active:scale-95"
                        >
                          <Move size={16} />
                          Adjust Position
                        </button>
                        <button
                          onClick={() => setResult(null)}
                          className="flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 rounded-lg text-sm font-bold border border-slate-700 hover:border-red-900/50 transition-all active:scale-95"
                        >
                          <X size={16} />
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-8 space-y-4">
                      <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto border-2 border-dashed border-slate-700">
                        <ImageIcon size={32} className="text-slate-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-white font-medium">Ready to Visualize</p>
                        <p className="text-slate-500 text-sm">Upload a face or type a prompt to see your character here.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(capturedFile) => setFile(capturedFile)}
      />
    </div>
  );
};
