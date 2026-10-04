# ⚡ Quizzy

### AI-Powered Real-Time Multiplayer Quiz Platform

Quizzy is an interactive web-based quiz platform that allows users to create, host, and play real-time multiplayer quizzes.

Hosts can manually create quizzes or use the built-in **AI Quiz Maker** to automatically generate questions based on a topic, difficulty level, and number of questions. Players can join live games using a unique Game PIN and compete through synchronized real-time gameplay.

Quizzy combines **AI-powered quiz generation, WebSockets, competitive scoring, player elimination, focus mode, live leaderboards, and podium results** into one interactive experience.

---

## 🌐 Live Application

**Quizzy:**  
https://quizzy-kappa-opal.vercel.app/

---

## ✨ Features

### 🤖 AI Quiz Maker

Quizzy integrates the **Groq API** to generate complete quizzes automatically.

Hosts can specify:

- Quiz topic
- Difficulty level
- Number of questions
- Additional instructions

The AI generates:

- Quiz title
- Questions
- Four answer options per question
- Correct answers
- Appropriate question time limits

The backend validates AI-generated content before allowing it to be used in a live game.

---

### ✏️ Manual Quiz Creation

Hosts can also create quizzes manually by defining:

- Quiz title
- Questions
- Four answer options
- Correct answer
- Question timer
- Gameplay settings

---

### 🎮 Real-Time Multiplayer

Quizzy uses **WebSockets** for real-time communication between the host and players.

The live game supports:

- Instant player joining
- Live lobby updates
- Synchronized questions
- Real-time answer submission
- Score updates
- Question reveals
- Host-controlled game progression
- Live leaderboard updates
- Final podium results

---

### 🔢 Game PIN System

Every hosted game receives a unique Game PIN.

Players can join by entering:

1. The Game PIN
2. Their display name

The host can see players appear in the lobby in real time before starting the game.

---

### 🔀 Shuffle Questions

Hosts can enable **Shuffle Questions** to randomize the order in which questions appear during the game.

This ensures that quiz sessions do not always follow the original question order.

---

### 🔄 Shuffle Answers

When enabled, Quizzy randomizes the answer options while preserving the correct-answer mapping.

This prevents the correct answer from consistently appearing in the same position.

---

### 🎯 Focus Mode

Quizzy includes a Focus Mode designed to discourage players from leaving the quiz during gameplay.

When enabled, the player interface monitors browser focus/visibility behavior according to the game rules.

> Browser security restrictions mean a website cannot physically prevent a user from switching tabs. Focus Mode instead detects relevant visibility/focus changes and allows Quizzy to respond through its gameplay rules.

---

### 💀 Player Elimination

Quizzy supports player elimination during competitive gameplay.

When a player is eliminated:

- The elimination is communicated during the game
- The player is removed from active competition
- The player no longer appears in the active host player list
- The player is excluded from the leaderboard
- The player is excluded from the final podium

---

### 🏆 Leaderboard & Podium

Player performance is tracked throughout the game.

Quizzy provides:

- Score tracking
- Streak tracking
- Live rankings
- Leaderboard updates
- Final podium results

Only eligible players are included in the final rankings.

---

## 🛠️ Tech Stack

### Frontend

- **Next.js 16**
- **React**
- **JavaScript**
- **Framer Motion**
- **CSS**

### Backend

- **Python**
- **FastAPI**
- **Uvicorn**
- **WebSockets**
- **HTTPX**

### Artificial Intelligence

- **Groq API**
- Groq-compatible text generation models

### Deployment

- **Vercel** — Frontend
- **PythonAnywhere** — FastAPI backend
- **GitHub** — Source control

---

## 🏗️ System Architecture

```text
                     ┌─────────────────────┐
                     │       QUIZZY        │
                     │   Next.js Frontend  │
                     │       Vercel        │
                     └──────────┬──────────┘
                                │
                     HTTPS / Secure WebSocket
                                │
                     ┌──────────▼──────────┐
                     │   FastAPI Backend   │
                     │   PythonAnywhere    │
                     └──────┬────────┬─────┘
                            │        │
                      Game Engine    │
                      WebSockets     │
                                     │ HTTPS
                                     ▼
                              ┌─────────────┐
                              │  Groq API   │
                              │ AI Quiz Gen │
                              └─────────────┘
```

---

## 📂 Project Structure

