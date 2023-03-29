<script lang="ts">
  import { onMount } from 'svelte';

  interface ITile {
    pos: number[];
    piece: { isBlack: boolean; isKing: boolean } | null;
  }

  let tiles = Array.from(Array(8), () => Array<ITile>(8));

  let isGray = (tilePos: number[]) => {
    const [r, c] = tilePos;
    return (r + c) % 2 == 1;
  };

  let isHighlighted = (tilePos: number[]) => {
    const [r, c] = tilePos;
    return false
  };

  const initTiles = () => {
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
  };
  initTiles();

  // onMount(() => {
  // });
</script>

<div class="tiles">
  {#each tiles.flat() as tile (tile.pos.toString())}
    <div
      class="tile"
      class:gray={isGray(tile.pos)}
      class:highlight={isHighlighted(tile.pos)}
    >
      {#if tile.piece}
        <div class="piece" class:black={tile.piece.isBlack}>
          <span class:hidden={!tile.piece.isKing}>&#128081;</span>
        </div>
      {/if}
    </div>
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
  .piece.black {
    background-color: black;
    color: yellow;
  }
  .hidden {
    visibility: hidden;
  }
</style>
