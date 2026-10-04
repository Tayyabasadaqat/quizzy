import uuid
import json
import os
import re

import httpx
from dotenv import load_dotenv

from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
)

from fastapi.middleware.cors import CORSMiddleware

from game_manager import manager

load_dotenv()


# ==================================================
# APP
# ==================================================

app = FastAPI(
    title="Quizzy API",
    version="0.3.0",
)


# ==================================================
# CORS
# ==================================================

frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================================================
# ROOT
# ==================================================

@app.get("/")
def root():
    return {
        "message": "Quizzy backend is alive ⚡"
    }




# ==================================================
# AI QUIZ MAKER (GROQ)
# ==================================================

def _extract_json_object(text: str):
    text = text.strip()
    text = re.sub(r"^```(?:json)?\\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("AI response did not contain JSON.")
    return json.loads(text[start:end + 1])


async def _choose_groq_model(client: httpx.AsyncClient, headers: dict, requested: str):
    if requested:
        return requested

    response = await client.get(
        "https://api.groq.com/openai/v1/models",
        headers=headers,
        timeout=20.0,
    )
    response.raise_for_status()
    ids = [item.get("id", "") for item in response.json().get("data", [])]

    preferred = [
        "llama-3.3-70b-versatile",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3-32b",
    ]
    for model in preferred:
        if model in ids:
            return model

    blocked = ("whisper", "tts", "guard", "prompt-guard", "compound")
    for model in ids:
        lower = model.lower()
        if model and not any(word in lower for word in blocked):
            return model

    raise ValueError("No compatible Groq text model is available.")


@app.post("/api/ai/generate-quiz")
async def generate_ai_quiz(payload: dict):
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return {
            "success": False,
            "message": "Add GROQ_API_KEY to backend/.env and restart the backend.",
        }

    topic = str(payload.get("topic", "")).strip()
    difficulty = str(payload.get("difficulty", "Medium")).strip()
    extra = str(payload.get("instructions", "")).strip()

    try:
        count = max(1, min(20, int(payload.get("count", 5))))
    except (TypeError, ValueError):
        count = 5

    if not topic:
        return {"success": False, "message": "Tell the AI what the quiz should be about."}

    system_prompt = f"""You create classroom multiple-choice quizzes for Quizzy.
Return ONLY one valid JSON object, with no markdown and no explanation.
Schema:
{{
  "title": "short quiz title",
  "questions": [
    {{
      "text": "question",
      "options": ["answer 1", "answer 2", "answer 3", "answer 4"],
      "correctAnswer": 0,
      "timeLimit": 20
    }}
  ]
}}
Rules:
- Generate exactly {count} questions.
- Every question has exactly four distinct answer options.
- correctAnswer is the zero-based index 0, 1, 2, or 3 of the single correct option.
- Questions must be factual, clear, classroom-safe, and appropriate for {difficulty} difficulty.
- Avoid trick wording and avoid duplicate questions.
- timeLimit must be exactly 20 seconds for every question.
"""

    user_prompt = f"Topic: {topic}\nDifficulty: {difficulty}"
    if extra:
        user_prompt += f"\nExtra instructions: {extra}"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient() as client:
            model = await _choose_groq_model(
                client,
                headers,
                os.getenv("GROQ_MODEL", "").strip(),
            )
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json={
                    "model": model,
                    "temperature": 0.7,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
                timeout=60.0,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]

        quiz = _extract_json_object(content)
        raw_questions = quiz.get("questions", [])
        if len(raw_questions) != count:
            raise ValueError(f"AI returned {len(raw_questions)} questions instead of {count}.")

        allowed_times = {10, 15, 20, 30, 45, 60}
        cleaned = []
        for index, q in enumerate(raw_questions):
            text = str(q.get("text", "")).strip()
            options = [str(x).strip() for x in q.get("options", [])]
            correct = q.get("correctAnswer")
            time_limit = 20
            if not text or len(options) != 4 or any(not x for x in options):
                raise ValueError(f"Question {index + 1} is incomplete.")
            if not isinstance(correct, int) or correct not in range(4):
                raise ValueError(f"Question {index + 1} has an invalid correct answer.")
            if time_limit not in allowed_times:
                time_limit = 20
            cleaned.append({
                "id": str(uuid.uuid4()),
                "text": text[:250],
                "options": [x[:120] for x in options],
                "correctAnswer": correct,
                "timeLimit": time_limit,
            })

        return {
            "success": True,
            "model": model,
            "quiz": {
                "title": str(quiz.get("title") or f"{topic} Quiz")[:80],
                "questions": cleaned,
            },
        }
    except httpx.HTTPStatusError as error:
        detail = "Groq rejected the request. Check your API key and try again."
        try:
            detail = error.response.json().get("error", {}).get("message", detail)
        except Exception:
            pass
        return {"success": False, "message": detail}
    except Exception as error:
        print(f"AI QUIZ ERROR: {error}")
        return {"success": False, "message": f"AI quiz generation failed: {error}"}


# ==================================================
# CREATE GAME
# ==================================================

@app.post("/api/games")
def create_game(payload: dict):
    quiz = payload.get("quiz")

    if not quiz:
        return {
            "success": False,
            "message": "Quiz is required.",
        }

    pin = manager.create_room(quiz)

    return {
        "success": True,
        "pin": pin,
    }


# ==================================================
# CHECK GAME
# ==================================================

@app.get("/api/games/{pin}")
def check_game(pin: str):
    room = manager.get_room(pin)

    if not room:
        return {
            "exists": False
        }

    return {
        "exists": True,
        "pin": pin,
        "status": room["status"],
        "title": room["quiz"].get(
            "title",
            "Untitled Quiz",
        ),
        "players": manager.public_players(
            pin
        ),
    }


# ==================================================
# HOST WEBSOCKET
# ==================================================

@app.websocket("/ws/host/{pin}")
async def host_websocket(
    websocket: WebSocket,
    pin: str,
):
    await websocket.accept()

    room = manager.get_room(pin)

    # --------------------------------------------------
    # GAME DOES NOT EXIST
    # --------------------------------------------------

    if not room:
        await websocket.send_json(
            {
                "type": "error",
                "message": "Game not found.",
            }
        )

        await websocket.close()

        return

    # --------------------------------------------------
    # REGISTER HOST SOCKET
    # --------------------------------------------------

    manager.set_host(
        pin,
        websocket,
    )

    print(
        f"HOST CONNECTED: {pin}"
    )

    # Send current room information immediately.
    await websocket.send_json(
        {
            "type": "connected",
            "role": "host",
            "pin": pin,
            "status": room["status"],
            "players": manager.public_players(
                pin
            ),
        }
    )

    try:
        # ==================================================
        # HOST MESSAGE LOOP
        # ==================================================

        while True:
            data = await websocket.receive_json()

            print(
                f"HOST {pin}: {data}"
            )

            message_type = data.get(
                "type"
            )

            # ==============================================
            # START GAME
            # ==============================================

            if message_type == "start_game":
                started = await manager.start_game(
                    pin
                )

                if started:
                    await websocket.send_json(
                        {
                            "type": "game_started",
                            "success": True,
                        }
                    )

                else:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": (
                                "Game could not be started. "
                                "Make sure at least one player "
                                "has joined."
                            ),
                        }
                    )

            # ==============================================
            # REVEAL QUESTION
            # ==============================================

            elif message_type == "reveal_question":
                revealed = (
                    await manager.reveal_question(
                        pin
                    )
                )

                if not revealed:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": (
                                "Question could not "
                                "be revealed."
                            ),
                        }
                    )

            # ==============================================
            # NEXT QUESTION
            # ==============================================

            elif message_type == "next_question":
                moved = (
                    await manager.next_question(
                        pin
                    )
                )

                if not moved:
                    await websocket.send_json(
                        {
                            "type": "no_more_questions",
                        }
                    )

            # ==============================================
            # FINISH GAME
            # ==============================================

            elif message_type == "finish_game":
                finished = (
                    await manager.finish_game(
                        pin
                    )
                )

                if not finished:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "message": (
                                "Game could not "
                                "be finished."
                            ),
                        }
                    )

            # ==============================================
            # UNKNOWN HOST MESSAGE
            # ==============================================

            else:
                print(
                    "UNKNOWN HOST MESSAGE:",
                    message_type,
                )

    except WebSocketDisconnect:
        print(
            f"HOST DISCONNECTED: {pin}"
        )

    except Exception as error:
        print(
            f"HOST WEBSOCKET ERROR "
            f"{pin}: {error}"
        )

    finally:
        room = manager.get_room(
            pin
        )

        if (
            room
            and room.get("host")
            is websocket
        ):
            room["host"] = None


