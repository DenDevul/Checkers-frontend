<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import socket from '../../socket';
  import { initialFen, readFen, writeFen } from '../../utility/fen';
  import Controls from '$lib/Controls.svelte';

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
  let isDrawOffered: boolean = false;
  let gameResult: string = '*';
  let restartButtonClicked: boolean = false;
  let readyToRestart: boolean = false;
  let promise: Promise<unknown>;

  $: gameUrl = $page.url.pathname.slice(1);

  $: if (gameUrl) {
    isLoading = true;
    restartButtonClicked = false;
    readyToRestart = false;
    promise = fetch();
  }

  $: isGameOver = gameResult !== '*';

  $: if (!isLoading) {
    if (isGameOver) canPlay = false;
    else canPlay = isWhiteSide === isWhiteTurn;
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
    if (isWhiteSide) return tiles.flat();
    else {
      let board = [...tiles].reverse();
      return board.map((row) => [...row].reverse()).flat();
    }
  };

  $: if (isDrawOffered) {
    if (isGameOver) isDrawOffered = false;
    else {
      setTimeout(() => {
        isDrawOffered = false;
      }, 5000);
    }
  }

  async function fetch() {
    if (!browser) return;
    try {
      connectSocket();
      await loadGame();
      isLoading = false;
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'Requested game was not found') {
          alert('Игра не найдена');
          await goto('/');
        }
      }
      throw err;
    }
  }

  function connectSocket(): void {
    if (!socket.connected) socket.connect();
    else socket.removeAllListeners();

    socket.on('next move', (fen: string) => {
      ({ tiles, isWhiteTurn, turn } = readFen(fen));
    });

    socket.on('end game', (result: string) => {
      gameResult = calcGameResult(result);
    });

    socket.on('offer draw', () => {
      isDrawOffered = true;
    });

    socket.on('request restart', () => {
      readyToRestart = true;
    });

    socket.on('restart game', async (newGameUrl: string) => {
      await goto(newGameUrl);
    });

    socket.on('connect_error', async (err) => {
      if (err.message === 'user id not provided') {
        await goto('/');
      }
    });

    socket.on('disconnect', async (reason) => {
      if (reason === 'io server disconnect') {
        await goto('/');
      }
    });
  }

  async function loadGame(): Promise<void> {
    const promise = new Promise<{
      fen: string;
      playerSide: string;
      result: string;
    }>((resolve, reject) => {
      socket.emit('request game', gameUrl, (response: any) => {
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
      throw error;
    }
  }

  function sendFen(): void {
    const fen = writeFen({ tiles, isWhiteTurn, turn });
    socket.emit('next move', gameUrl, fen);
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
    socket.emit('end game', gameUrl, result);
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

  function giveUp(): void {
    const result = isWhiteSide ? '0-1' : '1-0';
    endGame(result);
  }

  function offerDraw(): void {
    socket.emit('offer draw', gameUrl);
  }

  function respondToDrawOffer(e: CustomEvent<any>): void {
    const response = e.detail?.response;
    if (response === 'yes') {
      const result = '1/2-1/2';
      endGame(result);
    } else {
      isDrawOffered = false;
    }
  }

  function restartGame(
    event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
  ) {
    restartButtonClicked = true;
    if (readyToRestart) {
      socket.emit('restart game', gameUrl, initialFen);
    } else {
      socket.emit('request restart', gameUrl);
    }
  }
</script>

<div class="wrapper">
  <div class="turn" class:turn-black={!(isWhiteTurn ?? true)}>
    {#if isWhiteSide === isWhiteTurn}
      <h2>Ваш ход</h2>
    {:else}
      <h2>Ход соперника</h2>
    {/if}
  </div>
  <div class="container">
    <div class="tiles">
      {#await promise}
        <div class="blur">
          <span class="loader" />
        </div>
        {#each tiles.flat() as tile (tile)}
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
              <div class="piece" class:black={!tile.piece.isWhite}>
                <span class="king" class:hidden={!tile.piece.isKing}
                  >&#128081;</span
                >
              </div>
            {/if}
          </button>
        {/each}
      {:catch}
        {#each tiles.flat() as tile (tile)}
          <button class="tile" class:gray={isGray(tile)} />
        {/each}
        <h1 style="color: red; position: absolute;">ПРОИЗОШЕЛ ЕРРОР</h1>
      {/await}
    </div>
    <Controls
      {isGameOver}
      {isDrawOffered}
      on:giveUp={giveUp}
      on:offerDraw={offerDraw}
      on:respond={respondToDrawOffer}
    />
  </div>
</div>
{#if isGameOver}
  <div class="game-over">
    {#if gameResult === 'winner'}
      <h2>Вы победили!🥳</h2>
    {:else if gameResult === 'loser'}
      <h2>Вы проиграли!😔</h2>
    {:else if gameResult === 'draw'}
      <h2>Ничья!🤝</h2>
    {/if}
    <button class:clicked={restartButtonClicked} on:click|once={restartGame}
      >{restartButtonClicked ? 'ожидание ответа...' : 'сыграть заново'}</button
    >
  </div>
{/if}

<style>
  .wrapper {
    align-self: start;
    padding: 2rem 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .turn {
    width: 14rem;
    border-radius: 8px;
    padding: 2px 0;
    text-align: center;
    background-color: white;
    color: black;
  }
  .turn-black {
    background-color: black;
    color: white;
  }

  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    border-radius: 10px;
    box-shadow: 0px 0px 20px 4px rgba(0, 0, 0, 0.08);
    grid-area: board;
  }

  .tile {
    height: min(3.75rem, 10vw);
    width: min(3.75rem, 10vw);
    background-color: white;
    display: flex;
    justify-content: center;
    align-items: center;
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
    border-top-left-radius: 10px;
  }
  .tile:nth-child(8) {
    border-top-right-radius: 10px;
  }
  .tile:nth-child(57) {
    border-bottom-left-radius: 10px;
  }
  .tile:last-child {
    border-bottom-right-radius: 10px;
  }

  .piece {
    height: 65%;
    width: 65%;
    background-color: white;
    color: black;
    border-radius: 50%;
    display: flex;
    justify-content: center;
  }
  .piece.black {
    background-color: black;
  }
  .king {
    font-size: min(1.5rem, 4vw);
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
    padding: 1.75rem;
    gap: 1rem;
    background: rgb(255, 255, 255);
    box-shadow: 0px 0px 12px 2px rgba(0, 0, 0, 0.25);
  }
  .game-over button {
    padding: 8px;
    text-transform: uppercase;
    font-weight: bold;
    border-radius: 8px;
    border: black 2px solid;
    background-color: black;
    color: white;
  }
  .game-over button:hover {
    background-color: hsl(0, 0%, 15%);
  }
  .game-over button:active {
    background-color: white;
    color: black;
  }
  .game-over button:focus-visible {
    outline: 3px solid red;
  }
  .game-over button.clicked {
    background-color: white;
    color: black;
  }

  @media screen and (min-width: 768px) {
    .container {
      padding: 0 2rem;
      flex-direction: row;
      align-items: start;
    }
    .tile {
      width: clamp(3.75rem, 7.5vw, 4.5rem);
      height: clamp(3.75rem, 7.5vw, 4.5rem);
    }
    .king {
      font-size: clamp(1.5rem, 3.15vw, 1.85rem);
    }
  }

  @media screen and (min-width: 1024px) {
    .container {
      display: grid;
      grid-template:
        '. board controls' auto
        / 1fr 1fr 1fr;
    }
  }
</style>
