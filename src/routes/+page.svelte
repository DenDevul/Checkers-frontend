<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import socket from '../socket';
  import { initialFen } from '../utility/fen';

  let clicked = false;
  let checked = false;
  let url = '';
  let dialogHidden = true;
  $: fullUrl = $page.url.href + url;
  $: checked, (clicked = false);

  function copy() {
    navigator.clipboard.writeText(fullUrl);
    if (dialogHidden) {
      dialogHidden = false;
      setTimeout(() => {
        dialogHidden = true;
      }, 1200);
    }
  }

  async function handle() {
    if (!browser) return;
    const response = await fetch(import.meta.env.VITE_API_URL);
    url = await response.text();
    clicked = true;

    const newGame = {
      fen: initialFen,
      side: !checked ? 'white' : 'black',
      gameUrl: url
    };

    if (!socket.connected) socket.connect();
    else socket.removeAllListeners();

    socket.on('connect_error', (err) => {
      console.log('connection error!');
      console.log(err);
    });

    socket.once('player connect', () => {
      goto('/' + url);
    });

    socket.emit('init game', newGame);
  }
</script>

<div class="window">
  <h1>Начать игру</h1>
  <div class="side">
    <span class:hide={checked}>Белые</span>
    <input type="checkbox" id="switch" class="checkbox" bind:checked />
    <label for="switch" class="toggle" />
    <span class:hide={!checked}>Черные</span>
  </div>
  {#if !clicked}
    <button class="btn" on:click={handle}>Начать</button>
  {:else}
    <div class="link">
      <label for="link">Отправь эту ссылку другу:</label>
      <div class="link-button">
        <button id="link" on:click={copy}>{fullUrl}</button>
        <div class="dialog" class:hidden={dialogHidden}>
          <p>копировано</p>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .window {
    font-size: 1.5rem;
    height: 15em;
    width: 15em;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1rem;
    gap: 2rem;
    border-radius: 10px;
    background-color: #bbeafe;
    user-select: none;
  }
  .window > *:last-child {
    margin-top: auto;
    margin-bottom: 2rem;
  }

  .side {
    font-weight: bold;
    display: flex;
    align-items: center;
  }
  .side .hide {
    opacity: 0;
  }
  .side > span {
    transition: opacity ease-in 0.25s;
  }
  .side > span:first-child {
    margin-right: 1rem;
  }
  .side > span:last-child {
    margin-left: 1rem;
  }

  .toggle {
    position: relative;
    display: flex;
    align-items: center;
    width: 2em;
    height: 1em;
    background-color: black;
    border-radius: 1em;
    cursor: pointer;
    transition: background-color ease-in-out 0.25s;
  }
  .toggle:after {
    content: '';
    position: absolute;
    width: 0.9em;
    height: 0.9em;
    border-radius: 50%;
    background-color: white;
    left: 0.1em;
    transition: background-color ease-in-out 0.25s, transform ease-in-out 0.25s;
  }
  .checkbox:checked + .toggle::after {
    transform: translateX(100%);
    background-color: black;
  }
  .checkbox:checked + .toggle {
    background-color: white;
  }
  .checkbox:focus-visible + .toggle {
    outline: 2px solid blue;
  }
  .checkbox {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .btn {
    font-size: 1em;
    padding: 8px;
    width: 65%;
    border: 2px solid white;
    border-radius: 6px;
    font-weight: bold;
    color: black;
    background-color: white;
    cursor: pointer;
    box-shadow: 0 0 5px 0 rgba(0, 0, 0, 0.1);
    transition: background-color ease-in 50ms;
  }
  .btn:hover {
    background-color: hsl(0, 0%, 98%);
  }
  .btn:active {
    background-color: #bbeafe;
    box-shadow: none;
  }

  .link {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .link > label {
    font-size: smaller;
  }
  .link-button {
    position: relative;
    display: flex;
    align-items: center;
  }
  .dialog {
    position: absolute;
    display: flex;
    align-items: center;
    left: calc(100% + 0.5rem);
    font-size: 1rem;
    border: none;
    border-radius: 8px;
    padding: 4px;
    background-color: hsl(0, 0%, 20%);
    color: white;
    z-index: 10;
    transition: opacity ease-in 0.2s;
  }
  .dialog.hidden {
    opacity: 0;
  }
  .dialog::before {
    content: '';
    position: absolute;
    background-color: red;
    background-color: hsl(0, 0%, 20%);
    z-index: -1;
    width: 10px;
    height: 10px;
    left: -3px;
    transform: rotate(45deg);
  }
  #link {
    width: 100%;
    background-color: white;
    /* border: 4px solid black; */
    cursor: pointer;
    border: none;
    padding: 8px;
    border-radius: 1rem;
    transition: transform ease-in 50ms;
  }
  #link:active {
    transform: scale(0.97);
  }
</style>
