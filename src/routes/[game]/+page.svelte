<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import socket from '../../socket';
  import { initialFen, readFen, writeFen } from '../../utility/fen';

  interface Tile {
    pos: number[];
    piece: { isBlack: boolean; isKing: boolean } | null;
  }

  const gameUrl = $page.url.pathname.slice(1);

  let tiles: Tile[][] = readFen(initialFen).tiles;
  let selectedPiece: Tile | null = null;
  let possibleMoves: Tile[] = [];
  let playablePieces: Tile[] = [];
  let isWhiteSide: boolean;
  let isWhiteTurn: boolean;
  let turn: number;
  let isLoading: boolean = true;

  $: if (!isLoading) {
    if (isWhiteTurn === isWhiteSide) {
      playablePieces = getPlayablePieces();

      if (playablePieces.length == 0) endGame();
    }
  }
  $: if (selectedPiece) {
    const captures = getAllPossibleCaptures(selectedPiece);
    const moves = getAllPossibleMoves(selectedPiece);
    possibleMoves = captures.length > 0 ? captures : moves;
  }
  $: isHighlighted = (tile: Tile): boolean => {
    if (isLoading || isWhiteTurn !== isWhiteSide) return false;

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
      await connectSocket();
      isLoading = false;
      resolve();
    } catch (er) {
      reject();
    }
  });

  async function connectSocket(): Promise<void> {
    if (!browser) return;

    socket.auth = { ...socket.auth, gameUrl: gameUrl };

    socket.on('next move', (fen: string) => {
      ({ tiles, isWhiteTurn, turn } = readFen(fen));
    });
    
    socket.on('end game', (result: string) => {
      const isWhiteWon = result == '1-0'
      if (isWhiteSide === isWhiteWon) {
        // show 'you won' screen
      } else {
        // show 'better luck next time' screen
      }
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

    let data;
    try {
      data = await loadGame();
    } catch (error) {
      throw new Error('Could not load game');
    }
    isWhiteSide = data.playerSide === 'white';
    ({ tiles, isWhiteTurn, turn } = readFen(data.fen));
  }

  function loadGame(): Promise<{ fen: string; playerSide: string }> {
    return new Promise((resolve, reject) => {
      socket.emit('request game', (response: any) => {
        response ? resolve(response) : reject('Requested game was not found');
      });
    });
  }

  function sendFen(): void {
    const fen = writeFen({ tiles, isWhiteTurn, turn });
    socket.emit('next move', fen);
  }

  function handleClick(tile: Tile) {
    if (isWhiteTurn !== isWhiteSide) return;

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

  function endTurn(): void {
    selectedPiece = null;
    isWhiteTurn = !isWhiteTurn;
    turn++;
    sendFen();
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
        (!start.piece.isBlack && rowStart < rowEnd) ||
        (start.piece.isBlack && rowStart > rowEnd)
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
      capturedPieces[0].piece!.isBlack === start.piece.isBlack
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
    if ((row === 0 && !end.piece!.isBlack) || (row === 7 && end.piece!.isBlack))
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
      .filter((tile) => tile.piece?.isBlack !== isWhiteSide);
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

  function endGame() {
    const result = isWhiteSide ? '0-1' : '1-0';
    socket.emit('end game', result);
  }
</script>

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
          <div class="piece" class:black={tile.piece.isBlack}>
            <span class:hidden={!tile.piece.isKing}>&#128081;</span>
          </div>
        {/if}
      </button>
    {/each}
  {:catch}
    <h1 style="color: red; position: absolute;">ПРОИЗОШЕЛ ЕРРОР</h1>
  {/await}
</div>

<style>
  .tiles {
    height: calc(var(--tile-size) * 8);
    width: calc(var(--tile-size) * 8);
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    border-radius: var(--board-border-radius);
    box-shadow: rgba(100, 100, 111, 0.2) 0px 7px 29px 0px;
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
</style>
