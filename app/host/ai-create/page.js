"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function AIQuizMaker() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("Medium");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateQuiz = async () => {
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/ai/generate-quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), count, difficulty, instructions: instructions.trim() }),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      if (!data.success || !data.quiz) throw new Error(data.message || "Quiz generation failed.");

      localStorage.setItem("quizzy-ai-draft", JSON.stringify(data.quiz));
      router.push("/host/create?source=ai");
    } catch (err) {
      console.error("AI QUIZ ERROR:", err);
      setError(err.message || "Couldn't generate the quiz.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="ai-maker-page">
      <div className="background-grid" />
      <button className="back-button" onClick={() => router.push("/host")}>← Back</button>
      <motion.section className="ai-maker-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="ai-spark">✦</div>
        <p className="eyebrow">QUIZZY AI</p>
        <h1>Make a quiz in seconds.</h1>
        <p className="ai-subtitle">Tell me the topic. Groq handles the chaos.</p>

        <label>WHAT SHOULD THE QUIZ BE ABOUT?</label>
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Python basics, World War II, Machine Learning..." maxLength={500} />

        <div className="ai-maker-row">
          <label>QUESTIONS<select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[3,5,10,15,20].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>DIFFICULTY<select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option>Easy</option><option>Medium</option><option>Hard</option></select></label>
        </div>

        <label>EXTRA INSTRUCTIONS <span>(optional)</span></label>
        <input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Focus on definitions and practical examples" maxLength={300} />

        {error && <p className="ai-error">{error}</p>}
        <button className="ai-generate-button" onClick={generateQuiz} disabled={!topic.trim() || loading}>{loading ? "GENERATING CHAOS..." : "✦ GENERATE QUIZ"}</button>
        <p className="ai-note">You can review and edit every AI-generated question before creating the game.</p>
      </motion.section>
    </main>
  );
}
