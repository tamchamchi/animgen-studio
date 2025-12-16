import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Terminal, RefreshCw, Maximize, Minimize, Lock } from 'lucide-react';
import { getGameResources, FILE_BASE_URL } from '../services/api';
import { BackgroundService } from './BackgroundService';
import { DetectedObject as APIDetectedObject } from '../types';

// --- TYPES ---
interface LocalDetectedObject {
    name: string;
    polygon: number[][];
}

interface GameAssets {
    bgUrl: string | null;
    objects: LocalDetectedObject[];
    actions: Record<string, string>;
}

interface GameZoneProps {
    sessionId: string | null;
    isGameReady: boolean;
}

// --- GAME CONFIGURATION ---
const CONFIG = {
    TARGET_FPS: 60,
    GRAVITY: 0.5,
    SPEED: 5,
    JUMP_FORCE: -20,
    CHAR_WIDTH: 60,     // Hitbox width
    CHAR_HEIGHT: 80,    // Hitbox height
    RENDER_SIZE: 120    // Visual size of the GIF
};

const FRAME_DELAY = 1000 / CONFIG.TARGET_FPS;

// --- HOOK: Load Resources & Image Meta ---
const useGameResources = (gameId: string | null, shouldFetch: boolean) => {
    const [data, setData] = useState<GameAssets>({ bgUrl: null, objects: [], actions: {} });
    const [bgMeta, setBgMeta] = useState<{ width: number; height: number; ratio: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!gameId || !shouldFetch) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await getGameResources(gameId);
                const getFullUrl = (path: string | null | undefined) =>
                    path ? (path.startsWith('http') ? path : `${FILE_BASE_URL}${path}`) : null;

                const gifUrls = res.action_gif_urls || [];

                // Helper to match URLs containing specific keywords
                const findGif = (keywords: string[]) => {
                    const found = gifUrls.find(url => keywords.some(k => url.toLowerCase().includes(k)));
                    return found ? getFullUrl(found) : '';
                };

                const actions: Record<string, string> = {
                    idle: findGif(['standing', 'idle']) || '',
                    run: findGif(['running', 'run', 'walk']) || '',
                    jump: findGif(['jumping', 'jump']) || '',
                    wave: findGif(['waving', 'wave']) || '',
                    dance: findGif(['dancing', 'dance', 'jesse']) || '',
                    speak: findGif(['speaking', 'speak', 'talk']) || '',
                };

                // Fallbacks: If idle is missing but we have GIFs, use the first one available
                if (!actions.idle && gifUrls.length > 0) {
                    actions.idle = getFullUrl(gifUrls[0]) || '';
                }

                // Fallbacks for movement if specific ones missing
                if (!actions.run) actions.run = actions.idle;
                if (!actions.jump) actions.jump = actions.idle;

                const mappedObjects: LocalDetectedObject[] = (res.detected_objects || []).map((obj) => ({
                    name: obj.label || 'Object',
                    polygon: obj.polygon || []
                })).filter((o) => o.polygon.length > 0);

                setData({
                    bgUrl: getFullUrl(res.background_url),
                    objects: mappedObjects,
                    actions
                });

            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [gameId, shouldFetch]);

    useEffect(() => {
        if (!data.bgUrl) return;
        const img = new Image();
        img.src = data.bgUrl;
        img.onload = () => {
            setBgMeta({
                width: img.naturalWidth,
                height: img.naturalHeight,
                ratio: img.naturalWidth / img.naturalHeight
            });
        };
    }, [data.bgUrl]);

    return { data, setData, bgMeta, loading, error };
};

