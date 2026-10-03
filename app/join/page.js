"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pin = searchParams.get("pin") || "";
  const [nickname, setNickname] = useState("");

  const join = () => {
    const cleanName = nickname.trim();

    if (!cleanName) return;

    const avatars = [
  "😎",
  "👾",
  "🤓",
  "🐸",
  "👻",
  "🦊",
  "🐼",
  "🤖",
];

const avatar =
  avatars[
    Math.floor(Math.random() * avatars.length)
  ];

const sessionId = crypto.randomUUID();

localStorage.setItem(
  "quizzy-player",
  JSON.stringify({
    sessionId,
    name: cleanName,
    pin,
    avatar,
    score: 0,
    streak: 0,
    eliminated: false,
  })
);

    router.push("/play/waiting");
  };

  return (
    <main className="student-page">
      <div className="student-grid" />

      <button
        className="student-back"
        onClick={() => router.push("/")}
      >
        ← Back
      </button>

      <motion.section
        className="join-container"
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="join-lightning">⚡</div>

        <p className="student-eyebrow">GAME {pin || "------"}</p>

        <h1>Who's playing?</h1>

        <p className="student-subtitle">
          Pick a nickname everyone will recognize.
        </p>

        <div className="nickname-card">
          <label>NICKNAME</label>

          <input
            autoFocus
            maxLength={20}
            placeholder="Definitely Not Sir"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") join();
            }}
          />

          <button
            disabled={!nickname.trim()}
            onClick={join}
          >
            JOIN GAME ⚡
          </button>
        </div>

        <p className="nickname-limit">
          {nickname.length}/20
        </p>
      </motion.section>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinContent />
    </Suspense>
  );
}