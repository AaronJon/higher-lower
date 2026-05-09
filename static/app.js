const socket = io();
const screenEl  = document.getElementById("screen");
const navRight  = document.getElementById("navRight");

const TURN_TIME = 60;

let state = {
  code:     null,
  player:   null,
  turn:     1,
  maxNum:   100,
  history:  [],          // {guess, result, player} newest first
  timerInt: null,
  timeLeft: TURN_TIME,
  lastFeedback: "",
  lastFbType:   "",
};

/* ─── TOAST ──────────────────────────────────────────────────────── */
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

/* ─── SHAKE ──────────────────────────────────────────────────────── */
function shake(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}

/* ─── TIMER ──────────────────────────────────────────────────────── */
function clearTimer() {
  clearInterval(state.timerInt);
  state.timerInt = null;
}

function startTimer(onExpire) {
  clearTimer();
  state.timeLeft = TURN_TIME;
  renderTimerUI();
  state.timerInt = setInterval(() => {
    state.timeLeft--;
    renderTimerUI();
    if (state.timeLeft <= 0) { clearTimer(); onExpire(); }
  }, 1000);
}

function renderTimerUI() {
  const fill  = document.getElementById("timerFill");
  const num   = document.getElementById("timerNum");
  if (!fill || !num) return;
  const pct = (state.timeLeft / TURN_TIME) * 100;
  fill.style.width = pct + "%";
  fill.classList.remove("warn", "danger");
  num.classList.remove("danger");
  if      (state.timeLeft <= 5)  { fill.classList.add("danger"); num.classList.add("danger"); }
  else if (state.timeLeft <= 10) { fill.classList.add("warn"); }
  num.textContent = state.timeLeft + "s";
}

/* ─── NAV RESET BUTTON ────────────────────────────────────────────── */
function setNavReset(show) {
  navRight.innerHTML = show
    ? `<button class="btn btn-ghost btn-sm" onclick="doReset()">↩ Leave Game</button>`
    : "";
}

function doReset() {
  clearTimer();
  socket.emit("leave_game", { code: state.code });
  state = { code:null, player:null, turn:1, maxNum:100,
            history:[], timerInt:null, timeLeft:TURN_TIME,
            lastFeedback:"", lastFbType:"" };
  setNavReset(false);
  showHome();
}

/* ─── HISTORY HTML ───────────────────────────────────────────────── */
function historyPanelHTML() {
  const rows = state.history.length
    ? state.history.map(h => {
        let cls = "h-low", label = "⬆ Too Low";
        if (h.result === "high") { cls = "h-high"; label = "⬇ Too High"; }
        if (h.result === "win")  { cls = "h-win";  label = "✓ HIT!"; }
        const who = h.player === state.player ? "You" : "Opponent";
        return `
          <div class="h-item fade-in">
            <div>
              <div class="h-num">${h.guess}</div>
              <div class="h-player">${who} · P${h.player}</div>
            </div>
            <div></div>
            <span class="h-badge ${cls}">${label}</span>
          </div>`;
      }).join("")
    : `<div class="h-empty">No guesses yet</div>`;

  return `
    <div class="card-flush">
      <div class="history-header">
        <span class="section-label">Guess History</span>
        <span style="font-size:12px;color:var(--ink3)">${state.history.length} guess${state.history.length !== 1 ? "es" : ""}</span>
      </div>
      <div class="history-scroll">${rows}</div>
    </div>`;
}

