// State Management
let db = [];
let cart = [];
let targetCapacityGb = 852; // 1TB default Usable
let currentShopFilter = "inshop";
let currentModalItem = null;

const PIN_CODE = "1433";
let enteredPin = "";

const CAPACITIES = {
  '500GB': 426,
  '1TB': 852,
  '2TB': 1704,
  '3TB': 2556,
  '4TB': 3408,
  '6TB': 5112,
  '8TB': 6816
};

// DOM Elements
const authOverlay = document.getElementById("authOverlay");
const appContainer = document.getElementById("appContainer");
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");
const searchResults = document.getElementById("searchResults");
const cartList = document.getElementById("cartList");
const capacitySelect = document.getElementById("capacitySelect");
const customCapacityInput = document.getElementById("customCapacityInput");
const progressBar = document.getElementById("progressBar");
const statSize = document.getElementById("statSize");
const statPercent = document.getElementById("statPercent");
const indexesOutput = document.getElementById("indexesOutput");
const reportOutput = document.getElementById("reportOutput");
const cartCount = document.getElementById("cartCount");
const clearCartButton = document.getElementById("clearCartButton");
const shopFilterSelect = document.getElementById("shopFilterSelect");

// PIN Pad Auth
window.pressPin = function(num) {
  if (enteredPin.length < 4) {
    enteredPin += num;
    updatePinDisplay();
    if (enteredPin.length === 4) {
      setTimeout(verifyPin, 150);
    }
  }
}

window.clearPin = function() {
  enteredPin = "";
  updatePinDisplay();
  hideAuthError();
}

window.backspacePin = function() {
  if (enteredPin.length > 0) {
    enteredPin = enteredPin.slice(0, -1);
    updatePinDisplay();
    hideAuthError();
  }
}

function updatePinDisplay() {
  const dots = document.querySelectorAll(".pin-dot");
  dots.forEach((dot, idx) => {
    if (idx < enteredPin.length) {
      dot.classList.add("filled");
    } else {
      dot.classList.remove("filled");
    }
  });
}

function verifyPin() {
  if (enteredPin === PIN_CODE) {
    localStorage.setItem("backoffice_auth", "true");
    showDashboard();
  } else {
    showAuthError();
    clearPin();
  }
}

function showAuthError() {
  document.getElementById("authError").style.visibility = "visible";
}

function hideAuthError() {
  document.getElementById("authError").style.visibility = "hidden";
}

function showDashboard() {
  authOverlay.style.display = "none";
  appContainer.style.display = "block";
  loadDatabase();
}

// Load DB & Cart
async function loadDatabase() {
  try {
    const res = await fetch("data/db.json");
    if (!res.ok) throw new Error("Load DB failed");
    db = await res.json();
    
    const savedCart = localStorage.getItem("backoffice_cart");
    if (savedCart) {
      cart = JSON.parse(savedCart);
    }
    
    const savedCapacity = localStorage.getItem("backoffice_capacity_key") || "1TB";
    capacitySelect.value = savedCapacity;
    if (savedCapacity === "custom") {
      customCapacityInput.style.display = "inline-block";
      targetCapacityGb = parseFloat(localStorage.getItem("backoffice_capacity_val")) || 852;
      customCapacityInput.value = targetCapacityGb;
    } else {
      targetCapacityGb = CAPACITIES[savedCapacity] || 852;
    }
    
    // Bind shop filter change listener
    shopFilterSelect.addEventListener("change", (e) => {
      currentShopFilter = e.target.value;
      const query = searchInput.value.trim().toLowerCase();
      filterResults(query);
    });
    
    renderCart();
  } catch (err) {
    alert("Error loading db.json database. Make sure you generated it from the PC app.");
  }
}

// Search & Filtering
searchInput.addEventListener("input", (e) => {
  const query = e.target.value.trim().toLowerCase();
  if (query.length > 0) {
    document.querySelector(".search-wrap").classList.add("has-text");
    filterResults(query);
  } else {
    document.querySelector(".search-wrap").classList.remove("has-text");
    closeSearchResults();
  }
});

