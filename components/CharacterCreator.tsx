import { useState, useRef, SetStateAction } from 'react';
import { FileUpload } from './ui/FileUpload';
import { Sparkles, Image as ImageIcon, Type, Loader2, ArrowRight, Download, Move, Save, RotateCcw, Hand, ZoomIn, ZoomOut } from 'lucide-react';
import { createCharacterByFace, createCharacterByPrompt, FILE_BASE_URL } from '../services/api';
import { CharacterResponse, BODY_TEMPLATES } from '../types';

export const CharacterCreator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'face' | 'prompt'>('face');
  const [loading, setLoading] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [result, setResult] = useState<CharacterResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Inputs
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [selectedBodyId, setSelectedBodyId] = useState<string>('default');

  // Manual Adjustment State
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [facePosition, setFacePosition] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Refs for coordinate calculation
  const editorRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const faceImageRef = useRef<HTMLImageElement>(null);

  const getFullUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${FILE_BASE_URL}${path}`;
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
          throw new Error("Please upload a face image first.");
        }

        // Get the selected body template
        const selectedTemplate = BODY_TEMPLATES.find(t => t.id === selectedBodyId) || BODY_TEMPLATES[0];

        // Convert the imported image path to a Blob
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
      // Reset adjustments defaults for new generation
      setFacePosition({ x: 0, y: 0, scale: 1 });
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // --- Adjustment Logic (Frontend Only) ---

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    // Calculate the offset between mouse and current image position
    setDragStart({
      x: e.clientX - facePosition.x,
      y: e.clientY - facePosition.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();

    // Update position based on mouse movement relative to start offset
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
      // 1. Load the Body Image (High Res)
      const template = BODY_TEMPLATES.find(t => t.id === selectedBodyId) || BODY_TEMPLATES[0];
      const bodyImg = new Image();
      bodyImg.crossOrigin = "anonymous";
      bodyImg.src = template.src;
      await bodyImg.decode();

      // 2. Load the Face Image
      const faceImg = new Image();
      faceImg.crossOrigin = "anonymous";
      faceImg.src = getFullUrl(result.face_url);
      await faceImg.decode();

      // 3. Create Canvas matching Body dimensions
      const canvas = document.createElement('canvas');
      canvas.width = bodyImg.naturalWidth;
      canvas.height = bodyImg.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not create canvas context");

      // 4. Draw Body Base
      ctx.drawImage(bodyImg, 0, 0);

      // 5. Calculate Coordinates Mapping

      const containerRect = imageContainerRef.current.getBoundingClientRect();
      const containerW = containerRect.width;
      const containerH = containerRect.height;

      // Calculate how the body image is visually rendered (object-contain)
      const imgRatio = bodyImg.naturalWidth / bodyImg.naturalHeight;
      const containerRatio = containerW / containerH;

      let renderW, renderH, offsetLeft, offsetTop, scaleFactor;

      if (imgRatio < containerRatio) {
        // Fits height (vertical fit)
        renderH = containerH;
        renderW = containerH * imgRatio;
        offsetLeft = (containerW - renderW) / 2;
        offsetTop = 0;
        scaleFactor = bodyImg.naturalHeight / renderH;
      } else {
        // Fits width (horizontal fit)
        renderW = containerW;
        renderH = containerW / imgRatio;
        offsetLeft = 0;
        offsetTop = (containerH - renderH) / 2;
        scaleFactor = bodyImg.naturalWidth / renderW;
      }

      // 6. Calculate Face Visual Position
      // These must match the CSS styles exactly
      const faceBaseW = 128; // CSS w-32 = 128px (approximate reference for calculation)
      const faceBaseH = faceImageRef.current.naturalHeight * (128 / faceImageRef.current.naturalWidth);

      // Visual center relative to container
      // CSS: left-1/2 (50%) - ml-[64px] (half width) -> creates center anchor
      // Transform: translate(x, y)
      const visualCenterX = (containerW / 2) + facePosition.x;
      const visualCenterY = 50 + (faceBaseH / 2) + facePosition.y; // Top fixed at 50px

      // Target Dimensions (Scaled)
      const faceVisualW = faceBaseW * facePosition.scale;
      const faceVisualH = faceBaseH * facePosition.scale;

      const visualLeft = visualCenterX - (faceVisualW / 2);
      const visualTop = visualCenterY - (faceVisualH / 2);

      // 7. Map to Canvas Coordinates
      // Remove the "black bars" offset from object-contain
      const relativeLeft = visualLeft - offsetLeft;
      const relativeTop = visualTop - offsetTop;

      // Scale up to natural resolution
      const canvasX = relativeLeft * scaleFactor;
      const canvasY = relativeTop * scaleFactor;
      const canvasW = faceVisualW * scaleFactor;
      const canvasH = faceVisualH * scaleFactor;

      // 8. Draw Face on Canvas
      ctx.drawImage(faceImg, canvasX, canvasY, canvasW, canvasH);

      // 9. Export Result
      const newImageUrl = canvas.toDataURL('image/png');

      // Update local state with the new image
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
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">1. Upload Face</label>
                    <FileUpload
                      label="Upload Face Image"
                      onFileSelect={(f: SetStateAction<File | null>) => setFile(f)}
                    />
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
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={loading || adjusting}
                className={`
                  w-full py-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-lg transition-all
                  ${loading
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40'}
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

                  {/* Editor Canvas Area */}
                  <div
                    className="flex-1 relative bg-slate-950/50 overflow-hidden flex justify-center py-4 cursor-move"
                    ref={editorRef}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    <div ref={imageContainerRef} className="relative h-[500px] w-full max-w-[400px]">
                      {/* Background Body */}
                      <img
                        src={BODY_TEMPLATES.find(t => t.id === selectedBodyId)?.src || BODY_TEMPLATES[0].src}
                        className="w-full h-full object-contain pointer-events-none opacity-80"
                        alt="Body Template"
                      />
                      {/* Face Overlay */}
                      <img
                        ref={faceImageRef}
                        src={getFullUrl(result.face_url)}
                        // Visual Fix: left-1/2 centers start, -ml-[64px] centers element (half of w-32=128px)
                        // Then transform translates relative to center
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

                  {/* Controls */}
                  <div className="p-4 bg-slate-800 border-t border-slate-700">
                    <div className="flex items-center gap-4">
                      {/* Scale */}
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

                        {/* Reset Button */}
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
                        {result.face_url && (
                          <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex gap-4 items-center">
                            <img
                              src={getFullUrl(result.face_url)}
                              alt="Face Region"
                              className="w-12 h-12 rounded bg-black object-cover"
                            />
                            <div>
                              <p className="text-xs text-slate-400 uppercase font-semibold">Face</p>
                              <p className="text-xs text-slate-500">Source</p>
                            </div>
                          </div>
                        )}

                        {result.face_url && activeTab === 'face' && (
                          <button
                            onClick={() => setIsAdjusting(true)}
                            className="bg-slate-800 hover:bg-slate-700 p-3 rounded-lg border border-slate-700 flex gap-3 items-center transition-colors text-left"
                          >
                            <div className="bg-indigo-500/20 p-2 rounded text-indigo-400">
                              <Move size={16} />
                            </div>
                            <div>
                              <p className="text-xs text-slate-300 uppercase font-semibold">Misaligned?</p>
                              <p className="text-xs text-indigo-400">Adjust Position</p>
                            </div>
                          </button>
                        )}
                      </div>

                      <div className="text-center mt-auto">
                        <div className="inline-block px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-mono">
                          ID: {result.id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-600 p-8">
                      <div className="w-16 h-16 border-2 border-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 border-dashed">
                        <ArrowRight className="text-slate-600" />
                      </div>
                      <p>Generated result will appear here</p>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};