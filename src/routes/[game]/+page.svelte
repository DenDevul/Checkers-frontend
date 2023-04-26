<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import socket from '../../socket';
  import { initialFen, readFen, writeFen } from '../../utility/fen';

  interface Tile {
    pos: number[];
    piece: { isWhite: boolean; isKing: boolean } | null;
  }

  let tiles: Tile[][] = readFen(initialFen).tiles;
  let selectedPiece: Tile | null = null;
  let possibleMoves: Tile[] = [];
  let playablePieces: Tile[] = [];
  let isWhiteSide: boolean;
  let isWhiteTurn: boolean;
  let turn: number;
  let isLoading: boolean = true;
  let canPlay: boolean = false;
  let gameResult: string = '*';

  $: if (!isLoading) {
    if (gameResult !== '*') canPlay = false;
    else if (isWhiteSide === isWhiteTurn) canPlay = true;
  }

  $: if (canPlay) {
    playablePieces = getPlayablePieces();
  }
  $: if (selectedPiece) {
    const captures = getAllPossibleCaptures(selectedPiece);
    const moves = getAllPossibleMoves(selectedPiece);
    possibleMoves = captures.length > 0 ? captures : moves;
  }
  $: isHighlighted = (tile: Tile): boolean => {
    if (!canPlay) return false;

    if (!selectedPiece) return listIncludes(playablePieces, tile);

    return listIncludes([...possibleMoves, selectedPiece], tile);
  };

  $: board = () => {
    if (isLoading || isWhiteSide) return tiles.flat();
    else {
      let board = [...tiles].reverse();
      return board.map((row) => [...row].reverse()).flat();
    }
  };

  const promiseInit = new Promise<void>(async (resolve, reject) => {
    try {
      connectSocket();
      await loadGame();
      isLoading = false;
      resolve();
    } catch (er) {
      reject(er);
    }
  });

  function connectSocket(): void {
    if (!browser) return;

    const gameUrl = $page.url.pathname.slice(1);
    socket.auth = { ...socket.auth, gameUrl: gameUrl };

    socket.on('next move', (fen: string) => {
      ({ tiles, isWhiteTurn, turn } = readFen(fen));
    });

    socket.on('end game', (result: string) => {
      console.log(result);
      gameResult = calcGameResult(result);
    });

    socket.on('connect_error', (err) => {
      if (err.message === 'auth not provided') {
        goto('/');
      }
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        goto('/');
      }
    });

    if (!socket.connected) socket.connect();
  }

  async function loadGame(): Promise<void> {
    const promise = new Promise<{
      fen: string;
      playerSide: string;
      result: string;
    }>((resolve, reject) => {
      socket.emit('request game', (response: any) => {
        response
          ? resolve(response)
          : reject(new Error('Requested game was not found'));
      });
    });
    try {
      const data = await promise;
      isWhiteSide = data.playerSide === 'white';
      ({ tiles, isWhiteTurn, turn } = readFen(data.fen));
      gameResult = calcGameResult(data.result);
    } catch (error) {
      throw new Error('Could not load game');
    }
  }

  function sendFen(): void {
    const fen = writeFen({ tiles, isWhiteTurn, turn });
    socket.emit('next move', fen);
  }

  function handleClick(tile: Tile) {
    if (!canPlay) return;

    if (!selectedPiece) {
      if (listIncludes(playablePieces, tile)) selectedPiece = tile;
      return;
    }

    let start = selectedPiece;
    let end = tile;

    if (canPieceCapture(start)) {
      if (listIncludes(possibleMoves, end)) {
        const capturedTiles = getCapturedTiles(start, end);
        capturedTiles.find((el) => el.piece)!.piece = null;
        swap(start, end);
        if (canPieceCapture(end)) {
          selectedPiece = end;
          playablePieces = [end];
          sendFen();
          return;
        }
        return endTurn();
      } else {
        return selectOther(end);
      }
    }

    if (listIncludes(possibleMoves, end)) {
      const state = start.piece!.isKing;
      swap(start, end);
      if (state !== end.piece!.isKing) {
        if (canPieceCapture(end)) {
          selectedPiece = end;
          playablePieces = [end];
          sendFen();
          return;
        }
      }
      return endTurn();
    } else {
      return selectOther(end);
    }
  }

  function isValidMove(start: Tile, end: Tile): boolean {
    if (!start.piece || end.piece) return false;

    const [rowStart, colStart] = start.pos;
    const [rowEnd, colEnd] = end.pos;

    if (!start.piece.isKing) {
      // not 1 step
      if (
        Math.abs(rowStart - rowEnd) !== 1 ||
        Math.abs(colStart - colEnd) !== 1
      )
        return false;
      // not move forward
      if (
        (start.piece.isWhite && rowStart < rowEnd) ||
        (!start.piece.isWhite && rowStart > rowEnd)
      )
        return false;
    } else {
      // not diagonal move
      if (Math.abs(rowStart - rowEnd) !== Math.abs(colStart - colEnd))
        return false;
      // something in between
      const capturedTiles = getCapturedTiles(start, end);
      if (capturedTiles.filter((el) => el.piece).length > 0) return false;
    }

    return true;
  }

  function isValidCapture(start: Tile, end: Tile): boolean {
    if (!start.piece || end.piece) return false;

    const [rowStart, colStart] = start.pos;
    const [rowEnd, colEnd] = end.pos;

    // not diagonal move
    if (Math.abs(rowStart - rowEnd) !== Math.abs(colStart - colEnd))
      return false;

    // not 2 step capture
    if (!start.piece.isKing && Math.abs(rowStart - rowEnd) !== 2) return false;

    const capturedPieces = getCapturedTiles(start, end).filter(
      (el) => el.piece
    );

    if (
      capturedPieces.length !== 1 ||
      capturedPieces[0].piece!.isWhite === start.piece.isWhite
    )
      return false;

    return true;
  }

  function getAllPossibleMoves(piece: Tile, onlyCaptures = false): Tile[] {
    const [row, col] = piece.pos;
    const moves: Tile[] = [];
    const diagonals: Tile[] = [];

    // Check up-left direction
    for (let r = row - 1, c = col - 1; r >= 0 && c >= 0; r--, c--) {
      diagonals.push(tiles[r][c]);
    }
    // Check up-right direction
    for (let r = row - 1, c = col + 1; r >= 0 && c < 8; r--, c++) {
      diagonals.push(tiles[r][c]);
    }
    // Check down-left direction
    for (let r = row + 1, c = col - 1; r < 8 && c >= 0; r++, c--) {
      diagonals.push(tiles[r][c]);
    }
    // Check down-right direction
    for (let r = row + 1, c = col + 1; r < 8 && c < 8; r++, c++) {
      diagonals.push(tiles[r][c]);
    }

    for (const move of diagonals) {
      if (
        (isValidMove(piece, move) && !onlyCaptures) ||
        isValidCapture(piece, move)
      )
        moves.push(move);
    }

    return moves;
  }

  function getAllPossibleCaptures(piece: Tile): Tile[] {
    return getAllPossibleMoves(piece, true);
  }

  function swap(start: Tile, end: Tile): void {
    end.piece = start.piece;
    start.piece = null;
    const row = end.pos[0];
    if ((row === 0 && end.piece!.isWhite) || (row === 7 && !end.piece!.isWhite))
      end.piece!.isKing = true;
    tiles = tiles;
  }

  function getCapturedTiles(start: Tile, end: Tile): Tile[] {
    const [rowStart, colStart] = start.pos;
    const [rowEnd, colEnd] = end.pos;
    let steps = 2;
    if (start!.piece!.isKing) steps = Math.abs(rowStart - rowEnd);
    const capturedTiles = [];

    for (let i = 1; i < steps; i++) {
      const [row, col] = [
        rowStart < rowEnd ? rowStart + i : rowStart - i,
        colStart < colEnd ? colStart + i : colStart - i
      ];
      capturedTiles.push(tiles[row][col]);
    }
    return capturedTiles;
  }

  function getPlayablePieces(): Tile[] {
    let pieces = [];
    const attack: Tile[] = [];
    const move: Tile[] = [];
    const ownPieces = tiles
      .flat()
      .filter((tile) => tile.piece?.isWhite === isWhiteSide);
    for (const piece of ownPieces) {
      if (canPieceCapture(piece)) attack.push(piece);
      else if (getAllPossibleMoves(piece).length > 0) move.push(piece);
    }
    pieces = attack.length > 0 ? attack : move;
    return pieces;
  }

  function canPieceCapture(piece: Tile): boolean {
    return getAllPossibleCaptures(piece).length > 0;
  }

  function selectOther(tile: Tile): void {
    if (listIncludes(playablePieces, tile)) {
      selectedPiece = tile;
    } else {
      selectedPiece = null;
    }
  }

  function listIncludes(list: Tile[], tile: Tile): boolean {
    return list.map((el) => el.pos.toString()).includes(tile.pos.toString());
  }

  function isGray(tile: Tile): boolean {
    const [r, c] = tile.pos;
    return (r + c) % 2 == 1;
  }

  function endTurn(): void {
    const result = checkGameOver();
    selectedPiece = null;
    isWhiteTurn = !isWhiteTurn;
    turn++;
    sendFen();
    if (result !== '*') endGame(result);
  }

  function checkGameOver(): string {
    let res = '*';
    const ownPlayPieces: Tile[] = [];
    const enemyPlayPieces: Tile[] = [];
    for (const tile of tiles.flat()) {
      if (
        tile.piece?.isWhite !== isWhiteSide &&
        getAllPossibleMoves(tile).length > 0
      )
        enemyPlayPieces.push(tile);
      if (
        tile.piece?.isWhite === isWhiteSide &&
        getAllPossibleMoves(tile).length > 0
      )
        ownPlayPieces.push(tile);
    }
    if (enemyPlayPieces.length === 0) {
      if (ownPlayPieces.length === 0) res = '1/2-1/2';
      else res = isWhiteSide ? '1-0' : '0-1';
    }

    return res;
  }

  function endGame(result: string) {
    socket.emit('end game', result);
    gameResult = calcGameResult(result);
  }

  function calcGameResult(result: string): string {
    let res = '';
    switch (result) {
      case '*':
        res = '*';
        break;
      case '1-0':
        res = isWhiteSide ? 'winner' : 'loser';
        break;
      case '0-1':
        res = isWhiteSide ? 'loser' : 'winner';
        break;
      case '1/2-1/2':
        res = 'draw';
        break;
    }
    return res;
  }

  function redirectToHome() {
    socket.auth = { ...socket.auth, gameUrl: null };
    goto('/');
  }