searchClear.addEventListener("click", () => {
  searchInput.value = "";
  document.querySelector(".search-wrap").classList.remove("has-text");
  closeSearchResults();
});

function filterResults(query) {
  if (!query) {
    closeSearchResults();
    return;
  }
  let matched = [];
  const isDigits = /^\d+$/.test(query);
  
  let baseList = db;
  if (currentShopFilter === "inshop") {
    baseList = db.filter(item => item.inShop === true);
  }
  
  if (isDigits) {
    const padded = query.padStart(6, '0');
    matched = baseList.filter(item => item.index.includes(query) || item.index === padded);
  } else {
    matched = baseList.filter(item => 
      item.title.toLowerCase().includes(query) || 
      item.game_ids.some(gid => gid.toLowerCase().includes(query)) ||
      (item.genre && item.genre.some(g => g.toLowerCase().includes(query)))
    );
  }
  
  renderSearchResults(matched);
}

function renderSearchResults(results) {
  searchResults.innerHTML = "";
  if (results.length === 0) {
    searchResults.innerHTML = `<div class="no-results">ไม่พบผลลัพธ์ที่ค้นหา</div>`;
  } else {
    results.slice(0, 50).forEach(item => {
      const card = document.createElement("div");
      card.className = "search-card";
      
      const sizeGb = (item.game_size_mb / 1024).toFixed(1);
      const emuBadge = (item.emu_note && item.emu_note !== "PS4") ? `<span class="emu-badge">${item.emu_note}</span>` : "";
      
      card.innerHTML = `
        <img class="search-cover" src="images/${item.index}.jpg" onerror="this.src='https://placehold.co/100x125/000/fff?text=No+Cover';" />
        <div class="search-info">
          <div class="search-title">${item.title}</div>
          <div class="search-meta">
            <span class="search-index">#${item.index}</span>${emuBadge}
            <span>ID: ${item.game_ids.join('/')}</span> · 
            <span class="search-size">${sizeGb} GB</span>
          </div>
        </div>
        <button class="btn-add">เพิ่ม</button>
      `;
      
      // Bind click to thumbnail cover for zoom pop-up
      card.querySelector(".search-cover").addEventListener("click", (e) => {
        e.stopPropagation();
        openImageModal(`images/${item.index}.jpg`, item.title);
      });
      
      card.querySelector(".btn-add").addEventListener("click", (e) => {
        e.stopPropagation();
        addToCart(item);
      });
      
      card.addEventListener("click", () => addToCart(item));
      searchResults.appendChild(card);
    });
  }
  searchResults.classList.add("open");
}

function closeSearchResults() {
  searchResults.classList.remove("open");
  searchResults.innerHTML = "";
}

// Cart Logic
function addToCart(dbItem) {
  if (cart.some(item => item.index === dbItem.index)) {
    return;
  }
  
  const sizeGb = parseFloat((dbItem.game_size_mb / 1024).toFixed(2));
  cart.push({
    index: dbItem.index,
    title: dbItem.title,
    game_ids: dbItem.game_ids,
    size_gb: sizeGb,
    selected: true,
    emu_note: dbItem.emu_note
  });
  
  saveCart();
  renderCart();
  closeSearchResults();
  searchInput.value = "";
  document.querySelector(".search-wrap").classList.remove("has-text");
}

function moveItem(index, direction) {
  const idx = cart.findIndex(item => item.index === index);
  if (idx === -1) return;
  
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= cart.length) return;
  
  const temp = cart[idx];
  cart[idx] = cart[targetIdx];
  cart[targetIdx] = temp;
  
  saveCart();
  renderCart();
}

function toggleItemSelection(index, selected) {
  const item = cart.find(item => item.index === index);
  if (item) {
    item.selected = selected;
    saveCart();
    renderCart();
  }
}

