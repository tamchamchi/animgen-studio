import React, { useEffect, useState, useRef, useLayoutEffect, useCallback } from 'react';
import { Terminal, RefreshCw, Maximize, Minimize, Lock, Eye, EyeOff, Lightbulb, LightbulbOff, Video, VideoOff } from 'lucide-react';
import { getGameResources, FILE_BASE_URL, updateCharacterLocation } from '../services/api';
import { BackgroundService } from './BackgroundService';
import ScreenRecorderCore, { ScreenRecorderRef } from './ui/ScreenRecord'; // Import ScreenRecorderCore và interface của nó

// NEW: Import the LocalDetectedObject type and our new hook
import { LocalDetectedObject, LocationData, APIDetectedObject, UpdateLocationResponse, AUDIO_PATHS } from '../types'; // Đảm bảo đường dẫn đúng
import { useCollisionDetection } from '../hooks/useCollisionDetection';

interface GameAssets {
    bgUrl: string | null;
    objects: LocalDetectedObject[];
    actions: Record<string, string>;
}

interface GameZoneProps {
    sessionId: string | null;
    isGameReady: boolean;
    onResourcesLoaded: () => void; // New prop for the callback
}

// --- GAME CONFIGURATION ---
const CONFIG = {
    TARGET_FPS: 60,
    GRAVITY: 0.5,
    SPEED: 5,
    JUMP_FORCE: -20,

    CHAR_WIDTH: 60,
    CHAR_HEIGHT: 100,

    RENDER_SIZE: 256,

    // NEW: Collision thresholds moved to config for use in the hook
    COLLISION_THRESHOLD_UP: 25, // Ngưỡng "vượt qua" để nhân vật không bị kẹt khi đi lên dốc nhẹ
    COLLISION_THRESHOLD_DOWN: 10 // Ngưỡng "dưới" để bắt va chạm sớm hơn một chút
};
const SPOTLIGHT_INNER_RADIUS = 20; // Bán kính vùng sáng đặc
const SPOTLIGHT_OUTER_RADIUS = 140; // Bán kính vùng sáng mờ dần
const FRAME_DELAY = 1000 / CONFIG.TARGET_FPS;

// --- HOOK: Load Resources & Image Meta ---
const useGameResources = (gameId: string | null, shouldFetch: boolean, onResourcesLoaded: () => void) => {
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

                const mappedObjects: LocalDetectedObject[] = (res.detected_objects || []).map((obj, index) => ({
                    id: obj.id_polygon || `poly-${index}`,
                    name: obj.name || 'Object',
                    polygon: obj.polygon || [],
                    bbox: obj.bbox || []
                })).filter((o) => o.polygon.length > 0);

                setData({
                    bgUrl: getFullUrl(res.background_url),
                    objects: mappedObjects,
                    actions
                });

                onResourcesLoaded();

            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [gameId, shouldFetch, onResourcesLoaded]);

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

