/* VIBER: upišite broj u međunarodnom obliku, npr. '+381641234567'.
   Dok je prazno, Viber dugmad na sajtu su skrivena (atribut data-viber),
   a umesto njih se vide zamenska dugmad (atribut data-bez-vibera). */
window.OPSFORMA_VIBER = '';

(function () {
  var broj = window.OPSFORMA_VIBER;
  if (!broj) return;
  var href = 'viber://chat?number=' + encodeURIComponent(broj);
  document.querySelectorAll('[data-viber]').forEach(function (a) { a.href = href; a.hidden = false; });
  document.querySelectorAll('[data-bez-vibera]').forEach(function (a) { a.hidden = true; });
})();