function removeCartItem(index) {
  cart = cart.filter(item => item.index !== index);
  saveCart();
  renderCart();
}

clearCartButton.addEventListener("click", () => {
  if (cart.length > 0 && confirm("ต้องการล้างตะกร้าเกมทั้งหมดใช่หรือไม่?")) {
    cart = [];
    saveCart();
    renderCart();
  }
});

function saveCart() {
  localStorage.setItem("backoffice_cart", JSON.stringify(cart));
}

function renderCart() {
  cartList.innerHTML = "";
  cartCount.textContent = cart.length;
  
  if (cart.length === 0) {
    cartList.innerHTML = `<div class="cart-empty">ไม่มีรายการในตะกร้า ค้นหาด้านบนเพื่อเพิ่มเกม</div>`;
    updateCalculations();
    return;
  }
  
  cart.forEach((item, idx) => {
    const el = document.createElement("div");
    el.className = `cart-item ${item.selected ? '' : 'unselected'}`;
    
    el.innerHTML = `
      <input type="checkbox" class="cart-checkbox" ${item.selected ? 'checked' : ''} />
      <img class="cart-thumb" src="images/${item.index}.jpg" onerror="this.src='https://placehold.co/100x125/000/fff?text=No+Cover';" />
      <div class="cart-info">
        <div class="cart-title">${item.title}</div>
        <div class="cart-meta">
          <span class="cart-index">#${item.index}</span> · 
          ${item.emu_note && item.emu_note !== "PS4" ? `<span class="emu-badge">${item.emu_note}</span> · ` : ''}
          <span>ID: ${item.game_ids.join('/')}</span> · 
          <span class="cart-size">${item.size_gb.toFixed(1)} GB</span>
        </div>
      </div>
      <div class="cart-controls">
        <button class="btn-arrow btn-up" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''}>▲</button>
        <button class="btn-arrow btn-down" ${idx === cart.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>▼</button>
      </div>
      <button class="btn-remove">✕</button>
    `;
    
    // Bind click to thumbnail cover for zoom pop-up
    el.querySelector(".cart-thumb").addEventListener("click", () => {
      openImageModal(`images/${item.index}.jpg`, item.title);
    });
    
    el.querySelector(".cart-checkbox").addEventListener("change", (e) => {
      toggleItemSelection(item.index, e.target.checked);
    });
    
    el.querySelector(".btn-up").addEventListener("click", () => moveItem(item.index, -1));
    el.querySelector(".btn-down").addEventListener("click", () => moveItem(item.index, 1));
    el.querySelector(".btn-remove").addEventListener("click", () => removeCartItem(item.index));
    
    cartList.appendChild(el);
  });
  
  updateCalculations();
}

capacitySelect.addEventListener("change", (e) => {
  const val = e.target.value;
  localStorage.setItem("backoffice_capacity_key", val);
  if (val === "custom") {
    customCapacityInput.style.display = "inline-block";
    customCapacityInput.focus();
  } else {
    customCapacityInput.style.display = "none";
    targetCapacityGb = CAPACITIES[val] || 852;
    updateCalculations();
  }
});

customCapacityInput.addEventListener("input", (e) => {
  const val = parseFloat(e.target.value) || 0;
  targetCapacityGb = val;
  localStorage.setItem("backoffice_capacity_val", val);
  updateCalculations();
});

function updateCalculations() {
  let totalSelectedGb = 0;
  cart.forEach(item => {
    if (item.selected) {
      totalSelectedGb += item.size_gb;
    }
  });
  
  const percent = targetCapacityGb > 0 ? (totalSelectedGb / targetCapacityGb) * 100 : 0;
  
  progressBar.style.width = `${Math.min(percent, 100)}%`;
  statSize.textContent = `${totalSelectedGb.toFixed(1)} GB / ${targetCapacityGb.toFixed(1)} GB`;
  statPercent.textContent = `${percent.toFixed(1)}%`;
  
  progressBar.className = "progress-bar-fill";
  statPercent.className = "";
  if (percent > 100) {
    progressBar.classList.add("danger");
    statPercent.classList.add("danger");
  } else if (percent > 85) {
    progressBar.classList.add("warning");
    statPercent.classList.add("warning");
  }
  
  generateOutputTexts(totalSelectedGb);
}

