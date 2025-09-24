// Dangan Trial (Manual Wand Menu Patch) - SillyTavern extension (index.js)
(async () => {
  function waitForST() {
    return new Promise((resolve) => {
      if (window.SillyTavern && SillyTavern.getContext) return resolve();
      const t = setInterval(() => {
        if (window.SillyTavern && SillyTavern.getContext) {
          clearInterval(t);
          resolve();
        }
      }, 120);
    });
  }
  await waitForST();

  const ctx = SillyTavern.getContext();
  const {
    eventSource,
    event_types,
    extensionSettings,
    saveSettingsDebounced,
    chatMetadata,
    saveMetadata,
  } = ctx;

  const MODULE_KEY = "dangan_trial_toggle";

  const defaultSettings = {
    bullets: [],
  };

  function ensureSettings() {
    if (!extensionSettings[MODULE_KEY]) {
      extensionSettings[MODULE_KEY] = structuredClone(defaultSettings);
      saveSettingsDebounced();
    } else {
      for (const k of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(extensionSettings[MODULE_KEY], k)) {
          extensionSettings[MODULE_KEY][k] = defaultSettings[k];
        }
      }
    }
    return extensionSettings[MODULE_KEY];
  }

  function renderPanelContents(container) {
    ensureSettings();
    const s = extensionSettings[MODULE_KEY];
    const listEl = container.querySelector("#dangan-bullet-list");
    if (!listEl) return;

    listEl.innerHTML = "";
    if (!s.bullets.length) {
      listEl.innerHTML = `<div style="color:#aaa;padding:8px 2px;">No Truth Bullets. Add one below.</div>`;
    } else {
      s.bullets.forEach((b, idx) => {
        const btn = document.createElement("button");
        btn.className = "dangan-bullet-btn";
        if (b.used) {
          btn.classList.add("used");
          btn.disabled = true;
          btn.textContent = `(used) ${b.name}`;
        } else btn.textContent = b.name;

        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (b.used) return;
          const selectors = [
            "textarea",
            "textarea.input-message",
            "input[type=text]",
            "#message",
            ".chat-input textarea",
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
              el.focus();
              try { el.value = `I use Truth Bullet: ${b.name} — `; } catch (e) {}
              el.dispatchEvent(new Event("input", { bubbles: true }));
              break;
            }
          }
          s.bullets[idx].used = true;
          saveSettingsDebounced();
          renderPanelContents(container);

          const md = SillyTavern.getContext().chatMetadata;
          md["dangan_last_fired"] = { bullet: b.name, time: Date.now() };
          saveMetadata();
        });
        listEl.appendChild(btn);
      });
    }

    const addBtn = container.querySelector("#dangan-add-btn");
    const addInput = container.querySelector("#dangan-add-input");
    if (addBtn && addInput) {
      // prevent wand collapse when interacting
      addBtn.addEventListener("click", (ev) => ev.stopPropagation());
      addInput.addEventListener("click", (ev) => ev.stopPropagation());
      addInput.addEventListener("keydown", (ev) => ev.stopPropagation());

      addBtn.onclick = () => {
        const v = (addInput.value || "").trim();
        if (!v) return;
        s.bullets.push({ name: v, used: false });
        saveSettingsDebounced();
        addInput.value = "";
        renderPanelContents(container);
      };
      addInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addBtn.click();
      });
    }
  }

  function processRenderedMessageElement(el) {
    if (!el || el.dataset?.danganProcessed) return;
    const inner = el.innerHTML || "";
    if (!inner.includes("[WeakPoint:")) {
      el.dataset.danganProcessed = "true";
      return;
    }
    const replaced = inner.replace(/\[WeakPoint:(.*?)\]/g, (m, p1) => {
      const desc = p1.trim().replace(/"/g, "&quot;");
      return `<button class="dangan-weak-btn" data-wp="${desc}">Weak Point: ${desc}</button>`;
    });
    try { el.innerHTML = replaced; } catch (e) {
      console.warn("[Dangan Trial] failed to replace WP token", e);
    }
    el.dataset.danganProcessed = "true";
  }

  function handleWeakClick(ev) {
    const btn = ev.target.closest(".dangan-weak-btn");
    if (!btn) return;
    const desc = btn.getAttribute("data-wp") || btn.textContent || "Unknown";

    document.querySelectorAll(".dangan-weak-menu-floating").forEach((x) => x.remove());

    const menu = document.createElement("div");
    menu.className = "dangan-weak-menu-floating";
    menu.innerHTML = `<div style="color:#ffeb7a;font-weight:700;margin-bottom:6px;">Weak Point: ${desc}</div>
      <div id="dangan-menu-bullets" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
      <div style="margin-top:6px;color:#aaa;font-size:12px;">Click a bullet to use it against this Weak Point.</div>`;
    document.body.appendChild(menu);

    const menuList = menu.querySelector("#dangan-menu-bullets");
    const s = ensureSettings();
    if (!s.bullets.length) {
      menuList.innerHTML = `<div style="color:#bbb">No bullets available. Open Truth Bullets panel to add.</div>`;
    } else {
      s.bullets.forEach((b, idx) => {
        const bbtn = document.createElement("button");
        bbtn.className = "dangan-bullet-btn";
        bbtn.textContent = b.used ? `(used) ${b.name}` : b.name;
        if (b.used) bbtn.disabled = true;
        bbtn.addEventListener("click", (ev2) => {
          ev2.stopPropagation();
          if (b.used) return;

          const selectors = [
            "textarea",
            "textarea.input-message",
            "input[type=text]",
            "#message",
            ".chat-input textarea",
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
              el.focus();
              try { el.value = `I use Truth Bullet: ${b.name} — `; } catch (e) {}
              el.dispatchEvent(new Event("input", { bubbles: true }));
              break;
            }
          }
          s.bullets[idx].used = true;
          saveSettingsDebounced();
          const cont = document.querySelector("#dangan-panel-container");
          if (cont) renderPanelContents(cont);

          const md = SillyTavern.getContext().chatMetadata;
          md["dangan_last_target"] = { weakPoint: desc, bullet: b.name, ts: Date.now() };
          saveMetadata();

          menu.remove();
        });
        menuList.appendChild(bbtn);
      });
    }

    const rect = btn.getBoundingClientRect();
    const menuWidth = Math.min(320, window.innerWidth - 24);
    menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)) + "px";
    menu.style.top = rect.bottom + 8 + "px";

    const off = (e) => {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.remove();
        window.removeEventListener("mousedown", off);
      }
    };
    window.addEventListener("mousedown", off);
  }

  // NEW: floating panel placed next to wand entry (appended to body)
  function patchWandMenu() {
    const menu = document.querySelector("#extensionsMenu");
    if (!menu) {
      console.warn("[Dangan Trial] Wand menu not found, retrying...");
      setTimeout(patchWandMenu, 1000);
      return;
    }
    if (document.getElementById("dangan_wand_container")) return;

    // create wand entry inside menu (so it appears with other items)
    const container = document.createElement("div");
    container.id = "dangan_wand_container";
    container.className = "extension_container interactable";
    container.tabIndex = 0;

    const entry = document.createElement("div");
    entry.id = "dangan_wand_btn";
    entry.className = "list-group-item flex-container flexGap5 interactable";
    entry.title = "Manage Truth Bullets";
    entry.innerHTML = `<span style="font-size:1.2em">💥</span> Truth Bullets`;

    container.appendChild(entry);
    menu.appendChild(container);

    // create floating panel appended to body (not inside menu) so it's never clipped
    if (document.getElementById("dangan-panel-container")) {
      // if already present, reuse
      return;
    }
    const panel = document.createElement("div");
    panel.id = "dangan-panel-container";
    panel.style.display = "none";
    panel.style.position = "fixed";
    panel.style.background = "#fffbe8";
    panel.style.border = "2px solid #ffd14a";
    panel.style.borderRadius = "6px";
    panel.style.padding = "8px";
    panel.style.maxHeight = "70vh";
    panel.style.overflowY = "auto";
    panel.style.boxShadow = "0 6px 18px rgba(0,0,0,0.25)";
    panel.style.zIndex = "100000";
    panel.style.width = "260px";

    panel.innerHTML = `
      <div class="d-header">
        <h4 style="margin:0;">Dangan Trial — Truth Bullets</h4>
      </div>
      <div id="dangan-bullet-list" style="margin-top:6px;"></div>
      <div id="dangan-add-row" style="margin-top:8px;display:flex;gap:4px;">
        <input id="dangan-add-input" placeholder="New bullet name..." style="flex:1;" />
        <button id="dangan-add-btn">Add</button>
      </div>
    `;

    // prevent clicks inside from closing (we'll close on outside clicks)
    panel.addEventListener("click", (e) => e.stopPropagation());

    document.body.appendChild(panel);

    // toggling & positioning
    function showHidePanel() {
      const visible = panel.style.display === "block";
      if (visible) {
        panel.style.display = "none";
        return;
      }
      // render contents then position
      renderPanelContents(panel);
      panel.style.visibility = "hidden";
      panel.style.display = "block";

      // ensure width is set (already 260px) — compute position based on entry rect
      requestAnimationFrame(() => {
        const rect = entry.getBoundingClientRect();
        const pad = 8;
        const pw = Math.min(panel.offsetWidth || 260, Math.min(window.innerWidth - 16, 320));
        panel.style.width = pw + "px";

        // prefer right
        let left = rect.right + pad;
        if (left + pw > window.innerWidth - 8) {
          // not enough space on right -> place to the left of entry
          left = rect.left - pw - pad;
        }
        // clamp into viewport
        left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));

        // top: try align top of entry, but clamp to viewport
        let top = rect.top;
        if (top + panel.offsetHeight > window.innerHeight - 8) {
          top = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
        }
        top = Math.max(8, top);

        panel.style.left = Math.round(left) + "px";
        panel.style.top = Math.round(top) + "px";
        panel.style.visibility = "visible";
      });
    }

    entry.addEventListener("click", (ev) => {
      ev.stopPropagation();
      showHidePanel();
    });

    // close on outside click
    const outsideClose = (e) => {
      if (!panel.contains(e.target) && e.target !== entry) {
        panel.style.display = "none";
      }
    };
    document.addEventListener("mousedown", outsideClose);

    // reposition on resize
    window.addEventListener("resize", () => {
      if (panel.style.display === "block") {
        // reposition relative to entry
        const rect = entry.getBoundingClientRect();
        const pw = Math.min(panel.offsetWidth || 260, Math.min(window.innerWidth - 16, 320));
        let left = rect.right + 8;
        if (left + pw > window.innerWidth - 8) left = rect.left - pw - 8;
        left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
        let top = rect.top;
        if (top + panel.offsetHeight > window.innerHeight - 8) top = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
        panel.style.left = Math.round(left) + "px";
        panel.style.top = Math.round(top) + "px";
      }
    });

    console.log("[Dangan Trial] Wand entry injected (floating panel appended to body)");
  }

  function setupExtension() {
    patchWandMenu();

    document.querySelectorAll(".mes_text, .message .text, .character-message .mes_text")
      .forEach(processRenderedMessageElement);

    const chatRoot = document.querySelector("#chat") || document.body;
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === 1) {
              n.querySelectorAll &&
                n.querySelectorAll(".mes_text, .message .text, .character-message .mes_text")
                  .forEach(processRenderedMessageElement);
            }
          });
        }
      }
    });
    mo.observe(chatRoot, { childList: true, subtree: true });

    document.addEventListener("click", (ev) => {
      if (ev.target && ev.target.matches && ev.target.matches(".dangan-weak-btn")) {
        handleWeakClick(ev);
      }
    });

    eventSource.on(event_types.MESSAGE_SENT, (payload) => {
      try {
        const msg = payload?.message || (payload && payload.content) || "";
        const m = /I use Truth Bullet:\s*([^—\n\r]+)/i.exec(msg);
        if (m) {
          const name = m[1].trim();
          const s = ensureSettings();
          const idx = s.bullets.findIndex(
            (b) => b.name.toLowerCase() === name.toLowerCase() && !b.used
          );
          if (idx >= 0) {
            s.bullets[idx].used = true;
            saveSettingsDebounced();
          }
          const md = SillyTavern.getContext().chatMetadata;
          md["dangan_last_fired"] = { bullet: name, time: Date.now() };
          saveMetadata();
        }
      } catch (err) {
        console.warn("[Dangan Trial] MESSAGE_SENT handler error:", err);
      }
    });
  }

  setTimeout(() => {
    ensureSettings();
    setupExtension();
  }, 500);

  console.log("[Dangan Trial] Wand Menu beside/floating panel loaded");
})();
