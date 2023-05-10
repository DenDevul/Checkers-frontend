<svelte:head>
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
  <title>Checkers</title>
</svelte:head>

<header>
  <img src="svg/icon.svg" alt="icon" class="icon" />
  <a href="/" class="home">
    <h1>CHECKERS</h1>
  </a>
</header>
<div class="wrapper">
  <slot />
</div>

<style>
  @import '../main.css';
  header {
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
  }
  header .home {
    color: #2b2b2b;
    text-decoration: none;
  }
  header .icon {
    width: 32px;
    height: 32px;
    -webkit-user-drag: none;
  }
  .wrapper {
    width: 100vw;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
