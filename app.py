from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room, emit
import random
import string

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret'
socketio = SocketIO(app, cors_allowed_origins="*")

rooms = {}

def gen_code():
    """Generate a 4-char code like AB12 (2 letters + 2 digits, shuffled)."""
    parts = random.choices(string.ascii_uppercase, k=2) + random.choices(string.digits, k=2)
    random.shuffle(parts)
    return "".join(parts)


@app.route('/')
def index():
    return render_template('index.html')


# ── CREATE / JOIN ─────────────────────────────────────────────────────────────

@socketio.on('create_game')
def create_game(data=None):
    max_num = 100
    if isinstance(data, dict):
        try:
            max_num = max(10, min(500, int(data.get("maxNum", 100))))
        except (ValueError, TypeError):
            pass

    code = gen_code()
    while code in rooms:
        code = gen_code()

    rooms[code] = {
        "players":   [request.sid],
        "p1Secret":  None,
        "p2Secret":  None,
        "turn":      1,
        "maxNum":    max_num,
    }
    join_room(code)
    emit('game_created', {"code": code, "maxNum": max_num})


@socketio.on('join_game')
def join_game(code):
    code = (code or "").upper().strip()

    if code not in rooms:
        emit('error_msg', "Room not found — double-check the code.")
        return

    room = rooms[code]

    if len(room["players"]) >= 2:
        emit('error_msg', "That game is already full.")
        return

    join_room(code)
    room["players"].append(request.sid)
    emit('start_input', {"maxNum": room["maxNum"]}, room=code)


# ── SECRET ────────────────────────────────────────────────────────────────────

@socketio.on('set_secret')
def set_secret(data):
    code   = data.get('code', '').upper()
    player = data.get('player')
    value  = data.get('value')

    if code not in rooms:
        return

    room = rooms[code]

    try:
        value = int(value)
        if not (1 <= value <= room["maxNum"]):
            emit('error_msg', f"Pick a number between 1 and {room['maxNum']}.")
            return
    except (ValueError, TypeError):
        emit('error_msg', "Invalid number.")
        return

    if player == 1:
        room["p1Secret"] = value
    else:
        room["p2Secret"] = value

    if room["p1Secret"] is not None and room["p2Secret"] is not None:
        emit('start_game', room=code)


# ── GUESS ─────────────────────────────────────────────────────────────────────

@socketio.on('guess')
def guess(data):
    code   = data.get('code', '').upper()
    player = data.get('player')
    value  = data.get('value')

    if code not in rooms:
        return

    room = rooms[code]

    if player != room["turn"]:
        emit('error_msg', "It's not your turn!")
        return

    try:
        value = int(value)
    except (ValueError, TypeError):
        return

    target = room["p2Secret"] if player == 1 else room["p1Secret"]

    if value == target:
        emit('winner', {"player": player, "guess": value}, room=code)
        del rooms[code]
        return

    result = "low" if value < target else "high"
    room["turn"] = 2 if player == 1 else 1

    emit('feedback', {
        "result":  result,
        "guess":   value,
        "guesser": player,
        "turn":    room["turn"],
    }, room=code)


# ── TIMEOUT ───────────────────────────────────────────────────────────────────

@socketio.on('timeout')
def timeout(data):
    code   = data.get('code', '').upper()
    player = data.get('player')

    if code not in rooms:
        return

    room = rooms[code]

    if player != room["turn"]:
        return

    room["turn"] = 2 if player == 1 else 1
    emit('timeout_switch', {"turn": room["turn"]}, room=code)


# ── LEAVE ─────────────────────────────────────────────────────────────────────

@socketio.on('leave_game')
def leave_game(data):
    code = (data or {}).get('code', '').upper()
    if code in rooms:
        leave_room(code)
        del rooms[code]


@socketio.on('disconnect')
def on_disconnect():
    # Clean up any room the disconnected player was hosting
    sid = request.sid
    to_delete = [c for c, r in rooms.items() if sid in r["players"]]
    for code in to_delete:
        del rooms[code]


if __name__ == '__main__':
    socketio.run(app, debug=True)