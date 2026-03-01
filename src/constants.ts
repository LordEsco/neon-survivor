import { GameState, Player } from "./types";

export const INITIAL_PLAYER: Player = {
  id: "player1",
  x: 0,
  y: 0,
  radius: 15,
  color: "#00FF00",
  hp: 100,
  maxHp: 100,
  speed: 3,
  totalXp: 0,
  upgradePoints: 0,
  upgradeLevels: {
    damage: 0,
    speed: 0,
    attackSpeed: 0,
    regen: 0,
  },
  coins: 0,
  attackSpeed: 400,
  damage: 20,
  bulletSpeed: 7,
  skinId: "default",
  lastShotTime: 0,
  regenRate: 0.01, // Base regen rate
};

export const INITIAL_PLAYER2: Player = {
  id: "player2",
  x: 0,
  y: 0,
  radius: 15,
  color: "#FF00FF",
  hp: 100,
  maxHp: 100,
  speed: 3,
  totalXp: 0,
  upgradePoints: 0,
  upgradeLevels: {
    damage: 0,
    speed: 0,
    attackSpeed: 0,
    regen: 0,
  },
  coins: 0,
  attackSpeed: 400,
  damage: 20,
  bulletSpeed: 7,
  skinId: "default",
  lastShotTime: 0,
  regenRate: 0.01,
};

export const PLAYER_SKINS = [
  { id: "default", name: "Klasik", color: "#00FF00", label: "Varsayılan", requiredWave: 0, bonusText: "Standart neon zırh. Herhangi bir özel bonusu bulunmuyor." },
  { id: "neon_blue", name: "Neon Mavi", color: "#00FFFF", label: "", requiredWave: 0, bonusText: "Mavi enerjiyle güçlendirilmiş zırh. Görsel bir değişiklik sağlar." },
  { id: "neon_pink", name: "Neon Pembe", color: "#FF00FF", label: "", requiredWave: 4, unlockText: "3. Dalgayı Geçince Açılır", bonusText: "%3 Hareket hızı, %2 Saldırı Hasarı %1 Saldırı hızı" },
  { id: "neon_gold", name: "Neon Altın", color: "#FFD700", label: "", requiredWave: 8, unlockText: "7. Dalgayı Geçince Açılır", bonusText: "%5 Hareket hızı, %5 Saldırı Hasarı" },
  { id: "neon_white", name: "Neon Beyaz", color: "#FFFFFF", label: "", requiredWave: 13, unlockText: "12. Dalgayı Geçince Açılır", bonusText: "%10 Tüm özellikler" },
  { id: "neon_red", name: "Neon Kırmızı", color: "#FF0000", label: "", requiredWave: 19, unlockText: "18. Dalgayı Geçince Açılır", bonusText: "%15 Saldırı Hasarı" },
  { id: "neon_purple", name: "Neon Mor", color: "#A020F0", label: "", requiredWave: 26, unlockText: "25. Dalgayı Geçince Açılır", bonusText: "%20 Can Yenileme" },
  { id: "neon_orange", name: "Neon Turuncu", color: "#FFA500", label: "", requiredWave: 36, unlockText: "35. Dalgayı Geçince Açılır", bonusText: "%25 Kritik Hasar" },
  { id: "neon_lime", name: "Neon Limon", color: "#32CD32", label: "", requiredWave: 46, unlockText: "45. Dalgayı Geçince Açılır", bonusText: "%30 Tecrübe Kazanımı" },
  { id: "neon_cyan", name: "Neon Turkuaz", color: "#00CED1", label: "", requiredWave: 61, unlockText: "60. Dalgayı Geçince Açılır", bonusText: "%40 Mermi Hızı" },
];

