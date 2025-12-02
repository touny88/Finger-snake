export interface Point {
  x: number;
  y: number;
}

export enum GameState {
  LOADING = 'LOADING',
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER'
}

export interface SnakeSegment extends Point {
  id: number;
}

export interface GameConfig {
  speed: number;
  snakeSize: number;
  growthRate: number;
}