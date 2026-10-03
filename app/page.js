"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function Home() {
  const router = useRouter();

  const [gamePin, setGamePin] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const joinGame = async () => {
    const pin = gamePin.trim();

    if (!pin || joining) return;

    if (pin.length !== 6) {
      setError("Enter a valid 6-digit game PIN.");
      return;
    }

    setJoining(true);
    setError("");

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/games/${pin}`
      );

      if (!response.ok) {
        throw new Error("Server request failed.");
      }

      const data = await response.json();

      if (!data.exists) {
        setError("That game doesn't exist 👀");
        return;
      }

      if (data.status !== "lobby") {
        setError("That game has already started.");
        return;
      }

      router.push(`/join?pin=${pin}`);
    } catch (error) {
      console.error("Join game error:", error);

      setError(
        "Couldn't connect to the Quizzy server. Is the backend running?"
      );
    } finally {
      setJoining(false);
    }
  };

  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, "");

    setGamePin(value);

    if (error) {
      setError("");
    }
  };

  return (
    <main className="home">
      <div className="background-grid" />

      <section className="hero">
        <motion.div
          className="logo"
          initial={{ rotate: -8, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
        >
          ⚡
        </motion.div>

        <h1>QUIZZY</h1>

        <p className="tagline">
          Make class a little chaotic.
        </p>

        <div className="join-card">
          <label htmlFor="gamePin">
            GAME PIN
          </label>

          <input
            id="gamePin"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="482913"
            value={gamePin}
            onChange={handlePinChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                joinGame();
              }
            }}
          />

          {error && (
            <motion.p
              initial={{
                opacity: 0,
                y: -5,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              style={{
                color: "#ff4569",
                fontSize: "12px",
                margin: "0 0 10px",
                textAlign: "center",
              }}
            >
              {error}
            </motion.p>
          )}

          <button
            className="join-button"
            onClick={joinGame}
            disabled={
              gamePin.length !== 6 ||
              joining
            }
          >
            {joining
              ? "CHECKING..."
              : "JOIN GAME"}
          </button>
        </div>

        <button
          className="host-button"
          onClick={() =>
            router.push("/host")
          }
        >
          Host a game
          <span>→</span>
        </button>

        <p className="tiny-text">
          No accounts. No setup. Just play.
        </p>
      </section>
    </main>
  );
}