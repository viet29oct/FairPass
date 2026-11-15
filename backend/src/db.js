const { PrismaClient } = require("@prisma/client");

/**
 * Lỗi kết nối tạm thời (DB chớp tắt, socket bị reset, hết kết nối trong pool)
 * → tự thử lại tối đa 2 lần thay vì trả 500 cho người dùng.
 */
const TRANSIENT = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const base = new PrismaClient();

const prisma = base.$extends({
  query: {
    async $allOperations({ args, query }) {
      for (let attempt = 0; ; attempt++) {
        try {
          return await query(args);
        } catch (err) {
          if (attempt >= 2 || !TRANSIENT.has(err?.code)) throw err;
          await sleep(250 * (attempt + 1));
        }
      }
    },
  },
});

module.exports = { prisma };