```text
quizzy/
│
├── app/
│   ├── host/
│   │   ├── ai-create/
│   │   ├── create/
│   │   ├── game/
│   │   ├── lobby/
│   │   └── podium/
│   │
│   ├── join/
│   ├── play/
│   │   ├── finished/
│   │   └── waiting/
│   │
│   └── page.js
│
├── backend/
│   ├── main.py
│   ├── game_manager.py
│   ├── requirements.txt
│   └── .env
│
├── public/
├── package.json
├── next.config.mjs
└── README.md
```

---

## 🚀 Running Quizzy Locally

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd quizzy
```

---

### 2. Install Frontend Dependencies

```bash
npm install
```

---

### 3. Configure Frontend Environment Variables

Create a `.env.local` file in the project root.

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8000
```

---

### 4. Start the Frontend

```bash
npm run dev
```

The frontend will normally run at:

```text
http://localhost:3000
```

---

## ⚙️ Backend Setup

Open another terminal:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

### Windows

```bash
venv\Scripts\activate
```

### macOS / Linux

```bash
source venv/bin/activate
```

Install the backend dependencies:

```bash
pip install -r requirements.txt
```

---

## 🔐 Backend Environment Variables

Create:

```text
backend/.env
```

Add:

```env
GROQ_API_KEY=your_groq_api_key_here
```

Never expose the Groq API key through a `NEXT_PUBLIC_*` variable.

---

## ▶️ Start the Backend

From the `backend` directory:

```bash
python -m uvicorn main:app --reload --port 8000
```

The backend will be available at:

```text
http://127.0.0.1:8000
```

FastAPI documentation:

```text
http://127.0.0.1:8000/docs
```

---

## 🤖 AI Quiz Generation Flow

```text
Host
  ↓
Enter Topic / Difficulty / Question Count
  ↓
Next.js Frontend
  ↓
POST /api/ai/generate-quiz
  ↓
FastAPI Backend
  ↓
Groq API
  ↓
Structured Quiz JSON
  ↓
Backend Validation
  ↓
Quiz returned to Host
```

The Groq API key remains on the backend and is never intentionally sent to the browser.

---

## 🎮 Multiplayer Game Flow

```text
Host Creates Quiz
        ↓
Game Room Created
        ↓
Unique PIN Generated
        ↓
Players Join Using PIN
        ↓
Host Lobby Updates
        ↓
Host Starts Game
        ↓
Questions Broadcast
        ↓
Players Submit Answers
        ↓
Scores / Streaks Updated
        ↓
Question Reveal
        ↓
Next Question
        ↓
Eliminations / Leaderboard
        ↓
Game Finished
        ↓
Final Podium
```

---

## 🔌 Main API Endpoints

### Create Game

```http
POST /api/games
```

Creates a new multiplayer game room and returns a Game PIN.

### Get Game

```http
GET /api/games/{pin}
```

Retrieves information for an existing game.

### Generate AI Quiz

```http
POST /api/ai/generate-quiz
```

Generates and validates a quiz using the Groq API.

---

## 🔄 WebSocket Connections

### Host

```text
/ws/host/{pin}
```

Used for host controls and real-time game-state communication.

### Player

```text
/ws/player/{pin}
```

Used for player joining, answers, gameplay updates, scoring, and other live events.

---

## 🔒 Security

Quizzy follows several basic security practices:

- Groq API credentials remain server-side
- Production communication uses HTTPS/WSS
- CORS restricts browser access to approved origins
- AI responses are validated before use
- Environment files should not be committed to source control
- Public frontend variables contain only non-secret configuration

---

## 🌍 Production Deployment

The production architecture is:

```text
Frontend
Vercel
      ↓
HTTPS + WSS
      ↓
FastAPI Backend
PythonAnywhere
      ↓
Groq API
```

Production frontend:

```text
https://quizzy-kappa-opal.vercel.app/
```

---

## 🔮 Future Enhancements

Possible future improvements include:

- User accounts
- Saved quiz library
- Persistent game history
- Teacher dashboards
- Quiz analytics
- Additional question types
- Team-based gameplay
- Improved reconnect handling
- Accessibility improvements
- Database-backed persistent storage
- Advanced AI quiz customization

---

## 📄 Documentation

A complete **Software Requirements Specification (SRS)** has also been prepared for Quizzy, covering:

- Functional requirements
- Non-functional requirements
- System architecture
- User roles
- Use cases
- API requirements
- WebSocket communication
- Security
- Deployment
- Acceptance criteria

---

## 👩‍💻 Developed By

**Tayyaba Sadaqat**

---

## ⚡ Quizzy

**Create. Compete. Learn.**