function generateOutputTexts(totalSelectedGb) {
  const selectedIndexes = cart
    .filter(item => item.selected)
    .map(item => item.index)
    .join(",");
  
  indexesOutput.value = selectedIndexes;
  
  let report = "=== รายการเกมที่เลือก (SELECTED) ===\n";
  let count = 1;
  cart.forEach(item => {
    if (item.selected) {
      report += `${count}. [${item.index}] ${item.title} (ID: ${item.game_ids.join('/')}) - ${item.size_gb.toFixed(1)} GB\n`;
      count++;
    }
  });
  report += `ขนาดความจุรวม: ${totalSelectedGb.toFixed(1)} GB (${statPercent.textContent} ของความจุเป้าหมาย)\n\n`;
  
  const unselected = cart.filter(item => !item.selected);
  if (unselected.length > 0) {
    report += "=== รายการสำรอง/ที่คัดออก (UNSELECTED LOG) ===\n";
    unselected.forEach((item, index) => {
      report += `${index + 1}. [${item.index}] ${item.title} (ID: ${item.game_ids.join('/')}) - ${item.size_gb.toFixed(1)} GB\n`;
    });
  }
  
  reportOutput.value = report;
}

function copyTextToClipboard(text, btn) {
  if (!text) return;
  
  const showSuccess = () => {
    const originalText = btn.textContent;
    btn.textContent = "คัดลอกเรียบร้อย! ✓";
    btn.style.backgroundColor = "var(--green)";
    btn.style.color = "#fff";
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.backgroundColor = "";
      btn.style.color = "";
    }, 1500);
  };

  const fallbackCopy = (val) => {
    const textArea = document.createElement("textarea");
    textArea.value = val;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999);
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) showSuccess();
      else alert("คัดลอกไม่สำเร็จ");
    } catch (err) {
      document.body.removeChild(textArea);
      alert("คัดลอกไม่สำเร็จ: " + err);
    }
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(showSuccess)
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

document.getElementById("btnCopyIndexes").addEventListener("click", (e) => {
  copyTextToClipboard(indexesOutput.value, e.target);
});

document.getElementById("btnCopyReport").addEventListener("click", (e) => {
  copyTextToClipboard(reportOutput.value, e.target);
});

// Image Modal Popup handlers
window.openImageModal = function(imgSrc, title) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImg");
  const modalCaption = document.getElementById("modalCaption");
  const modalCheatBtn = document.getElementById("modalCheatBtn");
  
  modalImg.src = imgSrc;
  modalCaption.textContent = title;
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  
  const index = imgSrc.split("/").pop().replace(".jpg", "");
  const game = db.find(item => item.index === index);
  currentModalItem = game;
  
  if (game && game.cheats && Object.keys(game.cheats).length > 0) {
    modalCheatBtn.style.display = "inline-flex";
  } else {
    modalCheatBtn.style.display = "none";
  }
};

window.closeModal = function() {
  const modal = document.getElementById("imageModal");
  modal.style.display = "none";
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
};

document.getElementById("modalCheatBtn").addEventListener("click", () => {
  if (currentModalItem && currentModalItem.cheats) {
    openCheatModal(currentModalItem);
  }
});

