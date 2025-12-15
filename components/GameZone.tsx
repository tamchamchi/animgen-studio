import React, { useEffect, useState, useRef } from 'react';
import { Terminal, RefreshCw, AlertCircle, Box, Lock } from 'lucide-react';
import { getGameResources, FILE_BASE_URL } from '../services/api';

// --- CẤU HÌNH GAME ---
const SCREEN_WIDTH = 800;
const GROUND_Y = 500;
const GRAVITY = 0.8;
const JUMP_FORCE = -15;
const MOVE_SPEED = 6;
const PLAYER_WIDTH = 100;
const PLAYER_HEIGHT = 100;

interface GameZoneProps {
  sessionId: string | null;
  isGameReady: boolean; // <--- CỜ QUAN TRỌNG: Chỉ true khi Step 3 xong
}

// --- HOOK MỚI: Chỉ fetch khi có sessionId VÀ được phép fetch ---
const useGameResources = (gameId: string | null, shouldFetch: boolean) => {
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [background, setBackground] = useState<string | null>(null);
  const [obstacles, setObstacles] = useState<any[]>([]); 
  
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Nếu chưa có ID hoặc chưa chạy xong Step 3 thì reset và thoát
    if (!gameId || !shouldFetch) {
        setIsReady(false);
        setAssets({});
        setBackground(null);
        setObstacles([]);
        return;
    }

    const fetchResources = async () => {
        setLoading(true);
        setError(null);
        setIsReady(false);

        try {
            console.log(`🎮 GameZone: Fetching resources for Game ID: ${gameId}`);
            
            // 1. Gọi API lấy thông tin tài nguyên
            const res = await getGameResources(gameId);
            
            // Helper để nối URL đầy đủ
            const getFullUrl = (path: string | null) => {
                if (!path) return null;
                return path.startsWith('http') ? path : `${FILE_BASE_URL}${path}`;
            }

            const gifUrl = getFullUrl(res.action_gif_url);
            const bgUrl = getFullUrl(res.background_url);

            // 2. Setup Assets
            // Logic: Backend trả về 1 GIF chung -> Gán cho mọi hành động
            if (gifUrl) {
                setAssets({
                    idle: gifUrl,
                    run: gifUrl,
                    jump: gifUrl,
                    dance: gifUrl,
                    speak: gifUrl
                });
                setIsReady(true);
            } else {
                setError("Game found but no Action GIF available.");
            }

            // 3. Setup Background & Objects
            if (bgUrl) setBackground(bgUrl);
            if (res.detected_objects && Array.isArray(res.detected_objects)) {
                setObstacles(res.detected_objects);
            }

        } catch (err: any) {
            console.error(err);
            setError("Failed to load game resources. " + err.message);
        } finally {
            setLoading(false);
        }
    };

    fetchResources();
  }, [gameId, shouldFetch]); // Chạy lại khi gameId đổi hoặc shouldFetch bật lên true

  return { assets, background, obstacles, loading, isReady, error };
};

