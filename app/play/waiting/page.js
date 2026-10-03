"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

const SYMBOLS = ["▲", "◆", "●", "■"];

export default function WaitingPage() {
  const router = useRouter();
  const socketRef = useRef(null);

  // ========================================
  // PLAYER / CONNECTION STATE
  // ========================================

  const [player, setPlayer] = useState(null);
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [error, setError] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [eliminated, setEliminated] = useState(false);

  // ========================================
  // GAME STATE
  // ========================================

  const [question, setQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  // waiting | question | result | finished
  const [phase, setPhase] = useState("waiting");

  // ========================================
  // ANSWER STATE
  // ========================================

  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [answerResult, setAnswerResult] = useState(null);

  // ========================================
  // FINAL RESULT STATE
  // ========================================

  const [finalResult, setFinalResult] = useState(null);

  // ========================================
  // WEBSOCKET
  // ========================================

  useEffect(() => {
    const saved = localStorage.getItem("quizzy-player");

    if (!saved) {
      router.push("/");
      return;
    }

    let storedPlayer;

    try {
      storedPlayer = JSON.parse(saved);
    } catch {
      localStorage.removeItem("quizzy-player");
      router.push("/");
      return;
    }

    if (!storedPlayer.sessionId) {
      storedPlayer.sessionId = crypto.randomUUID();
      localStorage.setItem(
        "quizzy-player",
        JSON.stringify(storedPlayer)
      );
    }

    setPlayer(storedPlayer);

    let disposed = false;

    const socket = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000"}/ws/player/${storedPlayer.pin}`
    );

    socketRef.current = socket;

    // ========================================
    // CONNECT
    // ========================================

    socket.onopen = () => {
      if (disposed || socketRef.current !== socket) {
        return;
      }

      console.log("Student WebSocket connected");

      socket.send(
        JSON.stringify({
          type: "join",
          sessionId: storedPlayer.sessionId,
          name: storedPlayer.name,
          avatar: storedPlayer.avatar,
        })
      );
    };

    // ========================================
    // SERVER MESSAGES
    // ========================================

    socket.onmessage = (event) => {
      if (disposed || socketRef.current !== socket) {
        return;
      }

      const data = JSON.parse(event.data);

      console.log("STUDENT RECEIVED:", data);

      // ----------------------------------------
      // JOINED
      // ----------------------------------------

      if (data.type === "joined") {
        setConnected(true);
        setError("");
        setFocusMode(Boolean(data.focusMode));

        const updatedPlayer = {
          ...storedPlayer,
          id: data.player.id,
          score: data.player.score || 0,
          streak: data.player.streak || 0,
        };

        setPlayer(updatedPlayer);

        localStorage.setItem(
          "quizzy-player",
          JSON.stringify(updatedPlayer)
        );

        return;
      }

      // ----------------------------------------
      // PLAYERS UPDATED
      // ----------------------------------------

      if (data.type === "players_updated") {
        setPlayerCount(data.players?.length || 0);

        /*
          Find ourselves in the server's player list
          so our score/streak stay synchronized.
        */

        setPlayer((currentPlayer) => {
          if (!currentPlayer) {
            return currentPlayer;
          }

          const me = data.players?.find(
            (item) => item.id === currentPlayer.id
          );

          if (!me) {
            return currentPlayer;
          }

          return {
            ...currentPlayer,
            score: me.score ?? currentPlayer.score ?? 0,
            streak: me.streak ?? currentPlayer.streak ?? 0,
          };
        });

        return;
      }

      // ----------------------------------------
      // GAME STARTED
      // ----------------------------------------

      if (data.type === "game_started") {
        setQuestion(data.question);

        setQuestionIndex(
          data.questionIndex ?? 0
        );

        setTotalQuestions(
          data.totalQuestions ?? 1
        );

        setTimeLeft(
          data.question?.timeLimit || 20
        );

        setSelectedAnswer(null);
        setAnswerLocked(false);
        setAnswerResult(null);

        setPhase("question");

        return;
      }

      // ----------------------------------------
      // ANSWER ACCEPTED
      // ----------------------------------------

      if (data.type === "answer_accepted") {
        /*
          We already lock immediately on click,
          but this confirms the backend accepted it.
        */

        setSelectedAnswer(
          data.answerIndex
        );

        setAnswerLocked(true);

        return;
      }

      // ----------------------------------------
      // ANSWER REJECTED
      // ----------------------------------------

      if (data.type === "answer_rejected") {
        console.warn(
          "Answer rejected:",
          data.message
        );

        /*
          If the server rejected because time expired,
          keep the question locked.

          For another kind of rejection we still do not
          allow repeated submissions for this question.
        */

        setAnswerLocked(true);

        return;
      }

      // ----------------------------------------
      // ANSWER RESULT
      // ----------------------------------------

      if (data.type === "answer_result") {
        setAnswerResult({
          correct: data.correct,
          points: data.points || 0,
          correctAnswer: data.correctAnswer,
          correctText: data.correctText || "",
        });

        setPlayer((currentPlayer) => {
          if (!currentPlayer) {
            return currentPlayer;
          }

          const updatedPlayer = {
            ...currentPlayer,
            score: data.score ?? currentPlayer.score ?? 0,
            streak: data.streak ?? 0,
          };

          localStorage.setItem(
            "quizzy-player",
            JSON.stringify(updatedPlayer)
          );

          return updatedPlayer;
        });

        setAnswerLocked(true);
        setPhase("result");

        return;
      }

      // ----------------------------------------
      // NEXT QUESTION
      // ----------------------------------------

      if (data.type === "next_question") {
        setQuestion(data.question);

        setQuestionIndex(
          data.questionIndex ?? 0
        );

        setTotalQuestions(
          data.totalQuestions ?? 1
        );

        setTimeLeft(
          data.question?.timeLimit || 20
        );

        setSelectedAnswer(null);
        setAnswerLocked(false);
        setAnswerResult(null);

        setPhase("question");

        return;
      }

      // ----------------------------------------
      // GAME FINISHED
      // ----------------------------------------

      if (data.type === "game_finished") {
        const result = {
          score: data.score || 0,
          streak: data.streak || 0,
          rank: data.rank || 0,
          totalPlayers: data.totalPlayers || 0,
          leaderboard: data.leaderboard || [],
        };

        setFinalResult(result);

        setPlayer((currentPlayer) => {
          if (!currentPlayer) {
            return currentPlayer;
          }

          const updatedPlayer = {
            ...currentPlayer,
            score: result.score,
            streak: result.streak,
          };

          localStorage.setItem(
            "quizzy-player",
            JSON.stringify(updatedPlayer)
          );

          return updatedPlayer;
        });

        setPhase("finished");

        return;
      }

      // ----------------------------------------
      // FOCUS MODE ELIMINATION
      // ----------------------------------------

      if (data.type === "eliminated") {
        setEliminated(true);
        setAnswerLocked(true);
        return;
      }

      // ----------------------------------------
      // ERROR
      // ----------------------------------------

      if (data.type === "error") {
        setError(
          data.message || "Something went wrong."
        );
      }
    };

    // ========================================
    // SOCKET ERROR
    // ========================================

    socket.onerror = () => {
      if (disposed || socketRef.current !== socket) {
        return;
      }

      console.warn(
        "Student WebSocket connection issue."
      );
    };

    // ========================================
    // SOCKET CLOSED
    // ========================================

    socket.onclose = (event) => {
      if (disposed || socketRef.current !== socket) {
        return;
      }

      console.log(
        "Student WebSocket disconnected:",
        event.code,
        event.reason
      );

      setConnected(false);
    };

    // ========================================
    // CLEANUP
    // ========================================

    return () => {
      disposed = true;

      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close();
      }
    };
  }, [router]);

  // ========================================
  // FOCUS MODE
  // ========================================

  useEffect(() => {
    if (!focusMode || phase !== "question" || eliminated) return;

    const handleVisibilityChange = () => {
      if (!document.hidden) return;

      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "focus_violation" }));
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [focusMode, phase, eliminated]);

  // ========================================
  // STUDENT TIMER
  // ========================================

  useEffect(() => {
    if (
      phase !== "question" ||
      !question ||
      timeLeft <= 0
    ) {
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((value) =>
        Math.max(0, value - 1)
      );
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [
    phase,
    question,
    timeLeft,
  ]);

  // ========================================
  // SELECT ANSWER
  // ========================================

  const selectAnswer = (answerIndex) => {
    if (phase !== "question" || eliminated) {
      return;
    }

    if (answerLocked) {
      return;
    }

    if (timeLeft <= 0) {
      return;
    }

    const socket = socketRef.current;

    if (
      !socket ||
      socket.readyState !== WebSocket.OPEN
    ) {
      console.warn(
        "Cannot submit answer: WebSocket is not connected."
      );

      return;
    }

    /*
      Lock immediately so the student can't
      double-click/change their answer while
      waiting for the server.
    */

    setSelectedAnswer(answerIndex);
    setAnswerLocked(true);

    socket.send(
      JSON.stringify({
        type: "answer",
        questionIndex,
        answerIndex,
      })
    );

    console.log(
      "ANSWER SENT:",
      {
        questionIndex,
        answerIndex,
      }
    );
  };

  // ========================================
  // LEAVE GAME
  // ========================================

  const leaveGame = () => {
    localStorage.removeItem(
      "quizzy-player"
    );

    router.push("/");
  };

  // ========================================
  // INITIAL LOADING
  // ========================================

  if (!player) {
    return (
      <main className="student-loading">
        ⚡ Joining game...
      </main>
    );
  }

  // ========================================
  // ELIMINATED SCREEN
  // ========================================

  if (eliminated) {
    return (
      <main className="student-loading">
        <div>
          <h2>Eliminated 💀</h2>
          <p>You left the game tab while Focus Mode was enabled.</p>
          <button onClick={leaveGame}>Back home</button>
        </div>
      </main>
    );
  }

  // ========================================
  // ERROR SCREEN
  // ========================================

  if (error) {
    return (
      <main className="student-loading">
        <div>
          <h2>
            Couldn&apos;t join 😭
          </h2>

          <p>{error}</p>

          <button onClick={leaveGame}>
            Back home
          </button>
        </div>
      </main>
    );
  }

  return (
    <AnimatePresence mode="wait">

      {/* =====================================
          WAITING LOBBY
      ====================================== */}

      {phase === "waiting" && (
        <motion.main
          key="waiting"
          className="waiting-page"
          initial={{
            opacity: 1,
          }}
          exit={{
            opacity: 0,
            scale: 1.04,
          }}
        >
          <div className="waiting-glow" />

          <motion.section
            className="waiting-content"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
          >
            <motion.div
              className="waiting-avatar"
              initial={{
                scale: 0,
              }}
              animate={{
                scale: 1,
              }}
              transition={{
                type: "spring",
                stiffness: 250,
              }}
            >
              {player.avatar}
            </motion.div>

            <h1>
              {connected
                ? "You're in!"
                : "Joining..."}
            </h1>

            <strong className="waiting-name">
              {player.name}
            </strong>

            <div className="waiting-message">
              <p>
                {connected
                  ? "Waiting for the host to start"
                  : "Connecting to the game"}
              </p>

              <div className="student-dots">
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="waiting-pin">
              GAME PIN

              <strong>
                {player.pin}
              </strong>
            </div>

            {connected && (
              <p
                style={{
                  marginTop: 25,
                  color: "#666671",
                  fontSize: 11,
                }}
              >
                {playerCount}{" "}
                {playerCount === 1
                  ? "player"
                  : "players"}{" "}
                in the lobby
              </p>
            )}
          </motion.section>
        </motion.main>
      )}

      {/* =====================================
          QUESTION
      ====================================== */}

      {phase === "question" && question && (
        <motion.main
          key={`question-${questionIndex}`}
          className="student-game"
          initial={{
            opacity: 0,
            scale: 0.97,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            scale: 1.03,
          }}
        >
          <header className="student-game-header">
            <span>
              {questionIndex + 1}/
              {totalQuestions}
            </span>

            <strong
              className={
                timeLeft <= 5
                  ? "red-time"
                  : ""
              }
            >
              {timeLeft}
            </strong>

            <span>
              {(player.score || 0).toLocaleString()}{" "}
              pts
            </span>
          </header>

          <section className="student-question-screen">

            <div className="student-question-text">
              <p>
                QUESTION {questionIndex + 1}
              </p>

              <h1>
                {question.text}
              </h1>
            </div>

            <div className="student-options">
              {question.options?.map(
                (option, index) => {
                  const isSelected =
                    selectedAnswer === index;

                  return (
                    <motion.button
                      key={index}
                      className={`
                        student-answer
                        answer-color-${index}
                        ${
                          isSelected
                            ? "selected-answer"
                            : ""
                        }
                      `}
                      onClick={() =>
                        selectAnswer(index)
                      }
                      disabled={
                        answerLocked ||
                        timeLeft <= 0
                      }
                      whileTap={
                        !answerLocked &&
                        timeLeft > 0
                          ? {
                              scale: 0.96,
                            }
                          : {}
                      }
                    >
                      <span>
                        {SYMBOLS[index]}
                      </span>

                      <strong>
                        {option}
                      </strong>

                      {isSelected &&
                        answerLocked && (
                          <span className="answer-lock-icon">
                            🔒
                          </span>
                        )}
                    </motion.button>
                  );
                }
              )}
            </div>

            {/* ANSWER LOCKED */}

            <AnimatePresence>
              {answerLocked && (
                <motion.div
                  className="answer-locked-message"
                  initial={{
                    opacity: 0,
                    y: 10,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                >
                  🔒 ANSWER LOCKED

                  <span>
                    Waiting for the host...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TIME UP */}

            {!answerLocked &&
              timeLeft === 0 && (
                <motion.div
                  className="answer-locked-message"
                  initial={{
                    opacity: 0,
                    y: 10,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                >
                  ⏰ TIME&apos;S UP

                  <span>
                    Waiting for results...
                  </span>
                </motion.div>
              )}

            <div className="student-bottom-stats">
              <span>
                🔥 {player.streak || 0} streak
              </span>

              <span>
                {(player.score || 0).toLocaleString()} pts
              </span>
            </div>

          </section>
        </motion.main>
      )}

      {/* =====================================
          ANSWER RESULT
      ====================================== */}

      {phase === "result" &&
        question &&
        answerResult && (
          <motion.main
            key={`result-${questionIndex}`}
            className="student-game student-result-page"
            initial={{
              opacity: 0,
              scale: 0.9,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: -30,
            }}
          >
            <header className="student-game-header">
              <span>
                {questionIndex + 1}/
                {totalQuestions}
              </span>

              <strong>
                RESULT
              </strong>

              <span>
                {(player.score || 0).toLocaleString()}{" "}
                pts
              </span>
            </header>

            <section
              className="student-question-screen"
              style={{
                textAlign: "center",
              }}
            >
              <motion.div
                initial={{
                  scale: 0,
                  rotate: -10,
                }}
                animate={{
                  scale: 1,
                  rotate: 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 250,
                }}
                style={{
                  fontSize: "70px",
                  marginBottom: "15px",
                }}
              >
                {answerResult.correct
                  ? "⚡"
                  : "💀"}
              </motion.div>

              <p
                style={{
                  fontSize: "12px",
                  fontWeight: "800",
                  letterSpacing: "2px",
                  opacity: 0.65,
                }}
              >
                {answerResult.correct
                  ? "NICE ONE"
                  : "OOF"}
              </p>

              <h1
                style={{
                  fontSize: "clamp(38px, 8vw, 72px)",
                  margin: "10px 0",
                }}
              >
                {answerResult.correct
                  ? "CORRECT!"
                  : "WRONG!"}
              </h1>

              {/* POINTS */}

              <motion.div
                initial={{
                  opacity: 0,
                  y: 15,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  delay: 0.2,
                }}
                style={{
                  marginTop: "20px",
                  marginBottom: "25px",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    fontSize: "34px",
                  }}
                >
                  +{answerResult.points}
                </strong>

                <span
                  style={{
                    fontSize: "12px",
                    opacity: 0.65,
                    fontWeight: "700",
                  }}
                >
                  POINTS
                </span>
              </motion.div>

              {/* CORRECT ANSWER */}

              {!answerResult.correct && (
                <motion.div
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  transition={{
                    delay: 0.35,
                  }}
                  style={{
                    marginBottom: "25px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "11px",
                      opacity: 0.6,
                      marginBottom: "5px",
                    }}
                  >
                    CORRECT ANSWER
                  </p>

                  <strong
                    style={{
                      fontSize: "20px",
                    }}
                  >
                    {
                      answerResult.correctText
                    }
                  </strong>
                </motion.div>
              )}

              {/* STREAK */}

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "30px",
                  marginTop: "15px",
                }}
              >
                <div>
                  <strong
                    style={{
                      display: "block",
                      fontSize: "22px",
                    }}
                  >
                    🔥 {player.streak || 0}
                  </strong>

                  <span
                    style={{
                      fontSize: "10px",
                      opacity: 0.6,
                    }}
                  >
                    STREAK
                  </span>
                </div>

                <div>
                  <strong
                    style={{
                      display: "block",
                      fontSize: "22px",
                    }}
                  >
                    {(player.score || 0).toLocaleString()}
                  </strong>

                  <span
                    style={{
                      fontSize: "10px",
                      opacity: 0.6,
                    }}
                  >
                    TOTAL SCORE
                  </span>
                </div>
              </div>

              <motion.p
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 0.6,
                }}
                transition={{
                  delay: 0.5,
                }}
                style={{
                  marginTop: "35px",
                  fontSize: "12px",
                }}
              >
                Waiting for the host...
              </motion.p>

            </section>
          </motion.main>
        )}

      {/* =====================================
          GAME FINISHED
      ====================================== */}

      {phase === "finished" &&
        finalResult && (
          <motion.main
            key="finished"
            className="waiting-page"
            initial={{
              opacity: 0,
              scale: 0.9,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
          >
            <div className="waiting-glow" />

            <motion.section
              className="waiting-content"
              initial={{
                opacity: 0,
                y: 25,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
            >
              <motion.div
                initial={{
                  scale: 0,
                  rotate: -20,
                }}
                animate={{
                  scale: 1,
                  rotate: 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 220,
                }}
                style={{
                  fontSize: "70px",
                  marginBottom: "15px",
                }}
              >
                {finalResult.rank === 1
                  ? "🏆"
                  : finalResult.rank === 2
                  ? "🥈"
                  : finalResult.rank === 3
                  ? "🥉"
                  : "🏁"}
              </motion.div>

              <p
                style={{
                  fontSize: "11px",
                  fontWeight: "800",
                  letterSpacing: "2px",
                  opacity: 0.65,
                }}
              >
                QUIZ COMPLETE
              </p>

              <h1>
                {finalResult.rank === 1
                  ? "YOU WON!"
                  : "That's a wrap!"}
              </h1>

              <strong className="waiting-name">
                {player.name}
              </strong>

              {/* RANK */}

              <div
                style={{
                  marginTop: "30px",
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    opacity: 0.6,
                  }}
                >
                  FINAL RANK
                </span>

                <strong
                  style={{
                    display: "block",
                    fontSize: "42px",
                    marginTop: "4px",
                  }}
                >
                  #{finalResult.rank}
                </strong>

                <span
                  style={{
                    fontSize: "11px",
                    opacity: 0.6,
                  }}
                >
                  out of{" "}
                  {finalResult.totalPlayers}
                </span>
              </div>

              {/* SCORE */}

              <div
                style={{
                  marginTop: "25px",
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    opacity: 0.6,
                  }}
                >
                  FINAL SCORE
                </span>

                <strong
                  style={{
                    display: "block",
                    fontSize: "34px",
                    marginTop: "5px",
                  }}
                >
                  {finalResult.score.toLocaleString()}
                </strong>

                <span
                  style={{
                    fontSize: "11px",
                    opacity: 0.6,
                  }}
                >
                  POINTS
                </span>
              </div>

              {/* MINI LEADERBOARD */}

              {finalResult.leaderboard?.length > 0 && (
                <div
                  style={{
                    width: "100%",
                    maxWidth: "380px",
                    marginTop: "30px",
                  }}
                >
                  {finalResult.leaderboard
                    .slice(0, 3)
                    .map(
                      (item, index) => (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "10px 12px",
                            marginBottom: "7px",
                            borderRadius: "12px",
                            background:
                              "rgba(255,255,255,0.08)",
                          }}
                        >
                          <span
                            style={{
                              width: "25px",
                            }}
                          >
                            {index === 0
                              ? "🥇"
                              : index === 1
                              ? "🥈"
                              : "🥉"}
                          </span>

                          <span>
                            {item.avatar}
                          </span>

                          <strong
                            style={{
                              flex: 1,
                              textAlign: "left",
                            }}
                          >
                            {item.name}
                          </strong>

                          <span>
                            {(item.score || 0).toLocaleString()}
                          </span>
                        </div>
                      )
                    )}
                </div>
              )}

              <button
                onClick={leaveGame}
                style={{
                  marginTop: "30px",
                }}
              >
                BACK HOME
              </button>

            </motion.section>
          </motion.main>
        )}

    </AnimatePresence>
  );
}