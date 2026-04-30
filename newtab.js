const DEFAULT_WALLPAPER =
  "https://images.unsplash.com/photo-1511300636408-a63a89df3482?auto=format&fit=crop&w=1800&q=80";

const DEFAULT_HERO_IMAGE =
  "https://animesher.com/orig/1/161/1619/16191/animesher.com_purple-sakura-sky-1619127.gif";

const DEFAULT_SHORTCUTS = [
  { name: "YouTube", url: "https://www.youtube.com" },
  { name: "GitHub", url: "https://github.com" },
  { name: "Gmail", url: "https://mail.google.com" },
  { name: "X", url: "https://x.com" }
];

const wallpaperLayer = document.querySelector(".wallpaper-layer");
const shortcutGrid = document.getElementById("shortcutGrid");
const shortcutTemplate = document.getElementById("shortcutItemTemplate");

const shortcutModal = document.getElementById("shortcutModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalBackdrop = document.getElementById("modalBackdrop");
const shortcutForm = document.getElementById("shortcutForm");
const shortcutUrlInput = document.getElementById("shortcutUrl");

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

const lensModal = document.getElementById("lensModal");
const openLensModalBtn = document.getElementById("openLensModal");
const closeLensBtn = document.getElementById("closeLensBtn");
const lensBackdrop = document.getElementById("lensBackdrop");
const lensDropzone = document.getElementById("lensDropzone");
const lensPicker = document.getElementById("lensPicker");
const lensUploadForm = document.getElementById("lensUploadForm");
const lensUploadBtn = document.getElementById("lensUploadBtn");
const lensUrlForm = document.getElementById("lensUrlForm");
const lensUrlInput = document.getElementById("lensUrlInput");

const wallpaperInput = document.getElementById("wallpaperInput");
const heroImage = document.getElementById("heroImage");
const heroImageInput = document.getElementById("heroImageInput");
const heroImageContainer = document.getElementById("heroImageContainer");

const cropModal = document.getElementById("cropModal");
const closeCropBtn = document.getElementById("closeCropBtn");
const cropBackdrop = document.getElementById("cropBackdrop");
const cropArea = document.getElementById("cropArea");
const cropImage = document.getElementById("cropImage");
const cropZoom = document.getElementById("cropZoom");
const saveCropBtn = document.getElementById("saveCropBtn");

let cropState = {
  img: null,
  x: 0,
  y: 0,
  scale: 1,
  minScale: 0.1,
  isDragging: false,
  startX: 0,
  startY: 0
};

const clockEl = document.getElementById("clock");
const dateTextEl = document.getElementById("dateText");
const greetingTextEl = document.getElementById("greetingText");

const contextMenu = document.getElementById("shortcutContextMenu");
const editShortcutCmd = document.getElementById("editShortcutCmd");
const deleteShortcutCmd = document.getElementById("deleteShortcutCmd");

let shortcutsState = [];
let draggedIndex = null;
let activeContextMenuIndex = null;
let userName = "";

async function fetchUserName() {
  try {
    if (chrome.identity && chrome.identity.getProfileUserInfo) {
      const userInfo = await chrome.identity.getProfileUserInfo({ accountStatus: "ANY" });
      if (userInfo.email) {
        const namePart = userInfo.email.split('@')[0];
        const cleanName = namePart.replace(/[0-9]/g, '').replace(/\./g, ' ').trim();
        if (cleanName) {
          userName = cleanName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
      }
    }
  } catch (e) {
    console.error("Failed to get user name:", e);
  }
}

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function normalizeUrl(url) {
  const value = (url || "").trim();
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) {
    return `https://${value}`;
  }
  return value;
}

function moveItem(list, fromIndex, toIndex) {
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function faviconURL(siteUrl) {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", siteUrl);
  url.searchParams.set("size", "64");
  return url.toString();
}

async function getData() {
  const syncData = await chrome.storage.sync.get(["shortcuts"]);
  const localData = await chrome.storage.local.get(["wallpaper", "heroImage"]);
  return {
    shortcuts:
      Array.isArray(syncData.shortcuts) && syncData.shortcuts.length
        ? syncData.shortcuts
        : DEFAULT_SHORTCUTS,
    wallpaper: localData.wallpaper || DEFAULT_WALLPAPER,
    heroImage: localData.heroImage || DEFAULT_HERO_IMAGE
  };
}

async function saveShortcuts(shortcuts) {
  await chrome.storage.sync.set({ shortcuts });
}

async function saveWallpaper(wallpaper) {
  await chrome.storage.local.set({ wallpaper });
}

async function saveHeroImage(heroImage) {
  await chrome.storage.local.set({ heroImage });
}

function setWallpaper(src) {
  if (!src) return;

  const img = new Image();
  img.onload = () => {
    wallpaperLayer.style.backgroundImage = `url("${src}")`;
    wallpaperLayer.style.opacity = "1";
  };
  img.src = src;
}

function setHeroImage(src) {
  if (!heroImage || !heroImageContainer) return;
  if (!src) {
    heroImage.removeAttribute("src");
    heroImageContainer.classList.remove("has-image");
    return;
  }
  heroImage.src = src;
  heroImageContainer.classList.add("has-image");
}

function createEmptyState() {
  const div = document.createElement("div");
  div.className = "empty-state";
  div.textContent = "No shortcuts yet";
  return div;
}

function createAddShortcutButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "shortcut-icon-wrap add-shortcut";
  button.setAttribute("aria-label", "Add shortcut");
  button.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14"></path>
      <path d="M5 12h14"></path>
    </svg>
  `;
  button.addEventListener("click", openModal);
  return button;
}

function renderShortcuts(shortcuts) {
  shortcutGrid.innerHTML = "";

  if (!shortcuts.length) {
    shortcutGrid.appendChild(createEmptyState());
    shortcutGrid.appendChild(createAddShortcutButton());
    return;
  }

  shortcuts.forEach((item, index) => {
    const node = shortcutTemplate.content.firstElementChild.cloneNode(true);
    const icon = node.querySelector(".shortcut-icon");

    const safeUrl = normalizeUrl(item.url);
    const safeName = (item.name || getHostname(safeUrl)).trim();

    node.href = safeUrl;
    node.dataset.index = String(index);
    node.setAttribute("aria-label", safeName);

    icon.src = faviconURL(safeUrl);
    icon.alt = `${safeName} icon`;

    icon.addEventListener("error", () => {
      icon.src =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect width="64" height="64" rx="18" fill="rgba(255,255,255,0.16)"/>
            <path d="M20 32h24" stroke="white" stroke-opacity=".92" stroke-width="4" stroke-linecap="round"/>
            <path d="M32 20v24" stroke="white" stroke-opacity=".92" stroke-width="4" stroke-linecap="round"/>
          </svg>
        `);
    });

    node.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      activeContextMenuIndex = index;

      const rect = node.getBoundingClientRect();
      contextMenu.style.left = `${rect.left + (rect.width / 2)}px`;
      contextMenu.style.top = `${rect.bottom + 8}px`;
      contextMenu.style.transform = `translateX(-50%)`;
      contextMenu.classList.remove("hidden");
    });

    node.addEventListener("dragstart", (event) => {
      draggedIndex = Number(node.dataset.index);
      node.classList.add("dragging");

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", node.dataset.index);
      }
    });

    node.addEventListener("dragover", (event) => {
      event.preventDefault();
      node.classList.add("drag-over");
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    });

    node.addEventListener("dragleave", () => {
      node.classList.remove("drag-over");
    });

    node.addEventListener("drop", async (event) => {
      event.preventDefault();
      node.classList.remove("drag-over");

      const targetIndex = Number(node.dataset.index);
      const fromIndex = Number(
        event.dataTransfer?.getData("text/plain") || draggedIndex
      );

      if (
        Number.isNaN(fromIndex) ||
        Number.isNaN(targetIndex) ||
        fromIndex === targetIndex
      ) {
        return;
      }

      const nextShortcuts = moveItem(shortcutsState, fromIndex, targetIndex);
      shortcutsState = nextShortcuts;
      await saveShortcuts(nextShortcuts);
      renderShortcuts(nextShortcuts);
    });

    node.addEventListener("dragend", () => {
      node.classList.remove("dragging");
      node.classList.remove("drag-over");
    });

    shortcutGrid.appendChild(node);
  });

  shortcutGrid.appendChild(createAddShortcutButton());
}

