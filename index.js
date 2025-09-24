// Dangan Trial (Toggle UI) - SillyTavern extension (index.js)
(async () => {
  // Wait for SillyTavern context
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
  const { eventSource, event_types, extensionSettings, saveSettingsDebounced, chatMetadata, saveMetadata } = ctx;

  const MODULE_KEY = "dangan_trial_toggle";

  // default settings skeleton
  const defaultSettings = {
    bullets: [], // { name: string, used: boolean }
    panelOpen: false
  };

  function ensureSettings() {
    if (!extensionSettings[MODULE_KEY]) {
      extensionSettings[MODULE_KEY] = structuredClone(defaultSettings);
      saveSettingsDebounced();
    } else {
      // ensure keys exist when extension updates
      for (const k of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(extensionSettings[MODULE_KEY], k)) {
          extensionSettings[MODULE_KEY][k] = defaultSettings[k];
        }
      }
    }
    return extensionSettings[MODULE_KEY];
  }

  // Utility: find best chat input parent and send-area wrapper
  function findSendArea() {
    const possible = [
      ".chat-input",
      "#chat-input",
      ".send-area",
      ".input-area",
      ".composer",
      "#message-form",
      ".bottom-controls"
    ];
    for (const sel of possible) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    const ta = document.querySelector("textarea, input[type='text']");
    if (ta && ta.parentElement) return ta.parentElement;
    return document.body;
  }

  // --- NEW createUI (mobile-safe) ---
  function createUI() {
    if (document.getElementById("dangan-toggle-btn")) return;

    // --- Toggle button ---
    const toggleBtn = document.createElement("button");
    toggleBtn.id = "dangan-toggle-btn";
    toggleBtn.title = "Open Truth Bullets";
    toggleBtn.innerText = "Truth Bullets";
    document.body.appendChild(toggleBtn); // always float on body

    // --- Panel ---
    const panel = document.createElement("div");
    panel.id = "dangan-panel";
    panel.style.display = "none";
    panel.innerHTML = `
      <div class="d-header">
        <h4>Dangan Trial — Truth Bullets</h4>
        <div style="display:flex;gap:6px;align-items:center;">
          <button id="dangan-close" style="background:transparent;border:none;color:#888;cursor:pointer;font-weight:700">✕</button>
        </div>
      </div>
      <div id="dangan-bullet-list"></div>
      <div id="dangan-add-row">
        <input id="dangan-add-input" placeholder="New bullet name..." />
        <button id="dangan-add-btn">Add</button>
      </div>
    `;
    document.body.appendChild(panel);

    // --- Toggle click ---
    toggleBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const isOpen = panel.style.display === "block";
      if (isOpen) {
        panel.style.display = "none";
      } else {
        panel.style.display = "block";
        void panel.offsetHeight; // reflow
        positionPanel();
      }
    });

    // --- Close button ---
    panel.querySelector("#dangan-close").addEventListener("click", () => {
      panel.style.display = "none";
    });

    // --- Close when clicking outside ---
    document.addEventListener("click", (ev) => {
      if (!panel.contains(ev.target) && ev.target !== toggleBtn) {
        panel.style.display = "none";
      }
    });
  }

  // --- NEW positionPanel ---
  function positionPanel() {
    const panelEl = document.getElementById("dangan-panel");
    const sendArea = findSendArea();
    if (!panelEl || !sendArea) return;

    const rect = sendArea.getBoundingClientRect();
    const panelWidth = Math.min(window.innerWidth - 16, 320);

    panelEl.style.width = panelWidth + "px";
    panelEl.style.left = Math.max(8, rect.right - panelWidth) + "px";
    let top = rect.top - panelEl.offsetHeight - 8;
    if (top < 8) top = 8;
    panelEl.style.top = top + "px";
  }

  // Reposition on resize
  window.addEventListener("resize", () => {
    const panelEl = document.getElementById("dangan-panel");
    if (panelEl && panelEl.style.display === "block") {
      positionPanel();
    }
  });

  // --- rest of your code unchanged (renderPanelContents, weakpoint handling, etc) ---
  function renderPanelContents() {
    ensureSettings();
    const s = extensionSettings[MODULE_KEY];
    const listEl = document.getElementById("dangan-bullet-list");
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
          const selectors = ["textarea", "textarea.input-message", "input[type=text]", "#message", ".chat-input textarea"];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
              el.focus();
              try { el.value = `I use Truth Bullet: ${b.name} — `; } catch(e) {}
              el.dispatchEvent(new Event('input', { bubbles: true }));
              break;
            }
          }
          s.bullets[idx].used = true;
          saveSettingsDebounced();
          renderPanelContents();

          const md = SillyTavern.getContext().chatMetadata;
          md['dangan_last_fired'] = { bullet: b.name, time: Date.now() };
          saveMetadata();
        });
        listEl.appendChild(btn);
      });
    }

    const addBtn = document.getElementById("dangan-add-btn");
    const addInput = document.getElementById("dangan-add-input");
    if (addBtn && addInput) {
      addBtn.onclick = () => {
        const v = (addInput.value || "").trim();
        if (!v) return;
        s.bullets.push({ name: v, used: false });
        saveSettingsDebounced();
        addInput.value = "";
        renderPanelContents();
      };
      addInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addBtn.click();
      });
    }
  }

  // (rest of your weakpoint code untouched...)

  // wire listeners and initialization
  function setupExtension() {
    createUI();
    renderPanelContents();

    document.querySelectorAll(".mes_text, .message .text, .character-message .mes_text").forEach(processRenderedMessageElement);

    const chatRoot = document.querySelector("#chat") || document.body;
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          m.addedNodes.forEach(n => {
            if (n.nodeType === 1) {
              n.querySelectorAll && n.querySelectorAll(".mes_text, .message .text, .character-message .mes_text").forEach(processRenderedMessageElement);
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

    eventSource.on(event_types.APP_READY, () => {
      createUI();
      renderPanelContents();
    });

    eventSource.on(event_types.MESSAGE_SENT, (payload) => {
      try {
        const msg = payload?.message || (payload && payload.content) || "";
        const m = /I use Truth Bullet:\s*([^—\n\r]+)/i.exec(msg);
        if (m) {
          const name = m[1].trim();
          const s = ensureSettings();
          const idx = s.bullets.findIndex(b => b.name.toLowerCase() === name.toLowerCase() && !b.used);
          if (idx >= 0) {
            s.bullets[idx].used = true;
            saveSettingsDebounced();
            renderPanelContents();
          }
          const md = SillyTavern.getContext().chatMetadata;
          md['dangan_last_fired'] = { bullet: name, time: Date.now() };
          saveMetadata();
        }
      } catch (err) {
        console.warn("[Dangan Trial] MESSAGE_SENT handler error:", err);
      }
    });
  }

  // Initialize in short delay
  setTimeout(() => {
    ensureSettings();
    setupExtension();
  }, 300);

  console.log("[Dangan Trial] Toggle UI extension loaded");
})();
