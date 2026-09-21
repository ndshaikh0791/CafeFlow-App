import { existsSync, writeFileSync } from "node:fs";
import crypto from "node:crypto";
if (existsSync(".env")) {
  console.log(".env already exists; kept your configuration.");
} else {
  const secret = crypto.randomBytes(48).toString("hex");
  const password = crypto.randomBytes(12).toString("base64url");
  writeFileSync(
    ".env",
    `MONGODB_URI=mongodb://127.0.0.1:27017/cafeflow?replicaSet=rs0\nJWT_SECRET=${secret}\nPORT=4000\nFRONTEND_URL=http://localhost:5173\nVITE_API_URL=/api\nNODE_ENV=development\nSEED_PASSWORD=${password}\nRESET_EMAIL_WEBHOOK=\nRESET_EMAIL_TOKEN=\n`,
  );
  console.log(
    "Created .env with random JWT and demo credentials. Find SEED_PASSWORD in .env.",
  );
}
