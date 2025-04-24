// 遊戲常數
const BOARD_SIZE = 8;
const CELL_SIZE = 60;

// 玩家常數
const BLACK = "X";
const WHITE = "O";

// 遊戲類
class Game {
    constructor() {
        // 初始化遊戲狀態
        this.board = new Board();
        this.currentPlayer = BLACK; // 黑棋先手
        this.gameMode = null;
        this.playerColor = null;
        this.gameState = "menu";
        this.moveHistory = [];
        this.scores = { X: 0, O: 0 };
        this.timeUsed = { X: 0, O: 0 };
        this.moveStartTime = 0;
        this.validMoves = [];
        this.lastMove = null;
        this.returnMode = false;
        this.capturedToReturn = [];
        this.aiThinking = false;
        this.aiThinkingTime = 0;
        this.aiDifficulty = "normal";
        
        // 繪圖相關
        this.canvas = document.getElementById("board");
        this.ctx = this.canvas.getContext("2d");
        
        // 綁定事件
        this.canvas.addEventListener("click", this.handleCanvasClick.bind(this));
        document.getElementById("undo").addEventListener("click", this.undoMove.bind(this));
        document.getElementById("pass").addEventListener("click", this.passMove.bind(this));
        document.getElementById("restart").addEventListener("click", this.promptRestart.bind(this));
        document.getElementById("new-game").addEventListener("click", this.backToMenu.bind(this));
        
        // 主選單按鈕
        document.getElementById("vs-player").addEventListener("click", () => {
            this.setGameMode("player_vs_player");
        });
        document.getElementById("vs-ai").addEventListener("click", () => {
            document.getElementById("ai-options").classList.remove("hidden");
        });
        
        // AI難度選擇
        document.querySelectorAll('[data-difficulty]').forEach(button => {
            button.addEventListener('click', (e) => {
                this.aiDifficulty = e.target.dataset.difficulty;
                // 高亮選中的按鈕
                document.querySelectorAll('[data-difficulty]').forEach(btn => {
                    btn.style.backgroundColor = "";
                });
                e.target.style.backgroundColor = "#004d00";
            });
        });
        
        // 玩家顏色選擇
        document.querySelectorAll('[data-color]').forEach(button => {
            button.addEventListener('click', (e) => {
                this.playerColor = e.target.dataset.color;
                this.setGameMode("player_vs_ai");
                // 高亮選中的按鈕
                document.querySelectorAll('[data-color]').forEach(btn => {
                    btn.style.backgroundColor = "";
                });
                e.target.style.backgroundColor = "#004d00";
            });
        });
        
        // 初始化
        this.resetGame();
        this.updateUI();
    }
    
    // 設置遊戲模式
    setGameMode(mode) {
        this.gameMode = mode;
        this.gameState = "playing";
        this.resetGame();
        
        // 隱藏選單，顯示遊戲區域
        document.getElementById("game-menu").classList.add("hidden");
        document.getElementById("game-container").classList.remove("hidden");
        
        // 如果是AI模式且AI先手，啟動AI移動
        if (this.gameMode === "player_vs_ai" && this.currentPlayer !== this.playerColor) {
            setTimeout(() => this.aiMove(), 500);
        }
        
        this.updateUI();
    }
    
    // 重置遊戲
    resetGame(switchColors = false) {
        this.board.reset();
        this.currentPlayer = BLACK;
        this.moveHistory = [];
        this.validMoves = this.board.getValidMoves(this.currentPlayer);
        this.lastMove = null;
        this.timeUsed = { X: 0, O: 0 };
        this.moveStartTime = Date.now();
        this.returnMode = false;
        this.capturedToReturn = [];
        
        // 如果需要交換顏色（下一局）
        if (switchColors && this.gameMode === "player_vs_ai") {
            this.playerColor = this.playerColor === BLACK ? WHITE : BLACK;
        }
        
        this.updateUI();
    }
    
    // 切換玩家
    switchPlayer() {
        // 計算用時
        const moveTime = (Date.now() - this.moveStartTime) / 1000;
        this.timeUsed[this.currentPlayer] += moveTime;
        
        // 切換玩家
        this.currentPlayer = this.currentPlayer === BLACK ? WHITE : BLACK;
        this.validMoves = this.board.getValidMoves(this.currentPlayer);
        this.moveStartTime = Date.now();
        
        this.updateUI();
    }
    
    // 執行移動
    makeMove(x, y) {
        // 確認走法有效
        let moveInfo = null;
        for (const move of this.validMoves) {
            if (move.x === x && move.y === y) {
                moveInfo = move;
                break;
            }
        }
        
        if (!moveInfo) return false;
        
        // 記錄移動前的棋盤狀態，用於悔棋
        const prevBoard = this.board.clone();
        const prevPlayer = this.currentPlayer;
        const prevTime = {...this.timeUsed};
        
        // 特殊規則：如果吃掉2個以上的棋子，需要返還1個
        if (moveInfo.captured.length >= 2) {
            this.returnMode = true;
            this.capturedToReturn = moveInfo.captured;
            
            // 臨時做出移動以顯示棋盤狀態
            this.board.makeMove(x, y, this.currentPlayer, moveInfo.captured);
            this.lastMove = {x, y};
            this.updateUI();
            return true;
        } else {
            // 直接進行移動
            this.board.makeMove(x, y, this.currentPlayer, moveInfo.captured);
            this.lastMove = {x, y};
            
            // 儲存移動歷史
            this.moveHistory.push({
                board: prevBoard,
                player: prevPlayer,
                time: prevTime,
                move: {x, y},
                captured: moveInfo.captured,
                returned: null
            });
            
            // 更新歷史記錄UI
            this.updateHistoryUI({
                player: prevPlayer,
                move: {x, y},
                returned: null
            });
            
            // 切換玩家
            this.switchPlayer();
            
            // 如果目前的玩家沒有有效走法，再次切換玩家
            if (this.validMoves.length === 0) {
                // 檢查另一個玩家是否有有效走法
                const oppositePlayer = this.currentPlayer === BLACK ? WHITE : BLACK;
                if (this.board.getValidMoves(oppositePlayer).length === 0) {
                    // 遊戲結束
                    this.endMatch();
                } else {
                    // 顯示無有效走法提示
                    document.getElementById("no-moves-prompt").classList.remove("hidden");
                }
            }
            
            // 如果是人機模式且輪到AI
            if (this.gameMode === "player_vs_ai" && this.currentPlayer !== this.playerColor) {
                setTimeout(() => this.aiMove(), 500);
            }
            
            return true;
        }
    }
    
