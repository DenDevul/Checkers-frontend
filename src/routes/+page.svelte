<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import socket from '../socket';
  import { initialFen } from '../utility/fen';

  let clicked = false;
  let url = '';
  $: fullUrl = $page.url.href + url;

  function copy() {
    navigator.clipboard.writeText(fullUrl);
  }

  async function handle() {
    if (!browser) return;
    const response = await fetch(import.meta.env.VITE_API_URL);
    url = await response.text();
    clicked = true;

    const newGame = { fen: initialFen, side: 'white', gameUrl: url };
    if (!socket.connected) socket.connect();

    socket.emit('init game', newGame);

    socket.on('connect_error', (err) => {
      console.log('connection error!');
      console.log(err);
    });
    socket.once('player connect', () => {
      goto('/' + url);
    });
  }
</script>

<div class="window">
  <h1>CHECKERS</h1>
  <label for="link">send this link to your friend!</label>
  <input type="text" id="link" readonly bind:value={url} on:click={copy} />
  <button class:invisible={clicked} on:click|once={handle}>Play!</button>
  <button class:invisible={!clicked} disabled
    >Waiting for other player to join...</button
  >
</div>

<style>
  .window {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    border-radius: 1rem;
    background-color: aliceblue;
    padding: 1rem;
    user-select: none;
  }
  .window button {
    padding: 8px;
  }

  #link {
    /* pointer-events: none; */
    cursor: pointer;
  }

  .invisible {
    display: none;
  }
</style>
