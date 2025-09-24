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

  // Utility: find best chat input parent and send-area wrapper to attach toggle button nearby
  function findSendArea() {
    // try a variety of common selectors; fallback to body
    const possible = [
      ".chat-input",        // common container
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
    // try to find a visible textarea and use its parent
    const ta = document.querySelector("textarea, input[type='text']");
    if (ta && ta.parentElement) return ta.parentElement;
    return document.body;
  }

  // Create toggle button and panel DOM (only once)
  function createUI() {
    // prevent duplicate
    if (document.getElementById("dangan-toggle-btn")) return;

    const sendArea = findSendArea();
    // Create toggle
    const toggleBtn = document.createElement("button");
    toggleBtn.id = "dangan-toggle-btn";
    toggleBtn.title = "Open Truth Bullets";
    toggleBtn.innerText = "Truth Bullets";
    // style class may be present from CSS file

    // Attach toggle next to send area in a non-invasive way
    try {
      // Prefer appending to the sendArea but not inside main controls that would resize
      sendArea.appendChild(toggleBtn);
    } catch (err) {
      // fallback to body
      document.body.appendChild(toggleBtn);
    }

    // Panel overlay - absolute placed relative to the viewport; we'll position it above the send area
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

    // Positioning helper: place panel above the send area, centered-ish
    function positionPanel() {
      try {
        const rect = sendArea.getBoundingClientRect();
        // place above the send area; respect viewport
        const panelEl = document.getElementById("dangan-panel");
        const panelWidth = Math.min(window.innerWidth - 16, 520);
        panelEl.style.width = Math.min(rect.width - 8 || panelWidth, panelWidth) + "px";
        // prefer bottom: set absolute top
        let top = rect.top - panelEl.offsetHeight - 8;
        if (top < 8) top = 8;
        // set left near send area left
        let left = rect.left + 4;
        if (left + panelEl.offsetWidth > window.innerWidth - 8) {
          left = Math.max(8, window.innerWidth - panelEl.offsetWidth - 8);
        }
        panelEl.style.left = left + "px";
        panelEl.style.top = top + "px";
      } catch (e) {
        // fallback to anchored bottom-left
        const panelEl = document.getElementById("dangan-panel");
        panelEl.style.left = "8px";
        panelEl.style.bottom = "64px";
      }
    }

    // Toggle logic
    toggleBtn.addEventListener("click", (ev) => {
  ev.stopPropagation();
  const panelEl = document.getElementById("dangan-panel");
  const isOpen = panelEl.style.display === "block";
  if (isOpen) {
    panelEl.style.display = "none";
  } else {
    panelEl.style.display = "block";
    // Force a reflow so offsetHeight is valid
    void panelEl.offsetHeight;
    positionPanel();
  }
});
    // Close button
    panel.querySelector("#dangan-close").addEventListener("click", () => {
      document.getElementById("dangan-panel").style.display = "none";
    });

    // reposition on resize/scroll
    window.addEventListener("resize", () => {
      const p = document.getElementById("dangan-panel");
      if (p && p.style.display === "block") positionPanel();
    });
    window.addEventListener("scroll", () => {
      const p = document.getElementById("dangan-panel");
      if (p && p.style.display === "block") positionPanel();
    });

    // click outside to close (but let panel clicks pass)
    document.addEventListener("mousedown", (ev) => {
      const p = document.getElementById("dangan-panel");
      const t = document.getElementById("dangan-toggle-btn");
      if (!p || !t) return;
      if (p.style.display !== "block") return;
      if (!p.contains(ev.target) && !t.contains(ev.target)) {
        p.style.display = "none";
      }
    });
  }

  // Render the bullets list inside the panel
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
        if (b.used) { btn.classList.add("used"); btn.disabled = true; btn.textContent = `(used) ${b.name}`; }
        else btn.textContent = b.name;
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (b.used) return;
          // Prefill chat input
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
          // mark used locally
          s.bullets[idx].used = true;
          saveSettingsDebounced();
          renderPanelContents();

          // record metadata for LLM reference
          const md = SillyTavern.getContext().chatMetadata;
          md['dangan_last_fired'] = { bullet: b.name, time: Date.now() };
          saveMetadata();
        });
        listEl.appendChild(btn);
      });
    }

    // add handlers for add row
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

  // Replace [WeakPoint: ...] tokens in character messages with styled buttons
  function processRenderedMessageElement(el) {
    if (!el || el.dataset?.danganProcessed) return;
    const inner = el.innerHTML || "";
    if (!inner.includes("[WeakPoint:")) {
      el.dataset.danganProcessed = "true";
      return;
    }
    const replaced = inner.replace(/\[WeakPoint:(.*?)\]/g, (m, p1) => {
      const desc = p1.trim().replace(/"/g, '&quot;');
      return `<button class="dangan-weak-btn" data-wp="${desc}">Weak Point: ${desc}</button>`;
    });
    try {
      el.innerHTML = replaced;
    } catch (e) {
      console.warn("[Dangan Trial] failed to replace WP token", e);
    }
    el.dataset.danganProcessed = "true";
  }

  // Handle click on a Weak Point button in chat -- open floating menu with bullets
  function handleWeakClick(ev) {
    const btn = ev.target.closest(".dangan-weak-btn");
    if (!btn) return;
    const desc = btn.getAttribute("data-wp") || btn.textContent || "Unknown";

    // remove existing menus
    document.querySelectorAll(".dangan-weak-menu-floating").forEach(x => x.remove());

    const menu = document.createElement("div");
    menu.className = "dangan-weak-menu-floating";
    menu.innerHTML = `<div style="color:#ffeb7a;font-weight:700;margin-bottom:6px;">Weak Point: ${desc}</div><div id="dangan-menu-bullets" style="display:flex;flex-wrap:wrap;gap:6px;"></div><div style="margin-top:6px;color:#aaa;font-size:12px;">Click a bullet to use it against this Weak Point.</div>`;
    document.body.appendChild(menu);

    // fill bullets
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
          // Prefill input
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
          // mark used
          s.bullets[idx].used = true;
          saveSettingsDebounced();
          renderPanelContents();

          // set metadata recording targeted WP and fired bullet
          const md = SillyTavern.getContext().chatMetadata;
          md['dangan_last_target'] = { weakPoint: desc, bullet: b.name, ts: Date.now() };
          saveMetadata();

          // remove menu
          menu.remove();
        });
        menuList.appendChild(bbtn);
      });
    }

    // position menu near button (use bounding rect)
    const rect = btn.getBoundingClientRect();
    const menuWidth = Math.min(320, window.innerWidth - 24);
    menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)) + "px";
    menu.style.top = (rect.bottom + 8) + "px";

    // close menu on outside click
    const off = (e) => {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.remove();
        window.removeEventListener("mousedown", off);
      }
    };
    window.addEventListener("mousedown", off);
  }

  // wire listeners and initialization
  function setupExtension() {
    createUI();
    renderPanelContents();

    // initial pass over existing messages
    document.querySelectorAll(".mes_text, .message .text, .character-message .mes_text").forEach(processRenderedMessageElement);

    // observe message container for new messages
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

    // global click delegation for Weak Point buttons
    document.addEventListener("click", (ev) => {
      if (ev.target && ev.target.matches && ev.target.matches(".dangan-weak-btn")) {
        handleWeakClick(ev);
      }
    });

    // listen to ST events so we can re-create UI if app changes/draws
    eventSource.on(event_types.APP_READY, () => {
      // Ensure UI exists after app is ready
      createUI();
      renderPanelContents();
    });

    // When user sends a message, check for typed "I use Truth Bullet:" and mark bullets used
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
