"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function HostLobby() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pin = searchParams.get("pin");
  const socketRef = useRef(null);

  const [quiz, setQuiz] = useState(null);
  const [players, setPlayers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const savedQuiz = localStorage.getItem("quizzy-current-quiz");
    if (savedQuiz) setQuiz(JSON.parse(savedQuiz));

    if (!pin) {
      router.push("/host");
      return;
    }

    let disposed = false;
    const socket = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000"}/ws/host/${pin}`);
    socketRef.current = socket;

    socket.onopen = () => {
      if (disposed || socketRef.current !== socket) return;
      console.log("Host WebSocket connected");
      setConnected(true);
    };

    socket.onmessage = (event) => {
      if (disposed || socketRef.current !== socket) return;
      const data = JSON.parse(event.data);
      console.log("HOST RECEIVED:", data);

      if (data.type === "connected" || data.type === "players_updated") {
        setPlayers(data.players || []);
      }

      if (data.type === "game_started" && data.success) {
        router.push(`/host/game?pin=${pin}`);
      }

      if (data.type === "error") alert(data.message);
    };

    socket.onerror = () => {
      if (disposed || socketRef.current !== socket) return;
      console.warn("Host WebSocket connection issue.");
    };

    socket.onclose = (event) => {
      if (disposed || socketRef.current !== socket) return;
      console.log("Host WebSocket disconnected:", event.code, event.reason);
      setConnected(false);
    };

    return () => {
      disposed = true;
      if (socketRef.current === socket) socketRef.current = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  }, [pin, router]);

  const copyPin = async () => {
    if (!pin) return;
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.warn("Could not copy PIN", error);
    }
  };

  const startGame = () => {
    const socket = socketRef.current;
    if (players.length === 0 || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "start_game" }));
  };

  return (
    <main className="lobby-page">
      <div className="lobby-background" />
      <header className="lobby-header">
        <div className="lobby-logo">⚡ QUIZZY</div>
        <div className="quiz-name">{quiz?.title || "Your Quiz"}</div>
        <button onClick={() => router.push("/host/create")}>Leave game</button>
      </header>

      <section className="lobby-content">
        <motion.div className="pin-section" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <p>JOIN WITH GAME PIN</p>
          <button className="game-pin" onClick={copyPin}>
            {pin || "------"}
            <span>{copied ? "COPIED ✓" : "CLICK TO COPY"}</span>
          </button>
          <p className="waiting">
            {connected ? "Waiting for players" : "Connecting to server"}
            <span className="waiting-dots"><i /><i /><i /></span>
          </p>
        </motion.div>

        <section className="players-area">
          <div className="players-heading">
            <h2>Players <span>{players.length}</span></h2>
            {players.length > 0 && <p>Everyone&apos;s here? Start the chaos.</p>}
          </div>

          <motion.div className="players-grid" layout>
            <AnimatePresence>
              {players.map((player) => (
                <motion.div layout key={player.id} className="player-card"
                  initial={{ opacity: 0, scale: 0.5, y: 25 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: "spring", stiffness: 350, damping: 22 }}>
                  <span className="player-avatar">{player.avatar}</span>
                  <strong>{player.name}</strong>
                </motion.div>
              ))}
            </AnimatePresence>
            {players.length === 0 && <div className="empty-lobby"><div>👀</div><p>Waiting for the first player...</p></div>}
          </motion.div>
        </section>
      </section>

      <footer className="lobby-footer">
        <div><strong>{players.length}</strong><span>{players.length === 1 ? " PLAYER" : " PLAYERS"}</span></div>
        <motion.button className="start-game" disabled={players.length === 0 || !connected} onClick={startGame}
          whileHover={players.length > 0 && connected ? { scale: 1.03 } : {}}
          whileTap={players.length > 0 && connected ? { scale: 0.97 } : {}}>
          START GAME <span>→</span>
        </motion.button>
      </footer>
    </main>
  );
}
