interface ITile {
  pos: number[];
  piece: { isBlack: boolean; isKing: boolean } | null;
}

const initialFEN =
  '1b1b1b1b/b1b1b1b1/1b1b1b1b/8/8/w1w1w1w1/1w1w1w1w/w1w1w1w1 w 1';
const blankFEN = '8/8/8/8/8/8/8/8 w 1';

function readFEN(notation: string) {
  let tiles: ITile[][] = Array.from(Array(8), () => Array<ITile>(8));
  let i = 0,
    j = 0;
  const [board, side, turnStr]: string[] = notation.split(' ');
  for (const char of board) {
    if (char.match(/[bw]/i)) {
      const piece: ITile = {
        pos: [i, j],
        piece: {
          isBlack: char.toLowerCase() === 'b',
          isKing: char === char.toUpperCase()
        }
      };
      tiles[i][j] = piece;
      j++;
    } else if (char.match(/[1-8]/)) {
      for (let k = 0; k < parseInt(char, 10); k++) {
        const tile: ITile = {
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

function writeFEN(obj: {
  tiles: ITile[][];
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
        let letter = piece.isBlack ? 'b' : 'w';
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

export { readFEN, writeFEN, initialFEN, blankFEN};
