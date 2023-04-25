/*
  FEN - notation for describing board position of a game:
    https://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation
*/

interface Tile {
  pos: number[];
  piece: { isWhite: boolean; isKing: boolean } | null;
}

const initialFen =
  '1b1b1b1b/b1b1b1b1/1b1b1b1b/8/8/w1w1w1w1/1w1w1w1w/w1w1w1w1 w 1';

function readFen(notation: string) {
  let tiles: Tile[][] = Array.from(Array(8), () => Array<Tile>(8));
  let i = 0,
    j = 0;
  const [board, side, turnStr]: string[] = notation.split(' ');
  for (const char of board) {
    if (char.match(/[bw]/i)) {
      const piece: Tile = {
        pos: [i, j],
        piece: {
          isWhite: char.toLowerCase() === 'w',
          isKing: char === char.toUpperCase()
        }
      };
      tiles[i][j] = piece;
      j++;
    } else if (char.match(/[1-8]/)) {
      for (let k = 0; k < parseInt(char, 10); k++) {
        const tile: Tile = {
          pos: [i, j],
          piece: null
        };
        tiles[i][j] = tile;
        j++;
      }
    } else {
      i++;
      j = 0;
    }
  }
  const isWhiteTurn = side == 'w';
  const turn = parseInt(turnStr, 10);
  return { tiles, isWhiteTurn, turn };
}

function writeFen(obj: {
  tiles: Tile[][];
  isWhiteTurn: boolean;
  turn: number;
}): string {
  const { tiles, isWhiteTurn, turn } = obj;
  let notation = '';
  let skip = 0;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = 0; j < tiles.length; j++) {
      const piece = tiles[i][j].piece;
      if (piece) {
        if (skip > 0) {
          notation += skip.toString();
          skip = 0;
        }
        let letter = piece.isWhite ? 'w' : 'b';
        letter = piece.isKing ? letter.toUpperCase() : letter;
        notation += letter;
      } else {
        skip++;
      }
    }
    if (skip > 0) {
      notation += skip.toString();
      skip = 0;
    }
    if (i < 7) notation += '/';
  }
  isWhiteTurn ? (notation += ' w ') : (notation += ' b ');
  notation += turn.toString();
  return notation;
}

export { readFen, writeFen, initialFen };
