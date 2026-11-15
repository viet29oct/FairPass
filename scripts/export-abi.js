/**
 * Ghi thông tin deploy vào deployments/<network>.json và copy ABI + địa chỉ
 * sang frontend/src/contracts và backend/src/contracts.
 *
 * Dùng trong deploy.js, hoặc chạy riêng để export lại ABI sau khi compile:
 *   npx hardhat run scripts/export-abi.js --network localhost
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ARTIFACT = path.join(ROOT, "artifacts/contracts/EventTicketNFT.sol/EventTicketNFT.json");
const TARGETS = [path.join(ROOT, "frontend/src/contracts"), path.join(ROOT, "backend/src/contracts")];

function exportAbi(deployment) {
  const deployDir = path.join(ROOT, "deployments");
  fs.mkdirSync(deployDir, { recursive: true });

  if (deployment) {
    fs.writeFileSync(
      path.join(deployDir, `${deployment.network}.json`),
      JSON.stringify({ ...deployment, timestamp: new Date().toISOString() }, null, 2)
    );
  }

  // Gộp mọi mạng đã deploy thành { [chainId]: { address, deployBlock, network } }
  const addresses = {};
  for (const file of fs.readdirSync(deployDir).filter((f) => f.endsWith(".json"))) {
    const d = JSON.parse(fs.readFileSync(path.join(deployDir, file), "utf8"));
    addresses[d.chainId] = { address: d.address, deployBlock: d.deployBlock, network: d.network };
  }

  const { abi } = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
  for (const dir of TARGETS) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "EventTicketNFT.abi.json"), JSON.stringify(abi, null, 2));
    fs.writeFileSync(path.join(dir, "addresses.json"), JSON.stringify(addresses, null, 2));
  }
  console.log("📦 Đã export ABI + địa chỉ sang frontend/ và backend/");
}

module.exports = { exportAbi };

if (require.main === module) exportAbi();
