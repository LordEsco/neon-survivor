import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";

interface Player {
  id: string;
  role: "host" | "player";
  playerNumber: number;
  socketId: string;
}

interface Room {
  roomCode: string;
  maxPlayers: number;
  isLocked: boolean;
  isPasswordProtected: boolean;
  passwordHash: string | null;
  players: Player[];
  createdAt: number;
}

const rooms: Map<string, Room> = new Map();

function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(code));
  return code;
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = Number(process.env.PORT) || 3000;

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("create_room", async (data: { maxPlayers: number; password?: string }) => {
      const roomCode = generateRoomCode();
      const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;

      const newRoom: Room = {
        roomCode,
        maxPlayers: data.maxPlayers,
        isLocked: false,
        isPasswordProtected: !!data.password,
        passwordHash,
        players: [
          {
            id: socket.id, // Using socket.id as player id for simplicity
            role: "host",
            playerNumber: 1,
            socketId: socket.id,
          },
        ],
        createdAt: Date.now(),
      };

      rooms.set(roomCode, newRoom);
      socket.join(roomCode);
      socket.emit("room_created", { room: newRoom });
      console.log(`Room created: ${roomCode}`);
    });

    socket.on("join_room", async (data: { roomCode: string; password?: string }) => {
      const room = rooms.get(data.roomCode.toUpperCase());

      if (!room) {
        return socket.emit("error", { message: "Oda bulunamadı." });
      }

      if (room.isLocked) {
        return socket.emit("error", { message: "Oda kapalı." });
      }

      if (room.players.length >= room.maxPlayers) {
        return socket.emit("error", { message: "Oda dolu." });
      }

      if (room.isPasswordProtected) {
        if (!data.password) {
          return socket.emit("error", { message: "Şifre gerekli." });
        }
        const isMatch = await bcrypt.compare(data.password, room.passwordHash!);
        if (!isMatch) {
          return socket.emit("error", { message: "Hatalı şifre." });
        }
      }

      const playerNumber = room.players.length + 1;
      const newPlayer: Player = {
        id: socket.id,
        role: "player",
        playerNumber,
        socketId: socket.id,
      };

      room.players.push(newPlayer);
      
      // Auto-lock if full
      if (room.players.length === room.maxPlayers) {
        room.isLocked = true;
      }

      socket.join(room.roomCode);
      io.to(room.roomCode).emit("room_updated", { room });
      socket.emit("joined_room", { room });
      console.log(`User ${socket.id} joined room ${room.roomCode}`);
    });

    socket.on("toggle_room_status", (data: { roomCode: string }) => {
      const room = rooms.get(data.roomCode);
      if (room) {
        const player = room.players.find(p => p.socketId === socket.id);
        if (player?.role === "host") {
          room.isLocked = !room.isLocked;
          io.to(room.roomCode).emit("room_updated", { room });
        }
      }
    });

    socket.on("start_game", (data: { roomCode: string }) => {
      const room = rooms.get(data.roomCode);
      if (room) {
        const player = room.players.find(p => p.socketId === socket.id);
        if (player?.role === "host") {
          io.to(room.roomCode).emit("game_started", { room });
        }
      }
    });

    socket.on("player_move", (data: { roomCode: string; x: number; y: number; playerNumber: number }) => {
      socket.to(data.roomCode).emit("player_moved", data);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      rooms.forEach((room, roomCode) => {
        const playerIndex = room.players.findIndex((p) => p.socketId === socket.id);
        if (playerIndex !== -1) {
          const wasHost = room.players[playerIndex].role === "host";
          room.players.splice(playerIndex, 1);

          if (room.players.length === 0) {
            rooms.delete(roomCode);
            console.log(`Room deleted: ${roomCode}`);
          } else {
            // Re-assign player numbers and host if needed
            room.players.sort((a, b) => a.playerNumber - b.playerNumber);
            room.players.forEach((p, index) => {
              p.playerNumber = index + 1;
            });

            if (wasHost) {
              room.players[0].role = "host";
            }

            // Auto-unlock if it was full and now has space
            if (room.players.length < room.maxPlayers) {
              // We don't necessarily want to auto-unlock if the host manually locked it
              // but the requirement says "Oda maksimum oyuncu sayısına ulaşınca otomatik Kapalı olur."
              // It doesn't explicitly say to auto-open when someone leaves, but it's logical.
              // However, let's stick to the host's manual control for now if they toggled it.
            }

            io.to(roomCode).emit("room_updated", { room });
          }
        }
      });
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