export const ENEMY_SKINS = [
  { id: "default", name: "Zombi", color: "#FF4444", label: "Varsayılan", requiredWave: 0, bonusText: "Sıradan bir zombi. Özel bir zayıflığı yok." },
  { id: "ghost", name: "Hayalet", color: "#AAAAAA", label: "", requiredWave: 0, bonusText: "Yarı saydam bir varlık. Görsel bir değişiklik sağlar." },
  { id: "slime", name: "Balçık", color: "#44FF44", label: "", requiredWave: 6, unlockText: "5. Dalgayı Geçince Açılır", bonusText: "Düşmanlar %5 daha yavaş hareket eder" },
  { id: "void", name: "Boşluk", color: "#222222", label: "", requiredWave: 11, unlockText: "10. Dalgayı Geçince Açılır", bonusText: "Düşman canı %5 azalır" },
  { id: "fire", name: "Ateş", color: "#FF8800", label: "", requiredWave: 16, unlockText: "15. Dalgayı Geçince Açılır", bonusText: "Düşman hasarı %5 azalır" },
  { id: "ice", name: "Buz", color: "#00CCFF", label: "", requiredWave: 21, unlockText: "20. Dalgayı Geçince Açılır", bonusText: "Düşmanlar %10 daha yavaş ateş eder" },
  { id: "toxic", name: "Zehir", color: "#88FF00", label: "", requiredWave: 31, unlockText: "30. Dalgayı Geçince Açılır", bonusText: "Düşmanlardan %10 daha fazla XP düşer" },
  { id: "plasma", name: "Plazma", color: "#FF00AA", label: "", requiredWave: 41, unlockText: "40. Dalgayı Geçince Açılır", bonusText: "Düşman hızı %10 azalır" },
  { id: "shadow", name: "Gölge", color: "#440044", label: "", requiredWave: 51, unlockText: "50. Dalgayı Geçince Açılır", bonusText: "Düşman canı %10 azalır" },
  { id: "cyber", name: "Siber", color: "#00FF88", label: "", requiredWave: 71, unlockText: "70. Dalgayı Geçince Açılır", bonusText: "Düşman hasarı %10 azalır" },
];

export const CROSSHAIRS = [
  { id: "dot", name: "Nokta", type: "dot" },
  { id: "plus", name: "Artı", type: "plus" },
  { id: "cross", name: "Çarpı", type: "cross" },
  { id: "circle", name: "Daire", type: "circle" },
  { id: "square", name: "Kare", type: "square" },
  { id: "diamond", name: "Elmas", type: "diamond" },
  { id: "large-dot", name: "Büyük Nokta", type: "large-dot" },
  { id: "cursor", name: "Fare İmleci", type: "cursor" },
  { id: "t-shape", name: "T-Şekli", type: "t-shape" },
  { id: "arrow", name: "Ok", type: "arrow" },
];

export const INITIAL_STATE: GameState = {
  player: { ...INITIAL_PLAYER },
  otherPlayers: {},
  isMultiplayer: false,
  enemies: [],
  bullets: [],
  goldCoins: [],
  floatingTexts: [],
  notifications: [],
  score: 0,
  isPaused: false,
  isGameOver: false,
  wave: 1,
  maxWaveReached: 1,
  waveTimer: 0,
  waveDuration: 30000, // 30 seconds for waves
  enemiesRemainingInWave: 5,
  totalEnemiesInWave: 5,
  isWaveTransitioning: false,
  waveTransitionTimer: 0,
  lastShotTime: 0,
  gameStarted: false,
  showSkinsMenu: false,
  showPauseMenu: false,
  showCrosshairsMenu: false,
  selectedPlayerSkin: "default",
  selectedEnemySkin: "default",
  selectedCrosshair: "dot",
  showPowerUpMenu: false,
  showOnlineMenu: false,
  showCreateRoomMenu: false,
  showJoinRoomMenu: false,
  showInRoomMenu: false,
  onlineRoom: null,
  socketId: null,
};

export const UPGRADE_OPTIONS = [
  {
    id: "damage",
    name: "Hasar Artışı",
    description: "Her seviye başına %20 artış.",
    icon: "Sword",
    multiplier: 0.20
  },
  {
    id: "speed",
    name: "Hız Artışı",
    description: "Her seviye başına %15 artış.",
    icon: "Zap",
    multiplier: 0.15
  },
  {
    id: "attackSpeed",
    name: "Saldırı Hızı",
    description: "Her seviye başına %15 artış.",
    icon: "Timer",
    multiplier: 0.15
  },
  {
    id: "regen",
    name: "Can Yenilenme",
    description: "Her seviye başına %20 artış.",
    icon: "Heart",
    multiplier: 0.20
  }
];
