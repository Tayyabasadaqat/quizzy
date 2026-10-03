"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

const SYMBOLS = ["▲", "◆", "●", "■"];

export default function StudentPlay() {
  const router = useRouter();

  const [player, setPlayer] = useState(null);
  const [quiz, setQuiz] = useState(null);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  const [phase, setPhase] = useState("question");
  const [timeLeft, setTimeLeft] = useState(0);

  const [result, setResult] = useState(null);
  const [eliminated, setEliminated] = useState(false);

  useEffect(() => {
    const savedPlayer = localStorage.getItem("quizzy-player");
    const savedQuiz = localStorage.getItem("quizzy-current-quiz");

    if (!savedPlayer || !savedQuiz) {
      router.push("/");
      return;
    }

    const parsedPlayer = JSON.parse(savedPlayer);
    const parsedQuiz = JSON.parse(savedQuiz);

    setPlayer(parsedPlayer);
    setQuiz(parsedQuiz);

    setTimeLeft(parsedQuiz.questions[0].timeLimit);
  }, [router]);

  /*
    FOCUS MODE

    Later the server will receive the elimination event.
  */

  useEffect(() => {
    if (!quiz?.settings?.focusMode) return;

    const detectTabChange = () => {
      if (
        document.hidden &&
        phase === "question" &&
        !eliminated
      ) {
        setEliminated(true);

        const updated = {
          ...player,
          eliminated: true,
        };

        setPlayer(updated);

        localStorage.setItem(
          "quizzy-player",
          JSON.stringify(updated)
        );
      }
    };

    document.addEventListener(
      "visibilitychange",
      detectTabChange
    );

    return () =>
      document.removeEventListener(
        "visibilitychange",
        detectTabChange
      );
  }, [quiz, phase, eliminated, player]);

  const question = quiz?.questions?.[questionIndex];

  /*
    Timer
  */

  useEffect(() => {
    if (!question || phase !== "question") return;

    if (timeLeft <= 0) {
      calculateResult(null);
      return;
    }

    const timer = setTimeout(
      () => setTimeLeft((current) => current - 1),
      1000
    );

    return () => clearTimeout(timer);
  }, [timeLeft, phase, question]);

  const selectAnswer = (index) => {
    if (
      selectedAnswer !== null ||
      eliminated ||
      phase !== "question"
    ) {
      return;
    }

    setSelectedAnswer(index);

    /*
      Temporary delay.

      Later the HOST decides when answers
      are revealed.
    */

    setTimeout(() => {
      calculateResult(index);
    }, 1300);
  };

  const calculateResult = (answerIndex) => {
    if (phase !== "question") return;

    const correct =
      answerIndex === question.correctAnswer;

    let points = 0;
    let newStreak = 0;

    if (correct) {
      /*
        Base 500
        + up to 500 speed points.
      */

      const speedRatio =
        timeLeft / question.timeLimit;

      points =
        500 + Math.round(speedRatio * 500);

      newStreak = (player.streak || 0) + 1;
    }

    const updatedPlayer = {
      ...player,

      score: (player.score || 0) + points,

      streak: correct
        ? newStreak
        : 0,
    };

    setPlayer(updatedPlayer);

    localStorage.setItem(
      "quizzy-player",
      JSON.stringify(updatedPlayer)
    );

    setResult({
      correct,
      points,
      correctAnswer: question.correctAnswer,
    });

    setPhase("result");
  };

  const nextQuestion = () => {
    const next = questionIndex + 1;

    if (next >= quiz.questions.length) {
      router.push("/play/finished");
      return;
    }

    setQuestionIndex(next);
    setSelectedAnswer(null);
    setResult(null);
    setPhase("question");

    setTimeLeft(
      quiz.questions[next].timeLimit
    );
  };

  if (!player || !quiz || !question) {
    return (
      <main className="student-loading">
        ⚡ Loading game...
      </main>
    );
  }

  if (eliminated) {
    return (
      <main className="eliminated-page">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="skull"
        >
          💀
        </motion.div>

        <p>FOCUS LOST</p>

        <h1>You're out.</h1>

        <span>
          You left the game while Focus Mode was active.
        </span>

        <div className="eliminated-score">
          FINAL SCORE
          <strong>
            {player.score.toLocaleString()}
          </strong>
        </div>
      </main>
    );
  }

  return (
    <main className="student-game">
      <header className="student-game-header">
        <span>
          {questionIndex + 1}/{quiz.questions.length}
        </span>

        <strong className={timeLeft <= 5 ? "red-time" : ""}>
          {timeLeft}
        </strong>

        <span>
          {player.score.toLocaleString()} pts
        </span>
      </header>

      <AnimatePresence mode="wait">
        {phase === "question" && (
          <motion.section
            key={`student-question-${questionIndex}`}
            className="student-question-screen"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="student-question-text">
              <p>QUESTION {questionIndex + 1}</p>

              <h1>{question.text}</h1>
            </div>

            <div className="student-options">
              {question.options.map((option, index) => (
                <motion.button
                  key={index}
                  className={`student-answer answer-color-${index} ${
                    selectedAnswer === index
                      ? "student-selected"
                      : ""
                  }`}
                  disabled={selectedAnswer !== null}
                  onClick={() => selectAnswer(index)}
                  whileTap={{ scale: 0.97 }}
                >
                  <span>{SYMBOLS[index]}</span>

                  <strong>{option}</strong>
                </motion.button>
              ))}
            </div>

            {selectedAnswer !== null && (
              <motion.div
                className="answer-locked"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                🔒 Answer locked
              </motion.div>
            )}

            <div className="student-bottom-stats">
              <span>
                🔥 {player.streak || 0} streak
              </span>

              <span>
                {player.score.toLocaleString()} pts
              </span>
            </div>
          </motion.section>
        )}

        {phase === "result" && result && (
          <motion.section
            key="student-result"
            className={`student-result ${
              result.correct
                ? "result-correct"
                : "result-wrong"
            }`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <motion.div
              className="result-icon"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 250,
              }}
            >
              {result.correct ? "✓" : "✕"}
            </motion.div>

            <p>
              {result.correct
                ? "CORRECT!"
                : "WRONG"}
            </p>

            <h1>
              +{result.points.toLocaleString()}
            </h1>

            {!result.correct && (
              <div className="correct-answer-display">
                Correct answer
                <strong>
                  {
                    question.options[
                      result.correctAnswer
                    ]
                  }
                </strong>
              </div>
            )}

            {result.correct &&
              player.streak >= 2 && (
                <div className="streak-message">
                  🔥 {player.streak} answer streak!
                </div>
              )}

            <div className="result-total">
              TOTAL
              <strong>
                {player.score.toLocaleString()}
              </strong>
            </div>

            <button onClick={nextQuestion}>
              {questionIndex ===
              quiz.questions.length - 1
                ? "FINISH GAME →"
                : "TEMP: NEXT QUESTION →"}
            </button>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}