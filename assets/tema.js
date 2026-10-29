/* opsforma · dugme za tamnu temu. Temu pre prikaza postavlja kratka skripta u <head>;
   ovde se samo menja na klik, pamti izbor i prati uređaj dok posetilac sam ne izabere. */
(function () {
  var html = document.documentElement, KLJUC = 'opsforma-tema';
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function sacuvana() { try { return localStorage.getItem(KLJUC); } catch (e) { return null; } }
  function postavi(tema) {
    html.setAttribute('data-tema', tema);
    var dugmad = document.querySelectorAll('[data-tema-dugme]');
    for (var i = 0; i < dugmad.length; i++) dugmad[i].setAttribute('aria-pressed', String(tema === 'tamna'));
    var boja = document.querySelector('meta[name="theme-color"]');
    if (boja) boja.setAttribute('content', tema === 'tamna' ? '#111316' : '#14161A');
  }
  postavi(html.getAttribute('data-tema') || (mq && mq.matches ? 'tamna' : 'svetla'));
  document.addEventListener('click', function (e) {
    var dugme = e.target.closest ? e.target.closest('[data-tema-dugme]') : null;
    if (!dugme) return;
    var tema = html.getAttribute('data-tema') === 'tamna' ? 'svetla' : 'tamna';
    postavi(tema);
    try { localStorage.setItem(KLJUC, tema); } catch (er) {}
  });
  if (mq) {
    var promena = function () { if (!sacuvana()) postavi(mq.matches ? 'tamna' : 'svetla'); };
    if (mq.addEventListener) mq.addEventListener('change', promena); else if (mq.addListener) mq.addListener(promena);
  }
})();
