"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const emptyQuestion = () => ({
  id: crypto.randomUUID(),
  text: "",
  options: ["", "", "", ""],
  correctAnswer: null,
  timeLimit: 20,
});

export default function CreateQuiz() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleAnswers, setShuffleAnswers] = useState(true);
  const [focusMode, setFocusMode] = useState(true);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("source") !== "ai") return;
    const saved = localStorage.getItem("quizzy-ai-draft");
    if (!saved) return;
    try {
      const draft = JSON.parse(saved);
      if (draft.title) setTitle(draft.title);
      if (Array.isArray(draft.questions) && draft.questions.length) setQuestions(draft.questions);
      localStorage.removeItem("quizzy-ai-draft");
    } catch (error) {
      console.error("Could not load AI draft:", error);
    }
  }, []);

  const updateQuestion = (id, field, value) => {
    setQuestions((current) =>
      current.map((question) =>
        question.id === id
          ? { ...question, [field]: value }
          : question
      )
    );
  };

  const updateOption = (questionId, optionIndex, value) => {
    setQuestions((current) =>
      current.map((question) => {
        if (question.id !== questionId) return question;

        const options = [...question.options];
        options[optionIndex] = value;

        return { ...question, options };
      })
    );
  };

  const addQuestion = () => {
    setQuestions((current) => [...current, emptyQuestion()]);
  };

  const deleteQuestion = (id) => {
    if (questions.length === 1) return;

    setQuestions((current) =>
      current.filter((question) => question.id !== id)
    );
  };

  const isValid =
    title.trim() &&
    questions.every(
      (question) =>
        question.text.trim() &&
        question.options.every((option) => option.trim()) &&
        question.correctAnswer !== null
    );

    const createGame = async () => {
  if (!isValid) return;

  const preparedQuestions = questions.map((question) => ({
    ...question,
    text: question.text.trim(),
    options: question.options.map((option) => option.trim()),
  }));

  // Shuffle the question order ONCE for the whole live game.
  // Everyone must receive the SAME question order so the host and students
  // stay synchronized. If shuffling randomly lands on the original order,
  // force a rotation so enabling Shuffle Questions always visibly changes it.
  if (shuffleQuestions && preparedQuestions.length > 1) {
    const originalOrder = preparedQuestions.map((question) => question.id);

    for (let i = preparedQuestions.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [preparedQuestions[i], preparedQuestions[j]] = [
        preparedQuestions[j],
        preparedQuestions[i],
      ];
    }

    const stayedInOriginalOrder = preparedQuestions.every(
      (question, index) => question.id === originalOrder[index]
    );

    if (stayedInOriginalOrder) {
      preparedQuestions.push(preparedQuestions.shift());
    }
  }

  const quiz = {
    title: title.trim(),
    questions: preparedQuestions,

    settings: {
      shuffleQuestions,
      shuffleAnswers,
      focusMode,
    },
  };

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/games`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          quiz,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Server returned ${response.status}`
      );
    }

    const data = await response.json();

    console.log("CREATE GAME RESPONSE:", data);

    if (!data.success || !data.pin) {
      throw new Error(
        data.message || "Game could not be created."
      );
    }

    localStorage.setItem(
      "quizzy-current-quiz",
      JSON.stringify(quiz)
    );

    localStorage.setItem(
      "quizzy-game-pin",
      data.pin
    );

    router.push(
      `/host/lobby?pin=${data.pin}`
    );
  } catch (error) {
    console.error(
      "CREATE GAME ERROR:",
      error
    );

    alert(
      "Could not create the game. Make sure the Quizzy backend is running."
    );
  }
};

  return (
    <main className="builder-page">
      <header className="builder-header">
        <button onClick={() => router.push("/host")}>← Back</button>

        <div className="builder-logo">⚡ QUIZZY</div>

        <div className="question-count">
          {questions.length} {questions.length === 1 ? "question" : "questions"}
        </div>
      </header>

      <section className="builder-container">
        <motion.div
          className="builder-intro"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p>QUIZ BUILDER</p>
          <h1>Build your chaos.</h1>

          <input
            className="quiz-title-input"
            placeholder="Give your quiz a name..."
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
          />
        </motion.div>

        <div className="questions-list">
          <AnimatePresence>
            {questions.map((question, questionIndex) => (
              <motion.article
                key={question.id}
                className="question-editor"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
              >
                <div className="question-top">
                  <span>QUESTION {questionIndex + 1}</span>

                  {questions.length > 1 && (
                    <button
                      className="delete-question"
                      onClick={() => deleteQuestion(question.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>

                <textarea
                  placeholder="Type your question..."
                  value={question.text}
                  maxLength={250}
                  onChange={(e) =>
                    updateQuestion(
                      question.id,
                      "text",
                      e.target.value
                    )
                  }
                />

                <p className="answer-instruction">
                  Add four answers and click the circle beside the correct one.
                </p>

                <div className="options-grid">
                  {question.options.map((option, optionIndex) => (
                    <div
                      className={`option-editor option-${optionIndex}`}
                      key={optionIndex}
                    >
                      <button
                        type="button"
                        className={`correct-selector ${
                          question.correctAnswer === optionIndex
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          updateQuestion(
                            question.id,
                            "correctAnswer",
                            optionIndex
                          )
                        }
                        aria-label={`Mark answer ${optionIndex + 1} as correct`}
                      >
                        {question.correctAnswer === optionIndex
                          ? "✓"
                          : ""}
                      </button>

                      <input
                        placeholder={`Answer ${optionIndex + 1}`}
                        value={option}
                        maxLength={120}
                        onChange={(e) =>
                          updateOption(
                            question.id,
                            optionIndex,
                            e.target.value
                          )
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="question-settings">
                  <label>
                    ⏱ Time limit

                    <select
                      value={question.timeLimit}
                      onChange={(e) =>
                        updateQuestion(
                          question.id,
                          "timeLimit",
                          Number(e.target.value)
                        )
                      }
                    >
                      <option value={10}>10 seconds</option>
                      <option value={15}>15 seconds</option>
                      <option value={20}>20 seconds</option>
                      <option value={30}>30 seconds</option>
                      <option value={45}>45 seconds</option>
                      <option value={60}>60 seconds</option>
                    </select>
                  </label>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>

        <button className="add-question" onClick={addQuestion}>
          <span>+</span>
          Add another question
        </button>

        <section className="game-settings">
          <div>
            <p className="settings-eyebrow">GAME SETTINGS</p>
            <h2>How should this game behave?</h2>
          </div>

          <Toggle
            title="Shuffle questions"
            description="Randomize question order when the game begins."
            value={shuffleQuestions}
            setValue={setShuffleQuestions}
          />

          <Toggle
            title="Shuffle answers"
            description="Randomize the answer positions for players."
            value={shuffleAnswers}
            setValue={setShuffleAnswers}
          />

          <Toggle
            title="Focus mode"
            description="Leaving the game tab eliminates the player."
            value={focusMode}
            setValue={setFocusMode}
          />
        </section>

        <div className="create-game-section">
          {!isValid && (
            <p>
              Complete the title, every question, all four answers and select
              the correct answer.
            </p>
          )}

          <button
            className="create-game-button"
            disabled={!isValid}
            onClick={createGame}
          >
            CREATE GAME ⚡
          </button>
        </div>
      </section>
    </main>
  );
}

function Toggle({ title, description, value, setValue }) {
  return (
    <div className="setting-row">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <button
        type="button"
        className={`toggle ${value ? "active" : ""}`}
        onClick={() => setValue(!value)}
        aria-pressed={value}
      >
        <span />
      </button>
    </div>
  );
}