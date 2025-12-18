import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, CameraOff } from 'lucide-react';

interface CameraModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (file: File) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startCamera = async () => {
        setLoading(true);
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
            }
        } catch (err: any) {
            setError("Camera access denied or not available. Please check your browser permissions.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const handleCapture = () => {
        const video = videoRef.current;
        if (!video || !video.videoWidth) return;

        // Define the crop area based on the UI guide (w-64 h-80 = 256px x 320px)
        const guideWidth = 256;
        const guideHeight = 320;

        // The video is contained in an aspect-video box. 
        // We need to calculate the scale between the displayed pixels and the raw video resolution.
        const displayWidth = video.clientWidth;

        const scale = video.videoWidth / displayWidth;

        // Actual source dimensions to crop
        const sWidth = guideWidth * scale;
        const sHeight = guideHeight * scale;
        const sx = (video.videoWidth - sWidth) / 2;
        const sy = (video.videoHeight - sHeight) / 2;

        const canvas = document.createElement('canvas');
        // Final output resolution (maintaining the 4:5 aspect ratio of the guide)
        canvas.width = 512;
        canvas.height = 640;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Mirror the capture horizontally since the preview is mirrored
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);

            // Draw only the cropped section
            ctx.drawImage(
                video,
                sx, sy, sWidth, sHeight, // Source rectangle
                0, 0, canvas.width, canvas.height // Destination rectangle
            );

            canvas.toBlob((blob) => {
                if (blob) {
                    const capturedFile = new File([blob], `face_crop_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    onCapture(capturedFile);
                    handleClose();
                }
            }, 'image/jpeg', 0.95);
        }
    };

    const handleClose = () => {
        stopCamera();
        onClose();
    };

    useEffect(() => {
        if (isOpen) {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={handleClose} />

            <div className="relative bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <Camera size={18} className="text-indigo-400" />
                        </div>
                        <h3 className="font-bold text-white uppercase tracking-wider text-xs">Capture Face Photo</h3>
                    </div>
                    <button onClick={handleClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="relative aspect-video bg-black flex items-center justify-center">
                    {loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-indigo-400">
                            <RefreshCw className="animate-spin" size={32} />
                            <p className="text-xs font-medium animate-pulse">Initializing Camera...</p>
                        </div>
                    )}

                    {error ? (
                        <div className="p-8 text-center space-y-4">
                            <CameraOff size={48} className="mx-auto text-slate-600" />
                            <p className="text-red-400 text-sm max-w-xs">{error}</p>
                            <button onClick={startCamera} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-all">
                                Try Again
                            </button>
                        </div>
                    ) : (
                        <>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-500 ${loading ? 'opacity-0' : 'opacity-100'}`}
                            />

                            {/* Face Guide Overlay */}
                            {!loading && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-64 h-80 border-2 border-dashed border-white/20 rounded-[100px] shadow-[0_0_0_1000px_rgba(0,0,0,0.4)]" />
                                    <div className="absolute bottom-6 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                                        <p className="text-white text-[10px] font-bold uppercase tracking-widest">Center your face in the oval</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="p-6 bg-slate-900 flex justify-center border-t border-slate-800">
                    <button
                        onClick={handleCapture}
                        disabled={loading || !!error}
                        className="group relative flex items-center justify-center w-16 h-16 bg-white hover:bg-indigo-50 rounded-full shadow-2xl transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="w-12 h-12 border-2 border-slate-900 rounded-full flex items-center justify-center">
                            <div className="w-8 h-8 bg-slate-900 rounded-full scale-100 group-hover:scale-90 transition-transform" />
                        </div>
                        <span className="absolute -bottom-10 whitespace-nowrap text-[10px] font-bold text-white uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Capture Face Only</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