export const GameZone: React.FC<GameZoneProps> = ({ sessionId, isGameReady, onResourcesLoaded }) => {
    const { data, setData, bgMeta, loading } = useGameResources(sessionId, isGameReady, onResourcesLoaded);
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
    const [showBackground, setShowBackground] = useState(true);

    // Spotlight Effect State
    const [spotlightActive, setSpotlightActive] = useState(false);
    const spotlightActiveRef = useRef(false); // Ref for access inside requestAnimationFrame

    // NEW: State to store the polygon the character is currently standing on
    const [currentGroundPolygon, setCurrentGroundPolygon] = useState<LocalDetectedObject | null>(null);


    // --- SCREEN RECORDER STATE & REF ---
    const screenRecorderRef = useRef<ScreenRecorderRef | null>(null);
    const [isScreenRecording, setIsScreenRecording] = useState<boolean>(false);
    const [isScreenRecordingPaused, setIsScreenRecordingPaused] = useState<boolean>(false);
    const [showRecordedVideo, setShowRecordedVideo] = useState<boolean>(false); // To control video preview display

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

    // NEW: Audio Refs
    const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({
        running: null,
        jump: null,
        land: null,
        dance: null,
    });

    // NEW: Sử dụng useRef thay vì useState cho trạng thái phát âm thanh lặp
    const isPlayingRunningRef = useRef(false);
    const isPlayingDancingRef = useRef(false);
    const lastStateRef = useRef<string>('idle'); // Để theo dõi trạng thái trước đó của nhân vật
    const wasOnGroundRef = useRef<boolean>(true); // Để theo dõi trạng thái tiếp đất

    // scaledPolygonsRef is less critical now for collision due to useCollisionDetection,
    // but can still be used for rendering visual polygon outlines if needed.
    const scaledPolygonsRef = useRef<number[][][]>([]);

    const keys = useRef<Record<string, boolean>>({});
    const reqRef = useRef<number | undefined>(undefined);
    const lastTimeRef = useRef<number>(0);

    // NEW: Use the custom collision detection hook
    const { checkGroundCollision } = useCollisionDetection(
        data.objects,
        view.scale,
        view.width,
        view.height,
        {
            charWidth: CONFIG.CHAR_WIDTH,
            charHeight: CONFIG.CHAR_HEIGHT,
            collisionThresholdUp: CONFIG.COLLISION_THRESHOLD_UP,
            collisionThresholdDown: CONFIG.COLLISION_THRESHOLD_DOWN,
        }
    );


    const toggleSpotlight = () => {
        const newState = !spotlightActive;
        setSpotlightActive(newState);
        spotlightActiveRef.current = newState;
    };

    // Modified to link background visibility with spotlight
    const toggleBackground = () => {
        const nextShowBg = !showBackground;
        setShowBackground(nextShowBg);

        // Auto-enable spotlight when hiding background (Dark Mode)
        // Auto-disable spotlight when showing background
        const shouldSpotlight = !nextShowBg;
        setSpotlightActive(shouldSpotlight);
        spotlightActiveRef.current = shouldSpotlight;
    };

    // --- SCREEN RECORDER HANDLERS ---
    const handleStartScreenRecording = async () => {
        await screenRecorderRef.current?.start();
        setIsScreenRecording(true);
        setIsScreenRecordingPaused(false);
        setShowRecordedVideo(false); // Hide old video when starting new recording
    };

    const handleStopScreenRecording = () => {
        screenRecorderRef.current?.stop();
        setIsScreenRecording(false);
        setIsScreenRecordingPaused(false);
        setShowRecordedVideo(true); // Can show video preview after download
    };

    const handlePauseScreenRecording = () => {
        screenRecorderRef.current?.pause();
        setIsScreenRecordingPaused(true);
    };

    const handleResumeScreenRecording = () => {
        screenRecorderRef.current?.resume();
        setIsScreenRecordingPaused(false);
    };

    const toLocationData = (obj: LocalDetectedObject): LocationData => ({
        ...obj,
        bbox: obj.bbox ?? undefined, // ensure `undefined` instead of `null`
    });

    // --- useEffect to sync screen recording state from Core ---
    useEffect(() => {
        let intervalId: NodeJS.Timeout | undefined;
        if (isGameReady) {
            intervalId = setInterval(() => {
                if (screenRecorderRef.current) {
                    setIsScreenRecording(screenRecorderRef.current.getIsRecording());
                    setIsScreenRecordingPaused(screenRecorderRef.current.getIsPaused());
                }
            }, 200); // Update state every 200ms
        }
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isGameReady]);

    // NEW: Initialize Audio Elements
    useEffect(() => {
        audioRefs.current.running = new Audio(AUDIO_PATHS.RUNNING);
        audioRefs.current.jump = new Audio(AUDIO_PATHS.JUMP);
        audioRefs.current.land = new Audio(AUDIO_PATHS.LAND);
        audioRefs.current.dance = new Audio(AUDIO_PATHS.DANCE);

        // Optional: Loop running/dancing sound
        if (audioRefs.current.running) audioRefs.current.running.loop = true;
        if (audioRefs.current.dance) audioRefs.current.dance.loop = true;

        // Optional: Set volume
        Object.values(audioRefs.current).forEach(audio => {
            if (audio) audio.volume = 0.5;
        });

        // Cleanup on unmount
        return () => {
            Object.values(audioRefs.current).forEach(audio => {
                if (audio) {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.src = ''; // Clear src to release resources
                }
            });
        };
    }, []); // Chạy một lần khi mount

    // --- VIEW CALCULATION ---
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

    // Update scaled polygons based on calculated view scale - This is now primarily for rendering, not collision
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


    // --- GAME LOOP ---
    const update = useCallback(async (timestamp: number) => {
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

            const prevOnGround = wasOnGroundRef.current; // Lấy trạng thái onGround trước đó

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
            let newGroundPolygon: LocalDetectedObject | null = null;

            if (player.vy >= 0) { // Chỉ kiểm tra va chạm đất khi đang đi xuống
                const collisionResult = checkGroundCollision(player.x, player.y);
                if (collisionResult !== null) {
                    player.y = collisionResult.groundY - CONFIG.CHAR_HEIGHT;
                    player.vy = 0;
                    player.onGround = true;
                    newGroundPolygon = collisionResult.polygon;

                    // NEW: Play land sound when hitting ground
                    if (!prevOnGround && player.onGround) {
                        audioRefs.current.land?.play().catch(e => console.error("Error playing land sound:", e));
                    }
                }
            }

            // Fallback: Floor collision (nếu nhân vật rơi quá xa)
            if (player.y > view.height - CONFIG.CHAR_HEIGHT) {
                if (player.y > view.height + 100) { // Nếu rơi quá xa, reset vị trí
                    player.x = 50;
                    player.y = 0;
                    player.vy = 0;
                    newGroundPolygon = null;
                }
            }

            // Update currentGroundPolygon only if there's a change in ID
            if (currentGroundPolygon?.id !== newGroundPolygon?.id) {
                setCurrentGroundPolygon(newGroundPolygon);

                // Kiểm tra xem newGroundPolygon có tồn tại trước khi gọi API
                if (newGroundPolygon) {
                    try {
                        // Gọi API updateCharacterLocation với dữ liệu từ newGroundPolygon
                        // newGroundPolygon cần có kiểu tương thích với LocationData
                        const response: UpdateLocationResponse = await updateCharacterLocation(toLocationData(newGroundPolygon));

                        if (response.success) {
                            console.log("Cập nhật vị trí ground polygon thành công:", response.message);
                            // Bạn có thể thêm logic xử lý thành công tại đây, ví dụ: hiển thị thông báo
                        } else {
                            console.error("Cập nhật vị trí ground polygon thất bại:", response.message);
                            // Xử lý lỗi từ server
                        }
                    } catch (error) {
                        console.error("Lỗi khi gọi API cập nhật vị trí ground polygon:", error);
                        // Xử lý lỗi mạng hoặc lỗi khác trong quá trình gọi API
                    }
                } else {
                    console.warn("newGroundPolygon is null or undefined, skipping API call.");
                }
            }

            // D. Render Updates
            const playerEl = document.getElementById('game-player');
            const playerImg = document.getElementById('game-player-img') as HTMLImageElement;
            const bubbleEl = document.getElementById('game-bubble');
            const spotlightEl = document.getElementById('game-spotlight');

            const visualOffsetX = (CONFIG.CHAR_WIDTH - CONFIG.RENDER_SIZE) / 2;
            const visualOffsetY = CONFIG.CHAR_HEIGHT - CONFIG.RENDER_SIZE;

            // 1. Update Player
            if (playerEl && playerImg) {
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

                // --- UPDATE BUBBLE VISIBILITY ---
                if (bubbleEl) {
                    if (player.state === 'speak') {
                        bubbleEl.style.opacity = '1';
                        bubbleEl.style.transform = 'scale(1)';
                    } else {
                        bubbleEl.style.opacity = '0';
                        bubbleEl.style.transform = 'scale(0.5)';
                    }
                }
            }

            // 2. Update Spotlight
            if (spotlightEl) {
                if (spotlightActiveRef.current) {
                    // Calculate visual center of the player
                    const cx = player.x + visualOffsetX + view.offsetX + (CONFIG.RENDER_SIZE / 2);
                    const cy = player.y + visualOffsetY + view.offsetY + (CONFIG.RENDER_SIZE / 1.5);

                    spotlightEl.style.opacity = '1';
                    spotlightEl.style.background = `radial-gradient(circle at ${cx}px ${cy}px, rgba(255,255,255,1) 0px, rgba(255,255,255,1) ${SPOTLIGHT_INNER_RADIUS}px, transparent ${SPOTLIGHT_OUTER_RADIUS}px)`;
                } else {
                    spotlightEl.style.opacity = '0';
                }
            }

            // NEW: Simplified Audio Playback Logic for looping sounds
            // --- Running Sound Control ---
            const shouldPlayRunning = (player.state === 'run' && player.onGround);
            if (shouldPlayRunning && !isPlayingRunningRef.current) {
                audioRefs.current.running?.play().catch(e => console.error("Error playing running sound:", e));
                isPlayingRunningRef.current = true;
            } else if (!shouldPlayRunning && isPlayingRunningRef.current) {
                audioRefs.current.running?.pause();
                audioRefs.current.running!.currentTime = 0; // Reset to start for next play
                isPlayingRunningRef.current = false;
            }

            // --- Dancing Sound Control ---
            const shouldPlayDancing = (player.state === 'dance');
            if (shouldPlayDancing && !isPlayingDancingRef.current) {
                audioRefs.current.dance?.play().catch(e => console.error("Error playing dancing sound:", e));
                isPlayingDancingRef.current = true;
            } else if (!shouldPlayDancing && isPlayingDancingRef.current) {
                audioRefs.current.dance?.pause();
                audioRefs.current.dance!.currentTime = 0; // Reset to start for next play
                isPlayingDancingRef.current = false;
            }

            lastStateRef.current = player.state; // Cập nhật trạng thái hiện tại
            wasOnGroundRef.current = player.onGround; // Cập nhật trạng thái onGround hiện tại
        }

        reqRef.current = requestAnimationFrame(update);
    }, [bgMeta, checkGroundCollision, currentGroundPolygon?.id, data.actions, view, setCurrentGroundPolygon]);


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
                // NEW: Play jump sound
                audioRefs.current.jump?.play().catch(e => console.error("Error playing jump sound:", e));
            }

            // DROP DOWN MECHANIC
            if (e.key === 'ArrowDown' && gameState.current.onGround) {
                // Push Y down by 30px to exceed the collision threshold (+25px)
                gameState.current.y += 30;
                gameState.current.onGround = false;
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
    }, [bgMeta, isFocused, isFullscreen, update]);

    // --- OTHER HANDLERS ---
    const handleAnalysisComplete = (bgDataUrl: string, platforms: APIDetectedObject[]) => {
        const mappedObjects: LocalDetectedObject[] = platforms.map((p, index) => ({
            id: p.id_polygon || `poly-${index}`,
            name: p.name,
            polygon: p.polygon || [],
            bbox: p.bbox || []
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
                <div className="lg:col-span-1 h-full">
                    <BackgroundService
                        sessionId={sessionId}
                        onAnalysisComplete={handleAnalysisComplete}
                    />
                </div>
                <div className="lg:col-span-2 space-y-4">
                    {!isFullscreen && (
                        <div className="flex justify-between items-end bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <Terminal className="text-green-400" /> Game Screen
                                </h2>
                                <div className="text-xs text-slate-400 font-mono mt-1">
                                    {bgMeta ? `Res: ${bgMeta.width}x${bgMeta.height} | Scale: ${view.scale.toFixed(3)}` : 'Waiting for resources...'}
                                    <p>
                                        On: {currentGroundPolygon ? `${currentGroundPolygon.name} (ID: ${currentGroundPolygon.id})` : 'Air / Default Floor'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Toggle Spotlight */}
                                <button
                                    onClick={toggleSpotlight}
                                    className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-yellow-400 border border-slate-600"
                                    title={spotlightActive ? "Lights On" : "Lights Off"}
                                >
                                    {spotlightActive ? <LightbulbOff size={20} /> : <Lightbulb size={20} />}
                                </button>

                                {/* Toggle Background Visibility */}
                                <button
                                    onClick={toggleBackground}
                                    className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white border border-slate-600"
                                    title={showBackground ? "Hide Background" : "Show Background"}
                                >
                                    {showBackground ? <Eye size={20} /> : <EyeOff size={20} />}
                                </button>

                                {/* Fullscreen Button (Moved here) */}
                                <button
                                    onClick={toggleFullscreen}
                                    className="p-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-600"
                                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                                >
                                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                                </button>

                                {/* --- SCREEN RECORDER CONTROLS --- */}
                                {!isScreenRecording ? (
                                    <button
                                        onClick={handleStartScreenRecording}
                                        className="p-2 bg-slate-700/50 hover:bg-red-500 rounded-lg transition-colors text-red-400 hover:text-white border border-slate-600"
                                        title="Start Recording"
                                    >
                                        <Video size={20} />
                                    </button>
                                ) : (
                                    <>
                                        {!isScreenRecordingPaused ? (
                                            <button
                                                onClick={handlePauseScreenRecording}
                                                className="p-2 bg-slate-700/50 hover:bg-yellow-500 rounded-lg transition-colors text-yellow-400 hover:text-white border border-slate-600"
                                                title="Pause Recording"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pause"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleResumeScreenRecording}
                                                className="p-2 bg-slate-700/50 hover:bg-green-500 rounded-lg transition-colors text-green-400 hover:text-white border border-slate-600"
                                                title="Resume Recording"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-play"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                            </button>
                                        )}
                                        <button
                                            onClick={handleStopScreenRecording}
                                            className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white border border-slate-600"
                                            title="Stop Recording"
                                        >
                                            <VideoOff size={20} />
                                        </button>
                                    </>
                                )}
                                {loading && <RefreshCw className="animate-spin text-indigo-500" />}
                            </div>
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
                        {loading && <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900"><RefreshCw className="animate-spin text-indigo-500 w-8 h-8" /></div>}
                        {!isGameReady && !loading && <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 text-slate-400"><Lock className="w-10 h-10 mb-2" /><p>Complete Animation Step first</p></div>}

                        {/* Background Image - Toggles Visibility */}
                        {data.bgUrl && showBackground && (
                            <img
                                src={data.bgUrl}
                                alt="Background"
                                className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                            />
                        )}

                        {/* SVG Layer for Polygons */}
                        {bgMeta && (
                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                                <g transform={`translate(${view.offsetX}, ${view.offsetY})`}>
                                    {data.objects.map((obj, _i) => {
                                        const pointsStr = obj.polygon
                                            .map(p => `${p[0] * view.scale},${p[1] * view.scale}`)
                                            .join(' ');
                                        return (
                                            <g key={obj.id}>
                                                <polygon
                                                    points={pointsStr}
                                                    fill="rgba(255, 255, 255, 0)"
                                                    stroke={showBackground ? "rgba(255, 255, 255, 0)" : "rgba(255, 255, 255, 0)"}
                                                    strokeWidth="2"
                                                    style={{ transition: 'stroke 0.3s ease' }}
                                                />
                                            </g>
                                        )
                                    })}
                                </g>
                            </svg>
                        )}

                        {/* --- SPOTLIGHT LAYER (z-15) --- */}
                        <div
                            id="game-spotlight"
                            className="absolute inset-0 z-15 pointer-events-none transition-opacity duration-200 opacity-0"
                            style={{ willChange: 'background' }}
                        ></div>

                        {/* Player Character Container */}
                        <div
                            id="game-player"
                            className="absolute z-20 will-change-transform top-0 left-0"
                            style={{
                                width: CONFIG.RENDER_SIZE,
                                height: CONFIG.RENDER_SIZE,
                            }}
                        >
                            {/* --- SPEECH BUBBLE --- */}
                            <div
                                id="game-bubble"
                                className="absolute opacity-0 transition-all duration-200 transform scale-75 origin-bottom-right"
                                style={{
                                    pointerEvents: 'none',
                                    bottom: `${CONFIG.RENDER_SIZE / 2}px`,
                                    right: `${CONFIG.CHAR_WIDTH / 2}px`
                                }}
                            >
                                <div className="relative bg-white text-black px-4 py-2 rounded-2xl shadow-lg border-2 border-slate-200 min-w-[80px] text-center">
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b-2 border-r-2 border-slate-200 rotate-45 transform"></div>
                                    <div className="flex justify-center gap-1">
                                        <span className="w-2 h-2 bg-slate-800 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="w-2 h-2 bg-slate-800 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-2 h-2 bg-slate-800 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                </div>
                            </div>

                            <img
                                id="game-player-img"
                                src={data.actions['idle'] || ''}
                                alt="Player"
                                className="w-full h-full object-contain object-bottom"
                                style={{ imageRendering: 'pixelated' }}
                            />
                        </div>
                    </div>

                    {!isFullscreen && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
                            <KbdKey label="Move" keys={['←', '→']} />
                            <KbdKey label="Jump" keys={['Space', '↑']} />
                            <KbdKey label="Drop" keys={['↓']} />
                            <KbdKey label="Speak / Wave" keys={['S', 'W']} />
                            <KbdKey label="Dance" keys={['D']} />
                        </div>
                    )}
                </div>

            </div>
            {/* --- SCREEN RECORDER CORE COMPONENT --- */}
            {(isGameReady || isScreenRecording || showRecordedVideo) && (
                <ScreenRecorderCore ref={screenRecorderRef} />
            )}
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