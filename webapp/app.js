(() => {
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  try {
    if (tg) {
      tg.ready();
      tg.expand();
      tg.enableClosingConfirmation();
      if (tg.setHeaderColor) tg.setHeaderColor("#0f1115");
      if (tg.setBackgroundColor) tg.setBackgroundColor("#0f1115");
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
    const dotClass = type === "ok" ? "ok" : type === "bad" ? "bad" : "";
    const label =
      type === "ok" ? "Готово" : type === "bad" ? "Ошибка" : "Проверяю";
    el.innerHTML = `
      <span class="pill"><span class="dot ${dotClass}"></span>${label}</span>
      <span>${text || ""}</span>
    `;
  }

  async function api(path, payload) {
    try {
      if (!initData && tg) initData = tg.initData || "";
    } catch (_) {}
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
      setStatus(statusTag, "bad", "Похоже, тег введён неверно.");
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
      const name = (data && data.player && data.player.name) || (lastPlayer && lastPlayer.name) || "игрок";
      doneText.innerHTML = `Привязка выполнена: <b>${escapeHtml(name)}</b> <code>${escapeHtml(selectedTag)}</code>.<br/>Теперь можешь закрыть окно и пользоваться ботом.`;
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

  // initial
  try {
    if (tg) initData = tg.initData || "";
  } catch (_) {}

  async function boot() {
    setStatus(statusTag, "info", "Нажми «Далее», чтобы начать.");
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
        doneText.innerHTML = `Уже привязано: <b>${escapeHtml(name)}</b> <code>${escapeHtml(selectedTag)}</code>.<br/>Если нужно — можешь изменить привязку.`;
      }
    } catch (_) {
      // ignore
    }
  }

  boot();
})();
