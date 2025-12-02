import React, { useEffect, useRef, useState, useCallback } from 'react';
import { initializeHandLandmarker, startWebcam, detectHand } from '../services/vision';
import { getGeminiCommentary } from '../services/gemini';
import { GameState, Point, Particle, SnakeSegment } from '../types';

const INITIAL_SNAKE_LENGTH = 10;
const SEGMENT_SIZE = 12; // Radius
const SPEED = 4;

const SnakeGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number>();
  const [loading, setLoading] = useState(true);
  const [commentary, setCommentary] = useState("Loading AI Vision...");
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    status: 'menu',
    highScore: 0
  });

  // Game Mutable State (Refs for performance in game loop)
  const snakeRef = useRef<SnakeSegment[]>([]);
  const foodRef = useRef<Point>({ x: 0, y: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const targetRef = useRef<Point>({ x: 0, y: 0 }); // Where the snake wants to go
  const fingerRef = useRef<Point | null>(null); // Detected finger position
  const frameCountRef = useRef(0);

  // Initialize Vision and Audio
  useEffect(() => {
    const init = async () => {
      try {
        await initializeHandLandmarker();
        if (videoRef.current) {
          await startWebcam(videoRef.current);
        }
        setLoading(false);
        setCommentary("Show your hand to control the snake!");
      } catch (err) {
        console.error(err);
        setCommentary("Error initializing camera. Please allow permissions.");
      }
    };
    init();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Helper: Generate Random Position
  const getRandomPosition = (width: number, height: number, margin = 40): Point => {
    return {
      x: margin + Math.random() * (width - margin * 2),
      y: margin + Math.random() * (height - margin * 2)
    };
  };

  // Helper: Create explosion particles
  const createParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 2;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color
      });
    }
  };

  const startGame = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Reset State
    const center = { x: canvas.width / 2, y: canvas.height / 2 };
    snakeRef.current = [];
    for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
      snakeRef.current.push({ x: center.x, y: center.y + i * 5, id: i });
    }
    
    foodRef.current = getRandomPosition(canvas.width, canvas.height);
    particlesRef.current = [];
    targetRef.current = { ...center };
    
    setGameState(prev => ({ ...prev, status: 'playing', score: 0 }));
    
    // Gemini Intro
    const intro = await getGeminiCommentary('start', 0);
    setCommentary(intro);
  };

  const update = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Vision Detection
    const detectedFinger = detectHand(video);
    
    if (detectedFinger) {
      // Mirror x coordinate because webcam is mirrored
      fingerRef.current = {
        x: (1 - detectedFinger.x) * canvas.width,
        y: detectedFinger.y * canvas.height
      };
    } else {
      fingerRef.current = null;
    }

    // 2. Logic Update (Only if playing)
    if (gameState.status === 'playing') {
      frameCountRef.current++;

      // Determine Target
      if (fingerRef.current) {
        targetRef.current = fingerRef.current;
      } else {
        // Random wandering if no finger
        if (frameCountRef.current % 100 === 0) {
          targetRef.current = getRandomPosition(canvas.width, canvas.height);
        }
      }

      // Move Head
      const head = snakeRef.current[0];
      const dx = targetRef.current.x - head.x;
      const dy = targetRef.current.y - head.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Only move if not super close to target to avoid jitter
      if (distance > 5) {
        const vx = (dx / distance) * SPEED;
        const vy = (dy / distance) * SPEED;
        
        // New Head Position
        const newHead = { x: head.x + vx, y: head.y + vy, id: Date.now() };
        
        // Add new head, remove tail (unless eating)
        snakeRef.current.unshift(newHead);
        
        // Check Food Collision
        const distFood = Math.hypot(newHead.x - foodRef.current.x, newHead.y - foodRef.current.y);
        if (distFood < SEGMENT_SIZE * 2) {
          // Eat!
          foodRef.current = getRandomPosition(canvas.width, canvas.height);
          const newScore = gameState.score + 1;
          setGameState(prev => ({ ...prev, score: newScore }));
          createParticles(newHead.x, newHead.y, '#facc15'); // Yellow splash
          
          // Trigger commentary occasionally
          if (newScore % 3 === 0) {
            getGeminiCommentary('eat', newScore).then(setCommentary);
          }
        } else {
          // Check Self Collision (Game Over) - Skip first few segments
          let crashed = false;
          // Simple boundary check
          if (newHead.x < 0 || newHead.x > canvas.width || newHead.y < 0 || newHead.y > canvas.height) {
            crashed = true;
          }

          // Self collision
          for (let i = 10; i < snakeRef.current.length; i++) {
            const seg = snakeRef.current[i];
            if (Math.hypot(newHead.x - seg.x, newHead.y - seg.y) < SEGMENT_SIZE) {
               crashed = true; 
               break;
            }
          }

          if (crashed) {
            setGameState(prev => ({ ...prev, status: 'gameover', highScore: Math.max(prev.score, prev.highScore) }));
            getGeminiCommentary('gameover', gameState.score).then(setCommentary);
          } else {
            snakeRef.current.pop();
          }
        }
      }
    }

    // 3. Render
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Particles
    particlesRef.current.forEach((p, index) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      if (p.life <= 0) particlesRef.current.splice(index, 1);
    });
    ctx.globalAlpha = 1;

    // Draw Food
    if (gameState.status === 'playing') {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#facc15';
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      const pulse = Math.sin(Date.now() / 200) * 2;
      ctx.arc(foodRef.current.x, foodRef.current.y, SEGMENT_SIZE - 2 + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Draw Snake
    if (snakeRef.current.length > 0) {
      // Draw Body
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = SEGMENT_SIZE * 2;
      
      // We draw the snake as a path for smoothness
      ctx.beginPath();
      ctx.moveTo(snakeRef.current[0].x, snakeRef.current[0].y);
      // Simplify path for performance
      for (let i = 1; i < snakeRef.current.length; i += 2) {
         ctx.lineTo(snakeRef.current[i].x, snakeRef.current[i].y);
      }
      ctx.stroke();

      // Draw Head
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(snakeRef.current[0].x, snakeRef.current[0].y, SEGMENT_SIZE + 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Eyes
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(snakeRef.current[0].x - 4, snakeRef.current[0].y - 4, 3, 0, Math.PI * 2);
      ctx.arc(snakeRef.current[0].x + 4, snakeRef.current[0].y - 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Finger Indicator (Ghost)
    if (fingerRef.current) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fingerRef.current.x, fingerRef.current.y, 20, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(fingerRef.current.x, fingerRef.current.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    requestRef.current = requestAnimationFrame(update);
  }, [gameState]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  // Resize handling
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden select-none">
      {/* Hidden Video Feed for CV */}
      <video 
        ref={videoRef} 
        className="absolute top-0 left-0 opacity-0 pointer-events-none" 
        playsInline 
        muted 
        width="640" 
        height="480"
      />

      {/* Game Canvas */}
      <canvas 
        ref={canvasRef} 
        className="block w-full h-full"
      />

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between p-6">
        
        {/* Top Bar: Score & Status */}
        <div className="flex justify-between items-start">
          <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-4 border border-slate-700 shadow-xl">
             <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">Score</div>
             <div className="text-4xl font-black text-yellow-400 font-mono">{gameState.score}</div>
          </div>
          
          <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-4 border border-slate-700 shadow-xl max-w-sm">
             <div className="flex items-center gap-2 mb-1">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
               <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">Gemini Commentary</div>
             </div>
             <p className="text-slate-200 text-lg leading-tight italic">"{commentary}"</p>
          </div>
        </div>

        {/* Center: Menus */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-50">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-white">Initializing Vision...</h2>
              <p className="text-slate-400">Please allow camera access</p>
            </div>
          </div>
        )}

        {!loading && gameState.status === 'menu' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-40 pointer-events-auto">
             <div className="text-center animate-bounce-in">
                <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-2">
                  FINGER SNAKE
                </h1>
                <p className="text-xl text-slate-300 mb-8">Show your index finger to guide the snake!</p>
                <button 
                  onClick={startGame}
                  className="px-8 py-4 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold text-xl rounded-full shadow-[0_0_20px_rgba(250,204,21,0.5)] transition-all transform hover:scale-105 active:scale-95 pointer-events-auto"
                >
                  Start Game
                </button>
             </div>
          </div>
        )}

        {!loading && gameState.status === 'gameover' && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/60 backdrop-blur-md z-40 pointer-events-auto">
             <div className="text-center">
                <h2 className="text-6xl font-black text-white mb-2">GAME OVER</h2>
                <div className="text-2xl text-yellow-400 font-mono mb-8">Final Score: {gameState.score}</div>
                <button 
                  onClick={startGame}
                  className="px-8 py-4 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xl rounded-full shadow-xl transition-all transform hover:scale-105 active:scale-95 pointer-events-auto"
                >
                  Play Again
                </button>
             </div>
          </div>
        )}
        
        {/* Bottom: Instructions */}
        <div className="text-center pb-4 opacity-50">
           <p className="text-white text-sm">
             Powered by Google MediaPipe & Gemini AI
           </p>
        </div>
      </div>
    </div>
  );
};

export default SnakeGame;