export const GameZone: React.FC<GameZoneProps> = ({ sessionId, isGameReady }) => {
    const { data, setData, bgMeta, loading } = useGameResources(sessionId, isGameReady);

    const containerRef = useRef<HTMLDivElement>(null);
    const [view, setView] = useState({
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        width: 800,
        height: 600
    });

    const [isFocused, setIsFocused] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // --- GAME STATE ---
    const gameState = useRef({
        x: 100,
        y: 0,
        vx: 0,
        vy: 0,
        state: 'idle',
        facingRight: true,
        onGround: false
    });

    const scaledPolygonsRef = useRef<number[][][]>([]);

    const keys = useRef<Record<string, boolean>>({});
    const reqRef = useRef<number | undefined>(undefined);
    const lastTimeRef = useRef<number>(0);

    // --- VIEW CALCULATION ---
    // Calculates the rendered dimensions of the background image (object-contain behavior)
    useLayoutEffect(() => {
        if (!containerRef.current || !bgMeta) return;

        const updateView = () => {
            const container = containerRef.current!;
            const cW = container.clientWidth;
            const cH = container.clientHeight;
            const iW = bgMeta.width;
            const iH = bgMeta.height;

            const cRatio = cW / cH;
            const iRatio = iW / iH;

            let newScale, rW, rH, offX, offY;

            if (cRatio > iRatio) {
                // Container is wider -> Fit Height (Pillarbox)
                newScale = cH / iH;
                rW = iW * newScale;
                rH = cH;
                offX = (cW - rW) / 2;
                offY = 0;
            } else {
                // Container is taller -> Fit Width (Letterbox)
                newScale = cW / iW;
                rW = cW;
                rH = iH * newScale;
                offX = 0;
                offY = (cH - rH) / 2;
            }

            setView({ scale: newScale, offsetX: offX, offsetY: offY, width: rW, height: rH });

            // Initial spawn logic
            if (gameState.current.y === 0) {
                gameState.current.y = rH - CONFIG.CHAR_HEIGHT - 20;
            }
        };

        const resizeObserver = new ResizeObserver(updateView);
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [bgMeta, isFullscreen]);

    // Update scaled polygons based on calculated view scale
    useEffect(() => {
        if (data.objects.length > 0 && view.scale > 0) {
            scaledPolygonsRef.current = data.objects.map(obj =>
                obj.polygon.map(p => [p[0] * view.scale, p[1] * view.scale])
            );
        } else {
            // Default floor if no polygons found
            const floorY = view.height - 20;
            const width = view.width;
            scaledPolygonsRef.current = [[[0, floorY], [width, floorY], [width, floorY + 50], [0, floorY + 50]]];
        }
    }, [data.objects, view.scale, view.width, view.height]);

    // --- PHYSICS HELPERS ---
    const checkGroundCollision = (currX: number, currY: number) => {
        let groundY: number | null = null;
        const footX = currX + CONFIG.CHAR_WIDTH / 2;
        const footY = currY + CONFIG.CHAR_HEIGHT;

        for (const poly of scaledPolygonsRef.current) {
            for (let i = 0; i < poly.length; i++) {
                const p1 = poly[i];
                const p2 = poly[(i + 1) % poly.length];

                const minX = Math.min(p1[0], p2[0]);
                const maxX = Math.max(p1[0], p2[0]);

                if (footX >= minX && footX <= maxX) {
                    if (p2[0] - p1[0] !== 0) {
                        const slope = (p2[1] - p1[1]) / (p2[0] - p1[0]);
                        const yOnLine = p1[1] + slope * (footX - p1[0]);

                        if (footY >= yOnLine - 10 && footY <= yOnLine + 25) {
                            if (groundY === null || yOnLine < groundY) {
                                groundY = yOnLine;
                            }
                        }
                    }
                }
            }
        }
        return groundY;
    };

    // --- GAME LOOP ---
    const update = (timestamp: number) => {
        if (!containerRef.current || !bgMeta) {
            reqRef.current = requestAnimationFrame(update);
            return;
        }

        if (!lastTimeRef.current) lastTimeRef.current = timestamp;
        const elapsed = timestamp - lastTimeRef.current;

        if (elapsed > FRAME_DELAY) {
            lastTimeRef.current = timestamp - (elapsed % FRAME_DELAY);

            const player = gameState.current;
            const k = keys.current;

            // A. Horizontal Movement
            player.vx = 0;

            if (player.onGround && player.state !== 'speak' && player.state !== 'dance' && player.state !== 'wave') {
                player.state = 'idle';
            }

            if (k['ArrowRight']) {
                player.vx = CONFIG.SPEED;
                player.facingRight = true;
                if (player.onGround) player.state = 'run';
            }
            else if (k['ArrowLeft']) {
                player.vx = -CONFIG.SPEED;
                player.facingRight = false;
                if (player.onGround) player.state = 'run';
            }

            // B. Vertical Movement
            if (!player.onGround) {
                player.state = 'jump';
            }

            player.vy += CONFIG.GRAVITY;
            player.x += player.vx;
            player.y += player.vy;

            // Screen Bounds (Relative to the rendered image, not container)
            if (player.x < 0) player.x = 0;
            if (player.x > view.width - CONFIG.CHAR_WIDTH) player.x = view.width - CONFIG.CHAR_WIDTH;

            // C. Ground Collision
            player.onGround = false;
            if (player.vy >= 0) {
                const groundLevel = checkGroundCollision(player.x, player.y);
                if (groundLevel !== null) {
                    player.y = groundLevel - CONFIG.CHAR_HEIGHT;
                    player.vy = 0;
                    player.onGround = true;
                }
            }

            // Fallback: Floor collision
            if (player.y > view.height - CONFIG.CHAR_HEIGHT) {
                if (player.y > view.height + 100) {
                    player.x = 50;
                    player.y = 0;
                    player.vy = 0;
                }
            }

            // D. Render Updates
            const playerEl = document.getElementById('game-player');
            const playerImg = document.getElementById('game-player-img') as HTMLImageElement;

            if (playerEl && playerImg) {
                const visualOffsetX = (CONFIG.CHAR_WIDTH - CONFIG.RENDER_SIZE) / 2;
                const visualOffsetY = CONFIG.CHAR_HEIGHT - CONFIG.RENDER_SIZE;

                // Important: Add view.offsetX/Y to align with center-positioned background
                playerEl.style.transform = `translate(${player.x + visualOffsetX + view.offsetX}px, ${player.y + visualOffsetY + view.offsetY}px)`;
                playerImg.style.transform = player.facingRight ? 'scaleX(1)' : 'scaleX(-1)';

                let src = data.actions['idle'];
                if (player.state === 'run' && data.actions['run']) src = data.actions['run'];
                if (player.state === 'jump' && data.actions['jump']) src = data.actions['jump'];
                if (player.state === 'wave' && data.actions['wave']) src = data.actions['wave'];
                if (player.state === 'dance' && data.actions['dance']) src = data.actions['dance'];
                if (player.state === 'speak' && data.actions['speak']) src = data.actions['speak'];

                if (playerImg.dataset.action !== player.state) {
                    if (src) playerImg.src = src;
                    playerImg.dataset.action = player.state;
                }
            }
        }

        reqRef.current = requestAnimationFrame(update);
    };

    // --- EVENT LISTENERS ---
    useEffect(() => {
        if (!bgMeta) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if ((isFocused || isFullscreen) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }

            keys.current[e.key] = true;

            if ((e.key === 'ArrowUp' || e.key === ' ') && gameState.current.onGround) {
                gameState.current.vy = CONFIG.JUMP_FORCE;
                gameState.current.onGround = false;
                gameState.current.state = 'jump';
            }
            if (e.key === 's' || e.key === 'S') gameState.current.state = 'speak';
            if (e.key === 'd' || e.key === 'D') gameState.current.state = 'dance';
            if (e.key === 'w' || e.key === 'W') gameState.current.state = 'wave';
        };

        const onKeyUp = (e: KeyboardEvent) => {
            keys.current[e.key] = false;
            if (['s', 'S', 'd', 'D', 'w', 'W'].includes(e.key) && gameState.current.onGround) {
                gameState.current.state = 'idle';
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        reqRef.current = requestAnimationFrame(update);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            if (reqRef.current) cancelAnimationFrame(reqRef.current);
        };
    }, [bgMeta, isFocused, isFullscreen, view]); // Dependent on view to ensure bounds are correct

    // --- OTHER HANDLERS ---
    const handleAnalysisComplete = (bgDataUrl: string, platforms: APIDetectedObject[]) => {
        const mappedObjects: LocalDetectedObject[] = platforms.map(p => ({
            name: p.label,
            polygon: p.polygon || []
        })).filter(p => p.polygon.length > 0);

        setData(prev => ({
            ...prev,
            bgUrl: bgDataUrl,
            objects: mappedObjects
        }));
    };

    const toggleFullscreen = async () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            try {
                if (containerRef.current.requestFullscreen) {
                    await containerRef.current.requestFullscreen();
                }
            } catch (err) { console.error(err); }
        } else {
            if (document.exitFullscreen) await document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
            if (!document.fullscreenElement) setIsFocused(false);
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    // --- RENDER ---
    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    {!isFullscreen && (
                        <div className="flex justify-between items-end bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <Terminal className="text-green-400" /> Game Controller
                                </h2>
                                <div className="text-xs text-slate-400 font-mono mt-1">
                                    {bgMeta ? `Res: ${bgMeta.width}x${bgMeta.height} | Scale: ${view.scale.toFixed(3)}` : 'Waiting for resources...'}
                                </div>
                            </div>
                            {loading && <RefreshCw className="animate-spin text-indigo-500" />}
                        </div>
                    )}

                    <div
                        ref={containerRef}
                        className={`relative overflow-hidden transition-all select-none outline-none group flex items-center justify-center
                        ${isFullscreen
                                ? 'fixed inset-0 z-50 w-screen h-screen bg-black border-none'
                                : `w-full rounded-2xl ${isFocused ? 'border-2 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.3)]' : 'border border-slate-700 bg-slate-900'}`
                            }
                    `}
                        style={{ aspectRatio: isFullscreen ? 'auto' : (bgMeta ? `${bgMeta.ratio}` : '16/9') }}
                        onMouseEnter={() => setIsFocused(true)}
                        onMouseLeave={() => setIsFocused(false)}
                        onClick={() => setIsFocused(true)}
                        tabIndex={0}
                    >
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                            className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-sm border border-white/20 transition-colors opacity-0 group-hover:opacity-100"
                        >
                            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                        </button>

                        {loading && <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900"><RefreshCw className="animate-spin text-indigo-500 w-8 h-8" /></div>}
                        {!isGameReady && !loading && <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 text-slate-400"><Lock className="w-10 h-10 mb-2" /><p>Complete Animation Step first</p></div>}

                        {/* Background Image */}
                        {data.bgUrl && (
                            <img
                                src={data.bgUrl}
                                alt="Background"
                                className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                            />
                        )}

                        {/* SVG Layer for Polygons */}
                        {/* We offset this group to match the object-contain image position */}
                        {bgMeta && (
                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-70">
                                <g transform={`translate(${view.offsetX}, ${view.offsetY})`}>
                                    {data.objects.map((obj, i) => {
                                        const pointsStr = obj.polygon
                                            .map(p => `${p[0] * view.scale},${p[1] * view.scale}`)
                                            .join(' ');
                                        return (
                                            <g key={i}>
                                                <polygon
                                                    points={pointsStr}
                                                    fill="rgba(34, 197, 94, 0.1)"
                                                    stroke="rgba(34, 197, 94, 0.6)"
                                                    strokeWidth="2"
                                                />
                                            </g>
                                        )
                                    })}
                                </g>
                            </svg>
                        )}

                        {/* Player Character Container */}
                        {/* Position handled via absolute + CSS transform translate inside the loop */}
                        <div
                            id="game-player"
                            className="absolute z-20 will-change-transform top-0 left-0"
                            style={{
                                width: CONFIG.RENDER_SIZE,
                                height: CONFIG.RENDER_SIZE,
                            }}
                        >
                            <img
                                id="game-player-img"
                                src={data.actions['idle'] || ''}
                                alt="Player"
                                className="w-full h-full object-contain"
                                style={{ imageRendering: 'pixelated' }}
                            />

                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm border border-white/20">
                                Player 1
                            </div>
                        </div>
                    </div>

                    {!isFullscreen && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                            <KbdKey label="Move" keys={['←', '→']} />
                            <KbdKey label="Jump" keys={['Space', '↑']} />
                            <KbdKey label="Speak / Wave" keys={['S', 'W']} />
                            <KbdKey label="Dance" keys={['D']} />
                        </div>
                    )}
                </div>

                <div className="lg:col-span-1 h-full">
                    <BackgroundService
                        sessionId={sessionId}
                        onAnalysisComplete={handleAnalysisComplete}
                    />
                </div>
            </div>
        </div>
    );
};

const KbdKey = ({ label, keys }: { label: string, keys: string[] }) => (
    <div className="bg-slate-800 border border-slate-700 rounded p-2 flex flex-col items-center">
        <span className="text-slate-400 text-xs mb-1">{label}</span>
        <div className="flex gap-1">
            {keys.map(k => (
                <kbd key={k} className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-xs font-mono border border-slate-600 shadow-sm">{k}</kbd>
            ))}
        </div>
    </div>
);