import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Point, GameState, SnakeSegment } from '../types';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  onScoreUpdate: (score: number) => void;
  onGameOver: () => void;
}

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
const SNAKE_SPEED = 4; // Pixels per frame
const TURN_SPEED = 0.15; // Radians per frame
const INITIAL_LENGTH = 10;
const SEGMENT_SPACING = 10;
const FOOD_RADIUS = 12;
const HEAD_RADIUS = 15;

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, 
  setGameState, 
  onScoreUpdate,
  onGameOver 
}) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
  const [webcamReady, setWebcamReady] = useState(false);

  // Game State Refs (using refs for high-performance game loop)
  const snakeRef = useRef<SnakeSegment[]>([]);
  const directionRef = useRef<number>(0); // Angle in radians
  const foodRef = useRef<Point>({ x: 0, y: 0 });
  const scoreRef = useRef<number>(0);
  const isHandDetectedRef = useRef<boolean>(false);
  const targetPointRef = useRef<Point | null>(null);

  // Initialize MediaPipe
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        setHandLandmarker(landmarker);
      } catch (error) {
        console.error("Failed to load MediaPipe:", error);
      }
    };
    initMediaPipe();
  }, []);

  // Initialize Game
  const initGame = useCallback(() => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    // Create initial snake
    const initialSnake: SnakeSegment[] = [];
    for (let i = 0; i < INITIAL_LENGTH; i++) {
      initialSnake.push({
        x: centerX,
        y: centerY + (i * SEGMENT_SPACING),
        id: i
      });
    }
    snakeRef.current = initialSnake;
    directionRef.current = -Math.PI / 2; // Facing up
    scoreRef.current = 0;
    spawnFood();
    onScoreUpdate(0);
  }, [onScoreUpdate]);

  const spawnFood = () => {
    const padding = 50;
    foodRef.current = {
      x: padding + Math.random() * (window.innerWidth - padding * 2),
      y: padding + Math.random() * (window.innerHeight - padding * 2)
    };
  };

  // The Game Loop
  const animate = useCallback((time: number) => {
    // If Game Over, stop loop
    if (gameState === GameState.GAME_OVER) return;

    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    const ctx = canvas?.getContext('2d');

    if (canvas && ctx && video && handLandmarker && webcamReady) {
      
      // 1. Process Vision (Only when playing to save resources/prevent movement when paused)
      //    We can allows keep tracking if we want the cursor to move in pause, but typically we stop.
      //    Let's keep tracking active in PAUSED so the 'resume' feels responsive to current hand position immediately.
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        const startTimeMs = performance.now();
        const results = handLandmarker.detectForVideo(video, startTimeMs);

        if (results.landmarks && results.landmarks.length > 0) {
          isHandDetectedRef.current = true;
          // Index finger tip is landmark 8
          const tip = results.landmarks[0][8]; 
          
          // Map normalized coordinates (0-1) to screen coordinates
          // Note: Webcam is mirrored usually, so we flip X
          targetPointRef.current = {
            x: (1 - tip.x) * canvas.width,
            y: tip.y * canvas.height
          };
        } else {
          isHandDetectedRef.current = false;
          targetPointRef.current = null;
        }
      }

      // 2. Clear Canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 3. Draw Background Grid (Cyberpunk style)
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.1)';
      ctx.lineWidth = 1;
      const gridSize = 50;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 4. Update Physics (ONLY IF PLAYING)
      if (gameState === GameState.PLAYING) {
        const snake = snakeRef.current;
        const head = snake[0];

        // Determine target angle
        let targetAngle = directionRef.current;

        if (isHandDetectedRef.current && targetPointRef.current) {
          // Move towards finger
          const dx = targetPointRef.current.x - head.x;
          const dy = targetPointRef.current.y - head.y;
          targetAngle = Math.atan2(dy, dx);
        } else {
           // Random movement or keep straight if no hand
           if (Math.random() < 0.05) {
             targetAngle += (Math.random() - 0.5) * 1.0; 
           }
        }

        // Smooth turning
        let diff = targetAngle - directionRef.current;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        if (Math.abs(diff) > TURN_SPEED) {
            directionRef.current += Math.sign(diff) * TURN_SPEED;
        } else {
            directionRef.current = targetAngle;
        }

        // Move Head
        const newHead = {
          x: head.x + Math.cos(directionRef.current) * SNAKE_SPEED,
          y: head.y + Math.sin(directionRef.current) * SNAKE_SPEED,
          id: Date.now() // temporary ID
        };

        // Screen Wrapping
        if (newHead.x < 0) newHead.x = canvas.width;
        if (newHead.x > canvas.width) newHead.x = 0;
        if (newHead.y < 0) newHead.y = canvas.height;
        if (newHead.y > canvas.height) newHead.y = 0;

        // Collision with Food
        const distToFood = Math.hypot(newHead.x - foodRef.current.x, newHead.y - foodRef.current.y);
        let grew = false;
        if (distToFood < HEAD_RADIUS + FOOD_RADIUS) {
          scoreRef.current += 10;
          onScoreUpdate(scoreRef.current);
          spawnFood();
          grew = true;
        }

        // Update Body Segments
        const newSnake = [newHead];
        snake.unshift(newHead);
        
        const targetLength = INITIAL_LENGTH + Math.floor(scoreRef.current / 10) * 2;
        
        if (!grew) {
           const neededHistory = Math.ceil(targetLength * (SEGMENT_SPACING / SNAKE_SPEED) * 1.5);
           if (snake.length > neededHistory) {
             snake.pop();
           }
        }

        snakeRef.current = snake;
      }

      // 5. Draw Game Elements (If PLAYING or PAUSED)
      if (gameState === GameState.PLAYING || gameState === GameState.PAUSED) {
        // Draw Food
        ctx.beginPath();
        ctx.fillStyle = '#ef4444'; // Red food
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ef4444';
        ctx.arc(foodRef.current.x, foodRef.current.y, FOOD_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw Snake
        const snake = snakeRef.current;
        let distanceTraveled = 0;
        let drawnSegments = 0;
        const targetLength = INITIAL_LENGTH + Math.floor(scoreRef.current / 10) * 2;
        
        for (let i = 0; i < snake.length - 1; i++) {
            const p1 = snake[i];
            const p2 = snake[i + 1];
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            distanceTraveled += dist;

            if (distanceTraveled >= SEGMENT_SPACING && drawnSegments < targetLength) {
                ctx.beginPath();
                ctx.fillStyle = drawnSegments === 0 ? '#10b981' : '#34d399'; 
                ctx.shadowBlur = drawnSegments === 0 ? 20 : 5;
                ctx.shadowColor = '#10b981';
                
                const radius = drawnSegments === 0 ? HEAD_RADIUS : Math.max(5, HEAD_RADIUS - (drawnSegments * 0.1));
                
                ctx.arc(p1.x, p1.y, radius, 0, Math.PI * 2);
                ctx.fill();
                
                distanceTraveled = 0;
                drawnSegments++;
            }
        }
        ctx.shadowBlur = 0;
      }

      // 6. Draw Target Indicator (Only if PLAYING)
      if (gameState === GameState.PLAYING && targetPointRef.current) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.arc(targetPointRef.current.x, targetPointRef.current.y, 20, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(targetPointRef.current.x - 10, targetPointRef.current.y);
        ctx.lineTo(targetPointRef.current.x + 10, targetPointRef.current.y);
        ctx.moveTo(targetPointRef.current.x, targetPointRef.current.y - 10);
        ctx.lineTo(targetPointRef.current.x, targetPointRef.current.y + 10);
        ctx.stroke();
      }
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [gameState, handLandmarker, onScoreUpdate, webcamReady]);

  // Handle Resize
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

  // Start Loop
  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // Track previous game state to only init on transition to PLAYING from MENU/GAMEOVER
  const prevGameState = useRef(gameState);

  // Handle Game Start
  useEffect(() => {
    // Only init if we are transitioning to PLAYING from a non-active state (MENU or GAME_OVER)
    // If coming from PAUSED, we DO NOT init.
    if (gameState === GameState.PLAYING) {
      const cameFromMenu = prevGameState.current === GameState.MENU;
      const cameFromGameOver = prevGameState.current === GameState.GAME_OVER;
      
      if (cameFromMenu || cameFromGameOver) {
        initGame();
      }
    }
    prevGameState.current = gameState;
  }, [gameState, initGame]);


  return (
    <div className="absolute inset-0 w-full h-full bg-slate-900 overflow-hidden">
      <Webcam
        ref={webcamRef}
        audio={false}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        screenshotFormat="image/jpeg"
        videoConstraints={{
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
          facingMode: "user"
        }}
        onUserMedia={() => setWebcamReady(true)}
        className="absolute opacity-0 pointer-events-none" // Hidden webcam
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block touch-none"
      />
      
      {!webcamReady && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-slate-900 z-50">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-8 w-8 bg-green-500 rounded-full mb-4 animate-bounce"></div>
            <p className="font-brand text-xl">Initializing Vision Systems...</p>
            <p className="text-sm text-slate-400 mt-2">Please allow camera access</p>
          </div>
        </div>
      )}
    </div>
  );
};