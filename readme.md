# 🔢 HayaLowa — Real-time Number Guessing Game

A two-player real-time guessing duel built with Flask and Socket.IO. Players secretly pick a number, then take turns guessing each other's — with live feedback, a turn timer, and shared guess history.

---

## Features

- 🎮 Real-time multiplayer via WebSockets
- 🔐 Alphanumeric room codes (e.g. `AB12`)
- 🎚️ Creator sets the number range (1–500)
- ⏱️ Per-turn countdown timer
- 📜 Live guess history visible to both players
- 📱 Responsive white editorial UI

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python · Flask · Flask-SocketIO |
| Frontend | Vanilla JS · Socket.IO client · Tailwind CSS |
| Fonts | Playfair Display · Instrument Sans |
| Transport | EventLet (async) |

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/numlock.git
cd hayalowa
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the server

```bash
python app.py
```

### 4. Open in browser