    // 選擇返還棋子
    selectReturnPiece(x, y) {
        // 確認是否在返還模式
        if (!this.returnMode) return false;
        
        // 確認選擇的棋子是否在可返還的列表中
        let selected = false;
        for (const cap of this.capturedToReturn) {
            if (cap.x === x && cap.y === y) {
                selected = true;
                break;
            }
        }
        
        if (!selected) return false;
        
        // 獲取上一次移動信息
        const lastX = this.lastMove.x;
        const lastY = this.lastMove.y;
        const prevBoard = this.board.clone();
        const prevPlayer = this.currentPlayer;
        const prevTime = {...this.timeUsed};
        
        // 完成移動，包括返還棋子
        this.board.makeMove(lastX, lastY, this.currentPlayer, this.capturedToReturn, {x, y});
        
        // 儲存移動歷史
        this.moveHistory.push({
            board: prevBoard,
            player: prevPlayer,
            time: prevTime,
            move: {x: lastX, y: lastY},
            captured: this.capturedToReturn,
            returned: {x, y}
        });
        
        // 更新歷史記錄UI
        this.updateHistoryUI({
            player: prevPlayer,
            move: {x: lastX, y: lastY},
            returned: {x, y}
        });
        
        // 退出返還模式
        this.returnMode = false;
        this.capturedToReturn = [];
        
        // 切換玩家
        this.switchPlayer();
        
        // 如果目前的玩家沒有有效走法，再次切換玩家
        if (this.validMoves.length === 0) {
            // 檢查另一個玩家是否有有效走法
            const oppositePlayer = this.currentPlayer === BLACK ? WHITE : BLACK;
            if (this.board.getValidMoves(oppositePlayer).length === 0) {
                // 遊戲結束
                this.endMatch();
            } else {
                // 顯示無有效走法提示
                document.getElementById("no-moves-prompt").classList.remove("hidden");
            }
        }
        
        // 如果是人機模式且輪到AI
        if (this.gameMode === "player_vs_ai" && this.currentPlayer !== this.playerColor && !this.returnMode) {
            setTimeout(() => this.aiMove(), 500);
        }
        
        return true;
    }
    
    // 悔棋
    undoMove() {
        // 確認有移動歷史且不在返還模式和AI思考時
        if (this.moveHistory.length === 0 || this.returnMode || this.aiThinking) {
            return false;
        }
        
        // 獲取上一次移動信息
        const lastMove = this.moveHistory.pop();
        this.board = lastMove.board;
        this.currentPlayer = lastMove.player;
        this.timeUsed = lastMove.time;
        this.moveStartTime = Date.now();
        this.validMoves = this.board.getValidMoves(this.currentPlayer);
        this.lastMove = null;
        
        // 更新歷史記錄UI - 移除最後一條記錄
        const historyContent = document.getElementById("history-content");
        if (historyContent.lastChild) {
            historyContent.removeChild(historyContent.lastChild);
        }
        
        this.updateUI();
        return true;
    }
    
    // 跳過回合
    passMove() {
        // 檢查基本條件
        if (this.returnMode || this.aiThinking) {
            return false;
        }
        
        // 檢查當前玩家是否有有效走法，如果有則不允許pass
        if (this.validMoves.length > 0) {
            console.log(`玩家 ${this.currentPlayer} 有有效走法，不能跳過回合`);
            return false;
        }
        
        // 計算花費的時間
        const moveTime = (Date.now() - this.moveStartTime) / 1000;
        this.timeUsed[this.currentPlayer] += moveTime;
        
        // 記錄狀態用於悔棋
        const prevPlayer = this.currentPlayer;
        const prevBoard = this.board.clone();
        const prevTime = {...this.timeUsed};
        
        // 添加到移動歷史
        this.moveHistory.push({
            board: prevBoard,
            player: prevPlayer,
            time: prevTime,
            move: "pass",
            captured: [],
            returned: null
        });
        
        // 更新歷史記錄UI
        this.updateHistoryUI({
            player: prevPlayer,
            move: "pass",
            returned: null
        });
        
        console.log(`玩家 ${this.currentPlayer} 跳過回合（沒有有效走法）`);
        
        // 切換玩家
        this.currentPlayer = this.currentPlayer === BLACK ? WHITE : BLACK;
        // 重新計算新玩家的有效走法
        this.validMoves = this.board.getValidMoves(this.currentPlayer);
        this.moveStartTime = Date.now();
        
        // 隱藏無有效走法提示
        document.getElementById("no-moves-prompt").classList.add("hidden");
        
        // 如果新的玩家也沒有有效走法，遊戲結束
        if (this.validMoves.length === 0) {
            console.log("雙方都沒有有效走法，遊戲結束");
            this.endMatch();
        } else if (this.gameMode === "player_vs_ai" && this.currentPlayer !== this.playerColor) {
            // 如果輪到AI走棋
            setTimeout(() => this.aiMove(), 500);
        }
        
        this.updateUI();
        return true;
    }
    
