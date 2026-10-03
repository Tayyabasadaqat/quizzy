"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

const ANSWER_SYMBOLS = ["▲", "◆", "●", "■"];

export default function HostGame() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pin = searchParams.get("pin");

  const socketRef = useRef(null);
  const revealSentRef = useRef(false);

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);

  const [questionIndex, setQuestionIndex] =
    useState(0);

  const [timeLeft, setTimeLeft] =
    useState(0);

  const [players, setPlayers] =
    useState([]);

  const [answersReceived, setAnswersReceived] =
    useState(0);

  const [connected, setConnected] =
    useState(false);

  const [error, setError] =
    useState("");

  const [eliminationNotice, setEliminationNotice] =
    useState(null);

  // question | reveal | leaderboard
  const [phase, setPhase] =
    useState("question");

  // ========================================
  // LOAD QUIZ
  // ========================================

  useEffect(() => {
    const savedQuiz =
      localStorage.getItem(
        "quizzy-current-quiz"
      );

    if (!savedQuiz) {
      router.push("/host/create");
      return;
    }

    try {
      const parsedQuiz =
        JSON.parse(savedQuiz);

      setQuiz(parsedQuiz);

      setQuestions(
        parsedQuiz.questions || []
      );

      if (
        parsedQuiz.questions?.length > 0
      ) {
        setTimeLeft(
          parsedQuiz.questions[0]
            .timeLimit || 20
        );
      }
    } catch (err) {
      console.error(
        "Could not load quiz:",
        err
      );

      router.push("/host/create");
    }
  }, [router]);

  // ========================================
  // HOST WEBSOCKET
  // ========================================

  useEffect(() => {
    if (!pin) {
      router.push("/host");
      return;
    }

    let disposed = false;

    const socket = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000"}/ws/host/${pin}`
    );

    socketRef.current = socket;

    socket.onopen = () => {
      if (
        disposed ||
        socketRef.current !== socket
      ) {
        return;
      }

      console.log(
        "Host game WebSocket connected"
      );

      setConnected(true);
      setError("");
    };

    socket.onmessage = (event) => {
      if (
        disposed ||
        socketRef.current !== socket
      ) {
        return;
      }

      const data =
        JSON.parse(event.data);

      console.log(
        "HOST GAME RECEIVED:",
        data
      );

      // ------------------------------
      // INITIAL CONNECTION
      // ------------------------------

      if (data.type === "connected") {
        setConnected(true);

        setPlayers(
          data.players || []
        );
      }

      // ------------------------------
      // PLAYERS UPDATED
      // ------------------------------

      if (
        data.type ===
        "players_updated"
      ) {
        setPlayers(
          data.players || []
        );
      }

      // ------------------------------
      // PLAYER ELIMINATED
      // ------------------------------

      if (data.type === "player_eliminated") {
        setPlayers((current) =>
          current.filter(
            (player) => player.id !== data.playerId
          )
        );

        setEliminationNotice({
          name: data.name || "Player",
          avatar: data.avatar || "💀",
        });

        window.setTimeout(() => {
          setEliminationNotice(null);
        }, 3500);
      }

      // ------------------------------
      // ANSWER COUNTER
      // ------------------------------

      if (
        data.type ===
        "answer_count_updated"
      ) {
        setAnswersReceived(
          data.answered || 0
        );
      }

      // ------------------------------
      // QUESTION REVEALED
      // ------------------------------

      if (
        data.type ===
        "question_revealed"
      ) {
        if (data.players) {
          setPlayers(
            data.players
          );
        }

        setPhase("reveal");
      }

      // ------------------------------
      // NEXT QUESTION
      // ------------------------------

      if (
        data.type ===
        "next_question"
      ) {
        const newIndex =
          data.questionIndex ?? 0;

        setQuestionIndex(
          newIndex
        );

        setAnswersReceived(0);

        revealSentRef.current =
          false;

        setPhase("question");

        setTimeLeft(
          data.question?.timeLimit || 20
        );
      }

      // ------------------------------
      // NO MORE QUESTIONS
      // ------------------------------

      if (
        data.type ===
        "no_more_questions"
      ) {
        finishGame();
      }

      // ------------------------------
      // GAME FINISHED
      // ------------------------------

      if (
        data.type ===
        "game_finished"
      ) {
        const leaderboard =
          data.leaderboard || [];

        localStorage.setItem(
          "quizzy-final-players",
          JSON.stringify(
            leaderboard
          )
        );

        router.push(
          `/host/podium?pin=${pin}`
        );
      }

      // ------------------------------
      // ERROR
      // ------------------------------

      if (data.type === "error") {
        console.error(
          "Quizzy server error:",
          data.message
        );

        setError(
          data.message ||
            "Something went wrong."
        );
      }
    };

    socket.onerror = () => {
      if (
        disposed ||
        socketRef.current !== socket
      ) {
        return;
      }

      console.warn(
        "Host game WebSocket issue."
      );
    };

    socket.onclose = (event) => {
      if (
        disposed ||
        socketRef.current !== socket
      ) {
        return;
      }

      console.log(
        "Host game WebSocket disconnected:",
        event.code,
        event.reason
      );

      setConnected(false);
    };

    return () => {
      disposed = true;

      if (
        socketRef.current === socket
      ) {
        socketRef.current = null;
      }

      if (
        socket.readyState ===
          WebSocket.OPEN ||
        socket.readyState ===
          WebSocket.CONNECTING
      ) {
        socket.close();
      }
    };
  }, [
    pin,
    router,
  ]);

  // ========================================
  // CURRENT QUESTION
  // ========================================

  const currentQuestion =
    questions[questionIndex];

  // ========================================
  // TIMER
  // ========================================

  useEffect(() => {
    if (
      !currentQuestion ||
      phase !== "question"
    ) {
      return;
    }

    if (timeLeft <= 0) {
      revealAnswer();
      return;
    }

    const timer =
      setTimeout(() => {
        setTimeLeft(
          (time) =>
            Math.max(
              0,
              time - 1
            )
        );
      }, 1000);

    return () =>
      clearTimeout(timer);
  }, [
    timeLeft,
    currentQuestion,
    phase,
  ]);

  // ========================================
  // REVEAL ANSWER
  // ========================================

  const revealAnswer = () => {
    if (
      phase !== "question" ||
      revealSentRef.current
    ) {
      return;
    }

    const socket =
      socketRef.current;

    if (
      !socket ||
      socket.readyState !==
        WebSocket.OPEN
    ) {
      console.warn(
        "Cannot reveal: socket disconnected."
      );

      return;
    }

    revealSentRef.current =
      true;

    socket.send(
      JSON.stringify({
        type:
          "reveal_question",
      })
    );
  };

  // ========================================
  // SHOW LEADERBOARD
  // ========================================

  const showLeaderboard = () => {
    setPhase("leaderboard");
  };

  // ========================================
  // NEXT QUESTION
  // ========================================

  const nextQuestion = () => {
    const socket =
      socketRef.current;

    if (
      !socket ||
      socket.readyState !==
        WebSocket.OPEN
    ) {
      return;
    }

    const finalQuestion =
      questionIndex ===
      questions.length - 1;

    if (finalQuestion) {
      finishGame();
      return;
    }

    socket.send(
      JSON.stringify({
        type:
          "next_question",
      })
    );
  };

  // ========================================
  // FINISH GAME
  // ========================================

  const finishGame = () => {
    const socket =
      socketRef.current;

    if (
      !socket ||
      socket.readyState !==
        WebSocket.OPEN
    ) {
      console.warn(
        "Cannot finish game: socket disconnected."
      );

      return;
    }

    socket.send(
      JSON.stringify({
        type: "finish_game",
      })
    );
  };

  // ========================================
  // RANKING
  // ========================================

  const rankedPlayers =
    useMemo(() => {
      return [...players].sort(
        (a, b) =>
          (b.score || 0) -
          (a.score || 0)
      );
    }, [players]);

  // ========================================
  // LOADING
  // ========================================

  if (
    !quiz ||
    !currentQuestion
  ) {
    return (
      <main className="game-loading">
        <div>⚡</div>

        <p>
          Preparing chaos...
        </p>
      </main>
    );
  }

  // ========================================
  // ERROR
  // ========================================

  if (error) {
    return (
      <main className="game-loading">
        <div>⚠️</div>

        <p>{error}</p>

        <button
          onClick={() =>
            router.push("/host")
          }
        >
          Back
        </button>
      </main>
    );
  }

  // ========================================
  // UI
  // ========================================

  return (
    <main className="host-game-page">
      <AnimatePresence>
        {eliminationNotice && (
          <motion.div
            key={eliminationNotice.name}
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.96 }}
            style={{
              position: "fixed",
              top: 22,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 9999,
              padding: "14px 20px",
              borderRadius: 14,
              background: "#17171c",
              color: "white",
              boxShadow: "0 12px 35px rgba(0,0,0,.28)",
              fontWeight: 800,
              letterSpacing: ".2px",
            }}
          >
            {eliminationNotice.avatar} {eliminationNotice.name} got eliminated 💀
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP BAR */}

      <header className="game-topbar">

        <div className="game-brand">
          ⚡ QUIZZY
        </div>

        <div className="game-progress">
          Question{" "}
          {questionIndex + 1} /{" "}
          {questions.length}
        </div>

        <div className="game-pin-small">
          PIN{" "}
          <strong>
            {pin}
          </strong>
        </div>

      </header>

      {!connected && (
        <div
          style={{
            textAlign: "center",
            padding: "8px",
            fontSize: "12px",
          }}
        >
          Connecting to Quizzy
          server...
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* QUESTION */}

        {phase === "question" && (
          <QuestionPhase
            key={`question-${questionIndex}`}
            question={
              currentQuestion
            }
            timeLeft={
              timeLeft
            }
            answersReceived={
              answersReceived
            }
            playerCount={
              players.length
            }
            revealAnswer={
              revealAnswer
            }
          />
        )}

        {/* REVEAL */}

        {phase === "reveal" && (
          <RevealPhase
            key={`reveal-${questionIndex}`}
            question={
              currentQuestion
            }
            players={
              players
            }
            showLeaderboard={
              showLeaderboard
            }
          />
        )}

        {/* LEADERBOARD */}

        {phase ===
          "leaderboard" && (
          <LeaderboardPhase
            key={`leaderboard-${questionIndex}`}
            players={
              rankedPlayers
            }
            finalQuestion={
              questionIndex ===
              questions.length - 1
            }
            nextQuestion={
              nextQuestion
            }
          />
        )}

      </AnimatePresence>
    </main>
  );
}


