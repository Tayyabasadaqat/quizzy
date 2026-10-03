"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function HostPage() {
  const router = useRouter();

  return (
    <main className="host-home">
      <div className="host-grid" />

      <button className="back-button" onClick={() => router.push("/")}>
        ← Back
      </button>

      <motion.section
        className="host-content"
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="host-icon">⚡</div>

        <p className="eyebrow">QUIZZY HOST</p>

        <h1>
          Ready to cause
          <span> some chaos?</span>
        </h1>

        <p className="host-description">
          Create a quiz, invite your class and see who actually
          paid attention.
        </p>

        <motion.button
          className="create-quiz-button"
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push("/host/create")}
        >
          <span className="plus">+</span>

          <span>
            <strong>Create a quiz</strong>
            <small>Build your questions from scratch</small>
          </span>

          <span className="arrow">→</span>
        </motion.button>

        <motion.button
          className="create-quiz-button ai-quiz-button"
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push("/host/ai-create")}
        >
          <span className="plus">✦</span>
          <span>
            <strong>Make it with AI</strong>
            <small>Give Quizzy a topic and let Groq build the questions</small>
          </span>
          <span className="arrow">→</span>
        </motion.button>

        <div className="host-features">
          <span>⚡ Live</span>
          <span>🏆 Competitive</span>
          <span>🎮 Free</span>
        </div>
      </motion.section>
    </main>
  );
}