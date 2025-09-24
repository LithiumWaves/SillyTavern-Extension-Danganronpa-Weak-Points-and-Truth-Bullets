(function () {
    const extName = "truthbullets";
    const settingsKey = "truthBulletsInventory";

    let inventory = [];

    // Load inventory from storage
    function loadInventory() {
        const stored = localStorage.getItem(settingsKey);
        if (stored) {
            inventory = JSON.parse(stored);
        }
    }

    // Save inventory to storage
    function saveInventory() {
        localStorage.setItem(settingsKey, JSON.stringify(inventory));
    }

    // Add a Truth Bullet
    function addTruthBullet(bullet) {
        inventory.push(bullet);
        saveInventory();
        renderInventory();
    }

    // Remove a Truth Bullet (after firing)
    function removeTruthBullet(bullet) {
        inventory = inventory.filter(b => b !== bullet);
        saveInventory();
        renderInventory();
    }

    // Create inventory panel UI
    function renderInventory() {
        const panel = document.getElementById("truth-bullet-panel");
        if (!panel) return;

        panel.innerHTML = "<h3>Truth Bullets</h3>";

        if (inventory.length === 0) {
            panel.innerHTML += "<p>No Truth Bullets collected.</p>";
            return;
        }

        const list = document.createElement("ul");
        inventory.forEach(bullet => {
            const li = document.createElement("li");
            li.textContent = bullet;
            list.appendChild(li);
        });
        panel.appendChild(list);
    }

    // Attach Weak Point click behavior
    function enableWeakPointClicks() {
        document.body.addEventListener("click", function (e) {
            if (e.target && e.target.matches("span.weak-point")) {
                openTruthBulletModal(e.target);
            }
        });
    }

    // Modal for firing Truth Bullets
    function openTruthBulletModal(weakPointElement) {
        const modal = document.createElement("div");
        modal.style.position = "fixed";
        modal.style.top = "50%";
        modal.style.left = "50%";
        modal.style.transform = "translate(-50%, -50%)";
        modal.style.background = "#222";
        modal.style.padding = "20px";
        modal.style.border = "2px solid yellow";
        modal.style.zIndex = "9999";

        modal.innerHTML = "<h3>Fire a Truth Bullet!</h3>";

        if (inventory.length === 0) {
            modal.innerHTML += "<p>You have no Truth Bullets...</p>";
        } else {
            inventory.forEach(bullet => {
                const btn = document.createElement("button");
                btn.textContent = bullet;
                btn.style.display = "block";
                btn.style.margin = "5px 0";
                btn.onclick = () => {
                    fireTruthBullet(bullet, weakPointElement);
                    document.body.removeChild(modal);
                };
                modal.appendChild(btn);
            });
        }

        const cancel = document.createElement("button");
        cancel.textContent = "Cancel";
        cancel.onclick = () => document.body.removeChild(modal);
        modal.appendChild(cancel);

        document.body.appendChild(modal);
    }

    // Fire Truth Bullet: send into chat + remove from inventory
    function fireTruthBullet(bullet, weakPointElement) {
        // Format the action
        const action = `You fire the Truth Bullet: "${bullet}" at the ${weakPointElement.textContent}.`;
        removeTruthBullet(bullet);

        // Insert into chat as a user message
        window?.SillyTavern?.sendMessage?.(action);
    }

    // Hook into SillyTavern
    window.SillyTavern.registerExtension(extName, {
        init() {
            console.log(`[${extName}] Initializing...`);
            loadInventory();
            enableWeakPointClicks();

            // Create inventory panel
            const panel = document.createElement("div");
            panel.id = "truth-bullet-panel";
            panel.style.position = "absolute";
            panel.style.top = "10px";
            panel.style.right = "10px";
            panel.style.background = "#111";
            panel.style.color = "white";
            panel.style.padding = "10px";
            panel.style.border = "1px solid yellow";
            panel.style.zIndex = "9999";
            document.body.appendChild(panel);

            renderInventory();

            // Debug: add some sample bullets
            // addTruthBullet("Knife with fingerprints");
            // addTruthBullet("Bloody shirt");
        },
        addTruthBullet
    });
})();
