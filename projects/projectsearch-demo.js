/* ProjectSearch — browser demonstration of the real interface.
   Four sample records, matched locally. The deployed tool ranks with embeddings,
   BM25 over SQLite FTS5, rank fusion, and a reranking pass; this page uses a
   transparent lexical score so the ranking stays inspectable from the page itself. */
(function () {
  "use strict";

  var RECORDS = [
    {
      id: "north-parapet",
      image: "../assets/projects/projectsearch-north-parapet.jpg",
      alt: "Blue liquid-applied waterproofing turned up a concrete parapet upstand over a black roof membrane",
      caption: "Blue liquid-applied waterproofing turned up the north parapet upstand, terminating on cast-in-place concrete above a black roof membrane.",
      setting: "Exterior · roof",
      level: "Main roof",
      room: "North parapet",
      components: ["parapet", "base flashing", "roof membrane", "upstand"],
      materials: ["liquid-applied waterproofing", "concrete", "modified bitumen"],
      condition: null,
      text: null,
      source: "Folder name",
      confidence: 0.94
    },
    {
      id: "rtu-3",
      image: "../assets/projects/projectsearch-rtu3-nameplate.jpg",
      alt: "Stainless nameplate reading RTU-3 fixed to a grey mechanical unit casing",
      caption: "Stainless nameplate reading RTU-3 fixed to a grey rooftop unit casing, with conduit and mechanical space visible beyond.",
      setting: "Interior · mechanical",
      level: "Level 03",
      room: "Mechanical room",
      components: ["rooftop unit", "access panel", "conduit", "nameplate"],
      materials: ["galvanized steel", "stainless steel"],
      condition: null,
      text: "RTU-3",
      source: "Level read in the photo",
      confidence: 0.99
    },
    {
      id: "hatch-curb",
      image: "../assets/projects/projectsearch-epdm-hatch-curb.jpg",
      alt: "EPDM membrane wrapped up a galvanized roof-hatch curb with a fastened termination bar",
      caption: "EPDM membrane wrapped up a galvanized roof-hatch curb and secured with a fastened termination bar.",
      setting: "Exterior · roof",
      level: "Main roof",
      room: "Roof hatch",
      components: ["roof hatch", "curb", "termination bar", "fasteners"],
      materials: ["EPDM", "galvanized steel"],
      condition: { note: "Surface chalking on the membrane field", severity: "Low" },
      text: null,
      source: "Kind of space",
      confidence: 0.88
    },
    {
      id: "flashing-adhesion",
      image: "../assets/projects/projectsearch-flashing-adhesion.jpg",
      alt: "EPDM base flashing at a parapet with a debonded lap lifting away from the substrate",
      caption: "EPDM base flashing at the northeast parapet with a debonded lap lifting away from the substrate below the metal coping.",
      setting: "Exterior · roof",
      level: "Main roof",
      room: "NE corner",
      components: ["base flashing", "parapet", "coping", "lap"],
      materials: ["EPDM", "metal coping"],
      condition: { note: "Adhesion loss at the flashing lap", severity: "Moderate" },
      text: null,
      source: "Time-ordered walk inference",
      confidence: 0.92
    }
  ];

  var STOP = /^(the|a|an|at|in|on|of|and|or|to|with|is|are|for|from|by|it|show|shows|me|photos?|find|all)$/;

  function tokens(value) {
    return String(value)
      .toLowerCase()
      .split(/[^a-z0-9-]+/)
      .filter(function (word) { return word.length > 1 && !STOP.test(word); });
  }

  function haystack(record) {
    return [
      record.caption, record.setting, record.level, record.room,
      record.components.join(" "), record.materials.join(" "),
      record.condition ? record.condition.note + " " + record.condition.severity : "",
      record.text || ""
    ].join(" ").toLowerCase();
  }

  // A term scores on a whole-word hit, and at half weight on a prefix hit, so
  // "flash" still reaches "flashing" without "roof" matching "waterproofing".
  function score(record, terms) {
    var hay = haystack(record);
    var words = tokens(hay);
    var hits = 0;
    terms.forEach(function (term) {
      if (words.indexOf(term) !== -1) hits += 1;
      else if (hay.indexOf(term) !== -1) hits += 0.5;
    });
    return terms.length ? hits / terms.length : 0;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function fieldRow(label, value) {
    var row = el("div", "ps-field-row");
    row.appendChild(el("dt", null, label));
    row.appendChild(el("dd", null, value));
    return row;
  }

  function recordFields(record) {
    var list = el("dl", "ps-fields");
    list.appendChild(fieldRow("Setting", record.setting));
    list.appendChild(fieldRow("Level", record.level));
    list.appendChild(fieldRow("Room", record.room));
    list.appendChild(fieldRow("Components", record.components.join(" · ")));
    list.appendChild(fieldRow("Materials", record.materials.join(" · ")));
    list.appendChild(fieldRow("Condition", record.condition
      ? record.condition.note + " — " + record.condition.severity
      : "None observed"));
    list.appendChild(fieldRow("Visible text", record.text || "—"));
    list.appendChild(fieldRow("Level source", record.source));
    return list;
  }

  function resultItem(record, matched) {
    var item = el("li", "ps-result");

    var media = el("figure", "ps-result-media");
    var img = el("img");
    img.src = record.image;
    img.alt = record.alt;
    img.loading = "lazy";
    img.decoding = "async";
    media.appendChild(img);

    var body = el("div", "ps-result-body");
    var head = el("div", "ps-result-head");
    head.appendChild(el("span", null, record.level + " · " + record.room));
    head.appendChild(el("strong", null, Math.round(matched * 100) + "%"));
    body.appendChild(head);
    body.appendChild(el("p", null, record.caption));

    var meta = el("div", "ps-result-meta");
    if (record.condition) {
      meta.appendChild(el("span", "ps-flag", record.condition.severity + " · " + record.condition.note));
    }
    if (record.text) {
      meta.appendChild(el("span", "ps-text", "Visible text: “" + record.text + "”"));
    }
    meta.appendChild(el("span", null, "Level from: " + record.source));
    body.appendChild(meta);

    item.appendChild(media);
    item.appendChild(body);
    return item;
  }

  function start() {
    var demo = document.querySelector("[data-ps-demo]");
    var recordHost = document.querySelector("[data-ps-records]");

    if (recordHost) {
      RECORDS.forEach(function (record) {
        var card = el("article", "ps-record");
        var figure = el("figure");
        var img = el("img");
        img.src = record.image;
        img.alt = record.alt;
        img.loading = "lazy";
        img.decoding = "async";
        figure.appendChild(img);
        var caption = el("figcaption", null, record.caption);
        figure.appendChild(caption);
        card.appendChild(figure);
        card.appendChild(recordFields(record));
        recordHost.appendChild(card);
      });
    }

    if (!demo) return;

    var input = demo.querySelector("[data-ps-input]");
    var results = demo.querySelector("[data-ps-results]");
    var count = demo.querySelector("[data-ps-count]");
    var empty = demo.querySelector("[data-ps-empty]");
    var chips = demo.querySelectorAll("[data-ps-query]");

    function render(query) {
      var terms = tokens(query);
      var ranked = RECORDS
        .map(function (record) {
          return { record: record, matched: terms.length ? score(record, terms) : 1 };
        })
        .filter(function (row) { return row.matched > 0; })
        .sort(function (a, b) { return b.matched - a.matched; });

      results.textContent = "";
      ranked.forEach(function (row) { results.appendChild(resultItem(row.record, row.matched)); });

      if (!terms.length) {
        count.textContent = RECORDS.length + " records indexed · showing all";
      } else {
        count.textContent = ranked.length + " of " + RECORDS.length + " records matched “" + query.trim() + "”";
      }
      empty.hidden = ranked.length !== 0;
    }

    input.addEventListener("input", function () { render(input.value); });
    input.addEventListener("search", function () { render(input.value); });

    Array.prototype.forEach.call(chips, function (chip) {
      chip.addEventListener("click", function () {
        input.value = chip.getAttribute("data-ps-query");
        render(input.value);
        input.focus();
      });
    });

    render("");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}());
