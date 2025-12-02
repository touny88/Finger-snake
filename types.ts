export interface Point {
  x: number;
  y: number;
}

export interface GameState {
  score: number;
  status: 'menu' | 'playing' | 'gameover';
  highScore: number;
}

export interface SnakeSegment extends Point {
  id: number;
}

// Visual particle effect type
export interface Particle extends Point {
  vx: number;
  vy: number;
  life: number;
  color: string;
}
