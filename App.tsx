import React, { useState, useEffect, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { SiyuLogo } from './components/SiyuLogo';
import { GameState } from './types';
import { Play, RotateCcw, Hand, Pause, Square } from 'lucide-react';
import { generateSiyuWisdom } from './services/geminiService';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [aiMessage, setAiMessage] = useState<string>("Initializing Siyu Protocol...");
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Load initial wisdom
  useEffect(() => {
    const loadIntro = async () => {
      setIsLoadingAi(true);
      const msg = await generateSiyuWisdom(0, 'start');
      setAiMessage(msg);
      setIsLoadingAi(false);
    };
    loadIntro();
  }, []);

  const handleStartGame = useCallback(() => {
    setScore(0);
    setGameState(GameState.PLAYING);
  }, []);

  const handleGameOver = useCallback(async () => {
    setGameState(GameState.GAME_OVER);
    setHighScore(prev => Math.max(prev, score)); 
    setIsLoadingAi(true);
    const msg = await generateSiyuWisdom(score, 'gameover');
    setAiMessage(msg);
    setIsLoadingAi(false);
  }, [score]);

  const handleScoreUpdate = useCallback((newScore: number) => {
    setScore(newScore);
  }, []);

  const togglePause = useCallback(() => {
    if (gameState === GameState.PLAYING) {
      setGameState(GameState.PAUSED);
    } else if (gameState === GameState.PAUSED) {
      setGameState(GameState.PLAYING);
    }
  }, [gameState]);

  return (
    <div className="relative w-full h-screen bg-slate-900 text-white overflow-hidden selection:bg-green-500 selection:text-black">
      {/* Background/Game Layer */}
      <GameCanvas 
        gameState={gameState} 
        setGameState={setGameState}
        onScoreUpdate={handleScoreUpdate}
        onGameOver={handleGameOver}
      />

      {/* HUD Layer (Always Visible during game/pause) */}
      {(gameState === GameState.PLAYING || gameState === GameState.PAUSED) && (
        <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none z-10">
          <div className="flex flex-col">
            <span className="font-brand text-green-400 text-sm tracking-widest opacity-80">CURRENT SCORE</span>
            <span className="font-mono text-4xl font-bold">{score.toString().padStart(4, '0')}</span>
          </div>
          
          <div className="flex flex-row items-start gap-6">
             {/* Controls (Pointer Events enabled) */}
            <div className="flex gap-2 pointer-events-auto">
              <button 
                onClick={togglePause}
                className="p-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full border border-slate-600 transition-all backdrop-blur-sm"
                title={gameState === GameState.PAUSED ? "Resume" : "Pause"}
              >
                {gameState === GameState.PAUSED ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
              </button>
              <button 
                onClick={handleGameOver}
                className="p-3 bg-red-900/80 hover:bg-red-800 text-red-200 rounded-full border border-red-800 transition-all backdrop-blur-sm"
                title="End Game"
              >
                <Square className="w-6 h-6 fill-current" />
              </button>
            </div>

            <div className="flex flex-col items-end">
              <span className="font-brand text-teal-400 text-sm tracking-widest opacity-80">HIGH SCORE</span>
              <span className="font-mono text-4xl font-bold">{highScore.toString().padStart(4, '0')}</span>
            </div>
          </div>
        </div>
      )}

      {/* PAUSE MENU */}
      {gameState === GameState.PAUSED && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900/60 backdrop-blur-sm">
          <div className="flex flex-col items-center p-8 bg-slate-800/90 border border-slate-600 rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="font-brand text-4xl text-white mb-8 tracking-wider">PAUSED</h2>
            
            <div className="flex flex-col gap-4 w-64">
              <button
                onClick={togglePause}
                className="w-full py-4 bg-green-500 hover:bg-green-400 text-black font-brand font-bold text-lg rounded-xl transition-all hover:scale-105 flex items-center justify-center gap-3"
              >
                <Play className="w-5 h-5 fill-current" />
                RESUME
              </button>
              <button
                onClick={() => setGameState(GameState.MENU)}
                className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-brand font-bold text-lg rounded-xl transition-all hover:scale-105"
              >
                QUIT TO MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MENU UI */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900/80 backdrop-blur-sm transition-all duration-500">
          <div className="flex flex-col items-center p-8 max-w-md w-full text-center">
            <SiyuLogo className="mb-8" />
            
            <div className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl w-full mb-8 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-center mb-4 text-green-400">
                <Hand className="w-8 h-8 animate-pulse" />
              </div>
              <h3 className="text-xl font-bold mb-2">How to Play</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Show your hand to the camera. Point with your <span className="text-green-400 font-bold">index finger</span> to guide the Siyu Snake. Collect red energy nodes to grow.
              </p>
            </div>

            <div className="min-h-[60px] mb-8 w-full flex items-center justify-center">
               {isLoadingAi ? (
                 <span className="text-xs text-green-500 font-mono animate-pulse">Establishing Neural Link...</span>
               ) : (
                 <p className="text-green-300 font-mono text-sm italic border-l-2 border-green-500 pl-4 py-1 text-left w-full bg-green-500/5">
                   "{aiMessage}"
                 </p>
               )}
            </div>

            <button
              onClick={handleStartGame}
              className="group relative px-8 py-4 bg-green-500 hover:bg-green-400 text-black font-brand font-bold text-xl rounded-full transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(34,197,94,0.6)] flex items-center gap-3"
            >
              <Play className="w-6 h-6 fill-current" />
              INITIATE
            </button>
          </div>
        </div>
      )}

      {/* GAME OVER UI (Simplified for replay) */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900/90 backdrop-blur-md">
          <div className="flex flex-col items-center p-8 max-w-md w-full text-center animate-in zoom-in duration-300">
            <h2 className="font-brand text-4xl text-white mb-2">SYSTEM FAILURE</h2>
            <p className="text-slate-400 mb-8 font-mono">CONNECTION LOST</p>
            
            <div className="bg-black/50 border border-red-500/30 p-6 rounded-xl w-full mb-8">
               <span className="block text-sm text-slate-500 uppercase tracking-widest mb-1">Final Score</span>
               <span className="block text-5xl font-mono font-bold text-white">{score}</span>
            </div>

            <div className="min-h-[80px] mb-8 w-full flex items-center justify-center bg-slate-800/50 rounded-lg p-4">
               {isLoadingAi ? (
                 <span className="text-xs text-green-500 font-mono animate-pulse">Analyzing performance data...</span>
               ) : (
                 <div className="w-full text-left">
                    <span className="text-[10px] text-green-500 uppercase tracking-widest block mb-1">AI Analysis</span>
                    <p className="text-green-300 font-mono text-sm italic">
                      "{aiMessage}"
                    </p>
                 </div>
               )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setGameState(GameState.MENU)}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
              >
                MENU
              </button>
              <button
                onClick={handleStartGame}
                className="px-8 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-lg transition-all hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] flex items-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                RETRY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}