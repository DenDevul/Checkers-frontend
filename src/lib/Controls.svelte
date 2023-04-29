<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isWhiteTurn: boolean;
  export let isWhiteSide: boolean;
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
  <div class="turn" class:turn-black={!(isWhiteTurn ?? true)}>
    {#if isWhiteSide === isWhiteTurn}
      <h2>Ваш ход</h2>
    {:else}
      <h2>Ход соперника</h2>
    {/if}
  </div>
  <div class="flex-col">
    <button class="btn giveup" on:click={giveUp}
      >Cдаться <img src="svg/flag.svg" alt="" /></button
    >
    <button
      class="btn"
      on:click={offerDraw}
      class:disabled={(btnDrawFlag || isDrawOffered) && !isGameOver}
      >{#if (btnDrawFlag || isDrawOffered) && !isGameOver}
        Ждем ответа...
      {:else}
        Предложить ничью <img src="svg/handshake.svg" alt="" />
      {/if}
    </button>
  </div>
  {#if isDrawOffered && !isGameOver}
    <div class="draw">
      <p>Соперник предлагает ничью</p>
      <div class="flex">
        <button class="btn" on:click={accept}
          ><img src="svg/check.svg" alt="" /></button
        >
        <button class="btn no" on:click={decline}
          ><img src="svg/close.svg" alt="" /></button
        >
      </div>
    </div>
  {/if}
</div>

<style>
  .controls {
    grid-area: controls;
    padding-left: 32px;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  .controls img {
    width: 1rem;
    height: 1rem;
  }

  .turn {
    border-radius: 8px;
    padding: 2px;
    text-align: center;
    background-color: white;
    color: black;
  }
  .turn.turn-black {
    background-color: black;
    color: white;
  }

  .flex-col {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .btn {
    border: none;
    background-color: hsl(69, 69%, 55%);
    border-radius: 8px;
    padding: 8px;
    font-size: 1.2rem;
    box-shadow: 0px 0px 8px 1px rgb(0 0 0 / 0.1);
  }
  .btn:hover {
    background-color: hsl(69, 69%, 48%);
  }
  .btn:active {
    background-color: hsl(69, 69%, 41%);
  }
  .btn.giveup {
    background-color: hsl(0, 0%, 100%);
  }
  .btn.giveup:hover {
    background-color: hsl(0, 0%, 96%);
  }
  .btn.giveup:active {
    background-color: hsl(0, 0%, 92%);
  }
  .btn.no {
    background-color: hsl(9, 69%, 55%);
  }
  .btn.no:hover {
    background-color: hsl(9, 69%, 48%);
  }
  .btn.no:active {
    background-color: hsl(9, 69%, 41%);
  }
  .btn.disabled {
    background-color: hsl(69, 69%, 41%);
    box-shadow: inset 0px 0px 8px 1px rgb(0 0 0 / 0.12);
    color: rgb(0 0 0 / 0.6);
    font-style: italic;
  }

  .draw {
    background-color: #fff;
    border-radius: 8px;
    padding: 8px;
    font-weight: bold;
    font-size: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .draw .flex {
    display: flex;
    justify-content: space-evenly;
  }
  .draw button {
    width: 5rem;
  }
</style>