async function addShortcut(name, url) {
  const data = await getData();
  const next = [
    ...data.shortcuts,
    {
      name: (name || "").trim(),
      url: normalizeUrl(url)
    }
  ];
  await saveShortcuts(next);
  return next;
}

async function removeShortcut(index) {
  const data = await getData();
  const next = data.shortcuts.filter((_, i) => i !== index);
  await saveShortcuts(next);
  return next;
}

function openModal() {
  shortcutModal.classList.remove("hidden");
  shortcutModal.setAttribute("aria-hidden", "false");
  setTimeout(() => shortcutUrlInput.focus(), 40);
}

function openEditModal(index) {
  const item = shortcutsState[index];
  if (!item) return;

  shortcutUrlInput.value = item.url || "";
  activeContextMenuIndex = index;

  openModal();
}

function closeModal() {
  shortcutModal.classList.add("hidden");
  shortcutModal.setAttribute("aria-hidden", "true");
  shortcutForm.reset();
  activeContextMenuIndex = null;
}

function openLensModal() {
  lensModal.classList.remove("hidden");
  lensModal.setAttribute("aria-hidden", "false");
}

function closeLensModal() {
  lensModal.classList.add("hidden");
  lensModal.setAttribute("aria-hidden", "true");
}

function updateClock() {
  const now = new Date();

  clockEl.textContent = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });

  dateTextEl.textContent = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const hour = now.getHours();
  let greeting = "Welcome";

  if (hour >= 5 && hour < 11) greeting = "Good morning";
  else if (hour >= 11 && hour < 15) greeting = "Good afternoon";
  else if (hour >= 15 && hour < 18) greeting = "Good evening";
  else greeting = "Good night";

  if (userName) {
    greeting += `, ${userName}`;
  }

  greetingTextEl.textContent = greeting;
}

