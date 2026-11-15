const express = require("express");
const cors = require("cors");
const config = require("./config");
const { prisma } = require("./db");
const { startIndexer } = require("./indexer");
const { UPLOAD_DIR, isLocalMode } = require("./ipfs");
const apiRoutes = require("./routes/api");
const uploadRoutes = require("./routes/upload");

// Prisma Decimal tự serialize thành chuỗi; thêm xử lý BigInt cho an toàn
const app = express();
app.set("json replacer", (_key, value) => (typeof value === "bigint" ? value.toString() : value));
app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(",") }));
app.use(express.json({ limit: "100kb" }));

app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));
app.use("/api", apiRoutes);
app.use("/api", uploadRoutes);

app.use((_req, _res, next) => {
  const err = new Error("Không tìm thấy endpoint");
  err.status = 404;
  next(err);
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === "LIMIT_FILE_SIZE" ? 413 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Lỗi máy chủ" : err.message });
});

async function main() {
  await prisma.$connect();
  app.listen(config.port, () => {
    console.log(`🚀 FairPass API: http://localhost:${config.port}/api`);
    console.log(`🗂️  Lưu trữ: ${isLocalMode() ? "LOCAL (chưa có PINATA_JWT)" : "IPFS/Pinata"}`);
  });
  await startIndexer();
}

main().catch(async (err) => {
  console.error("Khởi động thất bại:", err.message);
  await prisma.$disconnect();
  process.exit(1);
});