// ========================================
// QUESTION PHASE
// ========================================

function QuestionPhase({
  question,
  timeLeft,
  answersReceived,
  playerCount,
  revealAnswer,
}) {
  return (
    <motion.section
      className="question-phase"
      initial={{
        opacity: 0,
        scale: 0.98,
      }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
      exit={{
        opacity: 0,
        y: -20,
      }}
    >

      <div className="question-status">

        <div
          className={`big-timer ${
            timeLeft <= 5
              ? "danger"
              : ""
          }`}
        >
          {timeLeft}
        </div>

        <div className="answers-received">
          <strong>
            {answersReceived}
          </strong>

          <span>
            / {playerCount}
          </span>

          <small>
            ANSWERS
          </small>
        </div>

      </div>

      <div className="host-question">
        <p>QUESTION</p>

        <h1>
          {question.text}
        </h1>
      </div>

      <div className="host-answer-grid">

        {question.options.map(
          (option, index) => (
            <motion.div
              key={index}
              className={`host-answer answer-color-${index}`}
              initial={{
                opacity: 0,
                y: 25,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay:
                  index * 0.07,
              }}
            >
              <span>
                {
                  ANSWER_SYMBOLS[
                    index
                  ]
                }
              </span>

              <strong>
                {option}
              </strong>
            </motion.div>
          )
        )}

      </div>

      <button
        className="end-question-button"
        onClick={
          revealAnswer
        }
      >
        END QUESTION EARLY
      </button>

    </motion.section>
  );
}


// ========================================
// REVEAL PHASE
// ========================================

function RevealPhase({
  question,
  players,
  showLeaderboard,
}) {
  const correctPlayers =
    players.filter(
      (player) =>
        (player.lastPoints || 0) >
        0
    ).length;

  return (
    <motion.section
      className="reveal-phase"
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      exit={{
        opacity: 0,
      }}
    >

      <p className="reveal-eyebrow">
        ANSWER REVEAL
      </p>

      <h1>
        {question.text}
      </h1>

      <div className="reveal-options">

        {question.options.map(
          (option, index) => {
            const correct =
              question.correctAnswer ===
              index;

            return (
              <motion.div
                key={index}
                className={`reveal-answer ${
                  correct
                    ? "correct"
                    : "wrong"
                }`}
                initial={{
                  scale: 0.9,
                  opacity: 0,
                }}
                animate={{
                  scale: 1,
                  opacity: 1,
                }}
                transition={{
                  delay:
                    index * 0.08,
                }}
              >
                <span>
                  {
                    ANSWER_SYMBOLS[
                      index
                    ]
                  }
                </span>

                <strong>
                  {option}
                </strong>

                {correct && (
                  <b>✓</b>
                )}
              </motion.div>
            );
          }
        )}

      </div>

      <div className="answer-summary">

        <div>
          <strong>
            {correctPlayers}
          </strong>

          <span>
            Correct
          </span>
        </div>

        <div>
          <strong>
            {Math.max(
              0,
              players.length -
                correctPlayers
            )}
          </strong>

          <span>
            Wrong
          </span>
        </div>

      </div>

      <button
        className="continue-button"
        onClick={
          showLeaderboard
        }
      >
        SEE LEADERBOARD →
      </button>

    </motion.section>
  );
}


// ========================================
// LEADERBOARD PHASE
// ========================================

function LeaderboardPhase({
  players,
  finalQuestion,
  nextQuestion,
}) {
  return (
    <motion.section
      className="leaderboard-phase"
      initial={{
        opacity: 0,
        y: 25,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
      }}
    >

      <p className="leaderboard-eyebrow">
        {finalQuestion
          ? "FINAL STANDINGS"
          : "CURRENT STANDINGS"}
      </p>

      <h1>
        Leaderboard
      </h1>

      <div className="leaderboard-list">

        {players.map(
          (player, index) => (
            <motion.div
              key={player.id}
              className={`leaderboard-row ${
                index === 0
                  ? "leader"
                  : ""
              }`}
              initial={{
                opacity: 0,
                x: -25,
              }}
              animate={{
                opacity: 1,
                x: 0,
              }}
              transition={{
                delay:
                  index * 0.08,
              }}
            >

              <span className="rank">
                {index === 0
                  ? "👑"
                  : index + 1}
              </span>

              <span className="leader-avatar">
                {player.avatar}
              </span>

              <strong>
                {player.name}
              </strong>

              <span className="points-earned">
                {(player.lastPoints ||
                  0) > 0
                  ? `+${
                      player.lastPoints
                    }`
                  : "+0"}
              </span>

              <b>
                {(
                  player.score || 0
                ).toLocaleString()}
              </b>

            </motion.div>
          )
        )}

      </div>

      <button
        className="continue-button"
        onClick={
          nextQuestion
        }
      >
        {finalQuestion
          ? "SEE FINAL RESULTS 🏆"
          : "NEXT QUESTION →"}
      </button>

    </motion.section>
  );
}