    // 遊戲結束
    endMatch() {
        // 計算分數
        const [blackCount, whiteCount] = this.board.countPieces();
        
        // 記錄分數
        this.scores.X = blackCount - whiteCount;
        this.scores.O = whiteCount - blackCount;
        
        // 遊戲結束
        this.gameState = "game_end";
        
        // 顯示遊戲結束彈窗
        this.showGameEndModal();
    }
    
    // 顯示遊戲結束彈窗
    showGameEndModal() {
        const modal = document.getElementById("game-end-modal");
        const result = document.getElementById("result");
        const finalScore = document.getElementById("final-score");
        
        // 計算總分
        const [blackCount, whiteCount] = this.board.countPieces();
        
        // 設置分數文字
        let scoreText = "";
        if (this.gameMode === "player_vs_ai") {
            if (this.playerColor === BLACK) {
                scoreText = `玩家：${blackCount} 子，電腦：${whiteCount} 子`;
            } else {
                scoreText = `電腦：${blackCount} 子，玩家：${whiteCount} 子`;
            }
        } else {
            scoreText = `黑方：${blackCount} 子，白方：${whiteCount} 子`;
        }
        finalScore.textContent = scoreText;
        
        // 設置勝者文字
        let winnerText = "";
        if (this.gameMode === "player_vs_ai") {
            if (this.playerColor === BLACK) {
                if (blackCount > whiteCount) {
                    winnerText = "恭喜！玩家獲勝！";
                } else if (whiteCount > blackCount) {
                    winnerText = "電腦獲勝！";
                } else {
                    // 平手比較時間
                    if (this.timeUsed.X < this.timeUsed.O) {
                        winnerText = "平手！玩家用時較少，玩家獲勝！";
                    } else {
                        winnerText = "平手！電腦用時較少，電腦獲勝！";
                    }
                }
            } else {
                if (blackCount > whiteCount) {
                    winnerText = "電腦獲勝！";
                } else if (whiteCount > blackCount) {
                    winnerText = "恭喜！玩家獲勝！";
                } else {
                    // 平手比較時間
                    if (this.timeUsed.X < this.timeUsed.O) {
                        winnerText = "平手！電腦用時較少，電腦獲勝！";
                    } else {
                        winnerText = "平手！玩家用時較少，玩家獲勝！";
                    }
                }
            }
        } else {
            if (blackCount > whiteCount) {
                winnerText = "黑方獲勝！";
            } else if (whiteCount > blackCount) {
                winnerText = "白方獲勝！";
            } else {
                // 平手比較時間
                if (this.timeUsed.X < this.timeUsed.O) {
                    winnerText = "平手！黑方用時較少，黑方獲勝！";
                } else {
                    winnerText = "平手！白方用時較少，白方獲勝！";
                }
            }
        }
        result.textContent = winnerText;
        
        // 顯示彈窗
        modal.classList.remove("hidden");
    }
    
    // 重新開始提示
    promptRestart() {
        if (confirm("確定要重新開始遊戲嗎？")) {
            this.resetGame();
        }
    }
    
    // 返回選單
    backToMenu() {
        // 隱藏遊戲結束彈窗
        document.getElementById("game-end-modal").classList.add("hidden");
        
        // 隱藏遊戲區域
        document.getElementById("game-container").classList.add("hidden");
        
        // 重置並顯示選單
        document.getElementById("ai-options").classList.add("hidden");
        document.querySelectorAll('[data-difficulty], [data-color]').forEach(btn => {
            btn.style.backgroundColor = "";
        });
        document.getElementById("game-menu").classList.remove("hidden");
        
        // 重置遊戲狀態
        this.gameState = "menu";
    }
    
    // 處理畫布點擊
    handleCanvasClick(event) {
        // 如果不是遊戲中或AI正在思考，忽略點擊
        if (this.gameState !== "playing" || this.aiThinking) return;
        
        // 如果是人機模式且不是玩家回合，忽略點擊
        if (this.gameMode === "player_vs_ai" && this.currentPlayer !== this.playerColor) return;
        
        // 獲取點擊位置
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 轉換為棋盤座標
        const boardX = Math.floor(x / CELL_SIZE);
        const boardY = Math.floor(y / CELL_SIZE);
        
        if (boardX >= 0 && boardX < BOARD_SIZE && boardY >= 0 && boardY < BOARD_SIZE) {
            if (this.returnMode) {
                // 返還模式
                this.selectReturnPiece(boardY, boardX);
            } else {
                // 正常模式
                this.makeMove(boardY, boardX);
            }
        }
    }
    
