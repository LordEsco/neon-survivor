import React, { useEffect, useRef, useState } from 'react';
import { GameState, Enemy, Bullet, GoldCoin, UpgradeOption, Crosshair, Player } from '../types';
import { INITIAL_STATE, UPGRADE_OPTIONS, INITIAL_PLAYER, INITIAL_PLAYER2, PLAYER_SKINS, ENEMY_SKINS, CROSSHAIRS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { Sword, Zap, Timer, Heart, Play, RotateCcw, Trophy, Coins, Shirt, X, ChevronRight, Lock, HelpCircle, Home, Target, Globe, Users, Shield, Copy, Check, Crown } from 'lucide-react';
import { getSocket, disconnectSocket } from '../services/socketService';

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [joystick, setJoystick] = useState<{ active: boolean, x: number, y: number, startX: number, startY: number }>({
    active: false,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0
  });
  const [activeSkinInfo, setActiveSkinInfo] = useState<any>(null);
  const requestRef = useRef<number>(null);
  const stateRef = useRef<GameState>(INITIAL_STATE);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mousePos = useRef({ x: 0, y: 0 });
  const isMouseDown = useRef(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomPasswordInput, setRoomPasswordInput] = useState('');
  const [createMaxPlayers, setCreateMaxPlayers] = useState(2);
  const [createPassword, setCreatePassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Socket setup
  useEffect(() => {
    const socket = getSocket();

    socket.on('connect', () => {
      setGameState(prev => ({ ...prev, socketId: socket.id || null }));
    });

    if (socket.connected) {
      setGameState(prev => ({ ...prev, socketId: socket.id || null }));
    }

    socket.on('room_created', ({ room }) => {
      setGameState(prev => ({
        ...prev,
        onlineRoom: room,
        showCreateRoomMenu: false,
        showInRoomMenu: true
      }));
    });

    socket.on('joined_room', ({ room }) => {
      setGameState(prev => ({
        ...prev,
        onlineRoom: room,
        showJoinRoomMenu: false,
        showInRoomMenu: true
      }));
    });

    socket.on('room_updated', ({ room }) => {
      setGameState(prev => ({
        ...prev,
        onlineRoom: room
      }));
    });

    socket.on('game_started', ({ room }) => {
      startGame(room);
    });

    socket.on('player_moved', (data) => {
      setGameState(prev => {
        if (!prev.gameStarted || data.socketId === prev.socketId) return prev;
        
        const otherPlayers = { ...prev.otherPlayers };
        if (otherPlayers[data.socketId]) {
          otherPlayers[data.socketId] = {
            ...otherPlayers[data.socketId],
            x: data.x,
            y: data.y
          };
        } else {
          // New player joined or moved for the first time
          otherPlayers[data.socketId] = {
            ...INITIAL_PLAYER2,
            id: data.socketId,
            x: data.x,
            y: data.y,
            color: data.color || INITIAL_PLAYER2.color
          };
        }
        
        return { ...prev, otherPlayers };
      });
    });

    socket.on('error', ({ message }) => {
      setErrorMessage(message);
      setTimeout(() => setErrorMessage(null), 3000);
    });

    return () => {
      socket.off('connect');
      socket.off('room_created');
      socket.off('joined_room');
      socket.off('room_updated');
      socket.off('error');
    };
  }, []);

  // Sync ref with state for the game loop
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  const handleResize = () => {
    if (containerRef.current && canvasRef.current) {
      canvasRef.current.width = containerRef.current.clientWidth;
      canvasRef.current.height = containerRef.current.clientHeight;
      
      // Center player on first resize
      if (stateRef.current.player.x === 0 && stateRef.current.player.y === 0) {
        const playerSkin = PLAYER_SKINS.find(s => s.id === stateRef.current.selectedPlayerSkin) || PLAYER_SKINS[0];
        setGameState(prev => ({
          ...prev,
          player: { ...prev.player, x: canvasRef.current!.width / 2, y: canvasRef.current!.height / 2 },
          otherPlayers: prev.isMultiplayer ? { 
            'local_p2': {
              ...INITIAL_PLAYER2, 
              id: 'local_p2',
              color: playerSkin.color,
              skinId: playerSkin.id,
              x: canvasRef.current!.width / 2 + 40, 
              y: canvasRef.current!.height / 2 
            }
          } : {}
        }));
      }
    }
  };

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
      keysPressed.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
      keysPressed.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const spawnEnemy = (canvas: HTMLCanvasElement, wave: number) => {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * canvas.width; y = -20; }
    else if (side === 1) { x = canvas.width + 20; y = Math.random() * canvas.height; }
    else if (side === 2) { x = Math.random() * canvas.width; y = canvas.height + 20; }
    else { x = -20; y = Math.random() * canvas.height; }

    const hp = 50 + (wave * 10);
    const enemySkin = ENEMY_SKINS.find(s => s.id === stateRef.current.selectedEnemySkin) || ENEMY_SKINS[0];
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      x, y,
      radius: 12,
      color: enemySkin.color,
      hp,
      maxHp: hp,
      speed: 1 + (Math.random() * 0.5) + (wave * 0.1),
      damage: 10 + (wave * 2),
      xpValue: 20 + (wave * 5),
      skinId: enemySkin.id
    };
  };

  const gameLoop = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;

    if (state.gameStarted && !state.isPaused && !state.isGameOver && !state.showPowerUpMenu && !state.showPauseMenu) {
      const newState = { ...state };

      // 1. Movement
      // Player 1
      let moveX1 = 0;
      let moveY1 = 0;
      if (keysPressed.current['w']) moveY1 -= 1;
      if (keysPressed.current['s']) moveY1 += 1;
      if (keysPressed.current['a']) moveX1 -= 1;
      if (keysPressed.current['d']) moveX1 += 1;

      if (moveX1 !== 0 || moveY1 !== 0) {
        const dist = Math.sqrt(moveX1 * moveX1 + moveY1 * moveY1);
        newState.player.x = Math.max(state.player.radius, Math.min(canvas.width - state.player.radius, state.player.x + (moveX1 / dist) * state.player.speed));
        newState.player.y = Math.max(state.player.radius, Math.min(canvas.height - state.player.radius, state.player.y + (moveY1 / dist) * state.player.speed));
      }

      // Local Player 2 (Split keyboard)
      if (state.isMultiplayer && !state.onlineRoom) {
        let moveX2 = 0;
        let moveY2 = 0;
        if (keysPressed.current['arrowup']) moveY2 -= 1;
        if (keysPressed.current['arrowdown']) moveY2 += 1;
        if (keysPressed.current['arrowleft']) moveX2 -= 1;
        if (keysPressed.current['arrowright']) moveX2 += 1;

        if (moveX2 !== 0 || moveY2 !== 0) {
          const otherPlayers = { ...newState.otherPlayers };
          const p2 = otherPlayers['local_p2'] || { ...INITIAL_PLAYER2, id: 'local_p2' };
          const dist = Math.sqrt(moveX2 * moveX2 + moveY2 * moveY2);
          p2.x = Math.max(p2.radius, Math.min(canvas.width - p2.radius, p2.x + (moveX2 / dist) * p2.speed));
          p2.y = Math.max(p2.radius, Math.min(canvas.height - p2.radius, p2.y + (moveY2 / dist) * p2.speed));
          otherPlayers['local_p2'] = p2;
          newState.otherPlayers = otherPlayers;
        }
      }

      // Sync movement to server if online
      if (state.onlineRoom && (moveX1 !== 0 || moveY1 !== 0 || joystick.active)) {
        const myPlayer = state.onlineRoom.players.find(p => p.id === state.socketId);
        if (myPlayer) {
          getSocket().emit('player_move', {
            roomCode: state.onlineRoom.roomCode,
            x: newState.player.x,
            y: newState.player.y,
            playerNumber: myPlayer.playerNumber
          });
        }
      }

      // Joystick Movement (P1)
      if (joystick.active) {
        const dx = joystick.x - joystick.startX;
        const dy = joystick.y - joystick.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          const jMoveX = (dx / dist) * state.player.speed;
          const jMoveY = (dy / dist) * state.player.speed;
          newState.player.x = Math.max(state.player.radius, Math.min(canvas.width - state.player.radius, state.player.x + jMoveX));
          newState.player.y = Math.max(state.player.radius, Math.min(canvas.height - state.player.radius, state.player.y + jMoveY));
        }
      }

      // 2. Shooting
      // Player 1
      if (time - state.player.lastShotTime > state.player.attackSpeed) {
        let targetX = -1;
        let targetY = -1;

        if (state.isMultiplayer) {
          // Auto-shoot nearest enemy in multiplayer
          let nearestEnemy: Enemy | null = null;
          let minDist = Infinity;
          state.enemies.forEach(e => {
            const dist = Math.sqrt((e.x - state.player.x)**2 + (e.y - state.player.y)**2);
            if (dist < minDist) {
              minDist = dist;
              nearestEnemy = e;
            }
          });
          if (nearestEnemy) {
            targetX = nearestEnemy.x;
            targetY = nearestEnemy.y;
          }
        } else if (isMouseDown.current) {
          // Manual shoot in single player
          targetX = mousePos.current.x;
          targetY = mousePos.current.y;
        }

        if (targetX !== -1) {
          const angle = Math.atan2(targetY - state.player.y, targetX - state.player.x);
          newState.bullets.push({
            id: Math.random().toString(36).substr(2, 9),
            x: state.player.x,
            y: state.player.y,
            radius: 4,
            color: state.player.color,
            vx: Math.cos(angle) * state.player.bulletSpeed,
            vy: Math.sin(angle) * state.player.bulletSpeed,
            damage: state.player.damage,
            life: 100
          });
          newState.player.lastShotTime = time;
        }
      }

      // Other Players (Auto-shoot nearest enemy in multiplayer)
      if (state.isMultiplayer) {
        (Object.values(state.otherPlayers) as Player[]).forEach(otherPlayer => {
          if (time - otherPlayer.lastShotTime > otherPlayer.attackSpeed) {
            let nearestEnemy: Enemy | null = null;
            let minDist = Infinity;

            state.enemies.forEach(e => {
              const dist = Math.sqrt((e.x - otherPlayer.x)**2 + (e.y - otherPlayer.y)**2);
              if (dist < minDist) {
                minDist = dist;
                nearestEnemy = e;
              }
            });

            if (nearestEnemy) {
              const angle = Math.atan2(nearestEnemy.y - otherPlayer.y, nearestEnemy.x - otherPlayer.x);
              newState.bullets.push({
                id: Math.random().toString(36).substr(2, 9),
                x: otherPlayer.x,
                y: otherPlayer.y,
                radius: 4,
                color: otherPlayer.color,
                vx: Math.cos(angle) * otherPlayer.bulletSpeed,
                vy: Math.sin(angle) * otherPlayer.bulletSpeed,
                damage: otherPlayer.damage,
                life: 100
              });
              newState.otherPlayers[otherPlayer.id].lastShotTime = time;
            }
          }
        });
      }

      // 3. Update Bullets
      newState.bullets = state.bullets.map(b => ({
        ...b,
        x: b.x + b.vx,
        y: b.y + b.vy,
        life: b.life - 1
      })).filter(b => b.life > 0 && b.x > 0 && b.x < canvas.width && b.y > 0 && b.y < canvas.height);

      // 4. Update Enemies
      newState.enemies = state.enemies.map(e => {
        // Target nearest player
        let targetPlayer = state.player;
        let minDist = Math.sqrt((state.player.x - e.x)**2 + (state.player.y - e.y)**2);

        (Object.values(state.otherPlayers) as Player[]).forEach(otherPlayer => {
          const dist = Math.sqrt((otherPlayer.x - e.x)**2 + (otherPlayer.y - e.y)**2);
          if (dist < minDist) {
            minDist = dist;
            targetPlayer = otherPlayer;
          }
        });

        const angle = Math.atan2(targetPlayer.y - e.y, targetPlayer.x - e.x);
        return {
          ...e,
          x: e.x + Math.cos(angle) * e.speed,
          y: e.y + Math.sin(angle) * e.speed
        };
      });

      // 5. Collisions
      // Bullet vs Enemy
      newState.bullets.forEach((b, bIdx) => {
        newState.enemies.forEach((e, eIdx) => {
          const dist = Math.sqrt((b.x - e.x)**2 + (b.y - e.y)**2);
          if (dist < b.radius + e.radius) {
            e.hp -= b.damage;
            b.life = 0; // Destroy bullet
          }
        });
      });

      // Handle Enemy Death
      const deadEnemies = newState.enemies.filter(e => e.hp <= 0);
      deadEnemies.forEach(e => {
        newState.goldCoins.push({
          id: Math.random().toString(36).substr(2, 9),
          x: e.x,
          y: e.y,
          radius: 6,
          color: '#FFD700', // Gold color
          value: 20 // Each coin gives 20 XP as requested
        });
        newState.score += 10;
      });
      newState.enemies = newState.enemies.filter(e => e.hp > 0);

      // Player vs Enemy
      newState.enemies.forEach(e => {
        const dist1 = Math.sqrt((e.x - state.player.x)**2 + (e.y - state.player.y)**2);
        if (dist1 < e.radius + state.player.radius) {
          newState.player.hp -= 0.5; // Continuous damage
        }
        
        Object.values(newState.otherPlayers).forEach((otherPlayer: any) => {
          const dist = Math.sqrt((e.x - otherPlayer.x)**2 + (e.y - otherPlayer.y)**2);
          if (dist < e.radius + otherPlayer.radius) {
            otherPlayer.hp -= 0.5;
          }
        });
      });

      // Player vs Gold Coins
      newState.goldCoins.forEach((coin, idx) => {
        // Magnet effect for all players
        let nearestPlayer = state.player;
        let minDist = Math.sqrt((coin.x - state.player.x)**2 + (coin.y - state.player.y)**2);
        
        (Object.values(state.otherPlayers) as Player[]).forEach(otherPlayer => {
          const dist = Math.sqrt((coin.x - otherPlayer.x)**2 + (coin.y - otherPlayer.y)**2);
          if (dist < minDist) {
            minDist = dist;
            nearestPlayer = otherPlayer;
          }
        });

        if (minDist < coin.radius + nearestPlayer.radius + 20) { // Magnet effect
          const angle = Math.atan2(nearestPlayer.y - coin.y, nearestPlayer.x - coin.x);
          coin.x += Math.cos(angle) * 5;
          coin.y += Math.sin(angle) * 5;
        }
        
        if (minDist < coin.radius + nearestPlayer.radius) {
          // Gain XP and check for upgrade points
          const xpGain = coin.value;
          const oldXp = newState.player.totalXp;
          newState.player.totalXp += xpGain;
          
          // Every 100 XP gives 1 upgrade point
          const oldPoints = Math.floor(oldXp / 100);
          const newPoints = Math.floor(newState.player.totalXp / 100);
          if (newPoints > oldPoints) {
            const pointsToAdd = newPoints - oldPoints;
            newState.player.upgradePoints += pointsToAdd;
            (Object.values(newState.otherPlayers) as Player[]).forEach(otherPlayer => {
              otherPlayer.upgradePoints += pointsToAdd;
            });
          }

          (Object.values(newState.otherPlayers) as Player[]).forEach(otherPlayer => {
            otherPlayer.totalXp = newState.player.totalXp;
          });
          
          // Add floating text
          newState.floatingTexts.push({
            id: Math.random().toString(36).substr(2, 9),
            x: coin.x,
            y: coin.y - 20,
            text: `+${xpGain} XP`,
            color: '#fbbf24', // yellow-400
            life: 60
          });

          coin.value = 0; // Mark for removal
        }
      });
      newState.goldCoins = newState.goldCoins.filter(o => o.value > 0);

      // Player Regeneration
      if (newState.player.hp < newState.player.maxHp) {
        newState.player.hp = Math.min(newState.player.maxHp, newState.player.hp + newState.player.regenRate);
      }
      // Other Players Regeneration
      (Object.values(newState.otherPlayers) as Player[]).forEach(otherPlayer => {
        if (otherPlayer.hp < otherPlayer.maxHp) {
          otherPlayer.hp = Math.min(otherPlayer.maxHp, otherPlayer.hp + otherPlayer.regenRate);
        }
      });

      // Update Floating Texts
      newState.floatingTexts = state.floatingTexts.map(t => ({
        ...t,
        y: t.y - 1,
        life: t.life - 1
      })).filter(t => t.life > 0);

      // Update Notifications
      newState.notifications = state.notifications.map(n => ({
        ...n,
        life: n.life - 1
      })).filter(n => n.life > 0);

      // Spawning
      if (!newState.isWaveTransitioning) {
        const maxEnemiesOnScreen = 5 + (newState.wave * 2); 
        const spawnChance = 0.02 + (newState.wave * 0.005); 
        
        if (newState.enemies.length < maxEnemiesOnScreen && newState.enemiesRemainingInWave > 0) {
          if (Math.random() < spawnChance) {
            newState.enemies.push(spawnEnemy(canvas, newState.wave));
            newState.enemiesRemainingInWave -= 1;
          }
        }

        // Wave progression (Enemy-count based)
        if (newState.enemiesRemainingInWave === 0 && newState.enemies.length === 0) {
          newState.isWaveTransitioning = true;
          newState.waveTransitionTimer = 180; // 3 seconds at 60fps
        }
      } else {
        // Handle transition
        newState.waveTransitionTimer -= 1;
        if (newState.waveTransitionTimer <= 0) {
          newState.isWaveTransitioning = false;
          newState.wave += 1;
          newState.maxWaveReached = Math.max(newState.maxWaveReached, newState.wave);
          
          // Calculate next wave enemy count: 40% increase
          newState.totalEnemiesInWave = Math.floor(newState.totalEnemiesInWave * 1.4);
          newState.enemiesRemainingInWave = newState.totalEnemiesInWave;
          
          // Check for skin unlocks
          PLAYER_SKINS.forEach(skin => {
            if (skin.requiredWave === newState.wave && skin.requiredWave > 0) {
              newState.notifications.push({
                id: Math.random().toString(36).substr(2, 9),
                title: "KOSTÜM AÇILDI!",
                message: skin.name,
                description: skin.bonusText,
                color: skin.color,
                icon: skin.id,
                life: 300 // 5 seconds
              });
            }
          });

          ENEMY_SKINS.forEach(skin => {
            if (skin.requiredWave === newState.wave && skin.requiredWave > 0) {
              newState.notifications.push({
                id: Math.random().toString(36).substr(2, 9),
                title: "KOSTÜM AÇILDI!",
                message: `Düşman: ${skin.name}`,
                description: skin.bonusText,
                color: skin.color,
                icon: skin.id,
                life: 300
              });
            }
          });
        }
      }

      // Game Over
      const anyPlayerDead = newState.player.hp <= 0 || (Object.values(newState.otherPlayers) as Player[]).some(p => p.hp <= 0);
      if (anyPlayerDead) {
        newState.isGameOver = true;
      }

      setGameState(newState);
    }

    // Rendering
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid background
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 40) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 40) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // Draw Gold Coins
    state.goldCoins.forEach(o => {
      const pulse = Math.sin(Date.now() / 200) * 2;
      ctx.fillStyle = o.color;
      ctx.shadowBlur = 15 + pulse;
      ctx.shadowColor = o.color;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius + pulse/2, 0, Math.PI * 2);
      ctx.fill();
      
      // Coin detail (inner circle)
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(o.x, o.y, (o.radius + pulse/2) * 0.7, 0, Math.PI * 2);
      ctx.stroke();

      // Shine effect
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(o.x - o.radius/3, o.y - o.radius/3, o.radius/4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Enemies
    state.enemies.forEach(e => {
      ctx.fillStyle = e.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Health bar
      const barWidth = e.radius * 2;
      ctx.fillStyle = '#333';
      ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, barWidth, 4);
      ctx.fillStyle = '#FF4444';
      ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, barWidth * (e.hp / e.maxHp), 4);
    });

    // Draw Bullets
    state.bullets.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Floating Texts
    state.floatingTexts.forEach(t => {
      ctx.fillStyle = t.color;
      ctx.font = `bold ${12 + t.life/10}px Inter`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = t.life / 60;
      ctx.fillText(t.text, t.x, t.y);
      ctx.globalAlpha = 1;
    });

    // Draw Player 1
    ctx.fillStyle = state.player.color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = state.player.color;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw other players
    (Object.values(state.otherPlayers) as Player[]).forEach(otherPlayer => {
      ctx.fillStyle = otherPlayer.color;
      ctx.shadowBlur = 20;
      ctx.shadowColor = otherPlayer.color;
      ctx.beginPath();
      ctx.arc(otherPlayer.x, otherPlayer.y, otherPlayer.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.font = '10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('Player', otherPlayer.x, otherPlayer.y - otherPlayer.radius - 10);
    });

    // Draw Crosshair
    if (state.gameStarted && !state.isPaused && !state.isGameOver && !state.showPowerUpMenu && !state.showPauseMenu) {
      const cx = mousePos.current.x;
      const cy = mousePos.current.y;
      const size = 10;
      const color = '#FFFFFF';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 5;
      ctx.shadowColor = color;

      switch (state.selectedCrosshair) {
        case 'dot':
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(cx, cy, 2, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'plus':
          ctx.beginPath();
          ctx.moveTo(cx - size, cy); ctx.lineTo(cx + size, cy);
          ctx.moveTo(cx, cy - size); ctx.lineTo(cx, cy + size);
          ctx.stroke();
          break;
        case 'cross':
          ctx.beginPath();
          ctx.moveTo(cx - size, cy - size); ctx.lineTo(cx + size, cy + size);
          ctx.moveTo(cx + size, cy - size); ctx.lineTo(cx - size, cy + size);
          ctx.stroke();
          break;
        case 'circle':
          ctx.beginPath();
          ctx.arc(cx, cy, size, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'square':
          ctx.strokeRect(cx - size, cy - size, size * 2, size * 2);
          break;
        case 'diamond':
          ctx.beginPath();
          ctx.moveTo(cx, cy - size);
          ctx.lineTo(cx + size, cy);
          ctx.lineTo(cx, cy + size);
          ctx.lineTo(cx - size, cy);
          ctx.closePath();
          ctx.stroke();
          break;
        case 'large-dot':
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(cx, cy, 5, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'cursor':
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx, cy + size * 1.8);
          ctx.lineTo(cx + size * 0.5, cy + size * 1.3);
          ctx.lineTo(cx + size * 0.9, cy + size * 2.1);
          ctx.lineTo(cx + size * 1.3, cy + size * 1.9);
          ctx.lineTo(cx + size * 0.9, cy + size * 1.1);
          ctx.lineTo(cx + size * 1.5, cy + size * 1.1);
          ctx.closePath();
          ctx.stroke();
          // No fill to match the outline style of other crosshairs
          break;
        case 't-shape':
          ctx.beginPath();
          ctx.moveTo(cx - size, cy); ctx.lineTo(cx + size, cy);
          ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + size);
          ctx.stroke();
          break;
        case 'arrow':
          ctx.beginPath();
          ctx.moveTo(cx - size, cy + size); ctx.lineTo(cx, cy); ctx.lineTo(cx + size, cy + size);
          ctx.stroke();
          break;
      }
    }

    // Reset shadow
    ctx.shadowBlur = 0;

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(requestRef.current!);
  }, []);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setJoystick({ active: true, x: clientX, y: clientY, startX: clientX, startY: clientY });
    isMouseDown.current = true;
    mousePos.current = { x: clientX, y: clientY };
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    if (joystick.active) {
      setJoystick(prev => ({ ...prev, x: clientX, y: clientY }));
    }
    mousePos.current = { x: clientX, y: clientY };
  };

  const handleTouchEnd = () => {
    setJoystick({ active: false, x: 0, y: 0, startX: 0, startY: 0 });
    isMouseDown.current = false;
  };

  const togglePowerUpMenu = () => {
    setGameState(prev => ({ ...prev, showPowerUpMenu: !prev.showPowerUpMenu }));
  };

  const applyUpgrade = (type: 'damage' | 'speed' | 'attackSpeed' | 'regen', playerIndex: number = 1) => {
    setGameState(prev => {
      let targetPlayer: Player | undefined;
      let targetId: string | undefined;

      if (playerIndex === 1) {
        targetPlayer = prev.player;
      } else {
        const otherPlayerIds = Object.keys(prev.otherPlayers);
        targetId = otherPlayerIds[playerIndex - 2];
        if (targetId) targetPlayer = prev.otherPlayers[targetId];
      }

      if (!targetPlayer || targetPlayer.upgradePoints < 1) return prev;
      
      const newLevels = { ...targetPlayer.upgradeLevels };
      newLevels[type] += 1;
      
      const newPlayer = { ...targetPlayer };
      newPlayer.upgradeLevels = newLevels;
      newPlayer.upgradePoints -= 1;
      
      // Apply effects
      const initial = playerIndex === 1 ? INITIAL_PLAYER : INITIAL_PLAYER2;
      newPlayer.damage = initial.damage * (1 + 0.20 * newLevels.damage);
      newPlayer.speed = initial.speed * (1 + 0.15 * newLevels.speed);
      // attackSpeed is delay, so it should decrease to shoot faster
      newPlayer.attackSpeed = initial.attackSpeed / (1 + 0.15 * newLevels.attackSpeed);
      newPlayer.regenRate = initial.regenRate * (1 + 0.20 * newLevels.regen);
      
      if (playerIndex === 1) {
        return { ...prev, player: newPlayer };
      } else if (targetId) {
        return { 
          ...prev, 
          otherPlayers: {
            ...prev.otherPlayers,
            [targetId]: newPlayer
          }
        };
      }
      return prev;
    });
  };

  const restartGame = () => {
    const playerSkin = PLAYER_SKINS.find(s => s.id === stateRef.current.selectedPlayerSkin) || PLAYER_SKINS[0];
    const isMulti = stateRef.current.isMultiplayer;
    
    setGameState({
      ...INITIAL_STATE,
      gameStarted: true,
      isMultiplayer: isMulti,
      maxWaveReached: stateRef.current.maxWaveReached,
      selectedPlayerSkin: stateRef.current.selectedPlayerSkin,
      selectedEnemySkin: stateRef.current.selectedEnemySkin,
      selectedCrosshair: stateRef.current.selectedCrosshair,
      player: { 
        ...INITIAL_PLAYER, 
        color: playerSkin.color,
        skinId: playerSkin.id,
        x: canvasRef.current!.width / 2, 
        y: canvasRef.current!.height / 2 
      },
      otherPlayers: isMulti ? {
        'local_p2': {
          ...INITIAL_PLAYER2,
          id: 'local_p2',
          color: playerSkin.color,
          skinId: playerSkin.id,
          x: canvasRef.current!.width / 2 + 40,
          y: canvasRef.current!.height / 2
        }
      } : {},
      enemies: [],
      enemiesRemainingInWave: 5,
      totalEnemiesInWave: 5,
      isWaveTransitioning: false,
      waveTransitionTimer: 0,
      wave: 1
    });
  };

  const startGame = (roomData?: any) => {
    const playerSkin = PLAYER_SKINS.find(s => s.id === stateRef.current.selectedPlayerSkin) || PLAYER_SKINS[0];
    const isMulti = roomData ? roomData.players.length > 1 : stateRef.current.isMultiplayer;
    
    // Initialize other players if in a room
    const otherPlayers: { [socketId: string]: Player } = {};
    if (roomData) {
      roomData.players.forEach((p: any) => {
        if (p.id !== stateRef.current.socketId) {
          otherPlayers[p.id] = {
            ...INITIAL_PLAYER2,
            id: p.id,
            x: canvasRef.current!.width / 2 + (p.playerNumber - 1) * 40,
            y: canvasRef.current!.height / 2,
            color: INITIAL_PLAYER2.color // We can sync colors later
          };
        }
      });
    }

    setGameState(prev => ({
      ...prev,
      gameStarted: true,
      isMultiplayer: isMulti,
      showInRoomMenu: false,
      onlineRoom: roomData || prev.onlineRoom,
      otherPlayers: otherPlayers,
      player: {
        ...prev.player,
        color: playerSkin.color,
        skinId: playerSkin.id,
        x: canvasRef.current!.width / 2,
        y: canvasRef.current!.height / 2
      },
      enemies: [],
      enemiesRemainingInWave: 5,
      totalEnemiesInWave: 5,
      isWaveTransitioning: false,
      waveTransitionTimer: 0,
      wave: 1
    }));
  };

  const goToMenu = () => {
    setGameState({
      ...INITIAL_STATE,
      gameStarted: false,
      maxWaveReached: stateRef.current.maxWaveReached,
      selectedPlayerSkin: stateRef.current.selectedPlayerSkin,
      selectedEnemySkin: stateRef.current.selectedEnemySkin,
      selectedCrosshair: stateRef.current.selectedCrosshair,
    });
  };

  const toggleSkinsMenu = () => {
    setGameState(prev => ({ ...prev, showSkinsMenu: !prev.showSkinsMenu }));
  };

  const togglePauseMenu = () => {
    setGameState(prev => ({ ...prev, showPauseMenu: !prev.showPauseMenu }));
  };

  const toggleCrosshairsMenu = () => {
    setGameState(prev => ({ ...prev, showCrosshairsMenu: !prev.showCrosshairsMenu }));
  };

  const handleCreateRoom = () => {
    if (usePassword && createPassword.length < 4) {
      setErrorMessage('Şifre en az 4 karakter olmalıdır.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    getSocket().emit('create_room', {
      maxPlayers: createMaxPlayers,
      password: usePassword ? createPassword : undefined
    });
  };

  const handleJoinRoom = () => {
    if (!roomCodeInput) {
      setErrorMessage('Oda kodu gereklidir.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    getSocket().emit('join_room', {
      roomCode: roomCodeInput,
      password: roomPasswordInput || undefined
    });
  };

  const handleToggleRoomStatus = () => {
    if (gameState.onlineRoom) {
      getSocket().emit('toggle_room_status', { roomCode: gameState.onlineRoom.roomCode });
    }
  };

  const handleStartGame = () => {
    if (gameState.onlineRoom) {
      getSocket().emit('start_game', { roomCode: gameState.onlineRoom.roomCode });
    }
  };

  const copyRoomCode = () => {
    if (gameState.onlineRoom) {
      navigator.clipboard.writeText(gameState.onlineRoom.roomCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const selectPlayerSkin = (id: string) => {
    const skin = PLAYER_SKINS.find(s => s.id === id);
    if (skin && (skin.requiredWave === 0 || stateRef.current.maxWaveReached >= skin.requiredWave)) {
      setGameState(prev => {
        const otherPlayers = { ...prev.otherPlayers };
        Object.keys(otherPlayers).forEach(key => {
          otherPlayers[key] = { ...otherPlayers[key], color: skin.color, skinId: id };
        });
        return {
          ...prev,
          selectedPlayerSkin: id,
          player: { ...prev.player, color: skin.color, skinId: id },
          otherPlayers
        };
      });
    }
  };

  const selectEnemySkin = (id: string) => {
    const skin = ENEMY_SKINS.find(s => s.id === id);
    if (skin && (skin.requiredWave === 0 || stateRef.current.maxWaveReached >= skin.requiredWave)) {
      setGameState(prev => ({
        ...prev,
        selectedEnemySkin: id
      }));
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sword': return <Sword className="w-6 h-6" />;
      case 'Zap': return <Zap className="w-6 h-6" />;
      case 'Timer': return <Timer className="w-6 h-6" />;
      case 'Heart': return <Heart className="w-6 h-6" />;
      default: return null;
    }
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full h-screen bg-[#050505] overflow-hidden touch-none select-none ${
        gameState.gameStarted && !gameState.isPaused && !gameState.isGameOver && !gameState.showPowerUpMenu && !gameState.showPauseMenu && !gameState.showSkinsMenu && !gameState.showCrosshairsMenu
          ? 'cursor-none' 
          : 'cursor-default'
      }`}
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Wave Transition Overlay */}
      <AnimatePresence>
        {gameState.isWaveTransitioning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute top-32 left-1/2 -translate-x-1/2 z-[300] pointer-events-none"
          >
            <h2 className="text-7xl md:text-8xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-[0_0_60px_rgba(255,255,255,0.7)]">
              DALGA {gameState.wave + 1}
            </h2>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Text */}
      <div className="absolute bottom-4 left-4 text-white/40 text-xs font-mono z-[150] pointer-events-none bg-black/20 px-2 py-1 rounded">
        TeslaT
      </div>

      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-white font-mono text-sm">{gameState.score}</span>
          </div>
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full">
            <Zap className="w-4 h-4 text-blue-400" />
            <span className="text-white font-mono text-sm">Dalga {gameState.wave}</span>
            <span className="text-white/40 font-mono text-[10px] ml-1">
              Kalan: {gameState.enemiesRemainingInWave + gameState.enemies.length}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button 
            onClick={togglePauseMenu}
            className="p-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-white/10 transition-colors pointer-events-auto"
          >
            <Home className="w-5 h-5" />
          </button>
          
          <div className="flex flex-col items-end gap-3 w-48">
            <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                className="h-full bg-green-500"
                initial={{ width: '100%' }}
                animate={{ width: `${(gameState.player.hp / gameState.player.maxHp) * 100}%` }}
              />
            </div>
            
            {/* Power-up Menu Button */}
            <button
              onClick={togglePowerUpMenu}
              className="w-24 h-24 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex flex-col items-center justify-center gap-2 text-white hover:bg-white/20 transition-all pointer-events-auto group"
            >
              <Zap className={`w-6 h-6 ${(gameState.player.upgradePoints > 0 || (Object.values(gameState.otherPlayers) as Player[]).some(p => p.upgradePoints > 0)) ? 'text-yellow-400 animate-pulse' : 'text-white/40'}`} />
              <span className="text-[10px] font-black uppercase tracking-tighter text-center leading-tight">Güçlendirme<br/>Menüsü</span>
              {(gameState.player.upgradePoints > 0 || (Object.values(gameState.otherPlayers) as Player[]).some(p => p.upgradePoints > 0)) && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-lg">
                  {gameState.player.upgradePoints + (Object.values(gameState.otherPlayers) as Player[]).reduce((sum, p) => sum + p.upgradePoints, 0)}
                </div>
              )}
            </button>

            <div className="flex flex-col items-end">
              <span className="text-white/50 font-mono text-[10px] uppercase tracking-widest">XP: {gameState.player.totalXp}</span>
              {Object.values(gameState.otherPlayers).length > 0 ? (
                <div className="flex flex-col items-end">
                  <span className="text-green-400 font-mono text-[9px] uppercase tracking-widest">Sen: {gameState.player.upgradePoints}</span>
                  {(Object.values(gameState.otherPlayers) as Player[]).map((p, idx) => (
                    <span key={p.id} className="text-pink-400 font-mono text-[9px] uppercase tracking-widest">P{idx+2}: {p.upgradePoints}</span>
                  ))}
                </div>
              ) : (
                <span className="text-yellow-400 font-mono text-[10px] uppercase tracking-widest">Hak: {gameState.player.upgradePoints}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[200] pointer-events-none">
        <AnimatePresence>
          {gameState.notifications.map(notif => (
            <motion.div
              key={notif.id}
              initial={{ y: -50, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.8 }}
              className="bg-black/80 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-2xl flex items-center gap-4 shadow-2xl min-w-[320px]"
            >
              <div 
                className="w-12 h-12 rounded-full shadow-lg flex-shrink-0" 
                style={{ 
                  backgroundColor: notif.color, 
                  boxShadow: `0 0 20px ${notif.color}88` 
                }} 
              />
              <div>
                <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{notif.title}</div>
                <div className="text-white font-bold text-lg italic uppercase tracking-tight leading-tight">{notif.message}</div>
                {notif.description && (
                  <div className="text-white/60 text-[10px] mt-1 font-medium">{notif.description}</div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Main Menu */}
      <AnimatePresence>
        {!gameState.gameStarted && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100]"
          >
            <div className="text-center flex flex-col items-center gap-8">
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none">
                  NEON<br/><span className="text-green-400">SURVIVOR</span>
                </h1>
                <p className="text-white/40 mt-4 max-w-xs mx-auto text-sm">
                  Düşmanları yen, XP topla ve karakterini geliştir.
                </p>
              </motion.div>

              <div className="flex items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setGameState(prev => ({ ...prev, isMultiplayer: false }))}
                  className={`px-6 py-3 rounded-full font-bold uppercase tracking-widest border transition-all ${
                    !gameState.isMultiplayer 
                      ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-105' 
                      : 'bg-black/40 text-white/40 border-white/10'
                  }`}
                >
                  Tek Oyunculu
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={startGame}
                  className="bg-white text-black px-12 py-5 rounded-full font-black uppercase tracking-[0.2em] text-xl shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:bg-green-400 transition-colors"
                >
                  BAŞLA
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setGameState(prev => ({ ...prev, isMultiplayer: true }))}
                  className={`px-6 py-3 rounded-full font-bold uppercase tracking-widest border transition-all ${
                    gameState.isMultiplayer 
                      ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-105' 
                      : 'bg-black/40 text-white/40 border-white/10'
                  }`}
                >
                  Çok Oyunculu
                </motion.button>
              </div>

              <div className="flex flex-col gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleSkinsMenu}
                  className="flex items-center justify-center gap-2 bg-white/10 text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest border border-white/20 hover:bg-white/20 transition-colors w-48"
                >
                  <Shirt className="w-5 h-5" />
                  Kostümler
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleCrosshairsMenu}
                  className="flex items-center justify-center gap-2 bg-white/10 text-white px-6 py-3 rounded-full font-bold uppercase tracking-widest border border-white/20 hover:bg-white/20 transition-colors w-48"
                >
                  <Target className="w-5 h-5" />
                  Nişangahlar
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setGameState(prev => ({ ...prev, showOnlineMenu: true }))}
                  className="flex items-center justify-center gap-2 bg-blue-500/20 text-blue-400 px-6 py-3 rounded-full font-bold uppercase tracking-widest border border-blue-500/30 hover:bg-blue-500/30 transition-colors w-48"
                >
                  <Globe className="w-5 h-5" />
                  Online
                </motion.button>

                <div className="flex flex-col gap-3 text-white/30 text-[10px] uppercase tracking-widest font-bold w-48 mt-4">
                  <div className="flex items-center gap-2 w-full">
                    <div className="flex-1 h-[1px] bg-white/10"></div>
                    <span className="shrink-0 text-white/40">KONTROLLER</span>
                    <div className="flex-1 h-[1px] bg-white/10"></div>
                  </div>
                  
                  <div className={`flex justify-center text-center transition-all duration-500 ${gameState.isMultiplayer ? 'gap-4' : 'gap-0'}`}>
                    <div className={`transition-all duration-500 ${gameState.isMultiplayer ? 'w-1/2' : 'w-full'}`}>
                      <p className="text-white/50 mb-1 text-[9px]">PLAYER 1</p>
                      <div className="space-y-0.5 text-white/40">
                        <p className="leading-tight">WASD</p>
                        <p className="leading-tight">{gameState.isMultiplayer ? 'OTOMATİK' : 'TIKLA'}</p>
                      </div>
                    </div>
                    
                    <div className={`transition-all duration-500 overflow-hidden ${gameState.isMultiplayer ? 'opacity-100 w-1/2 translate-x-0' : 'opacity-0 w-0 translate-x-4'}`}>
                      <p className="text-white/50 mb-1 text-[9px]">PLAYER 2</p>
                      <div className="space-y-0.5 text-white/40">
                        <p className="leading-tight whitespace-nowrap">OKLAR</p>
                        <p className="leading-tight whitespace-nowrap">OTOMATİK</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Online Menu */}
      <AnimatePresence>
        {gameState.showOnlineMenu && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[110]"
          >
            <div className="bg-zinc-900 border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Online</h2>
                <button 
                  onClick={() => setGameState(prev => ({ ...prev, showOnlineMenu: false }))}
                  className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => setGameState(prev => ({ ...prev, showOnlineMenu: false, showJoinRoomMenu: true }))}
                  className="group flex items-center gap-4 p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
                >
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-bold text-white uppercase tracking-wider">Odaya Katıl</div>
                    <div className="text-xs text-white/40">Mevcut bir odaya kod ile giriş yap.</div>
                  </div>
                </button>

                <button
                  onClick={() => setGameState(prev => ({ ...prev, showOnlineMenu: false, showCreateRoomMenu: true }))}
                  className="group flex items-center gap-4 p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
                >
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Globe className="w-6 h-6 text-green-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-bold text-white uppercase tracking-wider">Oda Kur</div>
                    <div className="text-xs text-white/40">Yeni bir oda oluştur ve arkadaşlarını davet et.</div>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Room Menu */}
      <AnimatePresence>
        {gameState.showCreateRoomMenu && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[120]"
          >
            <div className="bg-zinc-900 border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Oda Kur</h2>
                <button 
                  onClick={() => setGameState(prev => ({ ...prev, showCreateRoomMenu: false, showOnlineMenu: true }))}
                  className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Kişi Sayısı</label>
                  <select 
                    value={createMaxPlayers}
                    onChange={(e) => setCreateMaxPlayers(parseInt(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    {[2, 3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n} className="bg-zinc-900">{n} Oyuncu</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <Shield className={`w-5 h-5 ${usePassword ? 'text-yellow-400' : 'text-white/20'}`} />
                    <span className="text-sm font-bold text-white uppercase tracking-wider">Şifreli Oda</span>
                  </div>
                  <button 
                    onClick={() => setUsePassword(!usePassword)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${usePassword ? 'bg-blue-500' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${usePassword ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {usePassword && (
                    <motion.div
                      key="password-input-field"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ 
                        height: { duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] },
                        opacity: { duration: 0.25, ease: "linear" }
                      }}
                      className="overflow-hidden"
                    >
                      <div className="pt-2 pb-4">
                        <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Şifre (Min 4 Karakter)</label>
                        <input 
                          type="password"
                          value={createPassword}
                          onChange={(e) => setCreatePassword(e.target.value)}
                          placeholder="****"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={handleCreateRoom}
                  disabled={usePassword && createPassword.length < 4}
                  className={`w-full py-4 rounded-xl font-black uppercase tracking-[0.2em] transition-all ${
                    usePassword && createPassword.length < 4
                      ? 'bg-white/5 text-white/20 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-green-400 shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                  }`}
                >
                  Oluştur
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join Room Menu */}
      <AnimatePresence>
        {gameState.showJoinRoomMenu && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[120]"
          >
            <div className="bg-zinc-900 border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Odaya Katıl</h2>
                <button 
                  onClick={() => setGameState(prev => ({ ...prev, showJoinRoomMenu: false, showOnlineMenu: true }))}
                  className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Oda Kodu</label>
                  <input 
                    type="text"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="A7K2P9"
                    maxLength={6}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl font-black tracking-[0.5em] focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Şifre (Varsa)</label>
                  <input 
                    type="password"
                    value={roomPasswordInput}
                    onChange={(e) => setRoomPasswordInput(e.target.value)}
                    placeholder="****"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <button
                  onClick={handleJoinRoom}
                  className="w-full py-4 bg-white text-black rounded-xl font-black uppercase tracking-[0.2em] hover:bg-blue-400 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                >
                  Katıl
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In Room Menu */}
      <AnimatePresence>
        {gameState.showInRoomMenu && gameState.onlineRoom && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/95 backdrop-blur-2xl z-[130] flex flex-col"
          >
            {/* Header */}
            <div className="p-8 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">Oda Bekleme Salonu</h2>
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">Oyunun başlaması bekleniyor...</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  disconnectSocket();
                  setGameState(prev => ({ ...prev, showInRoomMenu: false, onlineRoom: null }));
                }}
                className="flex items-center gap-2 px-6 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full font-bold uppercase tracking-widest hover:bg-red-500/20 transition-colors"
              >
                <X className="w-5 h-5" />
                Ayrıl
              </button>
            </div>

            <div className="flex-1 flex p-8 gap-8">
              {/* Left Panel: Stats & Status */}
              <div className="w-1/3 space-y-6">
                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Kişi Sayısı</span>
                    <span className="text-xl font-black text-white italic">{gameState.onlineRoom.players.length} / {gameState.onlineRoom.maxPlayers}</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${(gameState.onlineRoom.players.length / gameState.onlineRoom.maxPlayers) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">Oda Durumu</label>
                  <button
                    onClick={handleToggleRoomStatus}
                    disabled={gameState.onlineRoom.players.find(p => p.id === gameState.socketId)?.role !== 'host'}
                    className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between group ${
                      gameState.onlineRoom.isLocked 
                        ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                        : 'bg-green-500/10 border-green-500/20 text-green-400'
                    } ${gameState.onlineRoom.players.find(p => p.id === gameState.socketId)?.role === 'host' ? 'hover:scale-[1.02]' : 'cursor-not-allowed opacity-60'}`}
                  >
                    <div className="flex items-center gap-3">
                      {gameState.onlineRoom.isLocked ? <Lock className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      <span className="font-bold uppercase tracking-widest">{gameState.onlineRoom.isLocked ? 'Kapalı' : 'Açık'}</span>
                    </div>
                    {gameState.onlineRoom.players.find(p => p.id === gameState.socketId)?.role === 'host' && (
                      <ChevronRight className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                  <p className="text-[9px] text-white/30 mt-3 text-center uppercase tracking-wider">
                    {gameState.onlineRoom.isLocked ? 'Yeni oyuncu girişine kapalı' : 'Yeni oyuncular katılabilir'}
                  </p>
                </div>

                {/* Start Button */}
                {gameState.onlineRoom.players.find(p => p.id === gameState.socketId)?.role === 'host' && (
                  <button
                    onClick={handleStartGame}
                    className="w-full p-6 bg-green-500 hover:bg-green-400 text-white rounded-3xl font-black uppercase italic tracking-tighter text-2xl shadow-[0_0_30px_rgba(34,197,94,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    <Play className="w-8 h-8 fill-current" />
                    BAŞLAT
                  </button>
                )}
              </div>

              {/* Right Panel: Players */}
              <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl p-8 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Oyuncular</h3>
                  <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold text-white/60 uppercase tracking-widest">
                    {gameState.onlineRoom.players.length} Bağlı
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {gameState.onlineRoom.players.map((player) => (
                    <motion.div
                      key={player.id}
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className={`flex items-center justify-between p-4 rounded-2xl border ${
                        player.id === gameState.socketId 
                          ? 'bg-blue-500/20 border-blue-500/30' 
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                          player.role === 'host' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-white/10 text-white/40'
                        }`}>
                          {player.playerNumber}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white uppercase tracking-wider">Player {player.playerNumber}</span>
                            {player.role === 'host' && <Crown className="w-4 h-4 text-yellow-500" />}
                            {player.id === gameState.socketId && <span className="text-[9px] bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase font-bold">Sen</span>}
                          </div>
                          <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">{player.role === 'host' ? 'Oda Sahibi' : 'Oyuncu'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Hazır</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Bar: Room Code */}
            <div className="p-8 bg-black/40 border-t border-white/5 flex items-center justify-center">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-1">Oda Kodu</div>
                  <div className="text-4xl font-black text-white tracking-[0.2em] italic">{gameState.onlineRoom.roomCode}</div>
                </div>
                <button
                  onClick={copyRoomCode}
                  className={`group flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all ${
                    copySuccess 
                      ? 'bg-green-500 text-white' 
                      : 'bg-white text-black hover:bg-blue-400'
                  }`}
                >
                  {copySuccess ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6 group-hover:scale-110 transition-transform" />}
                  {copySuccess ? 'Kopyalandı' : 'Kodu Kopyala'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message Toast */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-red-500 text-white px-8 py-4 rounded-2xl font-bold uppercase tracking-widest shadow-2xl flex items-center gap-3"
          >
            <X className="w-5 h-5" />
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>


      {/* Crosshairs Menu */}
      <AnimatePresence>
        {gameState.showCrosshairsMenu && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 bg-black/95 z-[160] overflow-y-auto"
          >
            <div className="p-8 max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-12">
                <div>
                  <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">NİŞANGAHLAR</h2>
                  <p className="text-white/40 text-sm uppercase tracking-widest mt-1">Oyun içi nişangahını özelleştir</p>
                </div>
                <button 
                  onClick={toggleCrosshairsMenu}
                  className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {CROSSHAIRS.map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => setGameState(prev => ({ ...prev, selectedCrosshair: ch.id }))}
                    className={`relative p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${
                      gameState.selectedCrosshair === ch.id 
                        ? 'border-green-400 bg-green-400/10' 
                        : 'border-white/10 bg-white/5 hover:border-white/30'
                    }`}
                  >
                    <div className="w-12 h-12 flex items-center justify-center relative">
                      {/* Crosshair Preview */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        {ch.type === 'dot' && <div className="w-1 h-1 bg-white rounded-full" />}
                        {ch.type === 'plus' && (
                          <>
                            <div className="absolute w-4 h-0.5 bg-white" />
                            <div className="absolute h-4 w-0.5 bg-white" />
                          </>
                        )}
                        {ch.type === 'cross' && (
                          <>
                            <div className="absolute w-4 h-0.5 bg-white rotate-45" />
                            <div className="absolute w-4 h-0.5 bg-white -rotate-45" />
                          </>
                        )}
                        {ch.type === 'circle' && <div className="w-4 h-4 border-2 border-white rounded-full" />}
                        {ch.type === 'square' && <div className="w-4 h-4 border-2 border-white" />}
                        {ch.type === 'diamond' && <div className="w-4 h-4 border-2 border-white rotate-45" />}
                        {ch.type === 'large-dot' && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                        {ch.type === 'cursor' && (
                          <div className="w-5 h-5 relative">
                            <svg viewBox="0 0 24 24" className="w-full h-full fill-none stroke-white stroke-2">
                              <path d="M4 4l0 15 4-4 3 7 2-1-3-7 5 0z" />
                            </svg>
                          </div>
                        )}
                        {ch.type === 't-shape' && (
                          <>
                            <div className="absolute w-4 h-0.5 bg-white" />
                            <div className="absolute h-2 w-0.5 bg-white translate-y-1" />
                          </>
                        )}
                        {ch.type === 'arrow' && (
                          <div className="w-3 h-3 border-l-2 border-t-2 border-white rotate-45 translate-y-1" />
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-white uppercase tracking-widest">{ch.name}</div>
                    {gameState.selectedCrosshair === ch.id && (
                      <div className="absolute -top-2 -right-2 bg-green-400 text-black p-1 rounded-full">
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skins Menu */}
      <AnimatePresence>
        {gameState.showSkinsMenu && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 bg-black z-[110] overflow-y-auto p-6"
          >
            <div className="max-w-2xl mx-auto">
              <div className="flex justify-between items-center mb-12">
                <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">KOSTÜMLER</h2>
                <button onClick={toggleSkinsMenu} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-12">
                {/* Player Skins */}
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-1 h-6 bg-green-400" />
                    <h3 className="text-xl font-bold text-white uppercase tracking-widest">NEON KOSTÜMLERİ</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {PLAYER_SKINS.map(skin => {
                      const isLocked = skin.requiredWave > gameState.maxWaveReached;
                      return (
                        <div
                          key={skin.id}
                          onClick={() => !isLocked && selectPlayerSkin(skin.id)}
                          className={`relative p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                            gameState.selectedPlayerSkin === skin.id 
                              ? 'border-green-400 bg-green-400/10 cursor-pointer' 
                              : isLocked
                                ? 'border-white/5 bg-black/40 opacity-60'
                                : 'border-white/10 bg-white/5 hover:border-white/30 cursor-pointer'
                          }`}
                        >
                          {/* Info Button - Top Left */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSkinInfo(skin);
                            }}
                            className="absolute -top-2 -left-2 w-6 h-6 bg-blue-900 rounded-full flex items-center justify-center text-white border border-white/20 hover:bg-blue-800 transition-colors z-30 cursor-pointer pointer-events-auto shadow-lg"
                          >
                            <HelpCircle className="w-4 h-4" />
                          </button>

                          <div 
                            className="w-10 h-10 rounded-full shadow-lg relative flex items-center justify-center" 
                            style={{ backgroundColor: skin.color, boxShadow: isLocked ? 'none' : `0 0 15px ${skin.color}88` }} 
                          >
                            {isLocked && (
                              <div className="flex flex-col items-center justify-center text-white/80">
                                <Lock className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="text-center">
                            <div className="text-[10px] font-bold text-white uppercase">{skin.name}</div>
                            {isLocked ? (
                              <div className="text-[8px] text-red-500 font-black uppercase mt-1">KİLİTLİ (DALGA {skin.requiredWave})</div>
                            ) : (
                              skin.label && <div className="text-[8px] text-white/40 uppercase mt-1">{skin.label}</div>
                            )}
                          </div>
                          {gameState.selectedPlayerSkin === skin.id && (
                            <div className="absolute -top-2 -right-2 bg-green-400 text-black p-1 rounded-full">
                              <ChevronRight className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Enemy Skins */}
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-1 h-6 bg-red-500" />
                    <h3 className="text-xl font-bold text-white uppercase tracking-widest">DÜŞMAN KOSTÜMLERİ</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {ENEMY_SKINS.map(skin => {
                      const isLocked = skin.requiredWave > gameState.maxWaveReached;
                      return (
                        <div
                          key={skin.id}
                          onClick={() => !isLocked && selectEnemySkin(skin.id)}
                          className={`relative p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                            gameState.selectedEnemySkin === skin.id 
                              ? 'border-red-500 bg-red-500/10 cursor-pointer' 
                              : isLocked
                                ? 'border-white/5 bg-black/40 opacity-60'
                                : 'border-white/10 bg-white/5 hover:border-white/30 cursor-pointer'
                          }`}
                        >
                          {/* Info Button - Top Left */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSkinInfo(skin);
                            }}
                            className="absolute -top-2 -left-2 w-6 h-6 bg-blue-900 rounded-full flex items-center justify-center text-white border border-white/20 hover:bg-blue-800 transition-colors z-30 cursor-pointer pointer-events-auto shadow-lg"
                          >
                            <HelpCircle className="w-4 h-4" />
                          </button>

                          <div 
                            className="w-10 h-10 rounded-full shadow-lg relative flex items-center justify-center" 
                            style={{ backgroundColor: skin.color, boxShadow: isLocked ? 'none' : `0 0 15px ${skin.color}88` }} 
                          >
                            {isLocked && (
                              <div className="flex flex-col items-center justify-center text-white/80">
                                <Lock className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="text-center">
                            <div className="text-[10px] font-bold text-white uppercase">{skin.name}</div>
                            {isLocked ? (
                              <div className="text-[8px] text-red-500 font-black uppercase mt-1">KİLİTLİ (DALGA {skin.requiredWave})</div>
                            ) : (
                              skin.label && <div className="text-[8px] text-white/40 uppercase mt-1">{skin.label}</div>
                            )}
                          </div>
                          {gameState.selectedEnemySkin === skin.id && (
                            <div className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full">
                              <ChevronRight className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skin Info Popup */}
      <AnimatePresence>
        {activeSkinInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-6"
            onClick={() => setActiveSkinInfo(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#0a0a0a] border border-white/10 p-8 rounded-3xl max-w-xs w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div 
                  className="w-16 h-16 rounded-full" 
                  style={{ backgroundColor: activeSkinInfo.color, boxShadow: `0 0 30px ${activeSkinInfo.color}88` }} 
                />
                <h3 className="text-2xl font-black text-white uppercase italic">{activeSkinInfo.name}</h3>
                
                <div className="w-full h-[1px] bg-white/10 my-2" />
                
                <p className="text-white/80 text-sm font-medium">
                  {activeSkinInfo.requiredWave > gameState.maxWaveReached 
                    ? (activeSkinInfo.unlockText || "Bu kostüm kilitli.") 
                    : "Bu kostümün kilidi açıldı!"}
                </p>

                {activeSkinInfo.bonusText && (
                  <div className="w-full mt-4 text-left">
                    <h4 className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Takviyeler</h4>
                    <p className="text-white/50 text-xs leading-relaxed">
                      {activeSkinInfo.bonusText}
                    </p>
                  </div>
                )}

                <button 
                  onClick={() => setActiveSkinInfo(null)}
                  className="mt-6 w-full bg-white text-black py-3 rounded-full font-bold uppercase text-xs hover:bg-gray-200 transition-colors"
                >
                  Anladım
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause Menu */}
      <AnimatePresence>
        {gameState.showPauseMenu && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200]"
          >
            <div className="text-center flex flex-col items-center gap-6 p-8 bg-white/5 border border-white/10 rounded-[2rem] max-w-xs w-full">
              <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-4">OYUN DURDURULDU</h2>
              
              <div className="flex flex-col gap-4 w-full">
                <button 
                  onClick={togglePauseMenu}
                  className="w-full bg-white text-black py-4 rounded-full font-black uppercase tracking-widest hover:bg-green-400 transition-colors"
                >
                  Oyuna Devam Et
                </button>

                <button 
                  onClick={() => {
                    togglePauseMenu();
                    restartGame();
                  }}
                  className="w-full bg-white/10 text-white border border-white/20 py-4 rounded-full font-black uppercase tracking-widest hover:bg-white/20 transition-colors"
                >
                  Yeniden Başla
                </button>

                <button 
                  onClick={() => {
                    togglePauseMenu();
                    goToMenu();
                  }}
                  className="w-full bg-red-500/10 text-red-500 border border-red-500/20 py-4 rounded-full font-black uppercase tracking-widest hover:bg-red-500/20 transition-colors"
                >
                  Menüye Dön
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Power-up Menu Modal */}
      <AnimatePresence>
        {gameState.showPowerUpMenu && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 z-[250]"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`bg-[#0a0a0a] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl relative flex flex-col gap-6 ${gameState.isMultiplayer ? 'max-w-5xl' : 'max-w-md'}`}
            >
              <button 
                onClick={togglePowerUpMenu}
                className="absolute top-6 right-6 p-2 bg-white/5 rounded-full text-white hover:bg-white/10 transition-colors z-[260]"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex gap-8">
                {/* Player 1 Menu */}
                <div className="flex-1">
                  <div className="text-center mb-6">
                    <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">GÜÇLENDİRME</h2>
                    {gameState.isMultiplayer && <p className="text-green-400 font-bold text-xs tracking-widest uppercase mt-1">PLAYER 1</p>}
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className="text-white/40 text-sm uppercase tracking-widest">Hak:</span>
                      <span className="text-yellow-400 font-black text-xl">{gameState.player.upgradePoints}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                        {UPGRADE_OPTIONS.map((u) => {
                          const level = gameState.player.upgradeLevels[u.id as keyof typeof gameState.player.upgradeLevels];
                          const canUpgrade = gameState.player.upgradePoints > 0;

                      return (
                        <div key={u.id} className="flex items-center gap-4 bg-white/5 border border-white/10 p-3 rounded-2xl">
                          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">
                            {getIcon(u.icon)}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-white font-bold text-sm">{u.name}</h3>
                            <p className="text-white/40 text-[10px] uppercase tracking-wider">{u.description}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => applyUpgrade(u.id as any, 1)}
                              disabled={!canUpgrade}
                              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                                canUpgrade 
                                  ? 'bg-green-500 text-black hover:scale-110 active:scale-95' 
                                  : 'bg-white/5 text-white/20 cursor-not-allowed'
                              }`}
                            >
                              <span className="text-xl font-black">+</span>
                            </button>
                            <div className="w-10 h-9 bg-black/40 border border-white/10 rounded-xl flex items-center justify-center">
                              <span className="text-white font-mono font-bold">{level}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Other Players Menus (Multiplayer only) */}
                {(Object.values(gameState.otherPlayers) as Player[]).map((otherPlayer, pIdx) => (
                  <React.Fragment key={otherPlayer.id}>
                    <div className="w-[1px] bg-white/10 self-stretch my-8" />
                    <div className="flex-1">
                      <div className="text-center mb-6">
                        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">GÜÇLENDİRME</h2>
                        <p className="text-pink-400 font-bold text-xs tracking-widest uppercase mt-1">OYUNCU {pIdx + 2}</p>
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <span className="text-white/40 text-sm uppercase tracking-widest">Hak:</span>
                          <span className="text-yellow-400 font-black text-xl">{otherPlayer.upgradePoints}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {UPGRADE_OPTIONS.map((u) => {
                          const level = otherPlayer.upgradeLevels[u.id as keyof typeof gameState.player.upgradeLevels];
                          const canUpgrade = otherPlayer.upgradePoints > 0;

                          return (
                            <div key={u.id} className="flex items-center gap-4 bg-white/5 border border-white/10 p-3 rounded-2xl">
                              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">
                                {getIcon(u.icon)}
                              </div>
                              <div className="flex-1">
                                <h3 className="text-white font-bold text-sm">{u.name}</h3>
                                <p className="text-white/40 text-[10px] uppercase tracking-wider">{u.description}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => applyUpgrade(u.id as any, pIdx + 2)}
                                  disabled={!canUpgrade}
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                                    canUpgrade 
                                      ? 'bg-pink-500 text-black hover:scale-110 active:scale-95' 
                                      : 'bg-white/5 text-white/20 cursor-not-allowed'
                                  }`}
                                >
                                  <span className="text-xl font-black">+</span>
                                </button>
                                <div className="w-10 h-9 bg-black/40 border border-white/10 rounded-xl flex items-center justify-center">
                                  <span className="text-white font-mono font-bold">{level}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>

              <button 
                onClick={togglePowerUpMenu}
                className="w-full bg-white text-black py-3 rounded-full font-black uppercase tracking-widest hover:bg-green-400 transition-colors shadow-lg"
              >
                Kapat
              </button>
            </motion.div>
            
            {gameState.isMultiplayer && (
              <div />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Screen */}
      <AnimatePresence>
        {gameState.isGameOver && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6 z-[60]"
          >
            <div className="text-center flex flex-col items-center gap-8">
              <div className="relative">
                <h1 className="text-7xl font-black text-red-500 italic uppercase tracking-tighter leading-none">OYUN BİTTİ</h1>
                <div className="absolute -top-4 -right-4 bg-white text-black px-2 py-1 text-[10px] font-bold rotate-12">SKOR: {gameState.score}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                  <div className="text-white/40 text-[10px] uppercase font-bold">XP</div>
                  <div className="text-2xl font-mono text-white">{gameState.player.totalXp}</div>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                  <div className="text-white/40 text-[10px] uppercase font-bold">Dalga</div>
                  <div className="text-2xl font-mono text-white">{gameState.wave}</div>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-4">
                <button 
                  onClick={restartGame}
                  className="group flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full font-black uppercase tracking-widest hover:bg-green-400 transition-colors"
                >
                  <RotateCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                  Tekrar Dene
                </button>

                <button 
                  onClick={goToMenu}
                  className="flex items-center gap-3 bg-white/10 text-white border border-white/20 px-8 py-4 rounded-full font-black uppercase tracking-widest hover:bg-white/20 transition-colors"
                >
                  Menüye Dön
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default GameCanvas;