export const GameZone: React.FC<GameZoneProps> = ({ sessionId, isGameReady }) => {
  // Truyền cả sessionId và isGameReady vào hook
  const { assets, background, obstacles, loading, isReady, error } = useGameResources(sessionId, isGameReady);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // --- Refs cho Game Loop ---
  const gameState = useRef({
    x: 50,
    y: GROUND_Y - 100,
    velY: 0,
    isGrounded: true,
    facingRight: true,
    currentState: 'idle', 
  });
  const keys = useRef<Record<string, boolean>>({});
  const reqRef = useRef<number>();

  // --- GAME LOOP ---
  const updateGame = () => {
    if (!containerRef.current || !isReady) return;

    const state = gameState.current;
    const k = keys.current;
    let dx = 0;
    let newState = 'idle';

    // Input
    if (k['ArrowLeft']) { dx = -MOVE_SPEED; state.facingRight = false; newState = 'run'; }
    else if (k['ArrowRight']) { dx = MOVE_SPEED; state.facingRight = true; newState = 'run'; }
    
    // Jump
    if ((k['ArrowUp'] || k[' ']) && state.isGrounded) {
      state.velY = JUMP_FORCE;
      state.isGrounded = false;
    }

    // Physics
    state.velY += GRAVITY;
    state.y += state.velY;
    state.x += dx;

    // Ground Collision (Cơ bản)
    let groundLevel = GROUND_Y - PLAYER_HEIGHT;
    if (state.y >= groundLevel) {
      state.y = groundLevel;
      state.velY = 0;
      state.isGrounded = true;
    } else {
        newState = 'jump';
    }

    // Boundary
    if (state.x < 0) state.x = 0;
    if (state.x > SCREEN_WIDTH - PLAYER_WIDTH) state.x = SCREEN_WIDTH - PLAYER_WIDTH;

    state.currentState = newState;

    // Render Logic
    const playerEl = containerRef.current.querySelector('#player-sprite') as HTMLDivElement;
    if (playerEl) {
        playerEl.style.transform = `translate(${state.x}px, ${state.y}px)`;
        const imgEl = playerEl.querySelector('img');
        if (imgEl) {
            imgEl.style.transform = state.facingRight ? 'scaleX(1)' : 'scaleX(-1)';
        }
    }

    reqRef.current = requestAnimationFrame(updateGame);
  };

  useEffect(() => {
    if (!isReady) return;

    const handleKeyDown = (e: KeyboardEvent) => {
        if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) && isFocused) e.preventDefault();
        keys.current[e.key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => keys.current[e.key] = false;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    reqRef.current = requestAnimationFrame(updateGame);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [isReady, isFocused]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white">Game Preview</h2>
        {sessionId && <div className="text-xs text-slate-400 font-mono bg-slate-800 px-3 py-1 rounded-full">Game ID: {sessionId.slice(0,8)}</div>}
      </div>

      {/* Game Container */}
      <div 
        ref={containerRef}
        className={`relative w-full overflow-hidden border transition-colors ${isFocused ? 'border-indigo-500 shadow-indigo-500/20 shadow-xl' : 'border-slate-700'}`}
        style={{ 
            aspectRatio: '800/600', 
            borderRadius: '1rem',
            background: background ? `url(${background}) center/cover no-repeat` : '#0f172a'
        }}
        onMouseEnter={() => setIsFocused(true)}
        onMouseLeave={() => setIsFocused(false)}
        onClick={() => setIsFocused(true)}
      >
        {/* Background fallback */}
        {!background && <div className="absolute inset-0 bg-gradient-to-b from-[#1e1b4b] to-[#312e81] -z-10"></div>}
        
        {/* Render Obstacles */}
        {obstacles.map((obj, idx) => (
            <div 
                key={idx}
                className="absolute border-2 border-yellow-500/50 bg-yellow-500/10 flex items-center justify-center text-xs text-yellow-200 font-mono"
                style={{
                    left: obj.box_2d ? obj.box_2d[0] : 0,
                    top: obj.box_2d ? obj.box_2d[1] : 0,
                    width: obj.box_2d ? (obj.box_2d[2] - obj.box_2d[0]) : 50,
                    height: obj.box_2d ? (obj.box_2d[3] - obj.box_2d[1]) : 50,
                }}
            >
                {obj.label || "Obj"}
            </div>
        ))}

        {/* --- STATE 1: LOCKED (Chưa xong Step 3) --- */}
        {!isGameReady && !loading && sessionId && (
            <div className="absolute inset-0 z-50 bg-slate-900/80 flex flex-col items-center justify-center text-slate-400 gap-4 backdrop-blur-sm">
                <div className="bg-slate-800 p-4 rounded-full border border-slate-700">
                    <Lock className="w-8 h-8 opacity-50" />
                </div>
                <div className="text-center">
                    <p className="text-white font-medium text-lg">Engine Locked</p>
                    <p className="text-sm opacity-60 mt-1 max-w-xs">Please complete "Step 3: Animate" to generate game resources.</p>
                </div>
            </div>
        )}

        {/* --- STATE 2: LOADING --- */}
        {loading && (
            <div className="absolute inset-0 z-50 bg-slate-900/90 flex flex-col items-center justify-center text-center p-6">
                <RefreshCw className="text-indigo-500 w-10 h-10 animate-spin mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Syncing Resources...</h3>
            </div>
        )}
        
        {/* --- STATE 3: ERROR --- */}
        {error && !loading && (
             <div className="absolute inset-0 z-50 bg-slate-900/80 flex flex-col items-center justify-center text-slate-400">
                <AlertCircle className="w-10 h-10 mb-2 text-red-400" />
                <p className="text-red-200">{error}</p>
            </div>
        )}

        {/* --- PLAYER SPRITE --- */}
        <div 
            id="player-sprite"
            className="absolute z-10 will-change-transform"
            style={{ 
                width: PLAYER_WIDTH, 
                height: PLAYER_HEIGHT, 
                top: 0, 
                left: 0, 
                opacity: isReady ? 1 : 0,
            }}
        >
             {assets['idle'] && (
                 <img 
                    src={assets['idle']} 
                    alt="Player"
                    className="w-full h-full object-contain"
                    style={{ imageRendering: 'pixelated' }}
                 />
             )}
        </div>

        {/* HUD */}
        <div className="absolute top-4 left-4 z-20">
            <div className="bg-black/60 backdrop-blur px-3 py-1 rounded text-xs text-white border border-white/10 flex items-center gap-2">
                <Terminal size={12} className={isReady ? "text-green-400" : "text-yellow-400"} />
                {isReady ? "Engine: Ready" : "Standby"}
                {obstacles.length > 0 && <span className="ml-2 border-l pl-2 border-white/20 flex items-center gap-1"><Box size={10}/> {obstacles.length} Objects</span>}
            </div>
        </div>
      </div>
      
      {/* Controls Guide */}
      <div className="grid grid-cols-3 gap-4 text-center text-xs text-slate-400">
          <div>ARROWS: Move</div>
          <div>SPACE: Jump</div>
          <div>Current mode: Single Animation</div>
      </div>
    </div>
  );
};