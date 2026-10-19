"use strict";

const DIFFICULTIES = {
  beginner: { label: "초급", rows: 9, columns: 9, mines: 10 },
  intermediate: { label: "중급", rows: 16, columns: 16, mines: 40 },
  expert: { label: "고급", rows: 16, columns: 30, mines: 99 },
};
const RECORDS_STORAGE_KEY = "minesweeper-best-times-v1";
const boardElement = document.querySelector("#board");
const mineCountElement = document.querySelector("#mine-count");
const timerElement = document.querySelector("#timer");
const statusElement = document.querySelector("#game-status");
const resetButton = document.querySelector("#new-game");
const difficultySelect = document.querySelector("#difficulty");
const boardScrollElement = document.querySelector(".board-scroll");
const recordLabelElement = document.querySelector("#record-label");
const bestTimeElement = document.querySelector("#best-time");
const soundToggleButton = document.querySelector("#sound-toggle");

let cells = [];
let flags = 0;
let revealedCount = 0;
let gameStarted = false;
let gameOver = false;
let seconds = 0;
let timerId = null;
let difficultyKey = difficultySelect.value;
let bestTimes = {};
let soundEnabled = false;
let audioContext = null;

function getDifficulty() {
  return DIFFICULTIES[difficultyKey];
}

function createBoard() {
  const { rows, columns } = getDifficulty();
  cells = Array.from({ length: rows * columns }, (_, index) => ({
    index,
    isMine: false,
    adjacentMines: 0,
    isRevealed: false,
    isFlagged: false,
    isExploded: false,
  }));
}

function getNeighbors(index) {
  const { rows, columns } = getDifficulty();
  const row = Math.floor(index / columns);
  const column = index % columns;
  const neighbors = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) continue;

      const neighborRow = row + rowOffset;
      const neighborColumn = column + columnOffset;
      if (
        neighborRow >= 0 &&
        neighborRow < rows &&
        neighborColumn >= 0 &&
        neighborColumn < columns
      ) {
        neighbors.push(neighborRow * columns + neighborColumn);
      }
    }
  }

  return neighbors;
}

function placeMines(safeIndex) {
  const { mines } = getDifficulty();
  const available = cells
    .map((cell) => cell.index)
    .filter((index) => index !== safeIndex);

  for (let index = available.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [available[index], available[randomIndex]] = [
      available[randomIndex],
      available[index],
    ];
  }

  available.slice(0, mines).forEach((index) => {
    cells[index].isMine = true;
  });

  cells.forEach((cell) => {
    if (!cell.isMine) {
      cell.adjacentMines = getNeighbors(cell.index).filter(
        (neighborIndex) => cells[neighborIndex].isMine,
      ).length;
    }
  });
}

function startTimer() {
  if (timerId !== null) return;
  timerId = window.setInterval(() => {
    seconds = Math.min(seconds + 1, 999);
    timerElement.textContent = String(seconds).padStart(3, "0");
    if (seconds === 999) stopTimer();
  }, 1000);
}

function stopTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function updateMineCount() {
  mineCountElement.textContent = String(getDifficulty().mines - flags);
}

function updateBoardLayout() {
  const { rows, columns, label } = getDifficulty();
  boardScrollElement.style.setProperty("--board-columns", columns);
  boardScrollElement.style.setProperty("--board-min-width", `${columns * 20 + 6}px`);
  boardElement.setAttribute(
    "aria-label",
    `${rows}행 ${columns}열 ${label} 지뢰찾기 게임판`,
  );
}

function updateRecordDisplay() {
  const { label } = getDifficulty();
  const bestTime = bestTimes[difficultyKey];
  recordLabelElement.textContent = `${label} 최고 기록`;
  bestTimeElement.textContent =
    bestTime === undefined ? "기록 없음" : `${String(bestTime).padStart(3, "0")}초`;
}

function loadBestTimes() {
  try {
    const storedRecords = window.localStorage.getItem(RECORDS_STORAGE_KEY);
    if (storedRecords === null) return true;

    const parsedRecords = JSON.parse(storedRecords);
    if (
      parsedRecords === null ||
      typeof parsedRecords !== "object" ||
      Array.isArray(parsedRecords)
    ) {
      throw new Error("저장된 기록 데이터 형식이 올바르지 않습니다.");
    }

    bestTimes = Object.fromEntries(
      Object.entries(DIFFICULTIES)
        .filter(([key]) => Number.isInteger(parsedRecords[key]) && parsedRecords[key] >= 0)
        .map(([key]) => [key, parsedRecords[key]]),
    );
    return true;
  } catch (error) {
    console.error("최고 기록을 불러오지 못했습니다.", error);
    return false;
  }
}

function saveBestTime() {
  try {
    window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(bestTimes));
    return true;
  } catch (error) {
    console.error("최고 기록을 저장하지 못했습니다.", error);
    statusElement.textContent = "승리했지만 최고 기록을 저장하지 못했습니다.";
    return false;
  }
}

function recordWin() {
  const previousBest = bestTimes[difficultyKey];
  if (previousBest !== undefined && seconds >= previousBest) {
    return { isNewRecord: false, saved: true };
  }

  bestTimes[difficultyKey] = seconds;
  updateRecordDisplay();
  return { isNewRecord: true, saved: saveBestTime() };
}

function updateSoundButton() {
  soundToggleButton.textContent = soundEnabled ? "사운드 켬" : "사운드 끔";
  soundToggleButton.setAttribute("aria-pressed", String(soundEnabled));
}

function playSound(type) {
  if (!soundEnabled || !audioContext) return;

  const frequencies = {
    reveal: 520,
    flag: 360,
    win: 760,
    loss: 180,
  };
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequencies[type], now);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.14);
}

