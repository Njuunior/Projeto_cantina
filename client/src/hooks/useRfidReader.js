import { useEffect, useRef, useState } from 'react';

const RFID_WS_URL = import.meta.env.VITE_RFID_WS_URL || 'ws://127.0.0.1:8765';

export function useRfidReader({ onCard, enabled = true }) {
  const [status, setStatus] = useState({ connected: false, reader: null, bridgeOnline: false });
  const onCardRef = useRef(onCard);
  onCardRef.current = onCard;

  useEffect(() => {
    if (!enabled) {
      setStatus({ connected: false, reader: null, bridgeOnline: false });
      return undefined;
    }

    let ws;
    let retryTimer;

    const connect = () => {
      ws = new WebSocket(RFID_WS_URL);

      ws.onopen = () => {
        setStatus((prev) => ({ ...prev, bridgeOnline: true }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'status') {
            setStatus({
              bridgeOnline: true,
              connected: !!msg.connected,
              reader: msg.reader || null,
            });
          }
          if (msg.type === 'card' && msg.uid) {
            onCardRef.current?.(msg.uid);
          }
        } catch {
          /* ignore malformed */
        }
      };

      ws.onclose = () => {
        setStatus({ connected: false, reader: null, bridgeOnline: false });
        retryTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, [enabled]);

  return status;
}
