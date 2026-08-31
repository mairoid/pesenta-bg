/* Обратна връзка от страница-подарък
   ---------------------------------------------------------------------
   Клиентът пише в полето и натиска копчето — писмото тръгва оттук, без той
   да отваря пощата си и без да съчинява съобщение.

   Формата има action и method в HTML-а нарочно: ако този скрипт не се
   зареди, изпращането пак работи по нативния път на FormSubmit. Тук само
   го прихващаме, за да остане човекът на страницата — иначе го изхвърля
   на чужд екран, което върху подарък изглежда като счупено.

   Ендпойнтът е ajax/, а не нативният: тази форма няма прикачени файлове,
   а AJAX вариантът връща JSON вместо пренасочване. Същият адрес е — вж.
   бележката в order.js. */
(function () {
  var forma = document.getElementById("otzyv-forma");
  if (!forma) return;

  var btn = forma.querySelector(".otzyv-btn");
  var greshka = document.getElementById("otzyv-greshka");
  var gotovo = document.getElementById("otzyv-gotovo");
  var nadpis = btn ? btn.textContent : "Изпрати";

  forma.addEventListener("submit", function (e) {
    /* Полето е required, тоест браузърът вече е спрял празното изпращане.
       Ако все пак стигне дотук празно — не хабим заявка. */
    var tekst = forma.querySelector("#otzyv-tekst");
    if (!tekst || !tekst.value.trim()) return;

    e.preventDefault();
    if (greshka) { greshka.hidden = true; greshka.textContent = ""; }
    if (btn) { btn.disabled = true; btn.textContent = "Изпращане…"; }

    fetch("https://formsubmit.co/ajax/" + forma.action.split("/").pop(), {
      method: "POST",
      headers: { "Accept": "application/json" },
      body: new FormData(forma)
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function () {
        forma.hidden = true;
        if (gotovo) gotovo.hidden = false;
      })
      .catch(function () {
        /* Не губим написаното: формата остава на екрана с текста вътре,
           за да не се налага човекът да пише всичко наново. */
        if (btn) { btn.disabled = false; btn.textContent = nadpis; }
        if (greshka) {
          greshka.textContent = "Нещо се обърка. Опитайте пак след минута — написаното е запазено.";
          greshka.hidden = false;
        }
      });
  });
})();
