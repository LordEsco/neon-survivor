export interface Entity {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
}

export interface Player extends Entity {
  hp: number;
  maxHp: number;
  speed: number;
  totalXp: number;
  upgradePoints: number;
  upgradeLevels: {
    damage: number;
    speed: number;
    attackSpeed: number;
    regen: number;
  };
  coins: number;
  attackSpeed: number;
  damage: number;
  bulletSpeed: number;
  skinId: string;
  lastShotTime: number;
  regenRate: number;
}

export interface Enemy extends Entity {
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  xpValue: number;
  skinId: string;
}

export interface Bullet extends Entity {
  vx: number;
  vy: number;
  damage: number;
  life: number;
}

export interface GoldCoin extends Entity {
  value: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export interface GameNotification {
  id: string;
  title: string;
  message: string;
  description?: string;
  color: string;
  icon?: string;
  life: number;
}

export interface Crosshair {
  id: string;
  name: string;
  type: 'dot' | 'large-dot' | 'plus' | 'cross' | 'circle' | 'square' | 'diamond' | 'target' | 'cursor' | 't-shape' | 'arrow';
}

export interface RoomPlayer {
  id: string;
  role: "host" | "player";
  playerNumber: number;
}

export interface OnlineRoom {
  roomCode: string;
  maxPlayers: number;
  isLocked: boolean;
  isPasswordProtected: boolean;
  players: RoomPlayer[];
}

export interface GameState {
  player: Player;
  player2: Player | null;
  isMultiplayer: boolean;
  enemies: Enemy[];
  bullets: Bullet[];
  goldCoins: GoldCoin[];
  floatingTexts: FloatingText[];
  notifications: GameNotification[];
  score: number;
  isPaused: boolean;
  isGameOver: boolean;
  wave: number;
  maxWaveReached: number;
  waveTimer: number;
  waveDuration: number;
  enemiesRemainingInWave: number;
  totalEnemiesInWave: number;
  isWaveTransitioning: boolean;
  waveTransitionTimer: number;
  lastShotTime: number; // Keep for backward compatibility or remove if fully moved to Player
  gameStarted: boolean;
  showSkinsMenu: boolean;
  showPauseMenu: boolean;
  showCrosshairsMenu: boolean;
  selectedPlayerSkin: string;
  selectedEnemySkin: string;
  selectedCrosshair: string;
  showPowerUpMenu: boolean;
  showOnlineMenu: boolean;
  showCreateRoomMenu: boolean;
  showJoinRoomMenu: boolean;
  showInRoomMenu: boolean;
  onlineRoom: OnlineRoom | null;
  socketId: string | null;
}

export interface UpgradeOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  effect: (state: GameState, playerIndex: 1 | 2) => GameState;
}