async function toggleSound() {
  if (soundEnabled) {
    soundEnabled = false;
    updateSoundButton();
    return;
  }

  if (!window.AudioContext) {
    statusElement.textContent = "이 브라우저에서는 사운드를 지원하지 않습니다.";
    return;
  }

  try {
    if (audioContext === null) {
      audioContext = new window.AudioContext();
    }
    await audioContext.resume();
    soundEnabled = true;
    updateSoundButton();
  } catch (error) {
    console.error("사운드를 시작하지 못했습니다.", error);
    statusElement.textContent = "사운드를 시작하지 못했습니다.";
  }
}

function renderBoard() {
  boardElement.replaceChildren();

  cells.forEach((cell) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.setAttribute("role", "gridcell");

    const shouldRevealMine =
      gameOver && statusElement.dataset.state === "lost" && cell.isMine;

    if (cell.isRevealed || shouldRevealMine) {
      button.classList.add("revealed");
      button.disabled = true;

      if (cell.isMine) {
        button.classList.add("mine");
        button.textContent = "✹";
        button.setAttribute(
          "aria-label",
          `칸 ${cell.index + 1}, ${cell.isExploded ? "밟은 지뢰" : "지뢰"}`,
        );
      } else if (cell.adjacentMines > 0) {
        button.dataset.number = String(cell.adjacentMines);
        button.textContent = String(cell.adjacentMines);
        button.setAttribute(
          "aria-label",
          `칸 ${cell.index + 1}, 주변 지뢰 ${cell.adjacentMines}개`,
        );
      } else {
        button.setAttribute("aria-label", `칸 ${cell.index + 1}, 빈 칸`);
      }
    } else if (cell.isFlagged) {
      button.classList.add("flagged");
      button.textContent = "⚑";
      button.setAttribute("aria-label", `칸 ${cell.index + 1}, 깃발 표시됨`);
    } else {
      button.setAttribute("aria-label", `칸 ${cell.index + 1}, 닫힌 칸`);
    }

    if (cell.isExploded) {
      button.classList.add("exploded");
      button.textContent = "✹";
    }

    if (gameOver && cell.isFlagged && !cell.isMine) {
      button.classList.add("wrong-flag");
      button.textContent = "×";
      button.setAttribute("aria-label", `칸 ${cell.index + 1}, 잘못된 깃발`);
    }

    button.addEventListener("click", () => revealCell(cell.index));
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      toggleFlag(cell.index);
    });

    boardElement.append(button);
  });
}

function revealCell(index) {
  const cell = cells[index];
  if (gameOver || cell.isRevealed || cell.isFlagged) return;

  if (!gameStarted) {
    gameStarted = true;
    placeMines(index);
    startTimer();
  }

  if (cell.isMine) {
    cell.isRevealed = true;
    cell.isExploded = true;
    finishGame(false);
    return;
  }

  revealSafeCells(index);
  playSound("reveal");

  if (revealedCount === cells.length - getDifficulty().mines) {
    finishGame(true);
  } else {
    statusElement.textContent = "조심해서 다음 칸을 열어보세요.";
  }
  renderBoard();
}

function revealSafeCells(index) {
  const cell = cells[index];
  if (cell.isRevealed || cell.isFlagged || cell.isMine) return;

  cell.isRevealed = true;
  revealedCount += 1;

  if (cell.adjacentMines === 0) {
    getNeighbors(index).forEach(revealSafeCells);
  }
}

function toggleFlag(index) {
  const cell = cells[index];
  if (gameOver || cell.isRevealed) return;

  cell.isFlagged = !cell.isFlagged;
  flags += cell.isFlagged ? 1 : -1;
  playSound("flag");
  updateMineCount();
  renderBoard();
}

function finishGame(won) {
  gameOver = true;
  stopTimer();

  if (won) {
    const recordResult = recordWin();
    cells.forEach((cell) => {
      if (cell.isMine && !cell.isFlagged) {
        cell.isFlagged = true;
        flags += 1;
      }
    });
    statusElement.textContent = recordResult.isNewRecord
      ? "축하합니다! 새로운 최고 기록을 세웠어요."
      : "축하합니다! 모든 지뢰를 찾았어요.";
    if (!recordResult.saved) {
      statusElement.textContent = "승리했지만 최고 기록을 저장하지 못했습니다.";
    }
    statusElement.dataset.state = "won";
    resetButton.textContent = "😎";
    playSound("win");
  } else {
    statusElement.textContent = "앗, 지뢰를 밟았어요. 다시 도전해보세요!";
    statusElement.dataset.state = "lost";
    resetButton.textContent = "😵";
    playSound("loss");
  }

  updateMineCount();
  renderBoard();
}

function startNewGame() {
  stopTimer();
  flags = 0;
  revealedCount = 0;
  gameStarted = false;
  gameOver = false;
  seconds = 0;

  timerElement.textContent = "000";
  statusElement.textContent = "칸을 열어 게임을 시작하세요.";
  delete statusElement.dataset.state;
  resetButton.textContent = "🙂";

  updateBoardLayout();
  updateRecordDisplay();
  createBoard();
  updateMineCount();
  renderBoard();
}

function changeDifficulty() {
  difficultyKey = difficultySelect.value;
  startNewGame();
}

resetButton.addEventListener("click", startNewGame);
soundToggleButton.addEventListener("click", toggleSound);
difficultySelect.addEventListener("change", changeDifficulty);
const recordsLoaded = loadBestTimes();
startNewGame();
if (!recordsLoaded) {
  statusElement.textContent = "최고 기록을 불러오지 못했습니다.";
}
