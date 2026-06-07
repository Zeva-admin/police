(() => {
  /* ─── Telegram WebApp ─── */
  const tg = window.Telegram?.WebApp ?? null;
  try {
    if (tg) {
      tg.ready();
      tg.expand();
      tg.enableClosingConfirmation();
      if (tg.setHeaderColor)     tg.setHeaderColor("#ffffff");
      if (tg.setBackgroundColor) tg.setBackgroundColor("#fafafa");
    }
  } catch (_) {}

  /* ─── Refs ─── */
  const $ = id => document.getElementById(id);

  const stepIntro   = $("step-intro");
  const stepTag     = $("step-tag");
  const stepConfirm = $("step-confirm");
  const stepToken   = $("step-token");
  const stepDone    = $("step-done");
  const ALL_STEPS   = [stepIntro, stepTag, stepConfirm, stepToken, stepDone];

  const tgUserLine  = $("tg-user-line");
  const tagInput    = $("tag-input");
  const tokenInput  = $("token-input");
  const statusIntro = $("status-intro");
  const statusTag   = $("status-tag");
  const statusToken = $("status-token");
  const playerCard  = $("player-card");
  const meCard      = $("me-card");
  const doneText    = $("done-text");

  const btnStart  = $("btn-start");
  const btnLookup = $("btn-lookup");
  const btnYes    = $("btn-yes");
  const btnNo     = $("btn-no");
  const btnVerify = $("btn-verify");
  const btnClose  = $("btn-close");
  const btnChange = $("btn-change");
  const btnUnlink = $("btn-unlink");

  const loading      = $("loading");
  const loadingTitle = $("loading-title");
  const loadingText  = $("loading-text");

  let initData    = "";
  let selectedTag = "";
  let lastPlayer  = null;
  let unlinkBusy  = false;

  /* ─── Utils ─── */
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g,  "&amp;")
      .replace(/</g,  "&lt;")
      .replace(/>/g,  "&gt;")
      .replace(/"/g,  "&quot;")
      .replace(/'/g,  "&#039;");
  }

  function normTag(raw) {
    let t = (raw ?? "").trim();
    if (!t) return "";
    if (t.toLowerCase().startsWith("%23")) t = "#" + t.slice(3);
    if (!t.startsWith("#")) t = "#" + t;
    return t.toUpperCase();
  }

  // CoC tag alphabet: 0 2 8 9 P Y L Q G R J C U V
  function tagValid(tag) {
    const c = tag.replace(/^#/, "");
    return c.length >= 3 && c.length <= 12 && /^[0289PYLQGRJCUV]+$/.test(c);
  }

  /* ─── Navigation ─── */
  function show(el) {
    ALL_STEPS.forEach(x => x.classList.add("hidden"));
    el.classList.remove("hidden");
    el.style.animation = "none";
    void el.offsetHeight;
    el.style.animation = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ─── Loader ─── */
  function setLoading(on, title, sub) {
    if (!loading) return;
    if (on) {
      loadingTitle.textContent = title || "Загружаю";
      loadingText.textContent  = sub   || "Секунду";
      loading.classList.remove("hidden");
    } else {
      loading.classList.add("hidden");
    }
  }

  /* ─── Status ─── */
  const S_ICON = {
    ok: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    bad:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 5l14 14M19 5 5 19"/></svg>`,
    info:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`,
  };

  function setStatus(el, type, text) {
    el.className = `status-box status--${type}`;
    el.classList.remove("hidden");
    el.innerHTML = `<span class="status-box__icon">${S_ICON[type] ?? ""}</span><span>${esc(text)}</span>`;
  }

  function hideStatus(el) {
    el.classList.add("hidden");
    el.innerHTML = "";
  }

  /* ─── API ─── */
  async function api(path, payload) {
    try { if (tg) initData = tg.initData || initData; } catch (_) {}
    if (!initData) {
      throw new Error("Открой это окно через кнопку в боте и попробуй ещё раз.");
    }

    const labels = {
      "/api/lookup": "Ищу игрока",
      "/api/verify": "Проверяю токен",
      "/api/me":     "Проверяю привязку",
      "/api/unlink": "Удаляю привязку",
    };
    setLoading(true, labels[path] || "Загружаю", "Пара секунд");

    try {
      const res  = await fetch(path, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload ?? {}),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Не удалось выполнить запрос.");
      }
      return data;

    } catch (e) {
      if (e instanceof TypeError) {
        throw new Error("Нет соединения. Проверь интернет и попробуй снова.");
      }
      throw e;
    } finally {
      setLoading(false);
    }
  }

  /* ─── Render ─── */
  function rows(pairs) {
    return pairs.map(([k, v]) => `
      <div class="data-row">
        <div class="data-row__key">${esc(k)}</div>
        <div class="data-row__val">${esc(v)}</div>
      </div>`).join("");
  }

  function renderPlayer(target, p) {
    if (!target) return;
    if (!p) { target.innerHTML = ""; return; }
    target.innerHTML = rows([
      ["Ник",     p.name            || "—"],
      ["Тег",     p.tag             || "—"],
      ["ТХ",      p.townHallLevel   ? `ТХ ${p.townHallLevel}` : "—"],
      ["Уровень", p.expLevel != null ? String(p.expLevel)     : "—"],
      ["Лига",    p.league?.name    || "—"],
      ["Клан",    p.clan?.name      || "Без клана"],
    ]);
  }

  /* ─── TG user ─── */
  function fillUser() {
    if (!tg) {
      tgUserLine.textContent = "Открой через бота — так я пойму, кто ты.";
      return;
    }
    const u = tg.initDataUnsafe?.user;
    if (!u) { tgUserLine.textContent = "Не удалось получить профиль. Закрой и открой снова."; return; }
    const uname = u.username ? `@${u.username}` : "без username";
    tgUserLine.textContent = `${u.first_name || "Пользователь"} · ${uname}`;
  }

  /* ─── Confirm ─── */
  function confirmAsync(msg) {
    return new Promise(resolve => {
      if (tg?.showConfirm) tg.showConfirm(msg, resolve);
      else resolve(window.confirm(msg));
    });
  }

  /* ─── withBtn ─── */
  async function withBtn(btn, fn) {
    btn.disabled = true;
    try { await fn(); } finally { btn.disabled = false; }
  }

  /* ═══════════════════════════
     HANDLERS
  ═══════════════════════════ */

  btnStart.addEventListener("click", () => {
    try { if (tg) initData = tg.initData || initData; } catch (_) {}
    fillUser();
    hideStatus(statusIntro);
    hideStatus(statusTag);
    tagInput.value = "";
    show(stepTag);
    setTimeout(() => tagInput.focus(), 200);
  });

  btnLookup.addEventListener("click", () =>
    withBtn(btnLookup, async () => {
      const tag = normTag(tagInput.value);
      if (!tagValid(tag)) {
        setStatus(statusTag, "bad", "Тег выглядит неверно. Пример: #QV8CUPJ92");
        return;
      }
      setStatus(statusTag, "info", "Ищу в базе данных…");
      try {
        const data = await api("/api/lookup", { initData, tag });
        lastPlayer  = data.player || null;
        selectedTag = tag;
        renderPlayer(playerCard, lastPlayer);
        hideStatus(statusTag);
        show(stepConfirm);
      } catch (e) {
        setStatus(statusTag, "bad", e.message || "Ошибка.");
      }
    })
  );

  btnNo.addEventListener("click", () => {
    lastPlayer  = null;
    selectedTag = "";
    show(stepTag);
    setStatus(statusTag, "info", "Введи другой тег.");
  });

  btnYes.addEventListener("click", () => {
    if (!selectedTag) { show(stepTag); return; }
    tokenInput.value = "";
    hideStatus(statusToken);
    show(stepToken);
    setTimeout(() => tokenInput.focus(), 200);
  });

  btnVerify.addEventListener("click", () =>
    withBtn(btnVerify, async () => {
      const token = (tokenInput.value || "").trim();
      if (!/^[0-9A-Za-z]{6,32}$/.test(token)) {
        setStatus(statusToken, "bad", "Токен выглядит неверно. Проверь символы и попробуй ещё раз.");
        return;
      }
      setStatus(statusToken, "info", "Проверяю…");
      try {
        const data   = await api("/api/verify", { initData, tag: selectedTag, token });
        const player = data?.player || lastPlayer || null;
        lastPlayer   = player;

        renderPlayer(meCard, player);
        doneText.innerHTML = `Привязан аккаунт <strong>${esc(player?.name || "игрок")}</strong> <code>${esc(selectedTag)}</code>. Можно закрывать — бот всё запомнил.`;
        show(stepDone);

        try { if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred("success"); } catch (_) {}
      } catch (e) {
        const msg = e.message || "Ошибка.";
        setStatus(
          statusToken, "bad",
          msg.includes("истек") || msg.includes("истёк")
            ? "Токен истёк. Нажми «Авторизационный токен» в игре ещё раз."
            : msg
        );
        try { if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred("error"); } catch (_) {}
      }
    })
  );

  btnClose.addEventListener("click", () => {
    try { if (tg) tg.close(); } catch (_) {}
    window.close();
  });

  btnChange.addEventListener("click", () => {
    tagInput.value = "";
    hideStatus(statusTag);
    fillUser();
    show(stepTag);
    setTimeout(() => tagInput.focus(), 200);
  });

  async function doUnlink() {
    if (unlinkBusy) return;
    const confirmed = await confirmAsync("Удалить привязку аккаунта?");
    if (!confirmed) return;

    unlinkBusy = true;
    btnUnlink.disabled = true;
    try {
      await api("/api/unlink", { initData });
      lastPlayer  = null;
      selectedTag = "";
      hideStatus(statusIntro);
      show(stepIntro);
      try { if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred("success"); } catch (_) {}
    } catch (e) {
      const msg = e.message || "Не удалось удалить привязку.";
      if (tg?.showAlert) tg.showAlert(msg);
      else alert(msg);
    } finally {
      unlinkBusy = false;
      btnUnlink.disabled = false;
    }
  }

  btnUnlink.addEventListener("click", doUnlink);

  /* ─── Keyboard ─── */
  tagInput.addEventListener("keydown",   e => { if (e.key === "Enter") btnLookup.click(); });
  tokenInput.addEventListener("keydown", e => { if (e.key === "Enter") btnVerify.click(); });

  tagInput.addEventListener("input", () => {
    tagInput.value = tagInput.value.replace(/[^0-9A-Za-z#]/g, "");
  });

  /* ─── Boot ─── */
  try { if (tg) initData = tg.initData || ""; } catch (_) {}

  async function boot() {
    if (!tg) return;
    try { initData = tg.initData || initData; } catch (_) {}
    if (!initData) return;
    try {
      const data = await api("/api/me", { initData });
      if (data?.linked && data?.player) {
        const p = data.player;
        lastPlayer  = p;
        selectedTag = normTag(p.tag || "");
        renderPlayer(meCard, p);
        doneText.innerHTML = `Привязан аккаунт <strong>${esc(p.name || "игрок")}</strong> <code>${esc(selectedTag)}</code>.`;
        show(stepDone);
      }
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("Открой это окно")) {
        setStatus(statusIntro, "bad", msg);
      } else {
        setStatus(statusIntro, "info", "Не удалось проверить текущую привязку. Можно попробовать начать заново.");
      }
    }
  }

  boot();
})();
