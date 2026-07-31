import { Server } from "socket.io";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL?.split(",") || "*",
    credentials: true,
  },
});

// Maps a userId -> their active socket id. Since a user may only have one
// tab/device connected in this simple implementation, this is enough to
// know who's online and to route direct messages to the right socket.
const userSocketMap = {};

export const getReceiverSocketId = (receiverId) => userSocketMap[receiverId];

// Authenticate every socket connection using the same JWT used for REST
// requests, so a stolen/forged connection can't impersonate another user.
io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.cookie
        ?.split("; ")
        .find((c) => c.startsWith("jwt="))
        ?.split("=")[1];

    if (!token) return next(new Error("Authentication error: no token"));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error("Authentication error: invalid token"));
  }
});

io.on("connection", async (socket) => {
  const userId = socket.userId;
  console.log(`🔌 Socket connected: user ${userId} (${socket.id})`);

  if (userId) {
    userSocketMap[userId] = socket.id;

    // Mark the user online and broadcast the updated online-user list.
    await User.findByIdAndUpdate(userId, { isOnline: true });
    io.emit("onlineUsers", Object.keys(userSocketMap));
  }

  // ---- Typing indicators ----
  socket.on("typing", ({ receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", { senderId: userId });
    }
  });

  socket.on("stopTyping", ({ receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("stopTyping", { senderId: userId });
    }
  });

  // ---- Disconnect ----
  socket.on("disconnect", async () => {
    console.log(`❌ Socket disconnected: user ${userId}`);
    delete userSocketMap[userId];

    if (userId) {
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      });
    }

    io.emit("onlineUsers", Object.keys(userSocketMap));
  });
});

export { app, server, io };