</script>

<div class="grid">
  <div class="tiles">
    {#await promiseInit}
      <div class="blur">
        <span class="loader" />
      </div>
      {#each board() as tile (tile)}
        <button class="tile" class:gray={isGray(tile)} />
      {/each}
    {:then _}
      {#each board() as tile (tile)}
        <button
          class="tile"
          class:gray={isGray(tile)}
          class:highlight={isHighlighted(tile)}
          on:click={() => {
            handleClick(tile);
          }}
        >
          {#if tile.piece}
            <div class="piece" class:black={tile.piece.isWhite}>
              <span class:hidden={!tile.piece.isKing}>&#128081;</span>
            </div>
          {/if}
        </button>
      {/each}
    {:catch}
      <h1 style="color: red; position: absolute;">ПРОИЗОШЕЛ ЕРРОР</h1>
    {/await}
  </div>
  <div class="controls">
    <div class="turn b">
      <h2>Ход белых</h2>
    </div>
    <div class="flex-col">
      <button class="btn giveup"
        >Cдаться <img src="svg/flag.svg" alt="" /></button
      >
      <button class="btn btn-draw"
        >Предложить ничью <img src="svg/handshake.svg" alt="" /></button
      >
    </div>
    <div class="draw">
      <p>Соперник предлагает ничью</p>
      <div class="draw-buttons">
        <button class="btn"><img src="svg/check.svg" alt="" /></button>
        <button class="btn no"><img src="svg/close.svg" alt="" /></button>
      </div>
    </div>
  </div>
</div>
{#if gameResult !== '*'}
  <div class="game-over">
    {#if gameResult === 'winner'}
      <h1>Вы победили!</h1>
    {:else if gameResult === 'loser'}
      <h1>Увы, вы проиграли!</h1>
    {:else if gameResult === 'draw'}
      <h1>Ничья!</h1>
    {/if}
    <button on:click={redirectToHome}>сыграть новую игру</button>
  </div>
{/if}

<style>
  .grid {
    display: grid;
    grid-template:
      '. board controls' auto
      / 1fr auto 1fr;
  }

  .tiles {
    height: calc(var(--tile-size) * 8);
    width: calc(var(--tile-size) * 8);
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    border-radius: var(--board-border-radius);
    box-shadow: 0px 0px 20px 4px rgba(0, 0, 0, 0.08);
    grid-area: board;
  }

  .tile {
    height: var(--tile-size);
    width: var(--tile-size);
    background-color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    user-select: none;
    cursor: pointer;
    border: none;
    outline: none;
  }
  .tile:focus-visible {
    border: 2px solid blue;
  }
  .tile.gray {
    background-color: #a9a9a9;
  }
  .tile.highlight {
    background-color: #fff68f;
  }

  .tile:first-child {
    border-top-left-radius: var(--board-border-radius);
  }
  .tile:nth-child(8) {
    border-top-right-radius: var(--board-border-radius);
  }
  .tile:nth-child(57) {
    border-bottom-left-radius: var(--board-border-radius);
  }
  .tile:last-child {
    border-bottom-right-radius: var(--board-border-radius);
  }

  .piece {
    height: var(--piece-size);
    width: var(--piece-size);
    background-color: white;
    color: black;
    border-radius: 100%;
    display: flex;
    justify-content: center;
    font-size: 2em;
  }
  .piece > span {
    font-size: xx-large;
  }
  .piece.black {
    background-color: black;
    color: yellow;
  }
  .hidden {
    visibility: hidden;
  }

  .blur {
    backdrop-filter: blur(3px);
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
  }
  .loader {
    z-index: 10;
    top: 0;
    left: 0;
    width: 48px;
    height: 48px;
    border: 5px solid #212121;
    border-bottom-color: transparent;
    border-radius: 50%;
    display: inline-block;
    box-sizing: border-box;
    animation: rotation 1s linear infinite;
  }

  @keyframes rotation {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .game-over {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    border-radius: 1rem;
    border: black 2px solid;
    padding: 1rem;
    gap: 1rem;
    background: white;
    box-shadow: 0px 0px 12px 2px rgba(0, 0, 0, 0.08);
  }
  .game-over button {
    padding: 8px;
    text-transform: uppercase;
    border-radius: 4px;
    border: black 1px solid;
    background-color: black;
    color: white;
    font-weight: bold;
  }
  .game-over button:active {
    background-color: white;
    color: black;
  }

  .controls {
    grid-area: controls;
    padding-left: 32px;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  .controls img {
    width: 1.2rem;
    height: 1.2rem;
  }

  .turn {
    background-color: #fff;
    border-radius: 8px;
    padding: 2px;
    text-align: center;
  }
  .turn.b {
    background-color: black;
    color: #fff;
  }

  .flex-col {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .btn {
    border: none;
    background-color: hsl(69, 69%, 55%);
    border-radius: 8px;
    padding: 8px;
    font-size: 1.2rem;
    box-shadow: 0px 0px 8px 1px rgb(0 0 0 / 0.1);
  }
  .btn:hover {
    background-color: hsl(69, 69%, 48%);
  }
  .btn:active {
    background-color: hsl(69, 69%, 41%);
  }
  .btn.giveup {
    background-color: hsl(0, 0%, 100%);
  }
  .btn.giveup:hover {
    background-color: hsl(0, 0%, 96%);
  }
  .btn.giveup:active {
    background-color: hsl(0, 0%, 92%);
  }
  .btn.no {
    background-color: hsl(9, 69%, 55%);
  }
  .btn.no:hover {
    background-color: hsl(9, 69%, 48%);
  }
  .btn.no:active {
    background-color: hsl(9, 69%, 41%);
  }
  .btn.btn-draw:active {
    box-shadow: inset 0 0 10px 2px rgba(0, 0, 0, 0.2);
  }

  .draw {
    background-color: #fff;
    border-radius: 8px;
    padding: 8px;
    font-weight: bold;
    font-size: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .draw-buttons {
    display: flex;
    justify-content: space-evenly;
  }
  .draw-buttons button {
    width: 5rem;
  }
</style>
