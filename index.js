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

  // 🔹 Bullet Fly Animation helper
function animateBulletShot(bulletName, weakPointDesc) {
  const el = document.createElement("div");
  el.className = "dangan-bullet-fly";
  el.textContent = bulletName;

  let tx = 200, ty = -200;
  const wpEl = weakPointDesc
    ? document.querySelector(`.dangan-weak-highlight[data-wp="${weakPointDesc}"]`)
    : null;

  if (wpEl) {
    const rect = wpEl.getBoundingClientRect();
    tx = rect.left + rect.width / 2 - window.innerWidth / 2;
    ty = rect.top + rect.height / 2 - window.innerHeight / 2;
  }

  el.style.setProperty("--target-x", `${tx}px`);
  el.style.setProperty("--target-y", `${ty}px`);

  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

  // 🔹 Update Weak Point button style after AI verdict
  // Exposed globally for DevTools manual testing too
  window.updateWeakPointStatus = function (weakPoint, status) {
    const all = Array.from(document.querySelectorAll(".dangan-weak-highlight"));
    const wpSpans = all.filter((s) => s.dataset && s.dataset.wp === weakPoint);

    if (wpSpans.length === 0) {
      console.warn("[Dangan Trial] updateWeakPointStatus: no spans matched for:", weakPoint);
      return;
    }

    wpSpans.forEach((wp) => {
      wp.classList.remove("dangan-weak-accepted", "dangan-weak-denied");

      if (status === "accepted") {
        wp.classList.add("dangan-weak-accepted");
      } else if (status === "denied") {
        wp.classList.add("dangan-weak-denied");
      }

      if (status === "accepted" || status === "denied") {
        // 🔒 Make it unclickable permanently
        wp.style.pointerEvents = "none";
        wp.style.cursor = "not-allowed";

        // ✅ Persist verdict in metadata
        const md = SillyTavern.getContext().chatMetadata;
        md["dangan_verdicts"] = md["dangan_verdicts"] || {};
        md["dangan_verdicts"][weakPoint] = status;
        if (typeof saveMetadata === "function") saveMetadata();
      }
    });
  };

  // 🔹 Restore all saved verdicts on startup or message render
  function restoreWeakPointVerdicts() {
    try {
      const md = SillyTavern.getContext().chatMetadata;
      if (!md || !md.dangan_verdicts) return;

      Object.entries(md.dangan_verdicts).forEach(([wp, status]) => {
        updateWeakPointStatus(wp, status);
      });

      console.log("[Dangan Trial] Restored Weak Point verdicts:", md.dangan_verdicts);
    } catch (err) {
      console.warn("[Dangan Trial] Failed to restore verdicts:", err);
    }
  }

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
        text-shadow: 0 0 6px rgba(255, 255, 0, 0.8);
        transition: text-shadow 0.2s, color 0.2s;
      }
      .dangan-weak-highlight:hover {
        color: #ffffff;
        text-shadow: 0 0 10px rgba(255, 255, 0, 1),
                     0 0 20px rgba(255, 255, 100, 0.8);
      }
      .dangan-weak-menu-floating { min-width: 180px; }

      /* 🔹 Bullet Fly Animation CSS */
