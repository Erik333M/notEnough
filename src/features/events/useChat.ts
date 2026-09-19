import { useCallback, useEffect, useRef, useState } from 'react';

import { API_BASE_URL } from '../../api/client';
import { chatApi, type ChatMessage } from '../../api/chat';
import { useAuth } from '../../state/AuthContext';

/**
 * A live channel, over the websocket the server exposes on its own port.
 *
 * React Native ships a WebSocket, so there is no library here — just a socket,
 * a reconnect, and the rule that the socket is an optimisation. Every message
 * is written and read over HTTP; if the socket never connects, the channel
 * still works, it just stops arriving by itself. That is why `connected` is
 * surfaced rather than hidden: a person should be able to see which of the two
 * they are getting.
 *
 * The token goes in the first frame, never in the URL — a query string ends up
 * in logs, and this one is a thirty-day credential.
 */
const RECONNECT_MS = 2500;
const TYPING_CLEARS_MS = 3500;

export function useChat(eventId: string) {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [canPost, setCanPost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  /** Ignores anything already held, so a socket push and a refetch cannot double up. */
  const absorb = useCallback((incoming: ChatMessage[]) => {
    setMessages((prev) => {
      const seen = new Set(prev.map((row) => row.id));
      const added = incoming.filter((row) => !seen.has(row.id));
      if (added.length === 0) return prev;
      return [...prev, ...added].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /* --------------------------------------------------------------- history */

  useEffect(() => {
    if (!token) return;
    let live = true;
    void chatApi.history(token, eventId).then((result) => {
      if (!live || !mounted.current) return;
      if (result.ok) {
        setMessages(result.data.messages);
        setHasMore(result.data.hasMore);
        setCanPost(result.data.canPost);
      }
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [eventId, token]);

  const loadOlder = useCallback(async () => {
    if (!token || !hasMore || messages.length === 0) return;
    const result = await chatApi.history(token, eventId, messages[0].id);
    if (!mounted.current || !result.ok) return;
    setHasMore(result.data.hasMore);
    setMessages((prev) => [...result.data.messages, ...prev]);
  }, [eventId, hasMore, messages, token]);

  /* ---------------------------------------------------------- the socket */

  useEffect(() => {
    if (!token) return;
    let closed = false;

    const connect = () => {
      if (closed) return;
      const url = `${API_BASE_URL.replace(/^http/, 'ws')}/ws`;
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));

      socket.onmessage = (raw) => {
        let frame: any = null;
        try {
          frame = JSON.parse(String(raw.data));
        } catch {
          return;
        }
        if (frame?.type === 'ready') {
          socket.send(JSON.stringify({ type: 'subscribe', eventId }));
          return;
        }
        if (frame?.type === 'subscribed' && mounted.current) {
          setConnected(true);
          return;
        }
        if (frame?.type === 'message' && frame.eventId === eventId) {
          absorb([frame.message]);
          setTyping(null);
          return;
        }
        if (frame?.type === 'typing' && frame.eventId === eventId && mounted.current) {
          setTyping(frame.name ?? 'Someone');
          if (typingRef.current) clearTimeout(typingRef.current);
          typingRef.current = setTimeout(() => mounted.current && setTyping(null), TYPING_CLEARS_MS);
        }
      };

      // A dropped socket on a phone is normal — a locked screen does it. Retry
      // quietly rather than telling somebody their network is broken.
      socket.onclose = () => {
        if (mounted.current) setConnected(false);
        if (!closed) retryRef.current = setTimeout(connect, RECONNECT_MS);
      };
      socket.onerror = () => socket.close();
    };

    connect();

    return () => {
      closed = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      if (typingRef.current) clearTimeout(typingRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [absorb, eventId, token]);

  /* ---------------------------------------------------------------- acting */

  const send = useCallback(
    async (body: string) => {
      if (!token || !body.trim()) return { ok: false as const, message: '' };
      setSending(true);
      const result = await chatApi.post(token, eventId, body.trim());
      if (!mounted.current) return { ok: false as const, message: '' };
      setSending(false);
      if (!result.ok) return { ok: false as const, message: result.error.message };
      // Added here as well as by the socket; `absorb` drops the duplicate, and
      // this way the message appears even with no live connection.
      absorb([result.data.message]);
      return { ok: true as const, message: '' };
    },
    [absorb, eventId, token],
  );

  const remove = useCallback(
    async (messageId: string) => {
      if (!token) return;
      const result = await chatApi.remove(token, eventId, messageId);
      if (result.ok && mounted.current) {
        setMessages((prev) => prev.filter((row) => row.id !== messageId));
      }
    },
    [eventId, token],
  );

  const notifyTyping = useCallback(() => {
    const socket = socketRef.current;
    if (socket?.readyState === 1) socket.send(JSON.stringify({ type: 'typing', eventId }));
  }, [eventId]);

  return {
    messages,
    hasMore,
    canPost,
    loading,
    sending,
    connected,
    typing,
    myId: user?.id ?? null,
    send,
    remove,
    loadOlder,
    notifyTyping,
  };
}
