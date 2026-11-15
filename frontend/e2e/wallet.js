/**
 * Ví giả lập EIP-1193 cho E2E — thay thế tiện ích MetaMask (Playwright không điều khiển được popup MetaMask).
 * Mọi yêu cầu ký / gửi giao dịch được chuyển thẳng tới Hardhat node, nơi 20 tài khoản test đã unlock sẵn:
 *   eth_sendTransaction, personal_sign, eth_signTypedData_v4 → node tự ký bằng private key của tài khoản.
 * Hợp đồng, backend, frontend đều chạy thật — chỉ thay "người bấm Xác nhận trong MetaMask".
 */
export const RPC_URL = process.env.E2E_RPC_URL || "http://127.0.0.1:8545";

/** Tài khoản mặc định của Hardhat (mnemonic test…junk) */
export const ACCOUNTS = {
  admin: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // #0
  organizer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // #1
  staff: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", // #4
  buyer1: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", // #5
  buyer2: "0x976EA74026E726554dB657fA54763abd0C3a0aa9", // #6
  buyer3: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955", // #7
  outsider: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", // #8
};

/** Script chạy trong trang TRƯỚC khi app load (context.addInitScript) */
function installWallet({ account, rpcUrl }) {
  const listeners = {};
  let id = 0;
  async function rpc(method, params) {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params: params || [] }),
    });
    const json = await res.json();
    if (json.error) {
      // Bọc lỗi giống MetaMask ("Internal JSON-RPC error." → data)
      const err = new Error("Internal JSON-RPC error.");
      err.code = -32603;
      err.data = json.error;
      throw err;
    }
    return json.result;
  }
  window.__e2eWallet = { account, calls: [] };
  window.ethereum = {
    isMetaMask: true,
    isE2EWallet: true,
    on(ev, fn) {
      (listeners[ev] ||= []).push(fn);
    },
    removeListener(ev, fn) {
      listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn);
    },
    async request({ method, params }) {
      window.__e2eWallet.calls.push(method);
      switch (method) {
        case "eth_accounts":
        case "eth_requestAccounts":
          return [account];
        case "eth_chainId":
          return "0x7a69";
        case "net_version":
          return "31337";
        case "wallet_switchEthereumChain":
        case "wallet_addEthereumChain":
          return null;
        case "wallet_requestPermissions":
          return [{ parentCapability: "eth_accounts" }];
        default:
          return rpc(method, params);
      }
    },
  };
}

/** Tạo browser context đóng vai một ví (giống 1 Chrome profile riêng) */
export async function walletContext(browser, account, options = {}) {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"], ...options });
  await context.addInitScript(installWallet, { account: account.toLowerCase(), rpcUrl: RPC_URL });
  return context;
}

/** Gọi RPC từ phía test (đọc số dư, gửi giao dịch dọn dẹp…) */
export async function rpc(method, params = []) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}
