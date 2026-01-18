
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Vector, Platform, Particle, GameState } from './types';
import { GRAVITY, JUMP_FORCE, FRICTION, PLAYER_SIZE, COLORS } from './constants';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const generateLevel = useCallback((lvl: number, width: number, height: number) => {
    const newPlatforms: Platform[] = [
      { x: 50, y: height - 100, width: 250, height: 40, type: 'normal', color: COLORS.platform },
    ];

    const platformCount = Math.min(6 + lvl, 15);
    const verticalGap = Math.max(70, 100 - lvl * 2);
    
    let lastY = height - 100;

    for (let i = 0; i < platformCount; i++) {
      const pWidth = Math.max(60, 140 - (lvl * 4));
      const x = Math.random() * (width - pWidth - 100) + 50;
      const y = lastY - verticalGap;
      lastY = y;

      const type = Math.random() > 0.8 ? 'bounce' : (Math.random() > 0.85 ? 'moving' : 'normal');
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
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 1.0,
        color,
        size: Math.random() * 5 + 2
      });
    }
  };

  const update = useCallback(() => {
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

    // Bounds
    if (player.pos.x < 0) player.pos.x = 0;
    if (player.pos.x > dimensions.width - PLAYER_SIZE) player.pos.x = dimensions.width - PLAYER_SIZE;

    player.isGrounded = false;

    // Platform Collisions
    platformsRef.current.forEach(p => {
      if (
        player.pos.x < p.x + p.width &&
        player.pos.x + PLAYER_SIZE > p.x &&
        player.pos.y + PLAYER_SIZE > p.y &&
        player.pos.y + PLAYER_SIZE < p.y + p.height + 15 &&
        player.vel.y >= 0
      ) {
        player.pos.y = p.y - PLAYER_SIZE;
        player.vel.y = p.type === 'bounce' ? JUMP_FORCE * 1.5 : 0;
        player.isGrounded = true;
        if (p.type === 'bounce' && Math.abs(player.vel.y) > 1) {
           createParticles(player.pos.x + PLAYER_SIZE/2, p.y, COLORS.bounce, 8);
        }
      }

      if (p.type === 'moving' && p.initialX !== undefined) {
        p.x = p.initialX + Math.sin(Date.now() / 600) * 80;
      }
    });

    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.025;
      return p.life > 0;
    });

    if (player.pos.y > dimensions.height) {
      setGameState(prev => ({ ...prev, isGameOver: true, isPlaying: false }));
    }

    const distToGoal = Math.hypot(
      (player.pos.x + PLAYER_SIZE / 2) - goalRef.current.x,
      (player.pos.y + PLAYER_SIZE / 2) - (goalRef.current.y + 20)
    );

    if (distToGoal < 45) {
      const nextLevel = level + 1;
      setLevel(nextLevel);
      generateLevel(nextLevel, dimensions.width, dimensions.height);
      resetPlayer(dimensions.height);
      setGameState(s => ({ ...s, score: s.score + 100 }));
      createParticles(goalRef.current.x, goalRef.current.y, '#FDE047', 20);
    }

    setGameState(prev => ({ ...prev, time: prev.time + 1/60 }));
  }, [dimensions, level, generateLevel]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Dynamic Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for(let i=0; i<8; i++) {
        const xBase = (dimensions.width / 7) * i;
        const xOff = Math.sin(Date.now()/3000 + i) * 30;
        const yOff = Math.cos(Date.now()/4000 + i) * 20;
        ctx.beginPath();
        ctx.arc(xBase + xOff, 150 + yOff, 40, 0, Math.PI*2);
        ctx.arc(xBase + xOff + 30, 150 + yOff + 10, 30, 0, Math.PI*2);
        ctx.arc(xBase + xOff - 30, 150 + yOff + 10, 30, 0, Math.PI*2);
        ctx.fill();
    }

    // Goal Star
    ctx.save();
    const bounce = Math.sin(Date.now() / 300) * 10;
    ctx.font = '50px Arial';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#FDE047';
    ctx.fillText('⭐', goalRef.current.x, goalRef.current.y + bounce);
    ctx.restore();

    // Platforms
    platformsRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(0,0,0,0.05)';
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.width, p.height, 12);
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 4;
      ctx.stroke();
    });
    ctx.shadowBlur = 0;

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
    
    const stretchY = Math.abs(player.vel.y) * 0.015;
    const stretchX = Math.abs(player.vel.x) * 0.015;
    ctx.scale(1 + stretchX - stretchY, 1 + stretchY - stretchX);
    if (!player.facingRight) ctx.scale(-1, 1);

    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.roundRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE, 14);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(6, -6, 3.5, 0, Math.PI * 2);
    ctx.arc(18, -6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Smile
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(12, 4, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.restore();
  }, [dimensions]);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && gameState.isPlaying && !gameState.isGameOver) {
      update();
      draw(ctx);
    }
    requestRef.current = requestAnimationFrame(gameLoop);
  }, [gameState.isPlaying, gameState.isGameOver, update, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [gameLoop]);

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

  useEffect(() => {
    if (gameState.isGameOver && gameState.score > gameState.highScore) {
      setGameState(s => ({ ...s, highScore: s.score }));
      localStorage.setItem('highScore', gameState.score.toString());
    }
  }, [gameState.isGameOver, gameState.score, gameState.highScore]);

  return (
    <div className="relative w-screen h-screen bg-pink-50 overflow-hidden flex items-center justify-center">
      {/* Background Gradient Layer */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-pink-50 to-purple-50 opacity-50" />
      
      {/* Responsive Canvas */}
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block z-0"
      />

      {/* UI Overlay: Top Left */}
      <div className="absolute top-6 left-6 flex flex-col gap-3 z-10">
        <div className="flex gap-3">
            <div className="bg-white/90 backdrop-blur-md px-5 py-2 rounded-2xl shadow-xl border-b-4 border-pink-200">
                <p className="text-pink-400 font-bold text-[10px] uppercase tracking-tighter">Level</p>
                <p className="text-2xl font-black text-pink-600 leading-none">{level}</p>
            </div>
            <div className="bg-white/90 backdrop-blur-md px-5 py-2 rounded-2xl shadow-xl border-b-4 border-blue-200">
                <p className="text-blue-400 font-bold text-[10px