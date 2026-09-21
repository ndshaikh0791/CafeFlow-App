import "dotenv/config";
import http from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { connectDB } from "./config/db.js";
import { createApp } from "./app.js";
import { User } from "./models/index.js";
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw new Error("Set JWT_SECRET to at least 32 random characters in .env");
await connectDB();
const io = new Server({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
});
const httpServer = http.createServer(createApp(io));
io.attach(httpServer);
io.on("connection", async (socket) => {
  const cookie = socket.handshake.headers.cookie || "";
  const token = cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("cf_session="))
    ?.slice(11);
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub);
      if (user?.active && user.tokenVersion === payload.version) {
        socket.join("staff");
        socket.emit("staff-ready");
        const timer = setTimeout(
          () => socket.disconnect(true),
          Math.max(0, payload.exp * 1000 - Date.now()),
        );
        socket.on("disconnect", () => clearTimeout(timer));
      }
    } catch {
      /* Anonymous customers can subscribe only with an unguessable tracking token. */
    }
  }
  socket.on("track", (token, ack) => {
    if (typeof token === "string" && /^[a-f0-9]{48}$/.test(token)) {
      for (const room of socket.rooms)
        if (room.startsWith("order:")) socket.leave(room);
      socket.join(`order:${token}`);
      if (typeof ack === "function") ack({ joined: true });
    }
  });
});
httpServer.listen(process.env.PORT || 4000, () =>
  console.log(`CafeFlow API listening on port ${httpServer.address().port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    io.close();
    httpServer.close(() => process.exit(0));
  });
