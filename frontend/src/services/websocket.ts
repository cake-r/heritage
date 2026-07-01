/** WebSocket 客户端 — 任务状态实时推送 + 自动重连 */

type WSMessageHandler = (data: any) => void;
type WSStatusHandler = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

interface WSConnection {
  ws: WebSocket;
  taskId: string;
  handlers: Set<WSMessageHandler>;
  statusHandlers: Set<WSStatusHandler>;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000; // 1s

const connections = new Map<string, WSConnection>();

function getToken(): string | null {
  return localStorage.getItem('token');
}

function getWsUrl(taskId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const token = getToken();
  return `${protocol}//${host}/api/tasks/${taskId}/ws?token=${token || ''}`;
}

export function connectTaskWS(
  taskId: string,
  onMessage: WSMessageHandler,
  onStatus?: WSStatusHandler,
): () => void {
  const existing = connections.get(taskId);
  if (existing) {
    existing.handlers.add(onMessage);
    if (onStatus) existing.statusHandlers.add(onStatus);
    // 返回断开函数
    return () => {
      existing.handlers.delete(onMessage);
      if (onStatus) existing.statusHandlers.delete(onStatus);
    };
  }

  const conn: WSConnection = {
    ws: null as any,
    taskId,
    handlers: new Set([onMessage]),
    statusHandlers: new Set(onStatus ? [onStatus] : []),
    reconnectTimer: null,
    reconnectAttempts: 0,
  };

  function notifyStatus(status: 'connecting' | 'connected' | 'disconnected' | 'error') {
    conn.statusHandlers.forEach(h => h(status));
  }

  function doConnect() {
    if (!getToken()) {
      // No token, fall back to polling
      notifyStatus('error');
      return;
    }

    notifyStatus('connecting');

    try {
      const ws = new WebSocket(getWsUrl(taskId));
      conn.ws = ws;

      ws.onopen = () => {
        conn.reconnectAttempts = 0;
        notifyStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          conn.handlers.forEach(h => h(data));
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = (event) => {
        // 非正常关闭时尝试重连
        if (event.code !== 1000 && event.code !== 4001 && event.code !== 4004) {
          attemptReconnect();
        } else {
          notifyStatus('disconnected');
        }
      };

      ws.onerror = () => {
        notifyStatus('error');
        // WebSocket 失败时不重连，让调用方降级到 HTTP 轮询
        ws.close();
      };
    } catch {
      notifyStatus('error');
    }
  }

  function attemptReconnect() {
    if (conn.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      notifyStatus('disconnected');
      return;
    }
    const delay = RECONNECT_BASE_DELAY * Math.pow(2, conn.reconnectAttempts);
    conn.reconnectAttempts++;
    conn.reconnectTimer = setTimeout(doConnect, delay);
  }

  function cancelTask() {
    if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send('cancel');
    }
  }

  // 暴露 cancel 方法到 connection 对象
  (conn as any).cancelTask = cancelTask;

  connections.set(taskId, conn);
  doConnect();

  // 返回断开函数
  return () => {
    conn.handlers.delete(onMessage);
    if (onStatus) conn.statusHandlers.delete(onStatus);
    // 如果没有任何 handler 了，关闭连接
    if (conn.handlers.size === 0) {
      disconnectTaskWS(taskId);
    }
  };
}

export function disconnectTaskWS(taskId: string) {
  const conn = connections.get(taskId);
  if (!conn) return;
  if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer);
  if (conn.ws && conn.ws.readyState !== WebSocket.CLOSED) {
    conn.ws.close(1000, 'Client disconnect');
  }
  connections.delete(taskId);
}

export function cancelTaskViaWS(taskId: string) {
  const conn = connections.get(taskId);
  if (conn) {
    (conn as any).cancelTask?.();
  }
}