function submitLensUpload() {
  if (!lensPicker || !lensUploadForm) return;
  if (!lensPicker.files || !lensPicker.files.length) return;

  lensUploadForm.submit();

  setTimeout(() => {
    lensPicker.value = "";
    closeLensModal();
  }, 500);
}

async function init() {
  await fetchUserName();

  updateClock();
  setInterval(updateClock, 1000);

  const data = await getData();

  wallpaperLayer.style.opacity = "0";

  setWallpaper(data.wallpaper);
  setHeroImage(data.heroImage);
  shortcutsState = data.shortcuts;
  renderShortcuts(data.shortcuts);
}

closeModalBtn?.addEventListener("click", closeModal);
modalBackdrop?.addEventListener("click", closeModal);

document.addEventListener("click", (e) => {
  if (contextMenu && !contextMenu.contains(e.target)) {
    contextMenu.classList.add("hidden");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!shortcutModal.classList.contains("hidden")) closeModal();
    if (!lensModal.classList.contains("hidden")) closeLensModal();
    if (contextMenu && !contextMenu.classList.contains("hidden")) {
      contextMenu.classList.add("hidden");
    }
  }
});

async function updateShortcut(index, name, url) {
  const data = await getData();
  const next = [...data.shortcuts];
  next[index] = { name: (name || "").trim(), url: normalizeUrl(url) };
  await saveShortcuts(next);
  return next;
}

shortcutForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = shortcutUrlInput.value.trim();

  if (!url) return;

  try {
    let nextShortcuts;
    if (activeContextMenuIndex !== null) {
      nextShortcuts = await updateShortcut(activeContextMenuIndex, "", url);
    } else {
      nextShortcuts = await addShortcut("", url);
    }
    shortcutsState = nextShortcuts;
    renderShortcuts(nextShortcuts);
    closeModal();
  } catch (error) {
    console.error("Failed to save shortcut:", error);
  }
});

editShortcutCmd?.addEventListener("click", () => {
  contextMenu.classList.add("hidden");
  if (activeContextMenuIndex !== null) {
    openEditModal(activeContextMenuIndex);
  }
});

deleteShortcutCmd?.addEventListener("click", async () => {
  contextMenu.classList.add("hidden");
  if (activeContextMenuIndex !== null) {
    const nextShortcuts = await removeShortcut(activeContextMenuIndex);
    shortcutsState = nextShortcuts;
    renderShortcuts(nextShortcuts);
    activeContextMenuIndex = null;
  }
});

openLensModalBtn?.addEventListener("click", openLensModal);
closeLensBtn?.addEventListener("click", closeLensModal);
lensBackdrop?.addEventListener("click", closeLensModal);

lensDropzone?.addEventListener("dragover", (event) => {
  event.preventDefault();
  lensDropzone.classList.add("drag-over");
});

lensDropzone?.addEventListener("dragleave", () => {
  lensDropzone.classList.remove("drag-over");
});

lensDropzone?.addEventListener("drop", (event) => {
  event.preventDefault();
  lensDropzone.classList.remove("drag-over");

  const file = event.dataTransfer?.files?.[0];
  if (!file || !lensPicker) return;

  const transfer = new DataTransfer();
  transfer.items.add(file);
  lensPicker.files = transfer.files;
  submitLensUpload();
});

lensDropzone?.addEventListener("click", (event) => {
  const blocked = event.target.closest("button, input, form");
  if (blocked) return;
  lensPicker?.click();
});

lensUploadBtn?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  lensPicker?.click();
});

