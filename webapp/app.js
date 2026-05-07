(() => {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  try {
    if (tg) {
      tg.ready();
      tg.expand();
      tg.enableClosingConfirmation();
      if (tg.setHeaderColor) tg.setHeaderColor("#0b0f14");
      if (tg.setBackgroundColor) tg.setBackgroundColor("#0b0f14");
    }
  } catch (_) {}

  const $ = (id) => document.getElementById(id);

  const stepIntro = $("step-intro");
  const stepTag = $("step-tag");
  const stepConfirm = $("step-confirm");
  const stepToken = $("step-token");
  const stepDone = $("step-done");

  const tgUserLine = $("tg-user-line");
  const tagInput = $("tag-input");
  const tokenInput = $("token-input");
  const statusTag = $("status-tag");
  const statusToken = $("status-token");
  const playerCard = $("player-card");
  const doneText = $("done-text");

  const btnStart = $("btn-start");
  const btnLookup = $("btn-lookup");
  const btnYes = $("btn-yes");
  const btnNo = $("btn-no");
  const btnVerify = $("btn-verify");
  const btnClose = $("btn-close");
  const btnChange = $("btn-change");
  const btnUnlink = $("btn-unlink");

  const btnMenu = $("btn-menu");
  const drawer = $("drawer");
  const backdrop = $("backdrop");
  const drawerMe = $("drawer-me");
  const drawerChange = $("drawer-change");
  const drawerUnlink = $("drawer-unlink");
  const drawerClose = $("drawer-close");

  const meCard = $("me-card");
  const loading = $("loading");
  const loadingTitle = $("loading-title");
  const loadingText = $("loading-text");

  let initData = "";
  let selectedTag = "";
  let lastPlayer = null;

  function show(el) {
    [stepIntro, stepTag, stepConfirm, stepToken, stepDone].forEach((x) =>
      x.classList.add("hidden")
    );
    el.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openDrawer() {
    drawer.classList.remove("hidden");
    backdrop.classList.remove("hidden");
    drawer.setAttribute("aria-hidden", "false");
  }
  function closeDrawer() {
    drawer.classList.add("hidden");
    backdrop.classList.add("hidden");
    drawer.setAttribute("aria-hidden", "true");
  }

  function setLoading(on, title, text) {
    if (!loading) return;
    if (on) {
      if (loadingTitle) loadingTitle.textContent = title || "Загружаю…";
      if (loadingText) loadingText.textContent = text || "Секунду.";
      loading.classList.remove("hidden");
    } else {
      loading.classList.add("hidden");
    }
  }

  function normTag(raw) {
    let t = (raw || "").trim();
    if (!t) return "";
    if (t.toLowerCase().startsWith("%23")) t = "#" + t.slice(3);
    if (!t.startsWith("#")) t = "#" + t;
    return t.toUpperCase();
  }

  function tagLooksValid(tag) {
    const cleaned = (tag || "").replace(/^#/, "");
    if (cleaned.length < 3 || cleaned.length > 12) return false;
    return /^[0289PYLQGRJCUV]+$/.test(cleaned);
  }

  function setStatus(el, type, text) {
    const label =
      type === "ok" ? "Готово" : type === "bad" ? "Ошибка" : "Проверяю";
    const pillClass = type === "ok" ? "ok" : type === "bad" ? "bad" : "info";
    const icon = statusIconSvg(type);
    el.innerHTML = `
      <span class="pill ${pillClass}"><span class="pillIcon">${icon}</span>${label}</span>
      <span>${text || ""}</span>
    `;
  }

  function statusIconSvg(type) {
    if (type === "ok") {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9.2 16.6 4.9 12.3a1.2 1.2 0 1 1 1.7-1.7l2.6 2.6 8.2-8.2a1.2 1.2 0 1 1 1.7 1.7l-9.9 9.9a1.2 1.2 0 0 1-1.7 0Z"/>
        </svg>`;
    }
    if (type === "bad") {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13.7 12 18.3 7.4a1.2 1.2 0 0 0-1.7-1.7L12 10.3 7.4 5.7a1.2 1.2 0 1 0-1.7 1.7L10.3 12l-4.6 4.6a1.2 1.2 0 1 0 1.7 1.7l4.6-4.6 4.6 4.6a1.2 1.2 0 0 0 1.7-1.7L13.7 12Z"/>
        </svg>`;
    }
    // info/loading
    return `
      <svg class="spin" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.2a8.8 8.8 0 1 0 8.8 8.8 1.2 1.2 0 1 0-2.4 0A6.4 6.4 0 1 1 12 5.6a1.2 1.2 0 1 0 0-2.4Z"/>
      </svg>`;
  }

  async function api(path, payload) {
    try {
      if (!initData && tg) initData = tg.initData || "";
    } catch (_) {}
    // Small UI hint: show overlay for network calls (prevents "nothing happens" feeling)
    const label =
      path === "/api/lookup"
        ? "Ищу игрока…"
        : path === "/api/verify"
          ? "Проверяю токен…"
          : path === "/api/me"
            ? "Проверяю привязку…"
            : path === "/api/unlink"
              ? "Удаляю привязку…"
              : "Загружаю…";
    setLoading(true, label, "Пара секунд.");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data || data.ok === false) {
        const msg = (data && data.error) || "Не удалось выполнить запрос.";
        throw new Error(msg);
      }
      return data;
    } finally {
      setLoading(false);
    }
  }

  function renderPlayerCard(player) {
    const rows = [
      ["Ник", player.name || "—"],
      ["Тег", player.tag || "—"],
      ["ТХ", player.townHallLevel ? "ТХ " + player.townHallLevel : "—"],
      ["Уровень", player.expLevel != null ? String(player.expLevel) : "—"],
      ["Лига", (player.league && player.league.name) || "—"],
      ["Клан", (player.clan && player.clan.name) || "Без клана"],
    ];
    playerCard.innerHTML = rows
      .map(
        ([k, v]) => `
        <div class="playerLine">
          <div class="playerKey">${k}</div>
          <div class="playerVal">${escapeHtml(v)}</div>
        </div>`
      )
      .join("");
  }

  function renderMeCard(player) {
    if (!meCard) return;
    if (!player || !player.tag) {
      meCard.innerHTML = "";
      return;
    }
    const rows = [
      ["Ник", player.name || "—"],
      ["Тег", player.tag || "—"],
      ["ТХ", player.townHallLevel ? "ТХ " + player.townHallLevel : "—"],
      ["Лига", (player.league && player.league.name) || "—"],
      ["Клан", (player.clan && player.clan.name) || "Без клана"],
    ];
    meCard.innerHTML = rows
      .map(
        ([k, v]) => `
        <div class="playerLine">
          <div class="playerKey">${k}</div>
          <div class="playerVal">${escapeHtml(v)}</div>
        </div>`
      )
      .join("");
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fillTelegramUser() {
    if (!tg) {
      tgUserLine.textContent =
        "Открой это окно через кнопку в боте — так я пойму, кто ты в Telegram.";
      return;
    }
    const u = (tg.initDataUnsafe && tg.initDataUnsafe.user) || null;
    if (!u) {
      tgUserLine.textContent =
        "Не получилось получить профиль Telegram. Закрой окно и открой снова через бота.";
      return;
    }
    const uname = u.username ? "@" + u.username : "без username";
    tgUserLine.textContent = `Ты в Telegram: ${u.first_name || "Пользователь"} (${uname})`;
  }

  btnStart.addEventListener("click", () => {
    show(stepTag);
    fillTelegramUser();
    setStatus(statusTag, "info", "Введи тег и нажми «Найти».");
    try {
      if (tg) initData = tg.initData || initData || "";
    } catch (_) {}
  });

  btnLookup.addEventListener("click", async () => {
    const tag = normTag(tagInput.value);
    if (!tagLooksValid(tag)) {
      setStatus(statusTag, "bad", "Тег выглядит странно. Проверь и попробуй ещё раз.");
      return;
    }
    setStatus(statusTag, "info", "Ищу игрока…");
    try {
      const data = await api("/api/lookup", { initData, tag });
      lastPlayer = data.player || null;
      selectedTag = tag;
      renderPlayerCard(lastPlayer || {});
      show(stepConfirm);
    } catch (e) {
      setStatus(statusTag, "bad", e.message || "Ошибка.");
    }
  });

  btnNo.addEventListener("click", () => {
    lastPlayer = null;
    selectedTag = "";
    show(stepTag);
    setStatus(statusTag, "info", "Ок, введи другой тег.");
  });

  btnYes.addEventListener("click", () => {
    if (!selectedTag) {
      show(stepTag);
      return;
    }
    show(stepToken);
    tokenInput.value = "";
    setStatus(statusToken, "info", "Введи токен и нажми «Подтвердить».");
  });

  btnVerify.addEventListener("click", async () => {
    const token = (tokenInput.value || "").trim();
    if (token.length < 6) {
      setStatus(statusToken, "bad", "Токен слишком короткий.");
      return;
    }
    setStatus(statusToken, "info", "Проверяю…");
    try {
      const data = await api("/api/verify", { initData, tag: selectedTag, token });
      setStatus(statusToken, "ok", "Готово.");
      show(stepDone);
      const player = (data && data.player) || lastPlayer || null;
      const name = (player && player.name) || "игрок";
      lastPlayer = player;
      renderMeCard(player);
      doneText.innerHTML = `Готово: <b>${escapeHtml(name)}</b> <code>${escapeHtml(selectedTag)}</code>.<br/>Можно закрывать окно — бот уже запомнил привязку.`;
      try {
        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
      } catch (_) {}
    } catch (e) {
      const msg = e.message || "Ошибка.";
      setStatus(
        statusToken,
        "bad",
        msg.includes("истек")
          ? "Похоже, токен уже истёк. Нажми в игре «Авторизационный токен» ещё раз и введи новый."
          : msg
      );
      try {
        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("error");
      } catch (_) {}
    }
  });

  btnClose.addEventListener("click", () => {
    try {
      if (tg) tg.close();
    } catch (_) {}
    // fallback
    window.close();
  });

  btnChange.addEventListener("click", () => {
    show(stepTag);
    fillTelegramUser();
    setStatus(statusTag, "info", "Введи тег и нажми «Найти».");
  });

  async function doUnlink() {
    if (!confirm("Удалить привязку?")) return;
    try {
      await api("/api/unlink", { initData });
      lastPlayer = null;
      selectedTag = "";
      renderMeCard(null);
      show(stepIntro);
    } catch (e) {
      alert(e.message || "Не удалось удалить привязку.");
    }
  }

  btnUnlink.addEventListener("click", doUnlink);

  btnMenu.addEventListener("click", openDrawer);
  backdrop.addEventListener("click", closeDrawer);
  drawerClose.addEventListener("click", closeDrawer);
  drawerMe.addEventListener("click", () => {
    closeDrawer();
    show(stepDone);
  });
  drawerChange.addEventListener("click", () => {
    closeDrawer();
    show(stepTag);
    fillTelegramUser();
    setStatus(statusTag, "info", "Введи тег и нажми «Найти».");
  });
  drawerUnlink.addEventListener("click", async () => {
    closeDrawer();
    await doUnlink();
  });

  // initial
  try {
    if (tg) initData = tg.initData || "";
  } catch (_) {}

  async function boot() {
    setStatus(statusTag, "info", "Нажми «Начать», чтобы привязать аккаунт.");
    if (!tg) return;
    try {
      initData = tg.initData || initData || "";
    } catch (_) {}
    if (!initData) return;
    try {
      const data = await api("/api/me", { initData });
      if (data && data.linked && data.player) {
        const p = data.player;
        const name = p.name || "игрок";
        const tag = p.tag || "";
        lastPlayer = p;
        selectedTag = normTag(tag);
        show(stepDone);
        doneText.innerHTML = `Сейчас привязано: <b>${escapeHtml(name)}</b> <code>${escapeHtml(selectedTag)}</code>.`;
        renderMeCard(p);
      }
    } catch (_) {
      // ignore
    }
  }

  boot();
})();
