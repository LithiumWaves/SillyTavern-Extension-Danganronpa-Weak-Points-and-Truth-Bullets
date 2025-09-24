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
    // --- REPLACE the existing createUI() with this block ---
function createUI() {
  // If already created, return
  if (document.getElementById("dangan-toggle-btn")) return;

  // find send area (used only for positioning the panel)
  const sendArea = findSendArea();

  // Create the floating toggle button (always append to body so it doesn't move ST layout)
  const toggleBtn = document.createElement("button");
  toggleBtn.id = "dangan-toggle-btn";
  toggleBtn.title = "Open Truth Bullets";
  toggleBtn.innerText = "Truth Bullets";

  // Inline styles to avoid relying on CSS file loading/sanitization
  Object.assign(toggleBtn.style, {
    position: "fixed",
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 78px)", // mobile safe area
    right: "12px",
    zIndex: "100000",
    padding: "8px 10px",
    borderRadius: "8px",
    background: "linear-gradient(180deg,#ffec7a,#ffd14a)",
    color: "#000",
    fontWeight: "700",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
    fontSize: "13px",
    touchAction: "manipulation"
  });

  // Append the button to the body (guaranteed visibility)
  document.body.appendChild(toggleBtn);

  // Function to create panel overlay (if not present)
  function buildPanel() {
    if (document.getElementById("dangan-panel")) return;
    const panel = document.createElement("div");
    panel.id = "dangan-panel";
    // fixed so it overlays and never pushes content
    Object.assign(panel.style, {
      position: "fixed",
      display: "none",
      zIndex: "100000",
      maxWidth: "min(96vw, 520px)",
      background: "rgba(14,14,14,0.96)",
      color: "#ddd",
      borderRadius: "10px",
      padding: "10px",
      border: "1px solid #333",
      boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
      fontSize: "13px"
    });

    panel.innerHTML = `
      <div class="d-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <h4 style="margin:0;color:#ffeb7a;font-size:14px;">Dangan Trial — Truth Bullets</h4>
        <div style="display:flex;gap:6px;align-items:center;">
          <button id="dangan-close" style="background:transparent;border:none;color:#888;cursor:pointer;font-weight:700">✕</button>
        </div>
      </div>
      <div id="dangan-bullet-list" style="min-height:40px;"></div>
      <div id="dangan-add-row" style="display:flex;gap:6px;margin-top:8px;">
        <input id="dangan-add-input" placeholder="New bullet name..." style="flex:1;padding:6px;border-radius:6px;border:1px solid #333;background:#111;color:#fff;" />
        <button id="dangan-add-btn" style="padding:6px 8px;border-radius:6px;background:#ffeb7a;border:none;font-weight:700;cursor:pointer;">Add</button>
      </div>
    `;
    document.body.appendChild(panel);

    // Close handler
    const closeBtn = panel.querySelector("#dangan-close");
    if (closeBtn) closeBtn.addEventListener("click", () => { panel.style.display = "none"; });

    // Position the panel relative to the send area (tries to sit above it)
    function positionPanel() {
      try {
        const rect = (sendArea && sendArea.getBoundingClientRect) ? sendArea.getBoundingClientRect() : { top: window.innerHeight - 120, left: 12, width: Math.min(window.innerWidth - 24, 520) };
        // ensure panel has been added to DOM so offsetHeight is available
        panel.style.width = Math.min(rect.width - 8 || Math.min(window.innerWidth - 16, 520), 520) + "px";
        let top = rect.top - panel.offsetHeight - 8;
        if (top < 8) top = 8;
        let left = rect.left + 4;
        if (left + panel.offsetWidth > window.innerWidth - 8) {
          left = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
        }
        panel.style.left = left + "px";
        panel.style.top = top + "px";
        // clear bottom in case earlier fallback set it
        panel.style.bottom = "auto";
      } catch (e) {
        // fallback anchored above safe area
        panel.style.left = "8px";
        panel.style.bottom = "calc(env(safe-area-inset-bottom, 0px) + 64px)";
        panel.style.top = "auto";
      }
    }

    // Expose positionPanel to outer scope by attaching to element (used on toggle)
    panel.__dangan_position = positionPanel;
  }

  // Toggle behavior
  toggleBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    // ensure panel exists
    buildPanel();
    const panel = document.getElementById("dangan-panel");
    if (!panel) return;
    panel.style.display = (panel.style.display === "block") ? "none" : "block";
    if (panel.style.display === "block") {
      // let layout settle then position
      setTimeout(() => { panel.__dangan_position && panel.__dangan_position(); }, 30);
    }
  });

  // reposition on resize/scroll so it stays near send area
  window.addEventListener("resize", () => {
    const p = document.getElementById("dangan-panel");
    if (p && p.style.display === "block") p.__dangan_position && p.__dangan_position();
  });
  window.addEventListener("scroll", () => {
    const p = document.getElementById("dangan-panel");
    if (p && p.style.display === "block") p.__dangan_position && p.__dangan_position();
  });

  // click outside to close panel (but allow clicks inside panel)
  document.addEventListener("pointerdown", (ev) => {
    const p = document.getElementById("dangan-panel");
    const t = document.getElementById("dangan-toggle-btn");
    if (!p || p.style.display !== "block") return;
    if (!p.contains(ev.target) && !t.contains(ev.target)) {
      p.style.display = "none";
    }
  });

  // debug log so you can check mobile console
  console.log("[Dangan Trial] toggle appended to body");
}
// --- end replacement ---


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
