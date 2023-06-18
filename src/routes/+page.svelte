<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import socket from '../socket';
  import { initialFen } from '../utility/fen';

  let clicked = false;
  let checked = false;
  let fetched = false;
  let url = '';
  $: fullUrl = $page.url.href + url;
  $: checked, (clicked = fetched = false);

  async function handle() {
    if (clicked) return;
    clicked = true;

    try {
      const response = await fetch(import.meta.env.VITE_API_URL);
      url = await response.text();
      fetched = true;
    } catch (error) {
      alert('Произошла ошибка, попробуйте позже');
      return;
    }

    if (!socket.connected) socket.connect();
    else socket.removeAllListeners();

    socket.on('connect_error', (err) => {
      alert('Ошибка при подключении к игре');
    });

    socket.once('player connect', () => {
      goto('/' + url);
    });

    const newGame = {
      fen: initialFen,
      side: !checked ? 'white' : 'black',
      gameUrl: url
    };
    socket.emit('init game', newGame);
  }
</script>

<div class="window">
  <h2>Начать игру</h2>
  <div class="side">
    <span class:hide={checked}>Белые</span>
    <input type="checkbox" id="switch" class="checkbox" bind:checked />
    <label for="switch" class="toggle" />
    <span class:hide={!checked}>Черные</span>
  </div>
  <div class="link flex">
    <button class="btn" class:clicked class:hide={fetched} on:click={handle}
      >Начать</button
    >
    <div class="flex" class:hide={!fetched}>
      <p>Отправь ссылку другу</p>
      <span class="url">{fullUrl}</span>
    </div>
  </div>
</div>

<style>
  .window {
    width: min(18em, 90%);
    border-radius: 10px;
    background-color: #9fdef9;
    padding: 1rem;
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 1.5em;
  }

  .hide {
    opacity: 0;
  }
  .side {
    font-weight: bold;
    display: flex;
    align-items: center;
  }
  .side > span {
    transition: opacity ease-in 0.25s;
  }
  .side > span:first-child {
    margin-right: 0.5rem;
  }
  .side > span:last-child {
    margin-left: 0.5rem;
  }

  .toggle {
    position: relative;
    display: flex;
    align-items: center;
    font-size: 1.25em;
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
    outline: 2px solid red;
  }
  .checkbox {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .btn {
    font-size: 1em;
    padding: 8px;
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
    background-color: #9fdef9;
    box-shadow: none;
  }
  .btn.clicked {
    color: hsl(0, 0%, 40%);
    cursor: not-allowed;
    background-color: #9fdef9;
    box-shadow: none;
  }

  .link {
    height: 4em;
    justify-content: center;
  }
  .flex {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .flex .hide {
    display: none;
  }

  .url {
    background-color: #fff;
    border-radius: 8px;
    padding: 4px;
    user-select: all;
  }

  @media screen and (min-width: 481px) {
    .window {
      font-size: 1.25em;
    }
  }
</style>
