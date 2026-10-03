import random
import time


class GameManager:
    def __init__(self):
        self.rooms = {}

    # ==================================================
    # ROOM MANAGEMENT
    # ==================================================

    def generate_pin(self):
        while True:
            pin = str(random.randint(100000, 999999))

            if pin not in self.rooms:
                return pin

    def create_room(self, quiz):
        pin = self.generate_pin()

        self.rooms[pin] = {
            "pin": pin,
            "quiz": quiz,
            "status": "lobby",
            "current_question": None,
            "question_started_at": None,
            "answers": {},
            # Per-question, per-player answer permutations. This lets two
            # students see the same answers in different positions safely.
            "option_orders": {},
            "players": {},
            "host": None,
        }

        print(f"ROOM CREATED: {pin}")

        return pin

    def room_exists(self, pin):
        return pin in self.rooms

    def get_room(self, pin):
        return self.rooms.get(pin)

    # ==================================================
    # HOST
    # ==================================================

    def set_host(self, pin, websocket):
        room = self.get_room(pin)

        if room:
            room["host"] = websocket

    async def send_to_host(self, pin, message):
        room = self.get_room(pin)

        if not room:
            return

        host = room.get("host")

        if not host:
            return

        try:
            await host.send_json(message)

        except Exception as error:
            print(f"HOST SEND FAILED: {error}")

            if room.get("host") is host:
                room["host"] = None

    # ==================================================
    # PLAYER MANAGEMENT
    # ==================================================

    def add_player(
        self,
        pin,
        player_id,
        session_id,
        name,
        avatar,
        websocket,
    ):
        room = self.get_room(pin)

        if not room:
            return None

        if room["status"] != "lobby":
            return None

        player = {
            "id": player_id,
            "sessionId": session_id,
            "name": name,
            "avatar": avatar,
            "score": 0,
            "streak": 0,
            "lastPoints": 0,
            "lastCorrect": None,
            "eliminated": False,
            "websocket": websocket,
        }

        room["players"][player_id] = player

        return player

    def remove_player(self, pin, player_id):
        room = self.get_room(pin)

        if not room:
            return

        room["players"].pop(
            player_id,
            None,
        )

        room["answers"].pop(
            player_id,
            None,
        )

    def public_players(self, pin):
        room = self.get_room(pin)

        if not room:
            return []

        return [
            {
                "id": player["id"],
                "sessionId": player.get("sessionId"),
                "name": player["name"],
                "avatar": player["avatar"],
                "score": player["score"],
                "streak": player["streak"],
                "lastPoints": player["lastPoints"],
                "lastCorrect": player["lastCorrect"],
                "eliminated": player["eliminated"],
            }
            for player in room["players"].values()
            if not player.get("eliminated", False)
        ]

    # ==================================================
    # BROADCASTING
    # ==================================================

    async def broadcast_players(self, pin):
        room = self.get_room(pin)

        if not room:
            return

        message = {
            "type": "players_updated",
            "players": self.public_players(pin),
        }

        await self.send_to_host(
            pin,
            message,
        )

        dead_players = []

        for player_id, player in list(
            room["players"].items()
        ):
            try:
                await player["websocket"].send_json(
                    message
                )

            except Exception:
                dead_players.append(
                    player_id
                )

        for player_id in dead_players:
            self.remove_player(
                pin,
                player_id,
            )

    async def send_to_all_players(
        self,
        pin,
        message,
    ):
        room = self.get_room(pin)

        if not room:
            return

        dead_players = []

        for player_id, player in list(
            room["players"].items()
        ):
            try:
                await player["websocket"].send_json(
                    message
                )

            except Exception as error:
                print(
                    f"PLAYER SEND FAILED "
                    f"{player_id}: {error}"
                )

                dead_players.append(
                    player_id
                )

        for player_id in dead_players:
            self.remove_player(
                pin,
                player_id,
            )

    # ==================================================
    # QUESTION HELPERS
    # ==================================================

    def get_questions(self, pin):
        room = self.get_room(pin)

        if not room:
            return []

        return (
            room
            .get("quiz", {})
            .get("questions", [])
        )

    def get_current_question(self, pin):
        room = self.get_room(pin)

        if not room:
            return None

        question_index = room.get(
            "current_question"
        )

        if question_index is None:
            return None

        questions = self.get_questions(pin)

        if (
            question_index < 0
            or question_index >= len(questions)
        ):
            return None

        return questions[question_index]

    def _option_order(self, pin, player_id, question_index):
        room = self.get_room(pin)
        questions = self.get_questions(pin)

        if not room or question_index < 0 or question_index >= len(questions):
            return []

        options = questions[question_index].get("options", [])
        normal_order = list(range(len(options)))
        settings = room.get("quiz", {}).get("settings", {})

        if not settings.get("shuffleAnswers", False):
            return normal_order

        question_orders = room["option_orders"].setdefault(question_index, {})
        if player_id not in question_orders:
            order = normal_order.copy()
            random.shuffle(order)
            question_orders[player_id] = order

        return question_orders[player_id]

    def student_question(self, pin, player_id, question_index):
        """Return a player-safe question, optionally with per-player answer order."""
        questions = self.get_questions(pin)
        if question_index < 0 or question_index >= len(questions):
            return None

        question = questions[question_index]
        options = question.get("options", [])
        order = self._option_order(pin, player_id, question_index)

        return {
            "text": question.get("text", ""),
            "options": [options[i] for i in order],
            "timeLimit": question.get("timeLimit", 20),
        }

    async def send_question_to_players(self, pin, message_type, question_index):
        room = self.get_room(pin)
        questions = self.get_questions(pin)
        if not room or question_index < 0 or question_index >= len(questions):
            return

        dead = []
        for player_id, player in list(room["players"].items()):
            try:
                await player["websocket"].send_json({
                    "type": message_type,
                    "questionIndex": question_index,
                    "totalQuestions": len(questions),
                    "question": self.student_question(pin, player_id, question_index),
                })
            except Exception as error:
                print(f"QUESTION SEND FAILED {player_id}: {error}")
                dead.append(player_id)

        for player_id in dead:
            self.remove_player(pin, player_id)

    # ==================================================
    # START GAME
    # ==================================================

    async def start_game(self, pin):
        room = self.get_room(pin)

        if not room:
            return False

        if room["status"] != "lobby":
            return False

        questions = self.get_questions(pin)

        if not questions:
            return False

        if not room["players"]:
            return False

        room["status"] = "playing"
        room["current_question"] = 0
        room["answers"] = {}
        room["question_started_at"] = time.monotonic()

        # Reset player round information.
        for player in room["players"].values():
            player["lastPoints"] = 0
            player["lastCorrect"] = None

        await self.send_question_to_players(
            pin,
            "game_started",
            0,
        )

        print(
            f"GAME STARTED: {pin} -> "
            f"{len(room['players'])} player(s)"
        )

        return True

    # ==================================================
    # SUBMIT ANSWER
    # ==================================================

    async def submit_answer(
        self,
        pin,
        player_id,
        question_index,
        answer_index,
    ):
        room = self.get_room(pin)

        if not room:
            return {
                "success": False,
                "message": "Game not found.",
            }

        if room["status"] != "playing":
            return {
                "success": False,
                "message": "The game is not accepting answers.",
            }

        current_question_index = room.get(
            "current_question"
        )

        if question_index != current_question_index:
            return {
                "success": False,
                "message": "That question is no longer active.",
            }

        player = room["players"].get(
            player_id
        )

        if not player:
            return {
                "success": False,
                "message": "Player not found.",
            }

        if player.get("eliminated"):
            return {
                "success": False,
                "message": "You have been eliminated.",
            }

        # One answer per student per question.
        if player_id in room["answers"]:
            return {
                "success": False,
                "message": "Answer already locked.",
            }

        question = self.get_current_question(
            pin
        )

        if not question:
            return {
                "success": False,
                "message": "Question not found.",
            }

        options = question.get(
            "options",
            []
        )

        if (
            not isinstance(answer_index, int)
            or answer_index < 0
            or answer_index >= len(options)
        ):
            return {
                "success": False,
                "message": "Invalid answer.",
            }

        # ==============================================
        # SERVER-SIDE TIME CHECK
        # ==============================================

        started_at = room.get(
            "question_started_at"
        )

        elapsed = 0.0

        if started_at is not None:
            elapsed = max(
                0.0,
                time.monotonic() - started_at,
            )

        try:
            time_limit = int(
                question.get(
                    "timeLimit",
                    20,
                )
            )
        except (TypeError, ValueError):
            time_limit = 20

        time_limit = max(
            1,
            time_limit,
        )

        if elapsed > time_limit:
            return {
                "success": False,
                "message": "Time is up.",
            }

        # ==============================================
        # CHECK ANSWER
        # ==============================================

        correct_answer = question.get(
            "correctAnswer"
        )

        # answer_index is the position the student clicked on their own screen.
        # Convert it back to the original option index before grading.
        option_order = self._option_order(pin, player_id, question_index)
        original_answer_index = option_order[answer_index]

        is_correct = (
            original_answer_index == correct_answer
        )

        points = 0

        if is_correct:
            # ------------------------------------------
            # QUIZZY POINT SYSTEM
            #
            # Correct answer:
            # minimum = 500
            # maximum = 1000
            #
            # Faster answers receive more points.
            # ------------------------------------------

            remaining_ratio = max(
                0.0,
                min(
                    1.0,
                    (
                        time_limit - elapsed
                    )
                    / time_limit,
                ),
            )

            speed_bonus = int(
                500 * remaining_ratio
            )

            points = (
                500 + speed_bonus
            )

            player["streak"] += 1

        else:
            # Wrong answer always gets 0.
            points = 0

            # Wrong answer breaks streak.
            player["streak"] = 0

        player["score"] += points

        player["lastPoints"] = points
        player["lastCorrect"] = is_correct

        # ==============================================
        # STORE ANSWER
        # ==============================================

        room["answers"][player_id] = {
            "answerIndex": answer_index,
            "originalAnswerIndex": original_answer_index,
            "correct": is_correct,
            "points": points,
            "elapsed": elapsed,
        }

        # ==============================================
        # CONFIRM LOCK TO STUDENT
        # ==============================================

        try:
            await player["websocket"].send_json(
                {
                    "type": "answer_accepted",
                    "questionIndex": question_index,
                    "answerIndex": answer_index,
                }
            )

        except Exception as error:
            print(
                f"ANSWER CONFIRM FAILED "
                f"{player_id}: {error}"
            )

        # ==============================================
        # UPDATE HOST ANSWER COUNT
        # ==============================================

        await self.send_to_host(
            pin,
            {
                "type": "answer_count_updated",
                "answered": len(
                    room["answers"]
                ),
                "total": len(self.public_players(pin)),
            },
        )

        print(
            f"ANSWER: {player['name']} | "
            f"Q{question_index + 1} | "
            f"answer={answer_index} | "
            f"correct={is_correct} | "
            f"points={points} | "
            f"score={player['score']} | "
            f"streak={player['streak']}"
        )

        return {
            "success": True,
            "correct": is_correct,
            "points": points,
        }

    # ==================================================
    # REVEAL QUESTION
    # ==================================================

    async def reveal_question(self, pin):
        room = self.get_room(pin)

        if not room:
            return False

        if room["status"] != "playing":
            return False

        question = self.get_current_question(
            pin
        )

        if not question:
            return False

        correct_answer = question.get(
            "correctAnswer"
        )

        options = question.get(
            "options",
            []
        )

        correct_text = ""

        if (
            isinstance(correct_answer, int)
            and 0 <= correct_answer < len(options)
        ):
            correct_text = options[
                correct_answer
            ]

        # ==============================================
        # SEND PERSONAL RESULT TO EVERY PLAYER
        # ==============================================

        for player_id, player in list(
            room["players"].items()
        ):
            submitted_answer = (
                room["answers"].get(
                    player_id
                )
            )

            # Player did not answer before reveal.
            if submitted_answer is None:
                is_correct = False
                points = 0

                player["lastPoints"] = 0
                player["lastCorrect"] = False

                # Missing a question also breaks streak.
                player["streak"] = 0

            else:
                is_correct = submitted_answer[
                    "correct"
                ]

                points = submitted_answer[
                    "points"
                ]

            try:
                question_index = room["current_question"]
                order = self._option_order(pin, player_id, question_index)
                displayed_correct_answer = (
                    order.index(correct_answer)
                    if correct_answer in order
                    else correct_answer
                )

                await player[
                    "websocket"
                ].send_json(
                    {
                        "type": "answer_result",
                        "questionIndex": question_index,
                        "correct": is_correct,
                        "points": points,
                        "score": player["score"],
                        "streak": player["streak"],
                        "correctAnswer": displayed_correct_answer,
                        "correctText": correct_text,
                    }
                )

            except Exception as error:
                print(
                    f"RESULT SEND FAILED "
                    f"{player_id}: {error}"
                )

        # ==============================================
        # SEND UPDATED REAL SCORES TO HOST
        # ==============================================

        await self.send_to_host(
            pin,
            {
                "type": "question_revealed",
                "questionIndex": room[
                    "current_question"
                ],
                "correctAnswer": correct_answer,
                "correctText": correct_text,
                "answered": len(
                    room["answers"]
                ),
                "players": self.public_players(
                    pin
                ),
            },
        )

        print(
            f"QUESTION REVEALED: "
            f"{pin} Q"
            f"{room['current_question'] + 1}"
        )

        return True

    # ==================================================
    # NEXT QUESTION
    # ==================================================

    async def next_question(self, pin):
        room = self.get_room(pin)

        if not room:
            return False

        if room["status"] != "playing":
            return False

        questions = self.get_questions(
            pin
        )

        current_index = room.get(
            "current_question"
        )

        if current_index is None:
            return False

        next_index = (
            current_index + 1
        )

        if next_index >= len(questions):
            return False

        # ==============================================
        # RESET QUESTION STATE
        # ==============================================

        room["current_question"] = next_index
        room["answers"] = {}
        room["question_started_at"] = time.monotonic()

        for player in room[
            "players"
        ].values():
            player["lastPoints"] = 0
            player["lastCorrect"] = None

        # ==============================================
        # PREPARE NEXT QUESTION
        # ==============================================

        question = questions[next_index]

        # ==============================================
        # SEND NEW QUESTION TO STUDENTS
        # Each player gets their own answer permutation when enabled.
        # ==============================================

        await self.send_question_to_players(
            pin,
            "next_question",
            next_index,
        )

        # ==============================================
        # CONFIRM NEW QUESTION TO HOST
        # ==============================================

        await self.send_to_host(
            pin,
            {
                "type": "next_question",
                "questionIndex": next_index,
                "totalQuestions": len(
                    questions
                ),
                "answered": 0,
                "question": {
                    "text": question.get("text", ""),
                    "options": question.get("options", []),
                    "timeLimit": question.get("timeLimit", 20),
                },
                "players": self.public_players(
                    pin
                ),
            },
        )

        print(
            f"NEXT QUESTION: "
            f"{pin} -> Q{next_index + 1}"
        )

        return True

    # ==================================================
    # FINISH GAME
    # ==================================================

    async def finish_game(self, pin):
        room = self.get_room(pin)

        if not room:
            return False

        # Finishing is idempotent. If the host sends the finish event
        # twice (for example from a repeated UI/WebSocket event), do not
        # turn the second request into a server error.
        if room["status"] == "finished":
            return True

        room["status"] = "finished"

        # ==============================================
        # FINAL LEADERBOARD
        # ==============================================

        leaderboard = sorted(
            self.public_players(pin),
            key=lambda player: (
                player["score"]
            ),
            reverse=True,
        )

        total_players = len(
            leaderboard
        )

        # ==============================================
        # SEND EACH STUDENT FINAL RESULT
        # ==============================================

        for rank, public_player in enumerate(
            leaderboard,
            start=1,
        ):
            player = room[
                "players"
            ].get(
                public_player["id"]
            )

            if not player:
                continue

            try:
                await player[
                    "websocket"
                ].send_json(
                    {
                        "type": "game_finished",
                        "score": player["score"],
                        "streak": player["streak"],
                        "rank": rank,
                        "totalPlayers": total_players,
                        "leaderboard": leaderboard,
                    }
                )

            except Exception as error:
                print(
                    f"FINAL RESULT SEND FAILED "
                    f"{player['id']}: {error}"
                )

        # ==============================================
        # SEND FINAL LEADERBOARD TO HOST
        # ==============================================

        await self.send_to_host(
            pin,
            {
                "type": "game_finished",
                "leaderboard": leaderboard,
            },
        )

        print(
            f"GAME FINISHED: {pin}"
        )

        return True


manager = GameManager()