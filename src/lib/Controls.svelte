<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isGameOver: boolean;
  export let isDrawOffered: boolean;

  let btnDrawFlag: boolean = false;

  const dispatch = createEventDispatcher();

  function giveUp() {
    if (!isGameOver) dispatch('giveUp');
  }

  function offerDraw() {
    if (!btnDrawFlag && !(isGameOver || isDrawOffered)) {
      btnDrawFlag = true;

      dispatch('offerDraw');

      setTimeout(() => {
        btnDrawFlag = false;
      }, 5000);
    }
  }

  function accept() {
    dispatch('respond', { response: 'yes' });
  }

  function decline() {
    dispatch('respond');
  }
</script>

<div class="controls">
  <div class="buttons">
    <button class="btn" on:click={giveUp}
      >Cдаться <img src="svg/flag.svg" alt="" /></button
    >
    <button
      class="btn btn-green"
      on:click={offerDraw}
      class:btn-disabled={(btnDrawFlag || isDrawOffered) && !isGameOver}
      >{#if (btnDrawFlag || isDrawOffered) && !isGameOver}
        Ждем...
      {:else}
        Ничья <img src="svg/handshake.svg" alt="" />
      {/if}
    </button>
  </div>
  {#if isDrawOffered && !isGameOver}
    <div class="window">
      <p>Соперник предлагает ничью</p>
      <div class="window-buttons">
        <button class="btn btn-green" on:click={accept}
          ><img src="svg/check.svg" alt="check" /></button
        >
        <button class="btn btn-red" on:click={decline}
          ><img src="svg/close.svg" alt="close" /></button
        >
      </div>
    </div>
  {/if}
</div>

<style>
  .controls {
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 1rem;
    grid-area: controls;
  }

  .buttons {
    display: flex;
    justify-content: space-between;
    gap: 2rem;
  }

  .btn {
    font-size: 1em;
    border: none;
    background-color: hsl(0, 0%, 100%);
    border-radius: 8px;
    padding: 8px;
    width: fit-content;
    box-shadow: 0px 0px 5px 1px rgb(0 0 0 / 0.1);
  }
  .btn:hover {
    background-color: hsl(0, 0%, 96%);
  }
  .btn:active {
    background-color: hsl(0, 0%, 92%);
  }
  .btn img {
    width: 1em;
    height: 1em;
  }
  .btn-green {
    background-color: hsl(69, 69%, 55%);
  }
  .btn-green:hover {
    background-color: hsl(69, 69%, 48%);
  }
  .btn-green:active {
    background-color: hsl(69, 69%, 41%);
  }
  .btn-red {
    background-color: hsl(9, 69%, 55%);
  }
  .btn-red:hover {
    background-color: hsl(9, 69%, 48%);
  }
  .btn-red:active {
    background-color: hsl(9, 69%, 41%);
  }
  .btn.btn-disabled {
    background-color: hsl(69, 69%, 41%);
    color: rgb(0 0 0 / 0.6);
    font-style: italic;
  }

  .window {
    background-color: #fff;
    border-radius: 8px;
    padding: 8px;
    font-weight: bold;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }
  .window-buttons {
    display: flex;
    justify-content: space-evenly;
  }
  .window button {
    width: 4rem;
  }

  @media screen and (min-width: 768px) {
    .controls {
      width: min(24vw, 15.5rem);
      align-items: start;
    }
    .buttons {
      flex-direction: column;
      gap: 0.75rem;
    }
  }
</style>
