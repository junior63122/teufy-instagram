// Page introuvable dans la langue de l'adresse visitée (/en/…, /ar/…) : 23/11/2026, testeur navigation (toujours en français).
(() => {
  const l = (location.pathname.match(/\/(en|it|es|zh|ar)\//) || [])[1];
  if (!l) return;
  document.querySelectorAll('.l404').forEach((d) => { d.hidden = d.lang !== l; });
  document.documentElement.lang = l; if (l === 'ar') document.documentElement.dir = 'rtl';
})();