    // AI 移動
    aiMove() {
        if (this.currentPlayer === this.playerColor || this.gameMode !== "player_vs_ai" || this.returnMode) {
            return;
        }
        
        this.aiThinking = true;
        document.getElementById("ai-thinking").classList.remove("hidden");
        this.updateUI();
        
        const aiStart = Date.now();
        
        // 使用setTimeout確保UI更新
        setTimeout(() => {
            try {
                if (this.validMoves.length > 0) {
                    let chosen;
                    const ai = new SmartAI(this, this.aiDifficulty);
                    
                    // 根據難度選擇移動
                    if (this.aiDifficulty === "easy") {
                        // 隨機選擇
                        chosen = this.validMoves[Math.floor(Math.random() * this.validMoves.length)];
                    } else {
                        // 使用AI算法
                        chosen = ai.getBestMove();
                    }
                    
                    // 執行移動
                    this.makeMove(chosen.x, chosen.y);
                    
                    // 如果進入了返還模式
                    if (this.returnMode) {
                        setTimeout(() => {
                            // 隨機或智能選擇返還棋子
                            let returnPiece;
                            if (this.aiDifficulty === "easy") {
                                // 簡單難度：隨機選擇
                                returnPiece = this.capturedToReturn[Math.floor(Math.random() * this.capturedToReturn.length)];
                            } else {
                                // 中等/困難難度：使用AI選擇
                                returnPiece = ai.getBestReturnPiece(this.capturedToReturn);
                            }
                            this.selectReturnPiece(returnPiece.x, returnPiece.y);
                        }, 800);
                    }
                } else {
                    // 沒有有效走法，跳過回合
                    this.passMove();
                }
            } catch (e) {
                console.error("AI移動出錯:", e);
            } finally {
                // 計算AI思考時間
                this.aiThinkingTime = (Date.now() - aiStart) / 1000;
                this.aiThinking = false;
                document.getElementById("ai-thinking").classList.add("hidden");
                this.updateUI();
            }
        }, 500); // 短暫延遲，讓UI有時間更新
    }
    
    // 更新UI
    updateUI() {
        // 更新棋盤
        this.drawBoard();
        
        // 更新狀態
        const statusEl = document.getElementById("status");
        const blackScoreEl = document.getElementById("black-score");
        const whiteScoreEl = document.getElementById("white-score");
        const blackTimeEl = document.getElementById("black-time");
        const whiteTimeEl = document.getElementById("white-time");
        const noMovesPrompt = document.getElementById("no-moves-prompt");
        const returnModePrompt = document.getElementById("return-mode-prompt");
        
        // 更新分數
        const [blackCount, whiteCount] = this.board.countPieces();
        
        if (this.gameMode === "player_vs_ai") {
            if (this.playerColor === BLACK) {
                blackScoreEl.textContent = `玩家 (黑)：${blackCount} 子`;
                whiteScoreEl.textContent = `電腦 (白)：${whiteCount} 子`;
                blackTimeEl.textContent = `玩家用時：${this.timeUsed.X.toFixed(1)}秒`;
                whiteTimeEl.textContent = `電腦用時：${this.timeUsed.O.toFixed(1)}秒`;
                statusEl.textContent = this.currentPlayer === BLACK ? "玩家回合" : "電腦回合";
            } else {
                blackScoreEl.textContent = `電腦 (黑)：${blackCount} 子`;
                whiteScoreEl.textContent = `玩家 (白)：${whiteCount} 子`;
                blackTimeEl.textContent = `電腦用時：${this.timeUsed.X.toFixed(1)}秒`;
                whiteTimeEl.textContent = `玩家用時：${this.timeUsed.O.toFixed(1)}秒`;
                statusEl.textContent = this.currentPlayer === BLACK ? "電腦回合" : "玩家回合";
            }
        } else {
            blackScoreEl.textContent = `黑棋：${blackCount} 子`;
            whiteScoreEl.textContent = `白棋：${whiteCount} 子`;
            blackTimeEl.textContent = `黑方用時：${this.timeUsed.X.toFixed(1)}秒`;
            whiteTimeEl.textContent = `白方用時：${this.timeUsed.O.toFixed(1)}秒`;
            statusEl.textContent = this.currentPlayer === BLACK ? "黑棋回合" : "白棋回合";
        }
        
        // 更新返還模式提示
        if (this.returnMode) {
            returnModePrompt.classList.remove("hidden");
        } else {
            returnModePrompt.classList.add("hidden");
        }
        
        // 更新無有效走法提示
        if (this.validMoves.length === 0 && !this.returnMode && !this.aiThinking && this.gameState === "playing") {
            if ((this.gameMode === "player_vs_player") || 
                (this.gameMode === "player_vs_ai" && this.currentPlayer === this.playerColor)) {
                noMovesPrompt.classList.remove("hidden");
            }
        } else {
            noMovesPrompt.classList.add("hidden");
        }
        
        // 啟用/禁用按鈕
        document.getElementById("undo").disabled = 
            this.moveHistory.length === 0 || this.returnMode || this.aiThinking;
        document.getElementById("pass").disabled = 
            this.validMoves.length > 0 || this.returnMode || this.aiThinking ||
            (this.gameMode === "player_vs_ai" && this.currentPlayer !== this.playerColor);
    }
    
    // 更新歷史記錄UI
    updateHistoryUI(move) {
        const historyContent = document.getElementById("history-content");
        const moveNumber = this.moveHistory.length;
        
        const moveText = document.createElement("div");
        
        let text = `${moveNumber}. ${move.player === BLACK ? "黑" : "白"}: `;
        
        if (move.move === "pass") {
            text += "跳過回合";
        } else {
            text += `(${move.move.y},${move.move.x})`;
            if (move.returned) {
                text += ` 返還 (${move.returned.y},${move.returned.x})`;
            }
        }
        
        moveText.textContent = text;
        historyContent.appendChild(moveText);
        
        // 自動滾動到底部
        historyContent.scrollTop = historyContent.scrollHeight;
    }
    
