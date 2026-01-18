
export interface Vector {
  x: number;
  y: number;
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'normal' | 'bounce' | 'moving' | 'vanishing';
  color: string;
  initialX?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface GameState {
  isPlaying: boolean;
  score: number;
  highScore: number;
  time: number;
  isGameOver: boolean;
}
