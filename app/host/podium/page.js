"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function PodiumPage() {
  const router = useRouter();
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("quizzy-final-players");

    if (!saved) {
      router.push("/");
      return;
    }

    const ranked = JSON.parse(saved)
      .filter((player) => !player.eliminated)
      .sort((a, b) => b.score - a.score);

    setPlayers(ranked);
  }, [router]);

  if (!players.length) {
    return (
      <main className="podium-loading">
        <span>🏆</span>
        <p>Calculating the damage...</p>
      </main>
    );
  }

  const first = players[0];
  const second = players[1];
  const third = players[2];

  return (
    <main className="podium-page">
      <div className="podium-glow" />

      <motion.div
        className="podium-title"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p>FINAL RESULTS</p>
        <h1>We have a winner.</h1>
      </motion.div>

      <section className="podium-stage">
        {second && (
          <motion.div
            className="podium-person second-place"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, type: "spring" }}
          >
            <div className="podium-player">
              <span>{second.avatar}</span>
              <strong>{second.name}</strong>
              <b>{second.score.toLocaleString()}</b>
            </div>

            <div className="podium-block">
              <span>🥈</span>
              <strong>2</strong>
            </div>
          </motion.div>
        )}

        {first && (
          <motion.div
            className="podium-person first-place"
            initial={{ opacity: 0, y: 130 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, type: "spring" }}
          >
            <motion.div
              className="winner-crown"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                delay: 2,
                type: "spring",
                stiffness: 250,
              }}
            >
              👑
            </motion.div>

            <div className="podium-player winner">
              <span>{first.avatar}</span>
              <strong>{first.name}</strong>
              <b>{first.score.toLocaleString()}</b>
            </div>

            <div className="podium-block">
              <span>🥇</span>
              <strong>1</strong>
            </div>
          </motion.div>
        )}

        {third && (
          <motion.div
            className="podium-person third-place"
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, type: "spring" }}
          >
            <div className="podium-player">
              <span>{third.avatar}</span>
              <strong>{third.name}</strong>
              <b>{third.score.toLocaleString()}</b>
            </div>

            <div className="podium-block">
              <span>🥉</span>
              <strong>3</strong>
            </div>
          </motion.div>
        )}
      </section>

      <motion.div
        className="podium-actions"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.4 }}
      >
        <button
          className="play-again-button"
          onClick={() => router.push("/host/lobby")}
        >
          PLAY AGAIN ⚡
        </button>

        <button
          className="home-button"
          onClick={() => router.push("/")}
        >
          Back to home
        </button>
      </motion.div>

      <motion.div
        className="winner-message"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.7 }}
      >
        <span>🎉</span>
        <span>⚡</span>
        <span>🎊</span>
        <span>🏆</span>
        <span>✨</span>
      </motion.div>
    </main>
  );
}