/* ─── HOME ───────────────────────────────────────────────────────── */
function showHome() {
  setNavReset(false);
  screenEl.innerHTML = `
    <div class="home-hero fade-in">
      <div class="hero-left">
      <h1 class="display">HAYA or<br><em>LOWA.</em></h1>

        <div class="hero-rule"></div>
          <h1 class="display" style="font-size:clamp(28px,4vw,48px);margin-bottom:20px">How to <em>Play</em></h1>
          <ol style="display:flex;flex-direction:column;gap:12px;padding:0;list-style:none">
            <li style="display:flex;gap:12px;align-items:flex-start">
              <span style="font-family:'Playfair Display',serif;font-size:22px;font-weight:900;color:var(--blue);line-height:1;min-width:24px">1.</span>
              <span style="color:var(--ink2);font-size:15px;line-height:1.5">Creator sets the <strong style="color:var(--ink)">number range</strong> (e.g. 1–100) and shares the game code.</span>
            </li>
            <li style="display:flex;gap:12px;align-items:flex-start">
              <span style="font-family:'Playfair Display',serif;font-size:22px;font-weight:900;color:var(--blue);line-height:1;min-width:24px">2.</span>
              <span style="color:var(--ink2);font-size:15px;line-height:1.5">Both players secretly <strong style="color:var(--ink)">pick a number</strong> within the range and lock it in.</span>
            </li>
            <li style="display:flex;gap:12px;align-items:flex-start">
              <span style="font-family:'Playfair Display',serif;font-size:22px;font-weight:900;color:var(--blue);line-height:1;min-width:24px">3.</span>
              <span style="color:var(--ink2);font-size:15px;line-height:1.5">Take turns guessing your opponent's number. You'll be told if it's <strong style="color:var(--ink)">too high or too low</strong>.</span>
            </li>
            <li style="display:flex;gap:12px;align-items:flex-start">
              <span style="font-family:'Playfair Display',serif;font-size:22px;font-weight:900;color:var(--blue);line-height:1;min-width:24px">4.</span>
              <span style="color:var(--ink2);font-size:15px;line-height:1.5">Each turn has a <strong style="color:var(--ink)">timer</strong> — miss it and your turn is skipped.</span>
            </li>
            <li style="display:flex;gap:12px;align-items:flex-start">
              <span style="font-family:'Playfair Display',serif;font-size:22px;font-weight:900;color:var(--blue);line-height:1;min-width:24px">5.</span>
              <span style="color:var(--ink2);font-size:15px;line-height:1.5">First to guess correctly <strong style="color:var(--ink)">wins the round</strong>. All guesses are visible to both players.</span>
            </li>
          </ol>
      </div>

      <div class="stack">
        <div class="card">
          <div class="stack">
            <div class="section-label" style="margin-bottom:4px">Create a game</div>

            <div class="slider-wrap stack" style="gap:8px">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:13px;color:var(--ink2);font-weight:500">Number range: 1 –</span>
                <span class="slider-val" id="sliderDisplay">100</span>
              </div>
              <div class="slider-row">
                <input type="range" id="maxSlider" min="10" max="500" value="100" step="10"
                  oninput="document.getElementById('sliderDisplay').textContent = this.value"/>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ink3)">
                <span>10</span><span>500</span>
              </div>
            </div>

            <button class="btn btn-blue" onclick="createGame()">🎮 Create Game</button>
          </div>
        </div>

        <div class="divider">or join</div>

        <div class="card">
          <div class="stack">
            <div class="section-label" style="margin-bottom:4px">Join a game</div>
            <input id="codeInput" class="inp inp-xl" placeholder="AB12"
              maxlength="4" style="text-transform:uppercase"/>
            <button class="btn btn-ghost" onclick="joinGame()">🔑 Join Game</button>
          </div>
        </div>
      </div>
    </div>`;
}

/* ─── CREATE / JOIN ──────────────────────────────────────────────── */
function createGame() {
  const max = parseInt(document.getElementById("maxSlider").value) || 100;
  state.maxNum = max;
  state.player = 1;
  socket.emit("create_game", { maxNum: max });
}

function joinGame() {
  const raw = (document.getElementById("codeInput").value || "").trim().toUpperCase();
  if (!raw) { shake("codeInput"); return; }
  state.code   = raw;
  state.player = 2;
  socket.emit("join_game", raw);
}

