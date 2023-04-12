<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import socket from '../../socket';

  interface ITile {
    pos: number[];
    piece: { isBlack: boolean; isKing: boolean } | null;
  }

  let tiles: ITile[][] = Array.from(Array(8), () => Array<ITile>(8));
  let isWhitesTurn: boolean = true;
  let selectedPiece: ITile | null = null;
  let highlightedList: number[][] = [];
  let attackingPieces: ITile[] = [];
  let playablePieces: ITile[] = [];

  $: isWhitesTurn, getPlayableTiles();
  $: selectedPiece, highlightTiles();
  $: isHighlighted = (tile: ITile) => {
    return highlightedList
      .map((el) => el.toString())
      .includes(tile.pos.toString());
  };

  async function connectSocket() {
    const gameUrl = $page.url.pathname.slice(1);
    socket.auth = { ...socket.auth, gameUrl: gameUrl };
    socket.connect();

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
  }

  function isGray(tile: ITile) {
    const [r, c] = tile.pos;
    return (r + c) % 2 == 1;
  }

  function initGame() {
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const tile: ITile = {
          pos: [i, j],
          piece:
            (i + j) % 2 === 1 && (i < 3 || i > 4)
              ? { isBlack: i < 3, isKing: false }
              : null
        };
        tiles[i][j] = tile;
      }
    }

    getPlayableTiles();
    highlightTiles();
  }

  function handleClick(tile: ITile) {
    if (!selectedPiece) {
      // on turn start primarily choose pieces that can attack
      if (attackingPieces.length > 0) {
        if (listContains(attackingPieces, tile)) selectedPiece = tile;
        return;
      }
      if (listContains(playablePieces, tile)) selectedPiece = tile;
      return;
    }

    let start = selectedPiece;
    let end = tile;

    if (attackingPieces.length > 0) {
      const captureMoves = getAllPossibleMoves(start, true);
      if (
        captureMoves.map((el) => el.toString()).includes(end.pos.toString())
      ) {
        const capturedTiles = getCapturedTiles(start, end);
        capturedTiles.find((el) => el.piece)!.piece = null;
        swap(start, end);
        if (canCapture(end)) {
          selectedPiece = end;
          attackingPieces = [end];
          return;
        }
        selectedPiece = null;
        isWhitesTurn = !isWhitesTurn;
        return;
      } else {
        if (listContains(attackingPieces, end)) {
          selectedPiece = end;
          return;
        }
        selectedPiece = null;
        return;
      }
    } else {
      const moves = getAllPossibleMoves(start);
      if (moves.map((el) => el.toString()).includes(end.pos.toString())) {
        const state = start.piece!.isKing;
        swap(start, end);
        if (state !== end.piece!.isKing) {
          if (canCapture(end)) {
            selectedPiece = end;
            attackingPieces = [end];
            return;
          }
        }
        selectedPiece = null;
        isWhitesTurn = !isWhitesTurn;
        return;
      } else {
        if (listContains(playablePieces, end)) {
          selectedPiece = end;
          return;
        }
        selectedPiece = null;
      }
    }
  }

  function isValidMove(start: ITile, end: ITile): boolean {
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

  function isValidCapture(start: ITile, end: ITile): boolean {
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

  function getAllPossibleMoves(piece: ITile, onlyCaptures = false): number[][] {
    const [row, col] = piece.pos;
    const moves = [] as number[][];
    const diagonals = [] as ITile[];

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
        moves.push(move.pos);
    }

    return moves;
  }

  function swap(start: ITile, end: ITile) {
    end.piece = start.piece;
    start.piece = null;
    const row = end.pos[0];
    if ((row === 0 && !end.piece!.isBlack) || (row === 7 && end.piece!.isBlack))
      end.piece!.isKing = true;
    tiles = tiles;
  }

  function getCapturedTiles(start: ITile, end: ITile): ITile[] {
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

  function getPlayableTiles() {
    attackingPieces = [];
    playablePieces = [];
    for (const row of tiles) {
      for (const el of row) {
        if (el.piece && el.piece.isBlack === !isWhitesTurn && canCapture(el))
          attackingPieces = [...attackingPieces, el];
        else if (
          el.piece &&
          el.piece.isBlack === !isWhitesTurn &&
          getAllPossibleMoves(el).length > 0
        )
          playablePieces = [...playablePieces, el];
      }
    }
    if (playablePieces.length === 0) {
      getWinner();
    }
  }

  function highlightTiles() {
    if (!selectedPiece) {
      highlightedList = [];
      if (attackingPieces.length > 0) {
        highlightedList = [...attackingPieces.map((el) => el.pos)];
      } else {
        highlightedList = [...playablePieces.map((el) => el.pos)];
      }
    } else {
      if (canCapture(selectedPiece))
        highlightedList = [
          selectedPiece.pos,
          ...getAllPossibleMoves(selectedPiece, true)
        ];
      else
        highlightedList = [
          selectedPiece.pos,
          ...getAllPossibleMoves(selectedPiece)
        ];
    }
  }

  function canCapture(piece: ITile): boolean {
    return getAllPossibleMoves(piece, true).length > 0;
  }

  function listContains(list: ITile[], tile: ITile): boolean {
    return list.some((el) => el.pos.toString() == tile.pos.toString());
  }

  function getWinner() {
    const winner = isWhitesTurn ? 'Second Player' : 'First Player';
    // to be continued
  }

  initGame();
  connectSocket();
</script>

<div class="tiles">
  {#each tiles.flat() as tile (tile.pos.toString())}
    <button
      class="tile"
      class:gray={isGray(tile)}
      class:highlight={isHighlighted(tile)}
      on:click={() => handleClick(tile)}
    >
      {#if tile.piece}
        <div class="piece" class:black={tile.piece.isBlack}>
          <span class:hidden={!tile.piece.isKing}>&#128081;</span>
        </div>
      {/if}
    </button>
  {/each}
</div>

<style>
  .tiles {
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
</style>
