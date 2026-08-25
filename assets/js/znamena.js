/* Знамена 26 на 18 — същата кутия като българското, само съдържанието вътре
   се сменя. Всяко е няколко правоъгълника, изрязани с ЕДИН общ clipPath:
   така заоблените ъгли не се чертаят на ръка за всяко знаме поотделно.

   Изрязването и градиентът за глобуса се слагат ВЕДНЪЖ за страницата, не
   вътре в знака: картите се клонират за безкрайната лента, тоест id вътре в
   тях щеше да се повтори четиринайсет пъти. */
(function () {
  "use strict";

  var KLIP = "zn-clip", GRAD = "zn-svyat";

  var pole = function (c) {
    return '<rect x=".5" y=".5" width="25" height="17" fill="' + c + '"/>';
  };
  /* Водоравни и отвесни трети: 17/3 = 5.667 и 25/3 = 8.333 */
  var red = function (c, i) {
    return '<rect x=".5" y="' + (0.5 + i * 5.667).toFixed(3) +
           '" width="25" height="5.667" fill="' + c + '"/>';
  };
  var kolona = function (c, i) {
    return '<rect x="' + (0.5 + i * 8.333).toFixed(3) +
           '" y=".5" width="8.333" height="17" fill="' + c + '"/>';
  };
  var tri_h = function (a, b, c) { return red(a, 0) + red(b, 1) + red(c, 2); };
  var tri_v = function (a, b, c) { return kolona(a, 0) + kolona(b, 1) + kolona(c, 2); };
  var polovin = function (gore, dolu) {
    return '<rect x=".5" y=".5" width="25" height="8.5" fill="' + gore + '"/>' +
           '<rect x=".5" y="9" width="25" height="8.5" fill="' + dolu + '"/>';
  };
  /* Скандинавски кръст: рамото е изместено към пилона, както е в оригиналите. */
  var krast = function (fon, cvyat, vatre) {
    return pole(fon) +
      '<rect x=".5" y="7" width="25" height="4" fill="' + cvyat + '"/>' +
      '<rect x="8" y=".5" width="4" height="17" fill="' + cvyat + '"/>' +
      (vatre ? '<rect x=".5" y="8" width="25" height="2" fill="' + vatre + '"/>' +
               '<rect x="9" y=".5" width="2" height="17" fill="' + vatre + '"/>' : "");
  };
  var ivici = function (broy, stapka, cvyat) {
    var s = "", i;
    for (i = 0; i < broy; i += 2) {
      s += '<rect x=".5" y="' + (0.5 + i * stapka).toFixed(2) +
           '" width="25" height="' + stapka + '" fill="' + cvyat + '"/>';
    }
    return s;
  };

  var Z = {
    BG: ["България", tri_h("#fff", "#00966E", "#D62612")],

    US: ["САЩ", pole("#fff") + ivici(8, 2.43, "#B22234") +
         '<rect x=".5" y=".5" width="11" height="9.7" fill="#3C3B6E"/>'],

    GB: ["Обединено кралство", pole("#012169") +
         '<path d="M.5.5 25.5 17.5M25.5.5 .5 17.5" stroke="#fff" stroke-width="3.4"/>' +
         '<path d="M.5.5 25.5 17.5M25.5.5 .5 17.5" stroke="#C8102E" stroke-width="1.8"/>' +
         '<path d="M13 .5v17M.5 9h25" stroke="#fff" stroke-width="5.4"/>' +
         '<path d="M13 .5v17M.5 9h25" stroke="#C8102E" stroke-width="3.2"/>'],

    IT: ["Италия", tri_v("#008C45", "#fff", "#CD212A")],
    FR: ["Франция", tri_v("#002395", "#fff", "#ED2939")],
    DE: ["Германия", tri_h("#000", "#DD0000", "#FFCE00")],

    ES: ["Испания", pole("#AA151B") +
         '<rect x=".5" y="4.75" width="25" height="8.5" fill="#F1BF00"/>'],

    SE: ["Швеция", krast("#006AA7", "#FECC00")],
    DK: ["Дания", krast("#C8102E", "#fff")],
    NO: ["Норвегия", krast("#BA0C2F", "#fff", "#00205B")],
    FI: ["Финландия", krast("#fff", "#003580")],

    CA: ["Канада", pole("#fff") +
         '<rect x=".5" y=".5" width="6.5" height="17" fill="#D80621"/>' +
         '<rect x="19" y=".5" width="6.5" height="17" fill="#D80621"/>' +
         '<path d="M13 4.5l1.4 3 2.4-.7-1.1 3 1.4.5-3 2.2.5 1.6-2.6-.5-.5 3h-.2l-.5-3-2.6.5.5-1.6-3-2.2 1.4-.5-1.1-3 2.4.7z" fill="#D80621"/>'],

    AU: ["Австралия", pole("#00247D") +
         '<rect x=".5" y=".5" width="12" height="8.5" fill="#012169"/>' +
         '<path d="M.5.5 12.5 9M12.5.5 .5 9" stroke="#fff" stroke-width="1.6"/>' +
         '<path d="M6.5.5v8.5M.5 4.75h12" stroke="#fff" stroke-width="2.6"/>' +
         '<path d="M6.5.5v8.5M.5 4.75h12" stroke="#C8102E" stroke-width="1.4"/>' +
         '<circle cx="19" cy="12" r="1.7" fill="#fff"/>' +
         '<circle cx="6" cy="14" r="1.4" fill="#fff"/>'],

    NL: ["Нидерландия", tri_h("#AE1C28", "#fff", "#21468B")],

    GR: ["Гърция", pole("#fff") + ivici(10, 1.89, "#0D5EAF") +
         '<rect x=".5" y=".5" width="9.45" height="9.45" fill="#0D5EAF"/>' +
         '<path d="M4.2 .5v9.45M.5 5.2h9.45" stroke="#fff" stroke-width="1.9"/>'],

    TR: ["Турция", pole("#E30A17") +
         '<circle cx="10" cy="9" r="4.2" fill="#fff"/>' +
         '<circle cx="11.4" cy="9" r="3.4" fill="#E30A17"/>' +
         '<path d="M15.4 9l3.6-1.2-2.2 3v-3.6l2.2 3z" fill="#fff"/>'],

    RU: ["Русия", tri_h("#fff", "#0039A6", "#D52B1E")],
    RS: ["Сърбия", tri_h("#C6363C", "#0C4076", "#fff")],
    RO: ["Румъния", tri_v("#002B7F", "#FCD116", "#CE1126")],

    BR: ["Бразилия", pole("#009B3A") +
         '<path d="M13 2.2 24 9l-11 6.8L2 9z" fill="#FEDF00"/>' +
         '<circle cx="13" cy="9" r="3.4" fill="#002776"/>'],

    MX: ["Мексико", tri_v("#006847", "#fff", "#CE1126")],
    JP: ["Япония", pole("#fff") + '<circle cx="13" cy="9" r="5.1" fill="#BC002D"/>'],
    IE: ["Ирландия", tri_v("#169B62", "#fff", "#FF883E")],
    AT: ["Австрия", tri_h("#ED2939", "#fff", "#ED2939")],

    CH: ["Швейцария", pole("#D52B1E") +
         '<rect x="11.4" y="4" width="3.2" height="10" fill="#fff"/>' +
         '<rect x="8" y="7.4" width="10" height="3.2" fill="#fff"/>'],

    PL: ["Полша", polovin("#fff", "#DC143C")],
    UA: ["Украйна", polovin("#0057B7", "#FFDD00")],

    PT: ["Португалия", pole("#FF0000") +
         '<rect x=".5" y=".5" width="10" height="17" fill="#006600"/>' +
         '<circle cx="10.5" cy="9" r="3.1" fill="#FFFF00" stroke="#FF0000" stroke-width=".8"/>'],

    /* Двете, които липсваха в набора, и затова са дорисувани тук. */

    /* Триъгълникът е равностранен със страна колкото височината на знамето,
       затова върхът му пада на 17 по корен от 3 върху 2, тоест на 14.7 от
       пилона. Слънцето и трите звезди са точки: на 26 пиксела осемте лъча на
       слънцето стават петно. */
    PH: ["Филипини", polovin("#0038A8", "#CE1126") +
         '<path d="M.5.5 15.2 9 .5 17.5z" fill="#fff"/>' +
         '<circle cx="5.4" cy="9" r="1.5" fill="#FCD116"/>' +
         '<circle cx="2.6" cy="2.9" r=".7" fill="#FCD116"/>' +
         '<circle cx="2.6" cy="15.1" r=".7" fill="#FCD116"/>' +
         '<circle cx="12.4" cy="9" r=".7" fill="#FCD116"/>'],

    /* Звездата на Давид е два наложени триъгълника САМО с контур — запълнени
       се сливат в шестоъгълно петно при този размер. */
    IL: ["Израел", pole("#fff") +
         '<rect x=".5" y="2.6" width="25" height="2.2" fill="#0038B8"/>' +
         '<rect x=".5" y="13.2" width="25" height="2.2" fill="#0038B8"/>' +
         '<path d="M13 5.4 9.88 10.8h6.24zM13 12.6 9.88 7.2h6.24z" fill="none"' +
           ' stroke="#0038B8" stroke-width=".9"/>']
  };

  /* Глобусът: „знаме на никоя държава“ в нашия градиент. Остава за всеки, на
     когото не знаем държавата — така липсата на данни изглежда като липса на
     данни, а не като чужда държава. */
  var SVYAT = '<rect x=".5" y=".5" width="25" height="17" fill="url(#' + GRAD + ')"/>' +
    '<g stroke="#fff" stroke-opacity=".9" stroke-width=".9" fill="none">' +
      '<path d="M1.1 9h23.8M2 4.4h22M2 13.6h22" stroke-linecap="round"/>' +
      '<ellipse cx="13" cy="9" rx="5.4" ry="8"/>' +
    "</g>";

  window.znameIme = function (kod) { return (Z[kod] && Z[kod][0]) || "световна"; };
  window.imaZname = function (kod) { return !!Z[kod]; };
  window.znameBroy = function () { return Object.keys(Z).length; };

  /* Знакът е aria-hidden нарочно: картата е <a> със свой aria-label, а той
     заменя изцяло съдържанието за екранен четец — етикет вътре не би се чул.
     Държавата пътува през title на обвивката, тоест през подсказката. */
  window.zname = function (kod) {
    var f = Z[kod];
    return '<svg class="rojden-znak" viewBox="0 0 26 18" aria-hidden="true">' +
             '<g clip-path="url(#' + KLIP + ')">' + (f ? f[1] : SVYAT) + "</g>" +
             '<rect x=".5" y=".5" width="25" height="17" rx="3" fill="none"' +
               ' stroke="rgba(0,0,0,.4)" stroke-width="1"/>' +
           "</svg>";
  };

  window.znameDefs = function (kade) {
    if (document.getElementById(KLIP)) return;
    var k = document.createElement("div");
    k.innerHTML =
      '<svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs>' +
        '<clipPath id="' + KLIP + '">' +
          '<rect x=".5" y=".5" width="25" height="17" rx="3"/>' +
        "</clipPath>" +
        '<linearGradient id="' + GRAD + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#ff4d8d"/>' +
          '<stop offset="1" stop-color="#ffa14d"/>' +
        "</linearGradient>" +
      "</defs></svg>";
    kade.insertBefore(k.firstChild, kade.firstChild);
  };
})();
