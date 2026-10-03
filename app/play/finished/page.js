"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function FinishedPage() {
  const router = useRouter();
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("quizzy-player");

    if (!saved) {
      router.push("/");
      return;
    }

    setPlayer(JSON.parse(saved));
  }, [router]);

  if (!player) return null;

  return (
    <main className="finished-page">
      <motion.div
        className="finished-icon"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring" }}
      >
        🏁
      </motion.div>

      <p>QUIZ COMPLETE</p>

      <h1>You're done!</h1>

      <span className="finished-name">
        {player.name}
      </span>

      <div className="finished-score">
        FINAL SCORE

        <strong>
          {player.score.toLocaleString()}
        </strong>

        <small>POINTS</small>
      </div>

      <p className="finished-wait">
        Waiting for the final leaderboard...
      </p>

      <button onClick={() => router.push("/")}>
        LEAVE GAME
      </button>
    </main>
  );
}