# ==================================================
# PLAYER WEBSOCKET
# ==================================================

@app.websocket("/ws/player/{pin}")
async def player_websocket(
    websocket: WebSocket,
    pin: str,
):
    await websocket.accept()

    room = manager.get_room(
        pin
    )

    # --------------------------------------------------
    # GAME DOES NOT EXIST
    # --------------------------------------------------

    if not room:
        await websocket.send_json(
            {
                "type": "error",
                "message": "Game not found.",
            }
        )

        await websocket.close()

        return

    player_id = str(
        uuid.uuid4()
    )

    player_added = False

    try:
        # ==================================================
        # FIRST MESSAGE MUST BE JOIN
        # ==================================================

        join_data = (
            await websocket.receive_json()
        )

        if (
            join_data.get("type")
            != "join"
        ):
            await websocket.send_json(
                {
                    "type": "error",
                    "message": (
                        "Join message required."
                    ),
                }
            )

            await websocket.close()

            return

        # ==================================================
        # VALIDATE PLAYER
        # ==================================================

        name = str(
            join_data.get(
                "name",
                "",
            )
        ).strip()[:20]

        avatar = str(
            join_data.get(
                "avatar",
                "😎",
            )
        )

        session_id = str(
            join_data.get("sessionId", "")
        ).strip()

        if not session_id:
            session_id = player_id

        if not name:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": (
                        "Nickname is required."
                    ),
                }
            )

            await websocket.close()

            return

        # ==================================================
        # ADD PLAYER
        # ==================================================

        # A browser session may briefly reconnect in React dev mode.
        # Replace its stale socket instead of counting it as another player.
        existing_id = None
        existing_socket = None
        for candidate_id, candidate in list(room["players"].items()):
            if candidate.get("sessionId") == session_id:
                existing_id = candidate_id
                existing_socket = candidate.get("websocket")
                break

        if existing_id:
            manager.remove_player(pin, existing_id)
            if existing_socket and existing_socket is not websocket:
                try:
                    await existing_socket.close(code=1000)
                except Exception:
                    pass

        if room["status"] != "lobby":
            await websocket.send_json({
                "type": "error",
                "message": "Game has already started.",
            })
            await websocket.close()
            return

        player = manager.add_player(
            pin=pin,
            player_id=player_id,
            session_id=session_id,
            name=name,
            avatar=avatar,
            websocket=websocket,
        )

        if not player:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": (
                        "Could not join game."
                    ),
                }
            )

            await websocket.close()

            return

        player_added = True

        print(
            f"PLAYER JOINED: "
            f"{name} -> {pin}"
        )

        # ==================================================
        # CONFIRM JOIN
        # ==================================================

        await websocket.send_json(
            {
                "type": "joined",
                "player": {
                    "id": player["id"],
                    "name": player["name"],
                    "avatar": player["avatar"],
                    "score": player["score"],
                    "streak": player["streak"],
                    "lastPoints": player[
                        "lastPoints"
                    ],
                    "lastCorrect": player[
                        "lastCorrect"
                    ],
                },
                "focusMode": bool(
                    room.get("quiz", {})
                    .get("settings", {})
                    .get("focusMode", False)
                ),
            }
        )

        # Update host + all players.
        await manager.broadcast_players(
            pin
        )

        # ==================================================
        # PLAYER MESSAGE LOOP
        # ==================================================

        while True:
            data = (
                await websocket.receive_json()
            )

            print(
                f"PLAYER {player_id}: "
                f"{data}"
            )

            message_type = data.get(
                "type"
            )

            # ==============================================
            # PLAYER ANSWER
            # ==============================================

            if message_type == "focus_violation":
                room = manager.get_room(pin)
                player = room.get("players", {}).get(player_id) if room else None
                focus_enabled = bool(
                    room.get("quiz", {})
                    .get("settings", {})
                    .get("focusMode", False)
                ) if room else False

                if player and focus_enabled and room.get("status") == "playing":
                    player["eliminated"] = True
                    player["streak"] = 0

                    # An eliminated player is no longer an active competitor.
                    # If they had already answered this question, remove that
                    # answer so the host counter only reflects active players.
                    room.get("answers", {}).pop(player_id, None)

                    await websocket.send_json({
                        "type": "eliminated",
                        "reason": "You left the game tab while Focus Mode was enabled.",
                    })

                    # Tell the host exactly who was eliminated.
                    await manager.send_to_host(pin, {
                        "type": "player_eliminated",
                        "playerId": player_id,
                        "name": player.get("name", "Player"),
                        "avatar": player.get("avatar", "💀"),
                    })

                    # public_players() excludes eliminated players, so this
                    # immediately removes them from the host's active list.
                    await manager.broadcast_players(pin)

                    await manager.send_to_host(pin, {
                        "type": "answer_count_updated",
                        "answered": len(room.get("answers", {})),
                        "total": len(manager.public_players(pin)),
                    })

                    print(f"PLAYER ELIMINATED (FOCUS): {player_id} -> {pin}")

            elif message_type == "answer":
                question_index = data.get(
                    "questionIndex"
                )

                answer_index = data.get(
                    "answerIndex"
                )

                result = (
                    await manager.submit_answer(
                        pin=pin,
                        player_id=player_id,
                        question_index=question_index,
                        answer_index=answer_index,
                    )
                )

                # ------------------------------------------
                # SERVER REJECTED ANSWER
                # ------------------------------------------

                if not result["success"]:
                    await websocket.send_json(
                        {
                            "type": "answer_rejected",
                            "message": result[
                                "message"
                            ],
                        }
                    )

            # ==============================================
            # UNKNOWN PLAYER MESSAGE
            # ==============================================

            else:
                print(
                    "UNKNOWN PLAYER MESSAGE:",
                    message_type,
                )

    except WebSocketDisconnect:
        print(
            f"PLAYER DISCONNECTED: "
            f"{player_id}"
        )

    except Exception as error:
        print(
            f"PLAYER WEBSOCKET ERROR "
            f"{player_id}: {error}"
        )

    finally:
        # ==================================================
        # REMOVE DISCONNECTED PLAYER
        # ==================================================

        if player_added:
            manager.remove_player(
                pin,
                player_id,
            )

            await manager.broadcast_players(
                pin
            )

            print(
                f"PLAYER REMOVED: "
                f"{player_id} -> {pin}"
            )