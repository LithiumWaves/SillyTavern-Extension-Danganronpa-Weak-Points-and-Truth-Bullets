// Dangan Trial - SillyTavern extension
// index.js

(async function () {
  // Wait for SillyTavern global to exist
  function waitForST() {
    return new Promise((resolve) => {
      if (window.SillyTavern && SillyTavern.getContext) return resolve();
      const t = setInterval(() => {
        if (window.SillyTavern && SillyTavern.getContext) {
          clearInterval(t);
          resolve();
        }
      }, 100);
      // safety timeout not necessary but could be added
    });
  }

  await waitForST();

  const ctx = SillyTavern.getContext();
  const { eventSource, event_types, extensionSettings, saveSettingsDebounced, chatMetadata, saveMetadata } = ctx;

  // Unique key for extension settings
  const MODULE_KEY = "dangan_trial";
  const defaultSettings = Object.freeze({
    bullets: [], // { name: string, used: boolean }
    panelVisible: true
  });

  function getSettings() {
    if (!extensionSettings[MODULE_KEY]) {
      extensionSettings[MODULE_KEY] = structuredClone(defaultSettings);
      saveSettingsDebounced();
    }
    // ensure keys exist when updating extension
    for (const k of Object.keys(defaultSettings)) {
      if (!Object.hasOwn(extensionSettings[MODULE_KEY], k)) {
        extensionSettings[MODULE_KEY][k] = defaultSettings[k];
      }
    }
    return extensionSettings[MODULE_KEY];
  }

  // Render the Truth Bullets panel into the extension area (sidebar)
  function renderPanel() {
    const settings = getSettings();
    // Insert container if not present
    let container = document.querySelector("#dangan-panel-root");
    if (!container) {
      container = document.createElement("div");
      container.id = "dangan-panel-root";
      container.className = "dangan-panel";
      // Try to find a sensible place: extensions panel or right sidebar
      const extArea = document.querySelector("#extensions-panel") || document.querySelector("#right-sidebar") || document.body;
      extArea.prepend(container);
    }
    container.innerHTML = `
      <h3>Dangan Trial — Truth Bullets</h3>
      <div id="dangan-bullet-list" style="min-height: 32px;"></div>
      <div style="margin-top:6px;">
        <input id="dangan-add-input" placeholder="New bullet name..." style="width:70%;padding:4px;" />
        <button id="dangan-add-btn" style="padding:4px 6px;margin-left:6px;">Add</button>
      </div>
      <div style="margin-top:8px;font-size:12px;color:#bbb">Click a bullet to prefill the chat input and mark it used.</div>
    `;
    // attach handlers
    const addBtn = container.querySelector("#dangan-add-btn");
    const addInput = container.querySelector("#dangan-add-input");
    addBtn.onclick = () => {
      const v = (addInput.value || "").trim();
      if (!v) return;
      settings.bullets.push({ name: v, used: false });
      saveSettingsDebounced();
      addInput.value = "";
      renderPanel();
    };

    // render bullets
    const list = container.querySelector("#dangan-bullet-list");
    list.innerHTML = "";
    settings.bullets.forEach((b, idx) => {
      const btn = document.createElement("button");
      btn.className = "dangan-bullet-btn";
      if (b.used) { btn.disabled = true; btn.textContent = `(used) ${b.name}`; }
      else btn.textContent = b.name;
      btn.onclick = (ev) => {
        ev.stopPropagation();
        if (settings.bullets[idx].used) return;
        // Prefill chat input reliably (try common selectors)
        const selectors = [
          "textarea",
          "textarea.input-message",
          "input[type=text]",
          "#message",
          ".chat-input textarea"
        ];
        let found = false;
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            el.focus();
            try { el.value = `I use Truth Bullet: ${b.name} — `; } catch(e) {}
            // Try to trigger input event so ST notices change
            el.dispatchEvent(new Event('input', { bubbles: true }));
            found = true;
            break;
          }
        }
        // Mark used in settings and save
        settings.bullets[idx].used = true;
        saveSettingsDebounced();
        renderPanel();

        // Save last-fired bullet into chat metadata so the LLM can reference it
        // (per chat basis)
        const metadata = SillyTavern.getContext().chatMetadata;
        metadata['dangan_last_fired'] = { bullet: b.name, time: Date.now() };
        saveMetadata();
      };
      list.appendChild(btn);
    });
  }

  // Replace WeakPoint tokens in rendered character messages with clickable buttons
  // Token format expected from LLM: [WeakPoint: description]
  function processRenderedMessageElement(el) {
    // Avoid double processing
    if (!el || el.dataset?.danganProcessed) return;
    const inner = el.innerHTML;
    if (!inner.includes("[WeakPoint:")) {
      el.dataset.danganProcessed = "true";
      return;
    }
    // Sanitize with DOMPurify if available
    const raw = inner;
    // Replace tokens with button markup
    const replaced = raw.replace(/\[WeakPoint:(.*?)\]/g, (m, p1) => {
      const desc = p1.trim().replace(/"/g, '&quot;');
      // We create a semantic button element; extension will attach global handler
      return `<button class="dangan-weak-btn" data-wp="${desc}">Weak Point: ${desc}</button>`;
    });
    // insert replaced HTML
    try {
      if (SillyTavern.libs && SillyTavern.libs.DOMPurify) {
        el.innerHTML = SillyTavern.libs.DOMPurify.sanitize(replaced, { ADD_ATTR: ['data-wp'] });
      } else {
        el.innerHTML = replaced;
      }
      el.dataset.danganProcessed = "true";
    } catch (err) {
      console.error("[Dangan Trial] Failed to replace WeakPoint tokens:", err);
      el.dataset.danganProcessed = "true";
    }
  }

  // When the user clicks a Weak Point button in chat, open a small popup menu of available bullets
  function handleWeakClick(ev) {
    const btn = ev.target.closest(".dangan-weak-btn");
    if (!btn) return;
    const desc = btn.getAttribute("data-wp") || btn.textContent || "Unknown";
    // Toggle an inline menu right next to the button (simple)
    // Remove existing menus first
    document.querySelectorAll(".dangan-weak-menu-floating").forEach(n => n.remove());

    const menu = document.createElement("div");
    menu.className = "dangan-weak-menu-floating";
    menu.style.position = "absolute";
    menu.style.background = "#0b0c0d";
    menu.style.border = "1px solid #222";
    menu.style.padding = "8px";
    menu.style.borderRadius = "6px";
    menu.style.boxShadow = "0 6px 20px rgba(0,0,0,0.5)";
    menu.style.zIndex = 99999;
    menu.innerHTML = `<div style="color:#ffeb7a;margin-bottom:6px;font-weight:700;">Weak Point: ${desc}</div><div style="display:flex;gap:6px;flex-wrap:wrap;" id="dangan-menu-bullets"></div><div style="margin-top:6px;color:#aaa;font-size:12px;">Click a bullet to prefill input and mark it used.</div>`;

    document.body.appendChild(menu);
    // position
    const rect = btn.getBoundingClientRect();
    menu.style.left = Math.min(window.innerWidth - 320, rect.left) + "px";
    menu.style.top = (rect.bottom + 6) + "px";

    // fill bullets
    const menuList = menu.querySelector("#dangan-menu-bullets");
    const settings = getSettings();
    if (!settings.bullets.length) {
      menuList.innerHTML = `<div style="color:#bbb">No bullets available. Add them in the Truth Bullets panel.</div>`;
    } else {
      settings.bullets.forEach((b, idx) => {
        const bbtn = document.createElement("button");
        bbtn.className = "dangan-bullet-btn";
        bbtn.textContent = b.used ? `(used) ${b.name}` : b.name;
        if (b.used) bbtn.disabled = true;
        bbtn.onclick = (ev2) => {
          ev2.stopPropagation();
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
          // mark used & persist
          settings.bullets[idx].used = true;
          saveSettingsDebounced();
          renderPanel();
          // set chat metadata so LLM can see which WP is being targeted and which bullet was fired
          const md = SillyTavern.getContext().chatMetadata;
          md['dangan_last_target'] = { weakPoint: desc, bullet: b.name, ts: Date.now() };
          saveMetadata();
          // remove menu
          menu.remove();
        };
        menuList.appendChild(bbtn);
      });
    }

    // remove menu if clicked outside
    const off = (e) => {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.remove();
        window.removeEventListener("mousedown", off);
      }
    };
    window.addEventListener("mousedown", off);
  }

  // Listen to events and DOM mutations
  function setupListeners() {
    // App ready -> render panel
    eventSource.on(event_types.APP_READY, () => {
      renderPanel();
      // initial pass over rendered character messages
      document.querySelectorAll(".mes_text, .message .text, .character-message .mes_text").forEach(processRenderedMessageElement);
    });

    // New generated message recorded (not yet rendered) => we still process after render
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (payload) => {
      // payload may include DOM node or message id; to be resilient, process latest items
      setTimeout(() => {
        // scan for new message nodes that include token
        const nodes = document.querySelectorAll(".mes_text, .message .text, .character-message .mes_text");
        nodes.forEach(processRenderedMessageElement);
      }, 40);
    });

    // User message sent -> allow extension to update metadata if it contains the "I use Truth Bullet:" command
    eventSource.on(event_types.MESSAGE_SENT, (payload) => {
      try {
        const msg = payload?.message || (payload && payload.content) || "";
        const m = /I use Truth Bullet:\s*([^—\n\r]+)/i.exec(msg);
        if (m) {
          const name = m[1].trim();
          // mark bullet used in settings if it exists
          const settings = getSettings();
          const idx = settings.bullets.findIndex(b => b.name.toLowerCase() === name.toLowerCase() && !b.used);
          if (idx >= 0) {
            settings.bullets[idx].used = true;
            saveSettingsDebounced();
            renderPanel();
          }
          // set chat metadata last fired
          const md = SillyTavern.getContext().chatMetadata;
          md['dangan_last_fired'] = { bullet: name, time: Date.now() };
          saveMetadata();
        }
      } catch (err) {
        console.warn("[Dangan Trial] MESSAGE_SENT handler error:", err);
      }
    });

    // Global DOM delegation for weak point button clicks (handles replacements created later)
    document.addEventListener("click", (ev) => {
      if (ev.target && ev.target.matches && ev.target.matches(".dangan-weak-btn")) {
        handleWeakClick(ev);
      }
    });

    // Also observe DOM for new messages (fallback)
    const chatRoot = document.querySelector("#chat") || document.body;
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          m.addedNodes.forEach(n => {
            if (n.nodeType === 1) {
              // try to find mes_text nodes inside
              n.querySelectorAll && n.querySelectorAll(".mes_text, .message .text, .character-message .mes_text").forEach(processRenderedMessageElement);
            }
          });
        }
      }
    });
    mo.observe(chatRoot, { childList: true, subtree: true });
  }

  // Initialize
  try {
    renderPanel();
    setupListeners();
    console.log("[Dangan Trial] extension initialized");
  } catch (err) {
    console.error("[Dangan Trial] init error:", err);
  }
})();
