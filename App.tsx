
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Vector, Platform, Particle, GameState } from './types';
import { GRAVITY, JUMP_FORCE, FRICTION, PLAYER_SIZE, COLORS } from './constants';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    score: 0,
    highScore: parseInt(localStorage.getItem('highScore') || '0'),
    time: 0,
    isGameOver: false
  });

  const [level, setLevel] = useState(1);
  const requestRef = useRef<number>();
  
  const playerRef = useRef({
    pos: { x: 100, y: 500 },
    vel: { x: 0, y: 0 },
    isGrounded: false,
    facingRight: true
  });

  const platformsRef = useRef<Platform[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const goalRef = useRef<Vector>({ x: 0, y: 0 });

  const generateLevel = useCallback((lvl: number, width: number, height: number) => {
    const newPlatforms: Platform[] = [
      { x: 50, y: height - 100, width: 250, height: 40, type: 'normal', color: COLORS.platform },
    ];

    const platformCount = Math.min(6 + lvl, 15);
    const verticalGap = Math.max(80, 110 - lvl * 3);
    
    let lastY = height - 100;
    let lastX = 150;

    for (let i = 0; i < platformCount; i++) {
      const pWidth = Math.max(70, 150 - (lvl * 5));
      // 이전 발판 근처에서 생성되도록 조절
      let x = lastX + (Math.random() - 0.5) * 400;
      x = Math.max(50, Math.min(width - pWidth - 50, x));
      const y = lastY - verticalGap;
      
      lastY = y;
      lastX = x;

      const type = Math.random() > 0.85 ? 'bounce' : (Math.random() > 0.9 ? 'moving' : 'normal');
      newPlatforms.push({
        x, 
        y, 
        width: pWidth, 
        height: 25, 
        type, 
        color: type === 'bounce' ? COLORS.bounce : (type === 'moving' ? COLORS.moving : COLORS.platform),
        initialX: x
      });
      
      if (i === platformCount - 1) {
        goalRef.current = { x: x + pWidth / 2, y: y - 60 };
      }
    }
    platformsRef.current = newPlatforms;
  }, []);

  const resetPlayer = (height: number) => {
    playerRef.current.pos = { x: 80, y: height - 150 };
    playerRef.current.vel = { x: 0, y: 0 };
  };

  // 초기 레벨 생성
  useEffect(() => {
    generateLevel(1, dimensions.width, dimensions.height);
    resetPlayer(dimensions.height);
  }, [generateLevel, dimensions.width, dimensions.height]);

  const handleResize = useCallback(() => {
    setDimensions({ width: window.innerWidth, height: window.innerHeight });
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  const startGame = () => {
    setLevel(1);
    setGameState(prev => ({ ...prev, isPlaying: true, isGameOver: false, score: 0, time: 0 }));
    generateLevel(1, dimensions.width, dimensions.height);
    resetPlayer(dimensions.height);
  };

  const createParticles = (x: number, y: number, color: string, count: number = 5) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1.0,
        color,
        size: Math.random() * 6 + 2
      });
    }
  };

  const update = useCallback(() => {
    if (!gameState.isPlaying || gameState.isGameOver) return;

    const player = playerRef.current;
    const keys = keysRef.current;

    if (keys['ArrowLeft'] || keys['a']) {
      player.vel.x -= 0.8;
      player.facingRight = false;
    }
    if (keys['ArrowRight'] || keys['d']) {
      player.vel.x += 0.8;
      player.facingRight = true;
    }
    if ((keys['ArrowUp'] || keys['w'] || keys[' ']) && player.isGrounded) {
      player.vel.y = JUMP_FORCE;
      player.isGrounded = false;
      createParticles(player.pos.x + PLAYER_SIZE / 2, player.pos.y + PLAYER_SIZE, '#fff');
    }

    player.vel.x *= FRICTION;
    player.vel.y += GRAVITY;
    player.pos.x += player.vel.x;
    player.pos.y += player.vel.y;

    if (player.pos.x < 0) player.pos.x = 0;
    if (player.pos.x > dimensions.width - PLAYER_SIZE) player.pos.x = dimensions.width - PLAYER_SIZE;

    player.isGrounded = false;

    platformsRef.current.forEach(p => {
      if (
        player.pos.x < p.x + p.width &&
        player.pos.x + PLAYER_SIZE > p.x &&
        player.pos.y + PLAYER_SIZE > p.y &&
        player.pos.y + PLAYER_SIZE < p.y + p.height + 15 &&
        player.vel.y >= 0
      ) {
        player.pos.y = p.y - PLAYER_SIZE;
        player.vel.y = p.type === 'bounce' ? JUMP_FORCE * 1.6 : 0;
        player.isGrounded = true;
        if (p.type === 'bounce' && Math.abs(player.vel.y) > 1) {
           createParticles(player.pos.x + PLAYER_SIZE/2, p.y, COLORS.bounce, 10);
        }
      }
      if (p.type === 'moving' && p.initialX !== undefined) {
        p.x = p.initialX + Math.sin(Date.now() / 600) * 100;
      }
    });

    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      return p.life > 0;
    });

    if (player.pos.y > dimensions.height) {
      setGameState(prev => ({ ...prev, isGameOver: true, isPlaying: false }));
    }

    const distToGoal = Math.hypot(
      (player.pos.x + PLAYER_SIZE / 2) - goalRef.current.x,
      (player.pos.y + PLAYER_SIZE / 2) - (goalRef.current.y + 20)
    );

    if (distToGoal < 50) {
      const nextLevel = level + 1;
      setLevel(nextLevel);
      generateLevel(nextLevel, dimensions.width, dimensions.height);
      resetPlayer(dimensions.height);
      setGameState(s => ({ ...s, score: s.score + 100 }));
      createParticles(goalRef.current.x, goalRef.current.y, '#FDE047', 25);
    }

    setGameState(prev => ({ ...prev, time: prev.time + 1/60 }));
  }, [dimensions, level, generateLevel, gameState.isPlaying, gameState.isGameOver]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for(let i=0; i<10; i++) {
        const xBase = (dimensions.width / 9) * i;
        const xOff = Math.sin(Date.now()/3500 + i) * 40;
        const yOff = Math.cos(Date.now()/4500 + i) * 25;
        ctx.beginPath();
        ctx.arc(xBase + xOff, 120 + yOff, 45, 0, Math.PI*2);
        ctx.arc(xBase + xOff + 35, 120 + yOff + 15, 35, 0, Math.PI*2);
        ctx.arc(xBase + xOff - 35, 120 + yOff + 15, 35, 0, Math.PI*2);
        ctx.fill();
    }

    // Goal
    ctx.save();
    const bounce = Math.sin(Date.now() / 250) * 12;
    ctx.font = '55px Arial';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#FDE047';
    ctx.fillText('⭐', goalRef.current.x, goalRef.current.y + bounce);
    ctx.restore();

    // Platforms
    platformsRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.width, p.height, 12);
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    // Particles
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Player
    const player = playerRef.current;
    ctx.save();
    ctx.translate(player.pos.x + PLAYER_SIZE / 2, player.pos.y + PLAYER_SIZE / 2);
    const sY = Math.abs(player.vel.y) * 0.02;
    const sX = Math.abs(player.vel.x) * 0.02;
    ctx.scale(1 + sX - sY, 1 + sY - sX);
    if (!player.facingRight) ctx.scale(-1, 1);
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.roundRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE, 12);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(6, -6, 4, 0, Math.PI * 2);
    ctx.arc(18, -6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(12, 4, 6, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.restore();
  }, [dimensions]);

  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        update();
        draw(ctx);
      }
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [update, draw]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current[e.key] = true;
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current[e.key] = false;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div className="relative w-screen h-screen bg-pink-50 overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-100 via-pink-50 to-purple-100 opacity-60" />
      
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block z-0"
      />

      {/* UI - Stats */}
      <div className="absolute top-6 left-6 flex gap-4 z-10 pointer-events-none">
        <div className="bg-white/80 backdrop-blur-md px-5 py-2 rounded-2xl shadow-xl border-b-4 border-pink-200">
            <p className="text-pink-400 font-bold text-[10px] uppercase tracking-tighter">Level</p>
            <p className="text-2xl font-black text-pink-600 leading-none">{level}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-md px-5 py-2 rounded-2xl shadow-xl border-b-4 border-blue-200">
            <p className="text-blue-400 font-bold text-[10px] uppercase tracking-tighter">Time</p>
            <p className="text-2xl font-black text-blue-600 leading-none">{gameState.time.toFixed(1)}s</p>
        </div>
      </div>

      <div className="absolute top-6 right-6 z-10 pointer-events-none">
        <div className="bg-white/80 backdrop-blur-md px-5 py-2 rounded-2xl shadow-xl border-b-4 border-yellow-200">
            <p className="text-yellow-500 font-bold text-[10px] uppercase tracking-tighter">Best Rank</p>
            <p className="text-2xl font-black text-yellow-600 leading-none">{gameState.highScore}</p>
        </div>
      </div>

      {/* Start Screen */}
      {!gameState.isPlaying && !gameState.isGameOver && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-white/20 backdrop-blur-sm">
          <div className="bg-white/90 p-12 rounded-[50px] shadow-2xl border-4 border-white text-center transform transition-all hover:scale-105">
            <h1 className="text-7xl font-black text-pink-500 mb-2 drop-shadow-sm tracking-tight">DREAMY RUN</h1>
            <p className="text-pink-400 mb-10 text-xl font-medium">별을 향해 점프하세요! ⭐</p>
            <button 
              onClick={startGame}
              className="bg-pink-500 hover:bg-pink-600 text-white text-3xl font-black py-5 px-16 rounded-full shadow-[0_10px_0_rgb(219,39,119)] active:translate-y-2 active:shadow-none transition-all duration-150"
            >
              START!
            </button>
            <div className="mt-12 flex justify-center gap-10 text-pink-300 font-bold text-sm">
                <div className="flex flex-col items-center gap-2">
                    <span className="bg-pink-100 px-3 py-1 rounded-lg text-pink-500">W / SPACE</span>
                    <span>JUMP</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <span className="bg-pink-100 px-3 py-1 rounded-lg text-pink-500">A / D</span>
                    <span>MOVE</span>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState.isGameOver && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-red-100/30 backdrop-blur-md">
          <div className="bg-white p-12 rounded-[50px] shadow-2xl border-4 border-red-100 text-center animate-bounce-in">
            <h2 className="text-6xl font-black text-red-400 mb-4">앗! 떨어졌어요</h2>
            <div className="flex justify-center gap-6 mb-10">
                <div className="bg-slate-50 p-5 rounded-3xl min-w-[120px]">
                    <p className="text-slate-400 text-xs font-bold uppercase mb-1">Score</p>
                    <p className="text-3xl font-black text-slate-700">{gameState.score}</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-3xl min-w-[120px]">
                    <p className="text-slate-400 text-xs font-bold uppercase mb-1">Time</p>
                    <p className="text-3xl font-black text-slate-700">{gameState.time.toFixed(1)}s</p>
                </div>
            </div>
            <button 
              onClick={startGame}
              className="bg-red-400 hover:bg-red-500 text-white text-2xl font-black py-5 px-14 rounded-full shadow-[0_8px_0_rgb(220,38,38)] active:translate-y-2 active:shadow-none transition-all duration-150"
            >
              RETRY
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