@keyframes dangan-bullet-fly {
  0% {
    transform: translate(-50%, -50%) scale(0.6) rotate(-10deg);
    opacity: 0.2;
  }
  40% {
    transform: translate(-50%, -50%) scale(1) rotate(5deg);
    opacity: 1;
  }
  100% {
    transform: translate(var(--target-x, 200px), var(--target-y, -200px)) scale(1.2);
    opacity: 0;
  }
}
.dangan-bullet-fly {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 100000;
  font-weight: 800;
  color: #66aaff;
  text-shadow: 0 0 8px #003366, 0 0 12px #66aaff;
  pointer-events: none;
  white-space: nowrap;
  animation: dangan-bullet-fly 1s ease-out forwards;
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

    const display = `Fired Truth Bullet: ${b.name}`;
    el.value = (el.value || "") + display;
    el.dispatchEvent(new Event("input", { bubbles: true }));

    console.log("[Dangan Trial] Bullet inserted:", display);
    return true;
  }

  function renderPanelContents(container) {
    ensureSettings();
    const s = extensionSettings ? extensionSettings[MODULE_KEY] : ensureSettings();
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

          // If panel bullet (no weakpoint target), set last target minimally to record bullet fired
          window.__dangan_last_target = { weakPoint: null, bullet: b.name, ts: Date.now(), applied: false };
          try {
            const md = SillyTavern.getContext().chatMetadata;
            if (md) {
              md["dangan_last_target"] = Object.assign({}, window.__dangan_last_target);
              saveMetadata && saveMetadata();
            }
          } catch (err) {
            console.warn("[Dangan Debug] could not persist last target from panel:", err);
          }

          const did = insertBulletText(b);
          if (!did) {
            console.warn("[Dangan Trial] Insertion fallback failed when clicking panel bullet.");
          }
          s.bullets[idx].used = true;
          saveSettingsDebounced && saveSettingsDebounced();
          renderPanelContents(container);

          const md = SillyTavern.getContext().chatMetadata;
          md["dangan_last_fired"] = { bullet: b.name, time: Date.now() };
          saveMetadata && saveMetadata();
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
            saveSettingsDebounced && saveSettingsDebounced();
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
      addBtn.replaceWith(addBtn.cloneNode(true));
      const newAddBtn = container.querySelector("#dangan-add-btn");
      newAddBtn.addEventListener("click", (ev) => ev.stopPropagation());

      addInput.addEventListener("click", (ev) => ev.stopPropagation());
      addInput.addEventListener("keydown", (ev) => ev.stopPropagation());

      newAddBtn.onclick = () => {
        const v = (addInput.value || "").trim();
        if (!v) return;
        s.bullets.push({ name: v, used: false });
        saveSettingsDebounced && saveSettingsDebounced();
        addInput.value = "";
        renderPanelContents(container);
      };
      addInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") newAddBtn.click();
      });
    }
  }

  // 🔹 Inline highlight replacement
  function processRenderedMessageElement(el, entry) {
    if (!el) return;

    // Use immersive version if available
    if (entry?.metadata?.dangan_display) {
      el.innerText = entry.metadata.dangan_display;
    }

    // WeakPoint highlighting
    const inner = el.innerHTML || "";
    if (!inner.includes("[WeakPoint:")) {
      el.dataset.danganProcessed = "true";
      return;
    }
    const replaced = inner.replace(/\[WeakPoint:([\s\S]*?)\]/g, (m, p1) => {
      const desc = p1.trim().replace(/"/g, "&quot;");
      return `<span class="dangan-weak-highlight" data-wp="${desc}">${desc}</span>`;
    });
    try {
      el.innerHTML = replaced;
    } catch (e) {
      console.warn("[Dangan Trial] failed to replace WP token", e);
    }
    el.dataset.danganProcessed = "true";
  }

  // 🔹 Click handler for highlights -> floating menu
  function handleWeakClick(btn) {
    if (!btn) return;
    const desc = btn.getAttribute("data-wp") || btn.textContent || "Unknown";
    document.querySelectorAll(".dangan-weak-menu-floating").forEach((x) => x.remove());

    const menu = document.createElement("div");
    menu.className = "dangan-weak-menu-floating dangan-panel";
    menu.innerHTML = `
      <div style="color:#66aaff;font-weight:700;margin-bottom:6px;">Weak Point: ${desc}</div>
      <div id="dangan-menu-bullets" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
      <div style="margin-top:6px;color:#aaa;font-size:12px;">Click a bullet to use it against this Weak Point.</div>
    `;
    document.body.appendChild(menu);

    menu.style.display = "block";
    menu.style.visibility = "visible";
    menu.style.opacity = "1";
    menu.style.zIndex = 9999;

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

          // set a fast global reference first (avoid race between user-send and metadata save)
          window.__dangan_last_target = { weakPoint: desc, bullet: b.name, ts: Date.now(), applied: false };

          // also save into chat metadata for persistence (best effort)
          try {
            const md = SillyTavern.getContext().chatMetadata;
            if (md) {
              md["dangan_last_target"] = Object.assign({}, window.__dangan_last_target);
              saveMetadata && saveMetadata();
              console.log("[Dangan Debug] last_target set (menu):", md["dangan_last_target"]);
            }
          } catch (err) {
            console.warn("[Dangan Debug] could not set chatMetadata.dangan_last_target", err);
          }

          // Now insert the bullet text into the textarea
          const inserted = insertBulletText(b);
          if (!inserted) {
            console.warn("[Dangan Trial] Failed to insert bullet from floating menu.");
          }

          s.bullets[idx].used = true;
          saveSettingsDebounced && saveSettingsDebounced();
          const cont = document.querySelector("#dangan-panel-container");
          if (cont) renderPanelContents(cont);

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

    // process any already-rendered messages
    document.querySelectorAll(".mes_text, .message .text, .character-message .mes_text, .message-text, .chat-message-text")
      .forEach((el) => {
        const idx = el.closest("[data-index]")?.dataset?.index;
        const entry = idx ? ctx.chat[idx] : null;
        processRenderedMessageElement(el, entry);
      });

    // ✅ restore verdicts for already-rendered WeakPoints
    restoreWeakPointVerdicts();

    const chatRoot = document.querySelector("#chat") || document.body;
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          m.addedNodes.forEach((n) => {
            if (n.nodeType === 1) {
              const idx = n.dataset?.index;
              const entry = idx ? ctx.chat[idx] : null;

              processRenderedMessageElement(n, entry);

              n.querySelectorAll &&
                n.querySelectorAll(".mes_text, .message .text, .character-message .mes_text, .message-text, .chat-message-text")
                  .forEach((child) => processRenderedMessageElement(child, entry));

              // ✅ reapply verdicts whenever new nodes render
              restoreWeakPointVerdicts();

              // After processing a new AI message, check for verdict markers
              const verdictText = (n.innerText || entry?.mes || "").trim();
              if (verdictText.includes("Truth Bullet - Accepted") || verdictText.includes("Truth Bullet - Denied")) {
                const lastTarget = window.__dangan_last_target || (SillyTavern.getContext && SillyTavern.getContext().chatMetadata && SillyTavern.getContext().chatMetadata.dangan_last_target);
                console.log("[Dangan Trial] Verdict detected in message:", verdictText, "Target:", lastTarget);

                if (!lastTarget) {
                  console.warn("[Dangan Trial] Verdict detected but no lastTarget available (skipping).");
                } else {
                  if (lastTarget.applied) {
                    console.log("[Dangan Debug] Verdict already applied for:", lastTarget.weakPoint);
                  } else {
                    if (lastTarget.weakPoint) {
                      if (verdictText.includes("Truth Bullet - Accepted")) {
                        updateWeakPointStatus(lastTarget.weakPoint, "accepted");
                      } else if (verdictText.includes("Truth Bullet - Denied")) {
                        updateWeakPointStatus(lastTarget.weakPoint, "denied");
                      }
                    } else {
                      console.log("[Dangan Debug] Verdict applied for bullet (no weakPoint):", lastTarget.bullet);
                    }

                    lastTarget.applied = true;
                    if (window.__dangan_last_target) window.__dangan_last_target.applied = true;
                    try {
                      const md = SillyTavern.getContext().chatMetadata;
                      if (md) {
                        md.dangan_last_target = md.dangan_last_target || {};
                        md.dangan_last_target.applied = true;
                        saveMetadata && saveMetadata();
                      }
                    } catch (err) {
                      console.warn("[Dangan Debug] could not persist applied flag:", err);
                    }

                    console.log("[Dangan Debug] Applied verdict to WeakPoint:", lastTarget.weakPoint, "status:", verdictText.includes("Accepted") ? "accepted" : "denied");
                  }
                }
              }
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
  }

  if (eventSource && event_types) {
    console.log("[Dangan Trial] Hooking MESSAGE_SENT event...");
    eventSource.on(event_types.MESSAGE_SENT, (idx) => {
      try {
        const chat = ctx.chat;
        const entry = chat[idx];
        const text = entry?.mes ?? "";
        console.log("[Dangan Trial] MESSAGE_SENT fired:", { idx, text, entry });

        if (text.includes("Fired Truth Bullet:")) {
          const m = /Fired Truth Bullet:\s*([^—\n\r]+)/i.exec(text);
          if (m) {
            const name = m[1].trim();
            entry.metadata = entry.metadata || {};
            entry.metadata.dangan_display = text;
            if (typeof entry.mes === "undefined" || entry.mes === null) {
              entry.mes = text;
            }

            console.log("[Dangan Trial] Fired Truth Bullet detected:", name);

            // 🔹 Trigger animation here
            animateBulletShot(name, window.__dangan_last_target?.weakPoint || null);

            try {
              const md = SillyTavern.getContext().chatMetadata;
              if (md) {
                md["dangan_last_fired"] = { bullet: name, time: Date.now() };
                saveMetadata && saveMetadata();
              }
            } catch (err) {
              console.warn("[Dangan Debug] couldn't persist dangan_last_fired:", err);
            }
          }
        }
      } catch (err) {
        console.warn("[Dangan Trial] MESSAGE_SENT handler error:", err);
      }
    });
  } else {
    console.warn("[Dangan Trial] eventSource or event_types missing — cannot hook MESSAGE_SENT!");
  }

  // 🔹 Init
  setTimeout(() => {
    ensureSettings();
    setupExtension();
  }, 500);

  console.log("[Dangan Trial] Wand Menu beside/floating panel loaded with CSS styling");
})();
