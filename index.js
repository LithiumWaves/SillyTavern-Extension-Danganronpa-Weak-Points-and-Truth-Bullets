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

  // 🔹 Inject CSS once
  if (!document.getElementById("dangan-style")) {
    const style = document.createElement("style");
    style.id = "dangan-style";
    style.textContent = `
      .dangan-panel {
        padding: 12px;
        background: #2b2b2b;
        border: 2px solid #003366;
        border-radius: 50px;
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
      .dangan-weak-highlight {
        color: #ffff66;
        background: transparent;
        font-weight: 700;
        cursor: pointer;
        text-shadow: 0 0 6px rgba(255,255,0,0.8);
        transition: text-shadow 0.2s, color 0.2s;
      }
      .dangan-weak-highlight:hover {
        color: #ffffff;
        text-shadow: 0 0 10px rgba(255, 255, 0, 1),
                     0 0 20px rgba(255, 255, 100, 0.8);
      }
      .dangan-weak-menu-floating { min-width: 180px; }
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
  } = ctx || {};

  const MODULE_KEY = "dangan_trial_toggle";
  const defaultSettings = { bullets: [] };

  function ensureSettings() {
    if (!extensionSettings) {
      console.warn("[Dangan Trial] extensionSettings not available");
      return structuredClone(defaultSettings);
    }
    if (!extensionSettings[MODULE_KEY]) {
      extensionSettings[MODULE_KEY] = structuredClone(defaultSettings);
      saveSettingsDebounced && saveSettingsDebounced();
    } else {
      for (const k of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(extensionSettings[MODULE_KEY], k)) {
          extensionSettings[MODULE_KEY][k] = defaultSettings[k];
        }
      }
    }
    return extensionSettings[MODULE_KEY];
  }

  function insertBulletText(b) {
    const el = document.querySelector("#send_textarea");
    if (!el) {
      console.warn("Could not find #send_textarea");
      return false;
    }
    el.focus();

    // Just visible text
    const display = `Fired Truth Bullet: ${b.name}`;
    el.value = (el.value || "") + display;
    el.dispatchEvent(new Event("input", { bubbles: true }));

    console.log("[Dangan Trial] Bullet inserted:", display);
    return true;
  }

  // ... [UNCHANGED FUNCTIONS: renderPanelContents, processRenderedMessageElement, handleWeakClick, patchWandMenu]
  // (keep them exactly as you pasted — I trimmed here just for clarity)

  function setupExtension() {
    patchWandMenu();

    document.querySelectorAll(".mes_text, .message .text, .character-message .mes_text, .message-text, .chat-message-text")
      .forEach(processRenderedMessageElement);

    const chatRoot = document.querySelector("#chat") || document.body;
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === 1) {
              processRenderedMessageElement(n);
              n.querySelectorAll &&
                n.querySelectorAll(".mes_text, .message .text, .character-message .mes_text, .message-text, .chat-message-text")
                  .forEach(processRenderedMessageElement);
            }
          });
        }
      }
    });
    mo.observe(chatRoot, { childList: true, subtree: true });

    document.addEventListener("click", (ev) => {
      const wp = ev.target.closest(".dangan-weak-highlight");
      if (wp) {
        ev.stopPropagation();
        handleWeakClick(wp);
      }
    });
  } // ✅ properly close setupExtension

  // 🔹 MESSAGE_SENT hook (top-level, not inside setupExtension)
  if (eventSource && event_types) {
    console.log("👀 Now watching outgoing messages for TruthBullet tags...");
    eventSource.on(event_types.MESSAGE_SENT, (payload) => {
      try {
        if (!payload?.message) return;
        if (payload.message.includes("Fired Truth Bullet:")) {
          const m = /Fired Truth Bullet:\s*([^—\n\r]+)/i.exec(payload.message);
          if (m) {
            const name = m[1].trim();
            console.log("📩 Before injection:", payload.message);
            payload.message += ` [DANGAN:TruthBullet="${name}"]`;
            console.log("🔒 After injection (with hidden tag):", payload.message);
          }
        }
      } catch (err) {
        console.warn("[Dangan Trial] MESSAGE_SENT handler error:", err);
      }
    });
  } else {
    console.warn("[Dangan Trial] eventSource / event_types not available - MESSAGE_SENT handler skipped");
  }

  // 🔹 Init
  setTimeout(() => {
    ensureSettings();
    setupExtension();
  }, 500);

  console.log("[Dangan Trial] Wand Menu beside/floating panel loaded with CSS styling");
})();
