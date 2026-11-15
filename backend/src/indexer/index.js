/**
 * Indexer: đọc log của contract theo từng khoảng block (eth_getLogs),
 * áp dụng handler tương ứng và lưu tiến độ vào SyncState.
 */
const config = require("../config");
const { prisma } = require("../db");
const { provider, contract } = require("../chain");
const { fetchJSON, toGatewayUrl } = require("../ipfs");
const { handlers } = require("./handlers");

const status = { running: false, lastBlock: null, headBlock: null, lastError: null, lastSyncAt: null };
const blockTimeCache = new Map();

async function blockTime(blockNumber) {
  if (!blockTimeCache.has(blockNumber)) {
    const block = await provider.getBlock(blockNumber);
    blockTimeCache.set(blockNumber, new Date(block.timestamp * 1000));
    if (blockTimeCache.size > 5000) blockTimeCache.clear();
  }
  return blockTimeCache.get(blockNumber);
}

async function resetDatabase() {
  await prisma.$transaction([
    prisma.activity.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.staff.deleteMany(),
    prisma.tier.deleteMany(),
    prisma.event.deleteMany(),
    prisma.organizer.deleteMany(),
    prisma.syncState.deleteMany(),
  ]);
}

/**
 * Khởi tạo / kiểm tra SyncState. Nếu contract, chain hoặc block deploy khác
 * (vd chạy lại `hardhat node`) thì xoá dữ liệu cũ và index lại từ đầu.
 */
async function ensureSyncState() {
  const deployBlock = await provider.getBlock(config.startBlock);
  if (!deployBlock) throw new Error(`Không tìm thấy block ${config.startBlock} — chain đã chạy chưa?`);
  const code = await provider.getCode(config.contractAddress);
  if (code === "0x") throw new Error(`Không có contract tại ${config.contractAddress} — đã deploy chưa?`);

  const state = await prisma.syncState.findUnique({ where: { id: 1 } });
  const same =
    state &&
    state.chainId === config.chainId &&
    state.contractAddress === config.contractAddress.toLowerCase() &&
    state.deployBlockHash === deployBlock.hash;

  if (!same) {
    if (state) console.log("⚠️  Chain/contract đã thay đổi → xoá dữ liệu cũ, index lại từ đầu");
    await resetDatabase();
    await prisma.syncState.create({
      data: {
        id: 1,
        chainId: config.chainId,
        contractAddress: config.contractAddress.toLowerCase(),
        deployBlockHash: deployBlock.hash,
        lastBlock: config.startBlock - 1,
      },
    });
  }
}

async function processLog(log) {
  const name = log.fragment?.name;
  const handler = name && handlers[name];
  if (!handler) return;

  const ctx = {
    txHash: log.transactionHash,
    logIndex: log.index,
    blockNumber: log.blockNumber,
    timestamp: await blockTime(log.blockNumber),
    afterCommit: [],
  };

  try {
    await prisma.$transaction(async (tx) => {
      const activity = await handler(tx, log.args, ctx);
      if (!activity) return;
      await tx.activity.create({
        data: {
          ...activity,
          txHash: ctx.txHash,
          logIndex: ctx.logIndex,
          blockNumber: ctx.blockNumber,
          timestamp: ctx.timestamp,
        },
      });
    });
  } catch (err) {
    if (err.code === "P2002") return; // log đã được xử lý trước đó
    throw err;
  }

  for (const job of ctx.afterCommit) runJob(job);
}

/** Việc phụ sau khi commit (không chặn indexer): tải metadata sự kiện từ IPFS */
async function runJob(job) {
  if (job.type !== "fetchEventMetadata" || !job.uri) return;
  try {
    const meta = await fetchJSON(job.uri);
    await prisma.event.update({
      where: { id: job.eventId },
      data: { description: meta.description || null, image: meta.image ? toGatewayUrl(meta.image) : null },
    });
  } catch (err) {
    console.warn(`Không tải được metadata sự kiện #${job.eventId}: ${err.message}`);
  }
}

async function syncOnce() {
  const head = await provider.getBlockNumber();
  const target = head - config.confirmations;
  status.headBlock = head;

  const state = await prisma.syncState.findUnique({ where: { id: 1 } });
  let from = state.lastBlock + 1;

  while (from <= target) {
    const to = Math.min(from + config.logChunkSize - 1, target);
    const logs = await contract.queryFilter("*", from, to);
    for (const log of logs) await processLog(log);
    await prisma.syncState.update({ where: { id: 1 }, data: { lastBlock: to } });
    if (logs.length) console.log(`📥 Block ${from}→${to}: ${logs.length} log`);
    from = to + 1;
  }
  status.lastBlock = Math.max(state.lastBlock, target);
  status.lastSyncAt = new Date();
  status.lastError = null;
}

async function startIndexer() {
  await ensureSyncState();
  status.running = true;
  console.log(`🔎 Indexer: ${config.contractAddress} trên chain ${config.chainId} từ block ${config.startBlock}`);

  const loop = async () => {
    try {
      await syncOnce();
    } catch (err) {
      status.lastError = err.message;
      console.error("Indexer lỗi:", err.message);
    }
    setTimeout(loop, config.pollIntervalMs);
  };
  await loop();
}

module.exports = { startIndexer, syncOnce, status };
