// Dangan Trial Extension Skeleton
// Drops a little UI panel, manages Truth Bullet inventory,
// and turns Weak Point markers into clickable buttons.

export default {
  // Runs when ST loads the extension
  async initExtension() {
    console.log("[Dangan Trial] Loaded");

    // === Persistent inventory ===
    // Stored in localStorage under 'danganTruthBullets'
    const storageKey = "danganTruthBullets";
    let bullets = JSON.parse(localStorage.getItem(storageKey)) || [];

    function saveBullets() {
      localStorage.setItem(storageKey, JSON.stringify(bullets));
    }

    // === Inventory UI Panel ===
    const panel = document.createElement("div");
    panel.style.padding = "8px";
    panel.style.border = "1px solid #444";
    panel.style.margin = "4px 0";
    panel.style.background = "#111";
    panel.innerHTML = `
      <h3 style="color:#ffeb7a;margin:4px 0;">Truth Bullets</h3>
      <ul id="truth-bullet-list" style="list-style:none;padding-left:0;"></ul>
      <input id="truth-bullet-input" type="text" placeholder="Add new bullet..." style="width:80%;margin-top:4px;">
      <button id="truth-bullet-add">Add</button>
    `;

    // Inject panel into the sidebar
    const target = document.querySelector("#extensions-panel");
    if (target) target.appendChild(panel);

    const listEl = panel.querySelector("#truth-bullet-list");
    const inputEl = panel.querySelector("#truth-bullet-input");
    const addBtn = panel.querySelector("#truth-bullet-add");

    function renderList() {
      listEl.innerHTML = "";
      bullets.forEach((b, i) => {
        const li = document.createElement("li");
        li.style.margin = "2px 0";
        li.innerHTML = `
          <button data-i="${i}" style="background:#8ef0ff;color:#000;border:none;border-radius:5px;padding:2px 6px;cursor:pointer;">
            ${b.used ? "(used) " : ""}${b.name}
          </button>
        `;
        listEl.appendChild(li);
      });
    }

    renderList();

    addBtn.addEventListener("click", () => {
      const val = inputEl.value.trim();
      if (!val) return;
      bullets.push({ name: val, used: false });
      saveBullets();
      renderList();
      inputEl.value = "";
    });

    // Clicking a bullet in the panel will prefill the chat input
    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-i]");
      if (!btn) return;
      const i = parseInt(btn.dataset.i);
      const bullet = bullets[i];
      if (bullet.used) return;

      // Prefill input box
      const chatInput =
        document.querySelector("textarea") ||
        document.querySelector("input[type=text]");
      if (chatInput) {
        chatInput.value = `I use Truth Bullet: ${bullet.name} — `;
        chatInput.focus();
      }

      // Mark as used visually + in storage
      bullets[i].used = true;
      saveBullets();
      renderList();
    });

    // === Weak Point Button Replacement ===
    // This function scans messages for the tag [WeakPoint: ...]
    // and replaces it with a clickable yellow button
    function replaceWeakPoints() {
      document.querySelectorAll(".mes_text").forEach((el) => {
        if (el.dataset.danganProcessed) return;
        el.dataset.danganProcessed = "true";

        el.innerHTML = el.innerHTML.replace(
          /\[WeakPoint:(.*?)\]/g,
          (match, p1) =>
            `<button style="background:#ffeb7a;color:#000;border-radius:5px;padding:2px 6px;margin:2px;cursor:pointer;">
               Weak Point: ${p1.trim()}
             </button>`
        );
      });
    }

    // Run once now, and then whenever new messages arrive
    replaceWeakPoints();
    const observer = new MutationObserver(replaceWeakPoints);
    observer.observe(document.querySelector("#chat"), {
      childList: true,
      subtree: true,
    });
  },
};
