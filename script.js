"use strict";

const BOARD_SIZE = 9;
const MINE_COUNT = 10;
const boardElement = document.querySelector("#board");
const mineCountElement = document.querySelector("#mine-count");
const timerElement = document.querySelector("#timer");
const statusElement = document.querySelector("#game-status");
const resetButton = document.querySelector("#new-game");

let cells = [];
let flags = 0;
let revealedCount = 0;
let gameStarted = false;
let gameOver = false;
let seconds = 0;
let timerId = null;

function createBoard() {
  cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => ({
    index,
    isMine: false,
    adjacentMines: 0,
    isRevealed: false,
    isFlagged: false,
    isExploded: false,
  }));
}

function getNeighbors(index) {
  const row = Math.floor(index / BOARD_SIZE);
  const column = index % BOARD_SIZE;
  const neighbors = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) continue;

      const neighborRow = row + rowOffset;
      const neighborColumn = column + columnOffset;
      if (
        neighborRow >= 0 &&
        neighborRow < BOARD_SIZE &&
        neighborColumn >= 0 &&
        neighborColumn < BOARD_SIZE
      ) {
        neighbors.push(neighborRow * BOARD_SIZE + neighborColumn);
      }
    }
  }

  return neighbors;
}

function placeMines(safeIndex) {
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

  available.slice(0, MINE_COUNT).forEach((index) => {
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
  }, 1000);
}

function stopTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function updateMineCount() {
  mineCountElement.textContent = String(MINE_COUNT - flags);
}

function renderBoard() {
  boardElement.replaceChildren();

  cells.forEach((cell) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.setAttribute("role", "gridcell");

    if (cell.isRevealed) {
      button.classList.add("revealed");
      button.disabled = true;

      if (cell.isMine) {
        button.classList.add("mine");
        button.textContent = "✹";
        button.setAttribute("aria-label", `칸 ${cell.index + 1}, 지뢰`);
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

  if (revealedCount === cells.length - MINE_COUNT) {
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
  updateMineCount();
  renderBoard();
}

function finishGame(won) {
  gameOver = true;
  stopTimer();

  if (won) {
    cells.forEach((cell) => {
      if (cell.isMine && !cell.isFlagged) {
        cell.isFlagged = true;
        flags += 1;
      }
    });
    statusElement.textContent = "축하합니다! 모든 지뢰를 찾았어요.";
    statusElement.dataset.state = "won";
    resetButton.textContent = "😎";
  } else {
    statusElement.textContent = "앗, 지뢰를 밟았어요. 다시 도전해보세요!";
    statusElement.dataset.state = "lost";
    resetButton.textContent = "😵";
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

  createBoard();
  updateMineCount();
  renderBoard();
}

resetButton.addEventListener("click", startNewGame);
startNewGame();