/* ─── WAITING FOR P2 ─────────────────────────────────────────────── */
function showWaiting(code) {
  setNavReset(true);
  screenEl.innerHTML = `
    <div style="max-width:440px;margin:80px auto 0;display:flex;flex-direction:column;gap:20px" class="fade-in">
      <div class="code-box">
        <div class="lbl">Share this code</div>
        <div class="code-val">${code}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;justify-content:center;color:var(--ink2);font-size:13px">
        <span class="dot pulse" style="color:var(--blue)"></span>
        Waiting for Player 2 to join…
      </div>
      <button class="btn btn-ghost" onclick="doReset()">↩ Cancel</button>
    </div>`;
}

/* ─── SECRET INPUT ───────────────────────────────────────────────── */
function showSecretInput() {
  setNavReset(true);
  screenEl.innerHTML = `
    <div style="max-width:440px;margin:80px auto 0;display:flex;flex-direction:column;gap:20px" class="fade-in">
      <div>
        <div class="section-label">Round Setup</div>
        <h2 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:700;margin-top:6px;letter-spacing:-0.5px">
          Pick your secret number
        </h2>
        <p style="color:var(--ink2);font-size:14px;margin-top:6px">
          Choose any number from <strong>1</strong> to <strong>${state.maxNum}</strong>. Your opponent will try to guess it.
        </p>
      </div>
      <div class="range-note">Range: 1 – ${state.maxNum}</div>
      <input id="secretInput" type="password" class="inp inp-xl" placeholder="••••"/>
      <button class="btn btn-blue" onclick="sendSecret()">🔒 Lock It In</button>
      <button class="btn btn-ghost" onclick="doReset()">↩ Leave Game</button>
    </div>`;
}

function sendSecret() {
  const val = parseInt(document.getElementById("secretInput").value);
  if (isNaN(val) || val < 1 || val > state.maxNum) {
    shake("secretInput");
    toast(`Enter a number between 1 and ${state.maxNum}`);
    return;
  }
  socket.emit("set_secret", { code: state.code, player: state.player, value: val });
  screenEl.innerHTML = `
    <div style="max-width:440px;margin:80px auto 0;text-align:center;color:var(--ink2)" class="fade-in">
      <div style="font-size:40px;margin-bottom:16px">⏳</div>
      <p style="font-size:15px">Secret locked. Waiting for your opponent…</p>
    </div>`;
}

/* ─── MAIN GAME SCREEN ───────────────────────────────────────────── */
function showGame() {
  const isMyTurn = state.turn === state.player;
  setNavReset(true);

  let feedbackHTML = "";
  if (state.lastFeedback) {
    const cls = state.lastFbType === "low" ? "fb-low"
              : state.lastFbType === "high" ? "fb-high"
              : "fb-timeout";
    feedbackHTML = `<div class="feedback-strip ${cls}">${state.lastFeedback}</div>`;
  }

  screenEl.innerHTML = `
    <div class="game-grid fade-in">

      <!-- LEFT: action panel -->
      <div style="display:flex;flex-direction:column;gap:20px">

        <!-- top bar -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <div class="section-label">Match in progress</div>
            <div style="margin-top:4px;font-family:'Playfair Display',serif;font-size:15px;color:var(--ink2)">
              Code: <strong style="color:var(--ink)">${state.code}</strong>
              &nbsp;·&nbsp; Range: 1–${state.maxNum}
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="player-badge">You · Player ${state.player}</span>
            <span class="pill ${isMyTurn ? "pill-green" : "pill-red"}">
              <span class="dot pulse"></span>
              ${isMyTurn ? "Your Turn" : "Their Turn"}
            </span>
          </div>
        </div>

        <!-- timer -->
        <div class="card" style="padding:20px 24px">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:10px">
            <div>
              <div class="section-label">Turn Timer</div>
              <div id="timerNum" class="timer-num" style="margin-top:2px">${state.timeLeft}s</div>
            </div>
            <div style="font-size:13px;color:var(--ink3)">
              ${isMyTurn ? "Make your guess before time runs out" : "Wait for your opponent"}
            </div>
          </div>
          <div class="timer-track">
            <div id="timerFill" class="timer-fill" style="width:100%"></div>
          </div>
        </div>

        ${feedbackHTML}

        <!-- guess input -->
        <div class="card">
          <div class="stack">
            <div class="section-label">Your Guess</div>
            <input id="guessInput" type="number" min="1" max="${state.maxNum}"
              class="inp inp-xl" placeholder="1 – ${state.maxNum}"
              ${!isMyTurn ? "disabled" : ""}/>
            <button class="btn ${isMyTurn ? "btn-blue" : "btn-ghost"}"
              onclick="sendGuess()" ${!isMyTurn ? "disabled" : ""}>
              🎯 Submit Guess
            </button>
          </div>
        </div>

        <button class="btn btn-ghost btn-sm" onclick="doReset()" style="width:auto;align-self:flex-start">
          ↩ Leave Game
        </button>

      </div>

      <!-- RIGHT: history panel -->
      ${historyPanelHTML()}

    </div>`;

  // start or stop timer
  if (isMyTurn) {
    startTimer(() => {
      socket.emit("timeout", { code: state.code, player: state.player });
    });
  } else {
    clearTimer();
  }
}

