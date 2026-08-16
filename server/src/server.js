import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { ensureStaffStore } from "./data/staffStore.js";

const app = createApp();

await ensureStaffStore();

app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
});
