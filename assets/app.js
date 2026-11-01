/* 聖經問答練習 — app logic (no build step, no dependencies) */
(function () {
  "use strict";

  var DATA = (window.BIBLE_QUIZ_DATA || []).slice().sort(function (a, b) { return a.n - b.n; });
  var KEY = "bq_v1";
  var LETTERS = ["A", "B", "C", "D"];

  /* ---------------- persistence ---------------- */
  var state = load();

  function load() {
    var base = { progress: {}, total: { answered: 0, correct: 0 }, streak: 0, best: 0, theme: "auto", last: null };
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return base;
      var s = JSON.parse(raw);
      return {
        progress: s.progress || {},
        total: s.total || base.total,
        streak: s.streak || 0,
        best: s.best || 0,
        theme: s.theme || "auto",
        last: s.last || null
      };
    } catch (e) { return base; }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore quota */ }
  }

  function bookProgress(n) {
    if (!state.progress[n]) state.progress[n] = {};
    return state.progress[n];
  }

  function isRight(n, qi) { return bookProgress(n)[qi] === 1; }
  function seen(n, qi) { return bookProgress(n)[qi] !== undefined; }
  function isWrong(n, qi) { return bookProgress(n)[qi] === 2; }

  function bookDoneCount(book) {
    var p = bookProgress(book.n), c = 0;
    for (var i = 0; i < book.q.length; i++) if (p[i] !== undefined) c++;
    return c;
  }

  function bookWrongCount(book) {
    var p = bookProgress(book.n), c = 0;
    for (var i = 0; i < book.q.length; i++) if (p[i] === 2) c++;
    return c;
  }

  function allWrong() {
    var out = [];
    DATA.forEach(function (book) {
      book.q.forEach(function (q, qi) { if (isWrong(book.n, qi)) out.push({ book: book, qi: qi }); });
    });
    return out;
  }

  function totals() { return state.total; }

  /* ---------------- helpers ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined) n.textContent = txt;
    return n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }

  /* ---------------- session ---------------- */
  var ses = null; // {title, items:[{book, qi}], i, picked:[], startedAt}

  function makeItems(book, mode) {
    var idx = book.q.map(function (_, i) { return i; });
    if (mode === "random") idx = shuffle(idx).slice(0, Math.min(10, idx.length));
    if (mode === "wrong") idx = idx.filter(function (i) { return isWrong(book.n, i); });
    return idx;
  }

  function start(book, mode) {
    var items = makeItems(book, mode);
    if (!items.length) { toast(mode === "wrong" ? "這卷書暫時沒有錯題" : "這一卷沒有題目"); return; }
    ses = {
      title: book.name,
      book: book,
      items: items.map(function (qi) { return { book: book, qi: qi }; }),
      i: 0,
      picked: {},
      startedAt: Date.now(),
      mode: mode
    };
    state.last = { n: book.n, mode: mode };
    save();
    closeSidebar();
    renderQuiz();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startMixed(count) {
    var pool = [];
    DATA.forEach(function (book) {
      book.q.forEach(function (_, qi) { pool.push({ book: book, qi: qi }); });
    });
    if (!pool.length) return;
    ses = {
      title: "全書卷隨機練習",
      book: null,
      items: shuffle(pool).slice(0, Math.min(count, pool.length)),
      i: 0,
      picked: {},
      startedAt: Date.now(),
      mode: "mixed"
    };
    closeSidebar();
    renderQuiz();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startWrongAll() {
    var wrong = allWrong();
    if (!wrong.length) { toast("目前沒有錯題，繼續加油！"); return; }
    ses = {
      title: "錯題重練",
      book: null,
      items: shuffle(wrong).slice(0, 40),
      i: 0,
      picked: {},
      startedAt: Date.now(),
      mode: "wrong"
    };
    closeSidebar();
    renderQuiz();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function answer(choice) {
    var item = ses.items[ses.i];
    if (ses.picked[ses.i] !== undefined) return;
    var q = item.book.q[item.qi];
    var ok = choice === q.a;
    ses.picked[ses.i] = choice;

    bookProgress(item.book.n)[item.qi] = ok ? 1 : 2;
    state.total.answered += 1;
    if (ok) {
      state.total.correct += 1;
      state.streak += 1;
      if (state.streak > state.best) state.best = state.streak;
    } else {
      state.streak = 0;
    }
    save();
    renderQuiz(true);
  }

  function next() {
    if (ses.picked[ses.i] === undefined) { toast("請先選擇答案"); return; }
    if (ses.i + 1 >= ses.items.length) { renderResult(); return; }
    ses.i += 1;
    renderQuiz();
    var card = $("#card");
    if (card) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function prev() {
    if (ses.i === 0) return;
    ses.i -= 1;
    renderQuiz();
  }

  /* ---------------- rendering ---------------- */
  var main = $("#main");

  function renderStats() {
    var t = totals();
    $("#statAnswered").textContent = t.answered;
    $("#statRate").textContent = pct(t.correct, t.answered) + "%";
    $("#statStreak").textContent = state.streak;
  }

  function renderHome() {
    ses = null;
    var t = totals();
    var totalQ = DATA.reduce(function (s, b) { return s + b.q.length; }, 0);
    var doneBooks = DATA.filter(function (b) { return bookDoneCount(b) >= b.q.length; }).length;
    var wrong = allWrong().length;

    main.innerHTML =
      '<div class="wrap">' +
        '<div class="topbar"><div class="crumb">和合本聖經 · 逐卷練習</div>' + statsHtml() + "</div>" +
        '<section class="card hero">' +
          "<h2>聖經問答練習</h2>" +
          "<p>按聖經書卷次序編排，每卷 10 至 30 題，全部答案均以經文為根據，並附出處與解釋。</p>" +
          '<div class="herostats">' +
            bigStat(totalQ, "全書卷題目") +
            bigStat(t.answered, "累計作答") +
            bigStat(pct(t.correct, t.answered) + "%", "整體正確率") +
            bigStat(doneBooks + " / " + DATA.length, "已完成書卷") +
            bigStat(wrong, "待重練錯題") +
          "</div>" +
          '<div class="actions">' +
            '<button class="btn primary" id="goRandom">隨機 20 題</button>' +
            (state.last ? '<button class="btn" id="goLast">繼續練習</button>' : "") +
            '<button class="btn" id="goWrong">錯題重練' + (wrong ? "（" + wrong + "）" : "") + "</button>" +
            '<button class="btn ghost" id="goFirst">由創世記開始</button>' +
          "</div>" +
          '<div class="section-title">新約速覽</div>' +
          '<div class="mini-grid">' + DATA.filter(function (b) { return b.testament === "NT"; }).slice(0, 8).map(miniBtn).join("") + "</div>" +
        "</section>" +
      "</div>";

    bindStats();
    $("#goRandom").addEventListener("click", function () { startMixed(20); });
    $("#goWrong").addEventListener("click", startWrongAll);
    $("#goFirst").addEventListener("click", function () { start(DATA[0], "order"); });
    if (state.last) {
      $("#goLast").addEventListener("click", function () {
        var b = DATA.filter(function (x) { return x.n === state.last.n; })[0];
        if (b) start(b, "order"); else renderHome();
      });
    }
    document.querySelectorAll("[data-book]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var n = Number(btn.getAttribute("data-book"));
        var b = DATA.filter(function (x) { return x.n === n; })[0];
        if (b) start(b, "order");
      });
      btn.addEventListener("contextmenu", function (ev) {
        ev.preventDefault();
        var n = Number(btn.getAttribute("data-book"));
        var b = DATA.filter(function (x) { return x.n === n; })[0];
        if (b) start(b, "random");
      });
    });
  }

  function bigStat(v, k) {
    return '<div class="bigstat"><div class="v">' + esc(v) + '</div><div class="k">' + esc(k) + "</div></div>";
  }

  function miniBtn(b) {
    return '<button class="mini" data-book="' + b.n + '">' + esc(b.name) + "<span>" + b.q.length + " 題</span></button>";
  }

  function statsHtml() {
    return '<div class="stats">' +
      '<div class="stat"><div class="v" id="statAnswered">0</div><div class="k">作答</div></div>' +
      '<div class="stat"><div class="v" id="statRate">0%</div><div class="k">正確</div></div>' +
      '<div class="stat"><div class="v" id="statStreak">0</div><div class="k">連對</div></div>' +
      "</div>";
  }

  function bindStats() {
    var t = totals();
    if ($("#statAnswered")) $("#statAnswered").textContent = t.answered;
    if ($("#statRate")) $("#statRate").textContent = pct(t.correct, t.answered) + "%";
    if ($("#statStreak")) $("#statStreak").textContent = state.streak;
  }

  function renderQuiz(justAnswered) {
    var item = ses.items[ses.i];
    var book = item.book;
    var q = book.q[item.qi];
    var picked = ses.picked[ses.i];
    var answered = picked !== undefined;
    var ok = answered && picked === q.a;
    var total = ses.items.length;

    var html =
      '<div class="wrap">' +
        '<div class="topbar">' +
          '<div class="crumb">' + esc(ses.title) + (book === null ? "" : " · 第 " + (item.qi + 1) + " 題") + "</div>" +
          statsHtml() +
        "</div>" +
        '<section class="card" id="card">' +
          '<div class="qhead">' +
            '<span class="chip">' + esc(book.name) + "　第 " + (item.qi + 1) + " 題</span>" +
            '<span class="qcounter">' + (ses.i + 1) + " / " + total + "</span>" +
          "</div>" +
          '<div class="progress"><i style="width:' + pct(ses.i + (answered ? 1 : 0), total) + '%"></i></div>' +
          '<h2 class="qtext">' + esc(q.q) + "</h2>" +
          '<div class="options">' +
            q.o.map(function (opt, i) {
              var cls = "opt";
              if (answered) {
                if (i === q.a) cls += " correct";
                else if (i === picked) cls += " wrong";
                else cls += " dim";
              }
              return '<button class="' + cls + '" data-opt="' + i + '"' + (answered ? " disabled" : "") + ">" +
                '<span class="key">' + LETTERS[i] + "</span><span>" + esc(opt) + "</span></button>";
            }).join("") +
          "</div>" +
          (answered
            ? '<div class="feedback ' + (ok ? "good" : "bad") + '">' +
                '<div class="verdict ' + (ok ? "good" : "bad") + '">' + (ok ? "✓ 答對了" : "✗ 答錯了，正確答案：" + esc(q.o[q.a])) + "</div>" +
                '<span class="ref">' + esc(q.ref) + "</span>" +
                (q.e ? '<p class="explain">' + esc(q.e) + "</p>" : "") +
              "</div>"
            : "") +
          '<div class="footbar">' +
            '<button class="btn ghost" id="btnPrev"' + (ses.i === 0 ? " disabled" : "") + ">上一題</button>" +
            '<span class="hint">按 <kbd>1</kbd>–<kbd>4</kbd> 選答 · <kbd>Enter</kbd> 下一題</span>' +
            '<button class="btn primary" id="btnNext"' + (answered ? "" : " disabled") + ">" +
              (ses.i + 1 >= total ? "看結果" : "下一題") +
            "</button>" +
          "</div>" +
        "</section>" +
      "</div>";

    main.innerHTML = html;
    bindStats();

    main.querySelectorAll("[data-opt]").forEach(function (btn) {
      btn.addEventListener("click", function () { answer(Number(btn.getAttribute("data-opt"))); });
    });
    $("#btnNext").addEventListener("click", next);
    $("#btnPrev").addEventListener("click", prev);

    if (justAnswered) {
      var card = $("#card");
      var fb = main.querySelector(".feedback");
      if (fb && card) setTimeout(function () { fb.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, 30);
    }
  }

  function renderResult() {
    var right = 0, wrongItems = [];
    ses.items.forEach(function (it, i) {
      var q = it.book.q[it.qi];
      if (ses.picked[i] === q.a) right++;
      else wrongItems.push({ book: it.book, qi: it.qi, picked: ses.picked[i] });
    });
    var total = ses.items.length;
    var rate = pct(right, total);
    var R = 72, C = 2 * Math.PI * R;
    var dash = (rate / 100) * C;
    var secs = Math.max(1, Math.round((Date.now() - ses.startedAt) / 1000));
    var mm = Math.floor(secs / 60), ss = secs % 60;

    main.innerHTML =
      '<div class="wrap">' +
        '<div class="topbar"><div class="crumb">' + esc(ses.title) + " · 練習結果</div>" + statsHtml() + "</div>" +
        '<section class="card result">' +
          '<div class="score-ring">' +
            '<svg width="168" height="168" viewBox="0 0 168 168">' +
              '<circle cx="84" cy="84" r="' + R + '" fill="none" stroke="var(--surface-2)" stroke-width="12"/>' +
              '<circle cx="84" cy="84" r="' + R + '" fill="none" stroke="var(--brand)" stroke-width="12" ' +
                'stroke-linecap="round" stroke-dasharray="' + dash + " " + C + '"/>' +
            "</svg>" +
            '<div class="mid"><b>' + rate + '%</b><small>' + right + " / " + total + "</small></div>" +
          "</div>" +
          "<h2>" + (rate >= 90 ? "優異！" : rate >= 70 ? "不錯！" : rate >= 50 ? "繼續努力" : "再讀一遍經文吧") + "</h2>" +
          "<p>用時 " + mm + " 分 " + ss + " 秒 · 本節答對 " + right + " 題，答錯 " + (total - right) + " 題</p>" +
          '<div class="actions" style="justify-content:center">' +
            '<button class="btn primary" id="again">再做一次</button>' +
            (bookWrongCount(ses.book || { n: -1, q: [] }) ? "" : "") +
            '<button class="btn" id="reviewWrong"' + (wrongItems.length ? "" : " disabled") + ">重練本節錯題</button>" +
            '<button class="btn ghost" id="backHome">返回書卷</button>' +
          "</div>" +
          (wrongItems.length
            ? '<div class="wronglist">' + wrongItems.map(function (w) {
                var q = w.book.q[w.qi];
                return '<div class="wrongitem"><div class="qt">' + esc(q.q) + "</div>" +
                  '<div class="an">正確答案：<b>' + esc(q.o[q.a]) + "</b> · " + esc(q.ref) + "</div></div>";
              }).join("") + "</div>"
            : "") +
        "</section>" +
      "</div>";

    bindStats();
    $("#again").addEventListener("click", function () {
      if (ses.book) start(ses.book, ses.mode === "random" ? "random" : "order");
      else startMixed(ses.items.length);
    });
    $("#reviewWrong").addEventListener("click", function () {
      if (!wrongItems.length) return;
      ses = {
        title: "本節錯題",
        book: null,
        items: wrongItems.map(function (w) { return { book: w.book, qi: w.qi }; }),
        i: 0, picked: {}, startedAt: Date.now(), mode: "wrong"
      };
      renderQuiz();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    $("#backHome").addEventListener("click", renderHome);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------- sidebar ---------------- */
  var filterTestament = "ALL";

  function renderSidebar() {
    var q = ($("#search").value || "").trim().toLowerCase();
    var list = DATA.filter(function (b) {
      if (filterTestament !== "ALL" && b.testament !== filterTestament) return false;
      if (!q) return true;
      return b.name.toLowerCase().indexOf(q) >= 0 ||
        b.en.toLowerCase().indexOf(q) >= 0 ||
        String(b.n) === q;
    });

    var html = list.map(function (b) {
      var done = bookDoneCount(b);
      var p = pct(done, b.q.length);
      var active = ses && ses.book && ses.book.n === b.n;
      return '<li><button class="book-btn" data-book="' + b.n + '"' + (active ? ' aria-current="true"' : "") + ">" +
        '<span class="book-no">' + String(b.n).padStart(2, "0") + "</span>" +
        '<span class="book-name">' + esc(b.name) + "</span>" +
        '<span class="book-meta"><span class="bar"><i style="width:' + p + '%"></i></span>' +
        '<span class="book-count">' + b.q.length + "</span></span>" +
        "</button></li>";
    }).join("");

    $("#bookList").innerHTML = html || '<li class="empty">沒有符合的書卷</li>';
    $("#bookList").querySelectorAll("[data-book]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var n = Number(btn.getAttribute("data-book"));
        var b = DATA.filter(function (x) { return x.n === n; })[0];
        if (b) start(b, "order");
      });
    });
  }

  function closeSidebar() {
    $("#sidebar").classList.remove("open");
    $("#scrim").classList.remove("on");
  }

  function applyTheme() {
    var t = state.theme;
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  var toastTimer = null;
  function toast(msg) {
    var n = $("#toast");
    n.textContent = msg;
    n.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { n.classList.remove("on"); }, 1800);
  }

  /* ---------------- boot ---------------- */
  function boot() {
    applyTheme();
    renderSidebar();
    if (!DATA.length) {
      main.innerHTML = '<div class="wrap"><section class="card"><div class="empty">未能載入題目資料（data.js）。</div></section></div>';
      return;
    }
    renderHome();

    $("#search").addEventListener("input", renderSidebar);
    document.querySelectorAll(".tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".tab").forEach(function (t) { t.setAttribute("aria-selected", "false"); });
        tab.setAttribute("aria-selected", "true");
        filterTestament = tab.getAttribute("data-testament");
        renderSidebar();
      });
    });
    $("#theme").addEventListener("click", function () {
      state.theme = state.theme === "auto" ? "light" : state.theme === "light" ? "dark" : "auto";
      save(); applyTheme();
      toast("主題：" + ({ auto: "跟隨系統", light: "淺色", dark: "深色" })[state.theme]);
    });
    $("#menu").addEventListener("click", function () {
      $("#sidebar").classList.toggle("open");
      $("#scrim").classList.toggle("on");
    });
    $("#scrim").addEventListener("click", closeSidebar);
    $("#homeBtn").addEventListener("click", function () { closeSidebar(); renderHome(); });

    document.addEventListener("keydown", function (ev) {
      if (!ses) return;
      if (ev.target && /input|textarea/i.test(ev.target.tagName)) return;
      if (ev.key >= "1" && ev.key <= "4") {
        var i = Number(ev.key) - 1;
        var item = ses.items[ses.i];
        if (i < item.book.q[item.qi].o.length) answer(i);
      } else if (ev.key === "Enter" || ev.key === " ") {
        if (ses.picked[ses.i] !== undefined) { ev.preventDefault(); next(); }
      }
    });

    $("#bookTotal").textContent = DATA.length;
    $("#qTotal").textContent = DATA.reduce(function (s, b) { return s + b.q.length; }, 0);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
