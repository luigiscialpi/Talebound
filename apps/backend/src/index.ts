import express from "express";
import { config } from "./config.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "talebound-backend" });
});

const server = app.listen(config.PORT, () => {
  console.log(`Talebound backend in ascolto su :${config.PORT}`);
});

// Graceful shutdown (doc §12): evita stato corrotto durante i deploy.
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