    // 繪製棋盤
    drawBoard() {
        const ctx = this.ctx;
        
        // 清空畫布
        ctx.fillStyle = "#009900";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 繪製網格
        for (let x = 0; x < BOARD_SIZE; x++) {
            for (let y = 0; y < BOARD_SIZE; y++) {
                ctx.fillStyle = "#90EE90";
                ctx.fillRect(y * CELL_SIZE, x * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                ctx.strokeStyle = "#000";
                ctx.strokeRect(y * CELL_SIZE, x * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                
                // 繪製座標
                if (x === 0) {
                    ctx.fillStyle = "#000";
                    ctx.font = "16px Arial";
                    ctx.fillText(y.toString(), y * CELL_SIZE + CELL_SIZE / 2 - 5, -10);
                }
                if (y === 0) {
                    ctx.fillStyle = "#000";
                    ctx.font = "16px Arial";
                    ctx.fillText(x.toString(), -20, x * CELL_SIZE + CELL_SIZE / 2 + 5);
                }
                
                // 繪製棋子
                const piece = this.board.getPiece(x, y);
                if (piece) {
                    const centerX = y * CELL_SIZE + CELL_SIZE / 2;
                    const centerY = x * CELL_SIZE + CELL_SIZE / 2;
                    const radius = CELL_SIZE / 2 - 5;
                    
                    if (piece === BLACK) {
                        ctx.fillStyle = "#000";
                        ctx.beginPath();
                        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        ctx.fillStyle = "#fff";
                        ctx.beginPath();
                        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = "#000";
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
            }
        }
        
        // 標記最後一手
        if (this.lastMove) {
            const centerX = this.lastMove.y * CELL_SIZE + CELL_SIZE / 2;
            const centerY = this.lastMove.x * CELL_SIZE + CELL_SIZE / 2;
            
            ctx.fillStyle = "#f00";
            ctx.beginPath();
            ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 繪製有效走法
        if (!this.returnMode) {
            for (const move of this.validMoves) {
                const centerX = move.y * CELL_SIZE + CELL_SIZE / 2;
                const centerY = move.x * CELL_SIZE + CELL_SIZE / 2;
                const radius = CELL_SIZE / 2 - 5;
                
                ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // 標記可以返還的棋子
            for (const piece of this.capturedToReturn) {
                const centerX = piece.y * CELL_SIZE + CELL_SIZE / 2;
                const centerY = piece.x * CELL_SIZE + CELL_SIZE / 2;
                const radius = CELL_SIZE / 2 - 5;
                
                ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }
}
// 棋盤類
class Board {
    constructor() {
        this.grid = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(null));
        this.reset();
    }
    
    // 重置棋盤
    reset() {
        // 清空棋盤
        for (let x = 0; x < BOARD_SIZE; x++) {
            for (let y = 0; y < BOARD_SIZE; y++) {
                this.grid[x][y] = null;
            }
        }
        
        // 設置初始棋子
        this.grid[3][3] = BLACK;  // 黑棋
        this.grid[4][4] = BLACK;  // 黑棋
        this.grid[3][4] = WHITE;  // 白棋
        this.grid[4][3] = WHITE;  // 白棋
    }
    
    // 獲取指定位置的棋子
    getPiece(x, y) {
        if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
            return this.grid[x][y];
        }
        return null;
    }
    
    // 設置指定位置的棋子
    setPiece(x, y, piece) {
        if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
            this.grid[x][y] = piece;
        }
    }
    
    // 計算棋子數量
    countPieces() {
        let blackCount = 0;
        let whiteCount = 0;
        
        for (let x = 0; x < BOARD_SIZE; x++) {
            for (let y = 0; y < BOARD_SIZE; y++) {
                if (this.grid[x][y] === BLACK) {
                    blackCount++;
                } else if (this.grid[x][y] === WHITE) {
                    whiteCount++;
                }
            }
        }
        
        return [blackCount, whiteCount];
    }
    
    // 檢查棋盤是否已滿
    isFull() {
        for (let x = 0; x < BOARD_SIZE; x++) {
            for (let y = 0; y < BOARD_SIZE; y++) {
                if (this.grid[x][y] === null) {
                    return false;
                }
            }
        }
        return true;
    }
    
    // 獲取有效走法
    getValidMoves(currentPlayer) {
        const validMoves = [];
        
        for (let x = 0; x < BOARD_SIZE; x++) {
            for (let y = 0; y < BOARD_SIZE; y++) {
                const captured = this.getCapturedPieces(x, y, currentPlayer);
                if (this.grid[x][y] === null && captured.length > 0) {
                    validMoves.push({x, y, captured});
                }
            }
        }
        
        return validMoves;
    }
    
    // 獲取將被吃掉的棋子
    getCapturedPieces(x, y, currentPlayer) {
        if (this.grid[x][y] !== null) {
            return [];
        }
        
        const opponent = currentPlayer === BLACK ? WHITE : BLACK;
        const captured = [];
        
        // 檢查八個方向
        const directions = [
            [0, 1], [1, 1], [1, 0], [1, -1], 
            [0, -1], [-1, -1], [-1, 0], [-1, 1]
        ];
        
        for (const [dx, dy] of directions) {
            let nx = x + dx;
            let ny = y + dy;
            const tempCaptured = [];
            
            // 向特定方向移動，尋找對手的棋子
            while (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE && this.grid[nx][ny] === opponent) {
                tempCaptured.push({x: nx, y: ny});
                nx += dx;
                ny += dy;
            }
            
            // 檢查這個方向的最後一個位置是否為自己的棋子
            if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE && this.grid[nx][ny] === currentPlayer && tempCaptured.length > 0) {
                captured.push(...tempCaptured);
            }
        }
        
        return captured;
    }
    
    // 執行移動
    makeMove(x, y, currentPlayer, capturedPieces, returnPiece = null) {
        this.grid[x][y] = currentPlayer;
        
        // 翻轉被吃掉的棋子
        for (const piece of capturedPieces) {
            // 如果不是要返還的棋子
            if (returnPiece === null || piece.x !== returnPiece.x || piece.y !== returnPiece.y) {
                this.grid[piece.x][piece.y] = currentPlayer;
            }
        }
        
        // 如果有指定返還的棋子，確保它不被翻轉
        if (returnPiece) {
            this.grid[returnPiece.x][returnPiece.y] = currentPlayer === BLACK ? WHITE : BLACK;
        }
    }
    
    // 克隆棋盤
    clone() {
        const newBoard = new Board();
        for (let x = 0; x < BOARD_SIZE; x++) {
            for (let y = 0; y < BOARD_SIZE; y++) {
                newBoard.grid[x][y] = this.grid[x][y];
            }
        }
        return newBoard;
    }
}

// AI類
class SmartAI {
    constructor(game, difficulty = "normal") {
        this.game = game;
        this.difficulty = difficulty;
        this.calculationTime = 0;
        this.searchInfo = {
            depthReached: 0,
            positionsEvaluated: 0,
            bestScore: 0
        };
    }
    
    // 評估棋盤狀態
    evaluateBoard(board, player) {
        const opponent = player === BLACK ? WHITE : BLACK;
        
        // 計算棋子數量
        const [blackCount, whiteCount] = board.countPieces();
        let pieceScore;
        if (player === BLACK) {
            pieceScore = blackCount - whiteCount;
        } else {
            pieceScore = whiteCount - blackCount;
        }
        
        // 角落評分 (權重高)
        let cornerScore = 0;
        const corners = [{x: 0, y: 0}, {x: 0, y: 7}, {x: 7, y: 0}, {x: 7, y: 7}];
        for (const corner of corners) {
            if (board.grid[corner.x][corner.y] === player) {
                cornerScore += 30;
            } else if (board.grid[corner.x][corner.y] === opponent) {
                cornerScore -= 30;
            }
        }
        
        // 邊緣評分
        let edgeScore = 0;
        for (let i = 1; i < 7; i++) {
            // 上邊緣
            if (board.grid[0][i] === player) {
                edgeScore += 5;
            } else if (board.grid[0][i] === opponent) {
                edgeScore -= 5;
            }
            
            // 下邊緣
            if (board.grid[7][i] === player) {
                edgeScore += 5;
            } else if (board.grid[7][i] === opponent) {
                edgeScore -= 5;
            }
            
            // 左邊緣
            if (board.grid[i][0] === player) {
                edgeScore += 5;
            } else if (board.grid[i][0] === opponent) {
                edgeScore -= 5;
            }
            
            // 右邊緣
            if (board.grid[i][7] === player) {
                edgeScore += 5;
            } else if (board.grid[i][7] === opponent) {
                edgeScore -= 5;
            }
        }
        
        // 機動性評分 (可下子位置數量)
        const playerMoves = board.getValidMoves(player).length;
        const opponentMoves = board.getValidMoves(opponent).length;
        let mobilityScore = 0;
        if (playerMoves + opponentMoves > 0) {
            mobilityScore = 10 * (playerMoves - opponentMoves) / (playerMoves + opponentMoves);
        }
        
        // 穩定子評分 (不會再被翻轉的棋子)
        const stabilityScore = this.calculateStability(board, player, opponent);
        
        // 棋盤填充率決定各項權重
        const [black, white] = board.countPieces();
        const totalPieces = black + white;
        const fillRate = totalPieces / (BOARD_SIZE * BOARD_SIZE);
        
        let pieceWeight, cornerWeight, edgeWeight, mobilityWeight, stabilityWeight;
        
        if (fillRate < 0.3) {  // 開局
            pieceWeight = 0.5;
            cornerWeight = 3.0;
            edgeWeight = 1.0;
            mobilityWeight = 2.0;
            stabilityWeight = 1.0;
        } else if (fillRate < 0.7) {  // 中局
            pieceWeight = 1.0;
            cornerWeight = 2.5;
            edgeWeight = 1.0;
            mobilityWeight = 1.5;
            stabilityWeight = 1.5;
        } else {  // 終局
            pieceWeight = 2.0;
            cornerWeight = 2.0;
            edgeWeight = 1.0;
            mobilityWeight = 0.5;
            stabilityWeight = 2.0;
        }
        
        // 根據難度調整評估精確度
        if (this.difficulty === "easy") {
            // 簡單難度：只考慮棋子數量和隨機因素
            return pieceScore + Math.random() * 5;
        }
        
        const totalScore = (
            pieceWeight * pieceScore +
            cornerWeight * cornerScore +
            edgeWeight * edgeScore +
            mobilityWeight * mobilityScore +
            stabilityWeight * stabilityScore
        );
        
        return totalScore;
    }
    
    // 計算穩定棋子分數
    calculateStability(board, player, opponent) {
        let score = 0;
        const stablePieces = this.findStablePieces(board);
        
        for (const piece of stablePieces) {
            if (board.grid[piece.x][piece.y] === player) {
                score += 10;
            } else if (board.grid[piece.x][piece.y] === opponent) {
                score -= 10;
            }
        }
        
        return score;
    }
    
    // 找出穩定棋子
    findStablePieces(board) {
        const stablePieces = new Set();
        
        // 首先添加所有角落
        const corners = [{x: 0, y: 0}, {x: 0, y: 7}, {x: 7, y: 0}, {x: 7, y: 7}];
        for (const {x, y} of corners) {
            if (board.grid[x][y] !== null) {
                stablePieces.add(`${x},${y}`);
            }
        }
        
        // 向其他方向擴展穩定棋子
        let oldSize = 0;
        while (oldSize !== stablePieces.size) {
            oldSize = stablePieces.size;
            
            for (let x = 0; x < BOARD_SIZE; x++) {
                for (let y = 0; y < BOARD_SIZE; y++) {
                    const key = `${x},${y}`;
                    if (board.grid[x][y] !== null && !stablePieces.has(key)) {
                        if (this.isStable(x, y, board, stablePieces)) {
                            stablePieces.add(key);
                        }
                    }
                }
            }
        }
        
        // 將Set轉換回座標對象數組
        return Array.from(stablePieces).map(key => {
            const [x, y] = key.split(",").map(Number);
            return {x, y};
        });
    }
    
    // 檢查一個棋子是否穩定
    isStable(x, y, board, stablePieces) {
        // 檢查四個方向
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        
        for (const [dx, dy] of directions) {
            let stablePos = false;
            let stableNeg = false;
            
            // 正方向
            let nx = x + dx;
            let ny = y + dy;
            while (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
                if (stablePieces.has(`${nx},${ny}`)) {
                    stablePos = true;
                    break;
                }
                if (board.grid[nx][ny] === null) {
                    break;
                }
                nx += dx;
                ny += dy;
            }
            
            // 負方向
            nx = x - dx;
            ny = y - dy;
            while (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
                if (stablePieces.has(`${nx},${ny}`)) {
                    stableNeg = true;
                    break;
                }
                if (board.grid[nx][ny] === null) {
                    break;
                }
                nx -= dx;
                ny -= dy;
            }
            
            if (!(stablePos || stableNeg)) {
                return false;
            }
        }
        
        return true;
    }
    
    // Minimax 算法，帶有 Alpha-Beta 剪枝
    minimax(board, depth, alpha, beta, maximizingPlayer, player) {
        const opponent = player === BLACK ? WHITE : BLACK;
        
        // 檢查是否達到遞歸深度或遊戲結束
        if (depth === 0 || board.isFull()) {
            return this.evaluateBoard(board, player);
        }
        
        // 更新搜索統計
        this.searchInfo.positionsEvaluated++;
        
        const validMoves = board.getValidMoves(maximizingPlayer ? player : opponent);
        
        // 如果沒有有效移動，切換玩家
        if (validMoves.length === 0) {
            // 檢查對方是否也沒有有效移動
            const opponentMoves = board.getValidMoves(maximizingPlayer ? opponent : player);
            if (opponentMoves.length === 0) {
                // 遊戲結束，評估最終局面
                return this.evaluateBoard(board, player);
            }
            
            // 跳過當前玩家，繼續搜索
            return this.minimax(board, depth, alpha, beta, !maximizingPlayer, player);
        }
        
        if (maximizingPlayer) {
            let maxEval = -Infinity;
            
            // 優先考慮角落和邊緣位置
            const sortedMoves = this.sortMoves(validMoves);
            
            for (const move of sortedMoves) {
                // 模擬移動
                const newBoard = board.clone();
                
                let returnPiece = null;
                if (move.captured.length >= 2 && this.difficulty === "hard") {
                    // 困難模式：選擇最優的返還棋子
                    returnPiece = this.findBestReturnPiece(board, move.x, move.y, move.captured, player);
                }
                
                // 執行移動
                newBoard.makeMove(move.x, move.y, player, move.captured, returnPiece);
                
                // 遞歸
                const evalScore = this.minimax(newBoard, depth - 1, alpha, beta, false, player);
                
                // 更新最大值
                maxEval = Math.max(maxEval, evalScore);
                
                // Alpha-Beta 剪枝
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) {
                    break;
                }
            }
            
            return maxEval;
        } else {
            let minEval = Infinity;
            
            const sortedMoves = this.sortMoves(validMoves);
            
            for (const move of sortedMoves) {
                // 模擬移動
                const newBoard = board.clone();
                
                let returnPiece = null;
                if (move.captured.length >= 2 && this.difficulty === "hard") {
                    // 困難模式：對對手而言最差的返還棋子
                    returnPiece = this.findBestReturnPiece(board, move.x, move.y, move.captured, opponent);
                }
                
                // 執行移動
                newBoard.makeMove(move.x, move.y, opponent, move.captured, returnPiece);
                
                // 遞歸
                const evalScore = this.minimax(newBoard, depth - 1, alpha, beta, true, player);
                
                // 更新最小值
                minEval = Math.min(minEval, evalScore);
                
                // Alpha-Beta 剪枝
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) {
                    break;
                }
            }
            
            return minEval;
        }
    }
    
    // 對移動進行排序，優先考慮角落和邊緣
    sortMoves(moves) {
        const corners = [{x: 0, y: 0}, {x: 0, y: 7}, {x: 7, y: 0}, {x: 7, y: 7}];
        const cornerCoords = corners.map(c => `${c.x},${c.y}`);
        
        const edges = [];
        for (let i = 1; i < 7; i++) {
            edges.push({x: 0, y: i}, {x: 7, y: i}, {x: i, y: 0}, {x: i, y: 7});
        }
        const edgeCoords = edges.map(e => `${e.x},${e.y}`);
        
        return moves.sort((a, b) => {
            const aKey = `${a.x},${a.y}`;
            const bKey = `${b.x},${b.y}`;
            
            // 角落最優先
            if (cornerCoords.includes(aKey) && !cornerCoords.includes(bKey)) return -1;
            if (!cornerCoords.includes(aKey) && cornerCoords.includes(bKey)) return 1;
            
            // 其次是邊緣
            if (edgeCoords.includes(aKey) && !edgeCoords.includes(bKey)) return -1;
            if (!edgeCoords.includes(aKey) && edgeCoords.includes(bKey)) return 1;
            
            // 捕獲更多棋子的優先
            return b.captured.length - a.captured.length;
        });
    }
    
    // 選擇最優的返還棋子
    findBestReturnPiece(board, moveX, moveY, captured, player) {
        // 默認返回第一個棋子
        if (captured.length === 0) return null;
        
        let bestPiece = captured[0];
        let bestScore = -Infinity;
        
        for (const piece of captured) {
            // 複製棋盤
            const newBoard = board.clone();
            // 模擬這次移動並返還當前考慮的棋子
            newBoard.makeMove(moveX, moveY, player, captured, piece);
            // 評估新棋盤
            const score = this.evaluateBoard(newBoard, player);
            // 更新最佳返還棋子
            if (score > bestScore) {
                bestScore = score;
                bestPiece = piece;
            }
        }
        
        return bestPiece;
    }
    
    // 迭代加深搜索
    iterativeDeepeningSearch(board, player) {
        const startTime = Date.now();
        this.searchInfo = {
            depthReached: 0,
            positionsEvaluated: 0,
            bestScore: 0
        };
        
        // 根據難度確定最大深度限制
        let maxDepthLimit;
        let maxTime;
        
        if (this.difficulty === "easy") {
            maxDepthLimit = 2;
            maxTime = 500;  // 毫秒
        } else if (this.difficulty === "normal") {
            maxDepthLimit = 4;
            maxTime = 1000;  // 毫秒
        } else {  // hard
            maxDepthLimit = 6;
            maxTime = 3000;  // 毫秒
        }
        
        let bestMove = null;
        let bestScore = -Infinity;
        
        // 從深度1開始迭代加深
        for (let depth = 1; depth <= maxDepthLimit; depth++) {
            console.log(`搜索深度 ${depth} 開始...`);
            this.searchInfo.positionsEvaluated = 0;
            
            let currentBestMove = null;
            let currentBestScore = -Infinity;
            
            const validMoves = board.getValidMoves(player);
            const sortedMoves = this.sortMoves(validMoves);
            
            for (const move of sortedMoves) {
                // 模擬移動
                const newBoard = board.clone();
                
                let returnPiece = null;
                if (move.captured.length >= 2 && this.difficulty === "hard") {
                    returnPiece = this.findBestReturnPiece(board, move.x, move.y, move.captured, player);
                }
                
                // 執行移動
                newBoard.makeMove(move.x, move.y, player, move.captured, returnPiece);
                
                // 評估這個移動
                const score = this.minimax(
                    newBoard, depth - 1, -Infinity, Infinity, false, player
                );
                
                if (score > currentBestScore) {
                    currentBestScore = score;
                    currentBestMove = move;
                }
            }
            
            // 記錄找到的最佳移動
            if (currentBestMove) {
                bestMove = currentBestMove;
                bestScore = currentBestScore;
                this.searchInfo.depthReached = depth;
                this.searchInfo.bestScore = bestScore;
            }
            
            console.log(`完成深度 ${depth} 搜索，找到最佳分數: ${bestScore}, 累計評估 ${this.searchInfo.positionsEvaluated} 個位置`);
            
            // 檢查剩餘時間
            const elapsed = Date.now() - startTime;
            if (elapsed > maxTime) {
                console.log(`時間不足以進行更深層搜索，停止於深度 ${depth}`);
                break;
            }
        }
        
        // 計算總計算時間
        this.calculationTime = (Date.now() - startTime) / 1000;
        
        console.log(`搜索完成：達到深度 ${this.searchInfo.depthReached}，評估 ${this.searchInfo.positionsEvaluated} 個位置，用時 ${this.calculationTime.toFixed(2)} 秒`);
        
        return bestMove;
    }
    
    // 獲取最佳移動
    getBestMove() {
        const player = this.game.currentPlayer;
        const validMoves = this.game.validMoves;
        
        if (validMoves.length === 0) {
            return null;
        }
        
        // 簡單難度：100% 隨機
        if (this.difficulty === "easy") {
            return validMoves[Math.floor(Math.random() * validMoves.length)];
        }
        
        // 中等難度：10% 隨機
        if (this.difficulty === "normal" && Math.random() < 0.1) {
            return validMoves[Math.floor(Math.random() * validMoves.length)];
        }
        
        // 使用迭代加深搜索尋找最佳移動
        return this.iterativeDeepeningSearch(this.game.board.clone(), player);
    }
    
    // 獲取最佳返還棋子
    getBestReturnPiece(capturedPieces) {
        // 簡單難度：隨機選擇
        if (this.difficulty === "easy") {
            return capturedPieces[Math.floor(Math.random() * capturedPieces.length)];
        }
        
        // 中等難度：10% 隨機選擇
        if (this.difficulty === "normal" && Math.random() < 0.1) {
            return capturedPieces[Math.floor(Math.random() * capturedPieces.length)];
        }
        
        // 困難難度：選擇最有利的棋子
        const player = this.game.currentPlayer;
        const moveX = this.game.lastMove.x;
        const moveY = this.game.lastMove.y;
        
        return this.findBestReturnPiece(this.game.board, moveX, moveY, capturedPieces, player);
    }
}

// 初始化遊戲
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM 已加載，開始初始化遊戲");
    
    try {
        const game = new Game();
        console.log("遊戲初始化完成，當前狀態:", game.gameState);
        
        // 確保模態窗口初始隱藏
        document.getElementById("game-end-modal").classList.add("hidden");
        console.log("已確保結束模態窗口隱藏");
        
        // 顯示選單
        document.getElementById("game-menu").classList.remove("hidden");
        console.log("已顯示遊戲選單");
    } catch (error) {
        console.error("遊戲初始化出錯:", error);
    }
});
