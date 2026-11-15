import { API_URL } from "./config";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** GET bị lỗi mạng / 5xx → thử lại 1 lần sau 600ms (lỗi kết nối chớp nhoáng) */
export async function api(path, opts = {}) {
  const isGet = !opts.method || opts.method === "GET";
  try {
    return await request(path, opts);
  } catch (err) {
    if (!isGet || err.name === "AbortError" || !(err.status === 0 || err.status >= 500)) throw err;
    await new Promise((r) => setTimeout(r, 600));
    if (opts.signal?.aborted) throw err;
    return request(path, opts);
  }
}

async function request(path, { method = "GET", body, token, headers = {}, signal } = {}) {
  const isForm = body instanceof FormData;
  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      signal,
      headers: {
        ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError("Không kết nối được máy chủ FairPass. Backend đã chạy chưa?", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Lỗi máy chủ (${res.status})`, res.status);
  return data;
}

/**
 * Chờ indexer xử lý tới block chứa giao dịch rồi mới tải lại dữ liệu
 * (thay cho việc đợi cố định vài giây).
 */
export async function waitIndexed(blockNumber, timeoutMs = 15000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const h = await api("/health");
      if ((h.indexer?.lastBlock ?? -1) >= blockNumber) return true;
    } catch {
      /* thử lại */
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}
