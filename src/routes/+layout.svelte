<svelte:head>
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
  <meta name="description" content="Играть в шашки онлайн!" />

  <meta property="og:url" content="https://densup.site" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Checkers" />
  <meta property="og:description" content="Играть в шашки онлайн!" />
  <meta property="og:image" content="https://densup.site/cat.jpg" />

  <title>Checkers</title>
</svelte:head>

<div class="main">
  <header>
    <img src="svg/icon.svg" alt="icon" class="icon" />
    <a href="/" class="home">
      <h1>CHECKERS</h1>
    </a>
  </header>
  <slot />
</div>

<style>
  @import '../main.css';
  .main {
    width: 100vw;
    height: 100vh;
    display: grid;
    grid-template:
      'header' min-content
      'content' auto
      / 100%;
    justify-items: center;
    align-items: center;
  }
  header {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
    height: 3rem;
  }
  header .home {
    color: #2b2b2b;
    text-decoration: none;
  }
  header .icon {
    width: 2rem;
    height: 2rem;
    -webkit-user-drag: none;
  }
</style>