lensPicker?.addEventListener("change", () => {
  submitLensUpload();
});

lensUrlForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const url = lensUrlInput?.value.trim();
  if (!url) return;

  window.open(
    `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(url)}`,
    "_blank",
    "noopener,noreferrer"
  );

  lensUrlInput.value = "";
  closeLensModal();
});

searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const query = searchInput?.value.trim();
  if (!query) return;

  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  window.location.href = url;
});

function openCropModal(imgSrc) {
  cropModal?.classList.remove("hidden");

  const img = new Image();
  img.onload = () => {
    cropState.img = img;
    cropImage.src = imgSrc;

    const areaRect = cropArea.getBoundingClientRect();
    const scaleX = areaRect.width / img.width;
    const scaleY = areaRect.height / img.height;
    const minScale = Math.max(scaleX, scaleY);

    cropState.minScale = minScale;
    cropState.scale = minScale;
    cropZoom.min = minScale;
    cropZoom.max = minScale * 5;
    cropZoom.value = minScale;

    cropState.x = (areaRect.width - (img.width * minScale)) / 2;
    cropState.y = (areaRect.height - (img.height * minScale)) / 2;

    updateCropView();
  };
  img.src = imgSrc;
}

function closeCropModal() {
  cropModal?.classList.add("hidden");
  cropImage.src = "";
  cropState.img = null;
  wallpaperInput.value = "";
}

function updateCropView() {
  if (!cropState.img) return;
  const areaRect = cropArea.getBoundingClientRect();

  const scaledWidth = cropState.img.width * cropState.scale;
  const scaledHeight = cropState.img.height * cropState.scale;

  if (cropState.x > 0) cropState.x = 0;
  if (cropState.y > 0) cropState.y = 0;
  if (cropState.x + scaledWidth < areaRect.width) cropState.x = areaRect.width - scaledWidth;
  if (cropState.y + scaledHeight < areaRect.height) cropState.y = areaRect.height - scaledHeight;

  cropImage.style.transform = `translate(${cropState.x}px, ${cropState.y}px) scale(${cropState.scale})`;
}

cropZoom?.addEventListener("input", (e) => {
  const newScale = parseFloat(e.target.value);
  const areaRect = cropArea.getBoundingClientRect();

  const centerX = areaRect.width / 2;
  const centerY = areaRect.height / 2;

  const imgCenterX = (centerX - cropState.x) / cropState.scale;
  const imgCenterY = (centerY - cropState.y) / cropState.scale;

  cropState.scale = newScale;
  cropState.x = centerX - (imgCenterX * cropState.scale);
  cropState.y = centerY - (imgCenterY * cropState.scale);

  updateCropView();
});

cropArea?.addEventListener("mousedown", (e) => {
  cropState.isDragging = true;
  cropState.startX = e.clientX - cropState.x;
  cropState.startY = e.clientY - cropState.y;
  cropArea.style.cursor = "grabbing";
});

window.addEventListener("mousemove", (e) => {
  if (!cropState.isDragging) return;
  cropState.x = e.clientX - cropState.startX;
  cropState.y = e.clientY - cropState.startY;
  updateCropView();
});

window.addEventListener("mouseup", () => {
  cropState.isDragging = false;
  if (cropArea) cropArea.style.cursor = "grab";
});

closeCropBtn?.addEventListener("click", closeCropModal);
cropBackdrop?.addEventListener("click", closeCropModal);

saveCropBtn?.addEventListener("click", async () => {
  if (!cropState.img) return;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = 1920;
  canvas.height = 1080;

  const areaRect = cropArea.getBoundingClientRect();
  const ratioX = canvas.width / areaRect.width;
  const ratioY = canvas.height / areaRect.height;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(
    cropState.img,
    0, 0, cropState.img.width, cropState.img.height,
    cropState.x * ratioX, cropState.y * ratioY,
    cropState.img.width * cropState.scale * ratioX, cropState.img.height * cropState.scale * ratioY
  );

  const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
  setWallpaper(croppedDataUrl);
  await saveWallpaper(croppedDataUrl);

  closeCropModal();
});

heroImageInput?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async () => {
    const result = reader.result;
    if (typeof result !== "string") return;

    setHeroImage(result);
    await saveHeroImage(result);
    heroImageInput.value = "";
  };

  reader.readAsDataURL(file);
});

wallpaperInput?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    const result = reader.result;
    if (typeof result !== "string") return;

    if (file.type === "image/gif") {
      setWallpaper(result);
      await saveWallpaper(result);
      wallpaperInput.value = "";
    } else {
      openCropModal(result);
    }
  };

  reader.readAsDataURL(file);
});

init();