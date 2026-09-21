import "dotenv/config";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { seed } from "../server/seed.js";
import { User } from "../server/models/index.js";
if (!process.env.JWT_SECRET || !process.env.SEED_PASSWORD)
  throw new Error(
    "Create .env with JWT_SECRET and SEED_PASSWORD first. See README.",
  );
const dataPath = path.resolve(".data/mongo");
mkdirSync(dataPath, { recursive: true });
const repl = await MongoMemoryServer.create({
  instance: {
    dbPath: dataPath,
    port: 27018,
    replSet: "testset",
    storageEngine: "wiredTiger",
  },
});
const direct = await mongoose.mongo.MongoClient.connect(repl.getUri(), {
  directConnection: true,
});
const admin = direct.db("admin");
const host = `127.0.0.1:${repl.instanceInfo.port}`;
try {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      let config;
      try {
        config = (await admin.command({ replSetGetConfig: 1 })).config;
      } catch (e) {
        if (e.code !== 94) throw e;
      }
      if (!config)
        await admin.command({
          replSetInitiate: { _id: "testset", members: [{ _id: 0, host }] },
        });
      else if (config.members[0].host !== host) {
        config.members = [{ _id: 0, host }];
        config.version++;
        await admin.command({ replSetReconfig: config, force: true });
      }
      break;
    } catch (e) {
      if (attempt === 29 || !(e.code === 23 || e.name === "MongoNetworkError"))
        throw e;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
} finally {
  await direct.close();
}
process.env.MONGODB_URI = `${repl.getUri("cafeflow")}?replicaSet=testset`;
await mongoose.connect(process.env.MONGODB_URI);
if (!(await User.exists({}))) {
  await seed(process.env.SEED_PASSWORD);
  console.log(
    "Demo database seeded. Sign in as owner@cafeflow.local using SEED_PASSWORD from .env.",
  );
}
await mongoose.disconnect();
const server = spawn(process.execPath, ["server/index.js"], {
  stdio: "inherit",
  env: process.env,
});
const client = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "0.0.0.0"],
  { stdio: "inherit", env: process.env },
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.kill();
  client.kill();
  await repl.stop({ doCleanup: false });
  process.exit();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", stop);
client.on("exit", stop);