// Cheat Modal Handlers
window.openCheatModal = function(game) {
  const modal = document.getElementById("cheatModal");
  const titleEl = document.getElementById("cheatModalTitle");
  titleEl.textContent = game.title;
  
  const tabsEl = document.getElementById("cheatCusaTabs");
  const containerEl = document.getElementById("cheatBlocksContainer");
  
  tabsEl.innerHTML = "";
  containerEl.innerHTML = "";
  
  const cusas = Object.keys(game.cheats);
  if (cusas.length === 0) return;
  
  cusas.forEach((cusa, idx) => {
    const tab = document.createElement("button");
    tab.className = `cheat-tab-btn ${idx === 0 ? 'active' : ''}`;
    tab.textContent = cusa;
    tab.addEventListener("click", () => {
      document.querySelectorAll(".cheat-tab-btn").forEach(btn => btn.classList.remove("active"));
      tab.classList.add("active");
      renderCheatCusaBlocks(cusa, game.cheats[cusa]);
    });
    tabsEl.appendChild(tab);
  });
  
  renderCheatCusaBlocks(cusas[0], game.cheats[cusas[0]]);
  modal.style.display = "flex";
};

window.closeCheatModal = function() {
  const modal = document.getElementById("cheatModal");
  modal.style.display = "none";
};

function renderCheatCusaBlocks(cusa, entries) {
  const containerEl = document.getElementById("cheatBlocksContainer");
  containerEl.innerHTML = "";
  
  entries.forEach(entry => {
    const block = document.createElement("div");
    block.className = "cheat-version-block";
    
    const creators = entry.creators ? entry.creators.join(", ") : "-";
    const version = entry.version || "-";
    
    let badgesHtml = "";
    const formats = entry.formats || {};
    ["json", "mc4", "shn"].forEach(fmt => {
      const fdata = formats[fmt] || {};
      const hasFile = fdata.hasFile;
      const count = hasFile ? (fdata.cheatsCount || (fdata.cheats ? fdata.cheats.length : 0)) : null;
      const badgeText = hasFile ? `${fmt.toUpperCase()}: ${count}` : `${fmt.toUpperCase()}: -`;
      badgesHtml += `<span class="cheat-badge ${hasFile ? 'active' : ''}">${badgeText}</span>`;
    });
    
    let cheatLines = [];
    ["json", "shn", "mc4"].forEach(fmt => {
      const fdata = formats[fmt] || {};
      if (fdata.hasFile) {
        const cheats = fdata.cheats || [];
        cheatLines.push(`[${fmt.toUpperCase()}] ${fdata.cheatsCount || cheats.length} cheats`);
        cheats.forEach(cheat => {
          cheatLines.push(`- ${cheat}`);
        });
        cheatLines.push("");
      }
    });
    const cheatText = cheatLines.join("\n").trim() || "ไม่มีรายการสูตรโกงใน format ที่มีไฟล์";
    
    block.innerHTML = `
      <div class="cheat-meta-row">
        <span class="cheat-meta-strong">Version:</span> ${version} · 
        <span class="cheat-meta-strong">Creator:</span> ${creators}
      </div>
      <div class="cheat-badges">${badgesHtml}</div>
      <textarea class="cheat-textarea" readonly>${cheatText}</textarea>
      <button class="btn-copy-cheat">📋 คัดลอกสูตรโกง (Copy)</button>
    `;
    
    const clipboardText = [
      entry.title || "Untitled",
      `ID: ${cusa}`,
      `Version: ${version}`,
      `Creator: ${creators}`,
      ["json", "mc4", "shn"].map(fmt => {
        const fdata = formats[fmt] || {};
        return fdata.hasFile ? `${fmt.toUpperCase()}: ${fdata.cheatsCount || (fdata.cheats ? fdata.cheats.length : 0)}` : `${fmt.toUpperCase()}: -`;
      }).join(" | "),
      "",
      "Cheats:",
      cheatText
    ].join("\n").trim();
    
    block.querySelector(".btn-copy-cheat").addEventListener("click", (e) => {
      copyTextToClipboard(clipboardText, e.target);
    });
    
    containerEl.appendChild(block);
  });
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeCheatModal();
  }
});

// Boot check
const authed = localStorage.getItem("backoffice_auth") === "true";
if (authed) {
  showDashboard();
} else {
  authOverlay.style.display = "flex";
  appContainer.style.display = "none";
}
