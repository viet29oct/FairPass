/**
 * Kết nối MetaMask (EIP-1193) — tự viết bằng ethers v6, không dùng wagmi.
 * Cung cấp: account, chainId, isCorrectChain, roles, connect, disconnect, switchNetwork, getSigner.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BrowserProvider, parseEther, toQuantity } from "ethers";
import { CHAIN } from "../lib/config";
import { api } from "../lib/api";
import { readProvider } from "../lib/contract";
import { isUnauthorized } from "../lib/errors";

const WalletContext = createContext(null);
const DISCONNECT_KEY = "fairpass.disconnected";

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value);
    } catch {
      /* private mode */
    }
  },
};

const EMPTY_ROLES = {
  isAdmin: false,
  isOrganizer: false,
  staffEventIds: [],
  organizedEventIds: [],
  checkinEvents: [],
};

export function WalletProvider({ children }) {
  const ethereum = typeof window !== "undefined" ? window.ethereum : undefined;
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [roles, setRoles] = useState(EMPTY_ROLES);
  const [fetchingRoles, setFetchingRoles] = useState(false);
  const [rolesAccount, setRolesAccount] = useState(null); // quyền hiện có là của ví nào
  // Đang tải nếu đang gọi API, hoặc quyền đang hiển thị chưa phải của ví hiện tại (tránh nháy "không có quyền")
  const rolesLoading = fetchingRoles || (!!account && rolesAccount !== account);

  // ── Khôi phục kết nối cũ (không bật popup) + lắng nghe thay đổi ví/mạng ──
  useEffect(() => {
    if (!ethereum) return;
    const onAccounts = (accs) => {
      if (storage.get(DISCONNECT_KEY)) return;
      setAccount(accs?.[0] ? accs[0].toLowerCase() : null);
    };
    const onChain = (id) => setChainId(Number(id));

    ethereum.request({ method: "eth_chainId" }).then(onChain).catch(() => {});
    if (!storage.get(DISCONNECT_KEY)) {
      ethereum.request({ method: "eth_accounts" }).then(onAccounts).catch(() => {});
    }
    ethereum.on?.("accountsChanged", onAccounts);
    ethereum.on?.("chainChanged", onChain);
    return () => {
      ethereum.removeListener?.("accountsChanged", onAccounts);
      ethereum.removeListener?.("chainChanged", onChain);
    };
  }, [ethereum]);

  // ── Quyền của ví: admin/organizer đọc từ chain qua API, staff từ indexer ──
  const refreshRoles = useCallback(async () => {
    if (!account) {
      setRoles(EMPTY_ROLES);
      setRolesAccount(null);
      return;
    }
    setFetchingRoles(true);
    try {
      setRoles({ ...EMPTY_ROLES, ...(await api(`/users/${account}/roles`)) });
    } catch {
      setRoles(EMPTY_ROLES);
    } finally {
      setRolesAccount(account);
      setFetchingRoles(false);
    }
  }, [account]);

  useEffect(() => {
    refreshRoles();
  }, [refreshRoles]);

  // ── Số dư ETH (đọc qua RPC của app, không phụ thuộc mạng MetaMask đang chọn) ──
  const [balance, setBalance] = useState(null);
  const refreshBalance = useCallback(async () => {
    if (!account) return setBalance(null);
    try {
      setBalance(await readProvider.getBalance(account));
    } catch {
      setBalance(null);
    }
  }, [account]);

  useEffect(() => {
    refreshBalance();
    if (!account) return;
    const id = setInterval(refreshBalance, 10000);
    return () => clearInterval(id);
  }, [account, refreshBalance]);

  /** Chỉ mạng Hardhat local: nạp ETH test bằng RPC hardhat_setBalance */
  const fundTestEth = useCallback(
    async (amountEth = 100) => {
      if (!account || CHAIN.id !== 31337) throw new Error("Chỉ dùng được trên mạng local");
      const current = await readProvider.getBalance(account);
      await readProvider.send("hardhat_setBalance", [account, toQuantity(current + parseEther(String(amountEth)))]);
      await refreshBalance();
    },
    [account, refreshBalance]
  );

  const connect = useCallback(async () => {
    if (!ethereum) throw new Error("Chưa cài MetaMask");
    setConnecting(true);
    try {
      storage.set(DISCONNECT_KEY, null);
      const accs = await ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accs?.[0]?.toLowerCase() || null);
      setChainId(Number(await ethereum.request({ method: "eth_chainId" })));
    } finally {
      setConnecting(false);
    }
  }, [ethereum]);

  /** MetaMask không cho DApp ngắt kết nối thật — ta chỉ "quên" ví ở phía app */
  const disconnect = useCallback(() => {
    storage.set(DISCONNECT_KEY, "1");
    setAccount(null);
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!ethereum) return;
    const hexId = toQuantity(CHAIN.id);
    try {
      await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
    } catch (err) {
      const code = err?.code ?? err?.data?.originalError?.code;
      if (code !== 4902) throw err;
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexId,
            chainName: CHAIN.name,
            rpcUrls: [CHAIN.rpcUrl],
            nativeCurrency: CHAIN.currency,
            ...(CHAIN.explorer ? { blockExplorerUrls: [CHAIN.explorer] } : {}),
          },
        ],
      });
    }
  }, [ethereum]);

  /**
   * Signer mới mỗi lần gọi — tránh lỗi "network changed" của BrowserProvider.
   * Đồng bộ lại `account` nếu MetaMask đang dùng tài khoản khác với app.
   */
  const getSigner = useCallback(async () => {
    if (!ethereum) throw new Error("Chưa cài MetaMask");
    const signer = await new BrowserProvider(ethereum).getSigner();
    const addr = signer.address.toLowerCase();
    setAccount((cur) => (cur === addr ? cur : addr));
    return signer;
  }, [ethereum]);

  /**
   * Xin lại quyền khi MetaMask báo 4100 ("not been authorized"):
   * mở hộp thoại kết nối để người dùng chọn tài khoản + mạng, rồi chuyển đúng mạng.
   */
  const reauthorize = useCallback(async () => {
    if (!ethereum) throw new Error("Chưa cài MetaMask");
    storage.set(DISCONNECT_KEY, null);
    try {
      await ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
    } catch (err) {
      if (err?.code === 4001) throw err; // người dùng huỷ
      await ethereum.request({ method: "eth_requestAccounts" });
    }
    const accs = await ethereum.request({ method: "eth_accounts" });
    setAccount(accs?.[0]?.toLowerCase() || null);
    const current = Number(await ethereum.request({ method: "eth_chainId" }));
    setChainId(current);
    if (current !== CHAIN.id) await switchNetwork();
  }, [ethereum, switchNetwork]);

  /** Chạy fn; nếu MetaMask báo chưa cấp quyền thì xin quyền rồi thử lại đúng 1 lần */
  const withAuthRetry = useCallback(
    async (fn) => {
      try {
        return await fn();
      } catch (err) {
        if (!isUnauthorized(err)) throw err;
        await reauthorize();
        return await fn();
      }
    },
    [reauthorize]
  );

  const value = useMemo(
    () => ({
      hasWallet: !!ethereum,
      account,
      chainId,
      isConnected: !!account,
      isCorrectChain: chainId === CHAIN.id,
      connecting,
      roles,
      rolesLoading,
      refreshRoles,
      balance,
      refreshBalance,
      fundTestEth,
      isLocalChain: CHAIN.id === 31337,
      connect,
      disconnect,
      switchNetwork,
      getSigner,
      reauthorize,
      withAuthRetry,
    }),
    [ethereum, account, chainId, connecting, roles, rolesLoading, refreshRoles, balance, refreshBalance, fundTestEth, connect, disconnect, switchNetwork, getSigner, reauthorize, withAuthRetry]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet phải nằm trong <WalletProvider>");
  return ctx;
}