/* ─── WINNER SCREEN ──────────────────────────────────────────────── */
function showWinner(data) {
  clearTimer();
  const isMe = data.player === state.player;
  setNavReset(false);

  screenEl.innerHTML = `
    <div class="game-grid fade-in">

      <div style="display:flex;flex-direction:column;gap:24px">
        <div>
          <div class="section-label">${isMe ? "Victory" : "Defeat"}</div>
          <h2 style="font-family:'Playfair Display',serif;font-size:40px;font-weight:900;
            letter-spacing:-1px;margin-top:6px;line-height:1.1">
            ${isMe ? "You Won!<br><em style='color:var(--blue)'>the game.</em>"
                   : "Better luck<br><em style='color:var(--red)'>next time.</em>"}
          </h2>
        </div>

        <div class="card" style="text-align:center;padding:36px">
          <div class="section-label" style="margin-bottom:12px">Winning Guess</div>
          <div class="winner-num">${data.guess}</div>
          <div style="margin-top:10px;font-size:14px;color:var(--ink2)">
            Player ${data.player} guessed it in ${state.history.length} attempt${state.history.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div style="display:flex;gap:12px">
          <button class="btn btn-blue" onclick="doReset()">🔄 Play Again</button>
        </div>
      </div>

      ${historyPanelHTML()}

    </div>`;
}

/* ─── SEND GUESS ─────────────────────────────────────────────────── */
function sendGuess() {
  const val = parseInt(document.getElementById("guessInput").value);
  if (isNaN(val) || val < 1 || val > state.maxNum) {
    shake("guessInput");
    toast(`Guess between 1 and ${state.maxNum}`);
    return;
  }
  socket.emit("guess", { code: state.code, player: state.player, value: val });
}

/* ─── SOCKET EVENTS ──────────────────────────────────────────────── */

socket.on("game_created", ({ code, maxNum }) => {
  state.code   = code;
  state.maxNum = maxNum;
  showWaiting(code);
});

socket.on("start_input", ({ maxNum }) => {
  state.maxNum = maxNum;
  showSecretInput();
});

socket.on("start_game", () => {
  state.history      = [];
  state.lastFeedback = "";
  state.lastFbType   = "";
  showGame();
});

socket.on("feedback", (data) => {
  state.turn = data.turn;
  state.history.unshift({ guess: data.guess, result: data.result, player: data.guesser });
  state.lastFeedback = data.result === "low" ? "⬆  Too Low — guess higher"
                                              : "⬇  Too High — guess lower";
  state.lastFbType   = data.result;
  showGame();
});

socket.on("timeout_switch", (data) => {
  state.turn         = data.turn;
  state.lastFeedback = "⌛ Opponent ran out of time";
  state.lastFbType   = "timeout";
  showGame();
});

socket.on("winner", (data) => {
  state.history.unshift({ guess: data.guess, result: "win", player: data.player });
  showWinner(data);
});

socket.on("error_msg", (msg) => {
  toast(msg);
  shake("codeInput");
});

/* ─── INIT ───────────────────────────────────────────────────────── */
showHome();