window.api.getCfg().then((c) => {
  if (!c.hasToken) document.querySelector('#gear').click();
});
window.api.start();
