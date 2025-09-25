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
  window.processRenderedMessageElement = processRenderedMessageElement;

  // 🔹 Inject CSS once
  if (!document.getElementById("dangan-style")) {
    const style = document.createElement("style");
    style.id = "dangan-style";
    style.textContent = `
      /* Floating panel */
      .dangan-panel {
        padding: 12px;
        background: #2b2b2b; /* dark grey */
        border: 2px solid #003366; /* dark blue outline */
        border-radius: 50px; /* bullet-like */
        max-height: 70vh;
        overflow-y: auto;
        color: #e0e0e0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.6);
        width: 260px;
      }
      .dangan-panel .d-header h4 {
        margin: 0;
        color: #66aaff;
        text-align: center;
      }

      /* Bullet buttons */
      .dangan-bullet-btn-styled {
        background: #2b2b2b;
        border: 1px solid #003366;
        border-radius: 20px;
        padding: 6px 12px;
        color: #66aaff;
        cursor: pointer;
        margin: 4px;
      }
      .dangan-bullet-btn-styled:disabled {
        color: #777;
        cursor: not-allowed;
        border-color: #444;
      }

      /* Input row */
      #dangan-add-row {
        display: flex;
        gap: 6px;
        align-items: center;
        justify-content: center;
        margin-top: 12px;
      }
      #dangan-add-input {
        flex: 1;
        min-width: 140px;
        background: #1e1e1e;
        border: 1px solid #003366;
        border-radius: 20px;
        padding: 6px 10px;
        color: #e0e0e0;
      }
      #dangan-add-btn {
        background: #2b2b2b;
        border: 1px solid #003366;
        border-radius: 20px;
        padding: 6px 12px;
        color: #66aaff;
        cursor: pointer;
      }

/* Weak Point highlights */
.dangan-weak-highlight {
  color: #ffff66; /* bright yellow */
  background: transparent;
  font-weight: 700;
  cursor: pointer;
  text-shadow: 0 0 6px rgba(255, 255, 0, 0.8);
  transition: text-shadow 0.2s, color 0.2s;
}

.dangan-weak-highlight:hover {
  color: #ffffff;
  text-shadow: 0 0 10px rgba(255, 255, 0, 1),
               0 0 20px rgba(255, 255, 100, 0.8);
}

    `;
    document.head.appendChild(style);
  }

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

  const defaultSettings = { bullets: [] };

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
        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        wrapper.style.gap = "6px";
        wrapper.style.margin = "4px 0";

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

        wrapper.appendChild(btn);

        if (b.used) {
          const removeBtn = document.createElement("button");
          removeBtn.textContent = "✖";
          removeBtn.style.background = "transparent";
          removeBtn.style.border = "none";
          removeBtn.style.color = "#f55";
          removeBtn.style.cursor = "pointer";
          removeBtn.style.fontWeight = "bold";

          removeBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            s.bullets.splice(idx, 1);
            saveSettingsDebounced();
            renderPanelContents(container);
          });

          wrapper.appendChild(removeBtn);
        }

        listEl.appendChild(wrapper);
      });
    }

    const addBtn = container.querySelector("#dangan-add-btn");
    const addInput = container.querySelector("#dangan-add-input");
    if (addBtn && addInput) {
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

  // 🔹 Inline highlight replacement
  function processRenderedMessageElement(el) {
    if (!el || el.dataset?.danganProcessed) return;
    const inner = el.innerHTML || "";
    if (!inner.includes("[WeakPoint:")) {
      el.dataset.danganProcessed = "true";
      return;
    }
    const replaced = inner.replace(/\[WeakPoint:(.*?)\]/g, (m, p1) => {
      const desc = p1.trim().replace(/"/g, "&quot;");
      return `<span class="dangan-weak-highlight" data-wp="${desc}">${desc}</span>`;
    });
    try { el.innerHTML = replaced; } catch (e) {
      console.warn("[Dangan Trial] failed to replace WP token", e);
    }
    el.dataset.danganProcessed = "true";
  }

  // 🔹 Click handler for highlights
  function handleWeakClick(ev) {
    const btn = ev.target.closest(".dangan-weak-highlight");
    if (!btn) return;
    const desc = btn.getAttribute("data-wp") || btn.textContent || "Unknown";

    document.querySelectorAll(".dangan-weak-menu-floating").forEach((x) => x.remove());

    const menu = document.createElement("div");
    menu.className = "dangan-weak-menu-floating dangan-panel";
    menu.innerHTML = `<div style="color:#66aaff;font-weight:700;margin-bottom:6px;">Weak Point: ${desc}</div>
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
        bbtn.className = "dangan-bullet-btn dangan-bullet-btn-styled";
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
    menu.style.position = "fixed";
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

  function patchWandMenu() {
    const menu = document.querySelector("#extensionsMenu");
    if (!menu) {
      console.warn("[Dangan Trial] Wand menu not found, retrying...");
      setTimeout(patchWandMenu, 1000);
      return;
    }
    if (document.getElementById("dangan_wand_container")) return;

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

    if (document.getElementById("dangan-panel-container")) return;
    const panel = document.createElement("div");
    panel.id = "dangan-panel-container";
    panel.className = "dangan-panel";
    panel.style.display = "none";

    panel.innerHTML = `
      <div class="d-header"><h4>Dangan Trial — Truth Bullets</h4></div>
      <div id="dangan-bullet-list"></div>
      <div id="dangan-add-row">
        <input id="dangan-add-input" placeholder="New bullet name..." />
        <button id="dangan-add-btn">Add</button>
      </div>
    `;

    panel.addEventListener("click", (e) => e.stopPropagation());
    document.body.appendChild(panel);

    function showHidePanel() {
      const visible = panel.style.display === "block";
      if (visible) {
        panel.style.display = "none";
        return;
      }
      renderPanelContents(panel);
      panel.style.visibility = "hidden";
      panel.style.display = "block";

      requestAnimationFrame(() => {
        const rect = entry.getBoundingClientRect();
        const pad = 8;
        const pw = Math.min(panel.offsetWidth || 260, Math.min(window.innerWidth - 16, 320));
        panel.style.width = pw + "px";

        let left = rect.right + pad;
        if (left + pw > window.innerWidth - 8) left = rect.left - pw - pad;
        left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));

        let top = rect.top;
        if (top + panel.offsetHeight > window.innerHeight - 8) {
          top = Math.max(8, window.innerHeight - panel.offsetHeight - 8);
        }
        panel.style.left = Math.round(left) + "px";
        panel.style.top = Math.round(top) + "px";
        panel.style.visibility = "visible";
      });
    }

    entry.addEventListener("click", (ev) => {
      ev.stopPropagation();
      showHidePanel();
    });

    document.addEventListener("mousedown", (e) => {
      if (!panel.contains(e.target) && e.target !== entry) {
        panel.style.display = "none";
      }
    });

    window.addEventListener("resize", () => {
      if (panel.style.display === "block") {
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

    console.log("[Dangan Trial] Wand entry injected (floating panel beside wand)");
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
      if (ev.target && ev.target.matches && ev.target.matches(".dangan-weak-highlight")) {
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

  console.log("[Dangan Trial] Wand Menu beside/floating panel loaded with CSS styling");
})();
