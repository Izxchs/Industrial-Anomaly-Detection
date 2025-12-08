const { ipcRenderer } = require("electron");

const apiBase = "http://127.0.0.1:8000";
let deleteTargetItem = null;

// Store selected file paths
const selectedFiles = {
  padimXml: null,
  padimBin: null,
  pcXml: null,
  pcBin: null,
  itemImage: null
};

// Reset Form Inputs + Labels
function resetAddModelForm() {
  document.getElementById("modelName").value = "";

  const labels = [
    "padimXml",
    "padimBin",
    "pcXml",
    "pcBin",
    "itemImage"
  ];

  labels.forEach(key => {
    selectedFiles[key] = null;
    const labelEl = document.getElementById(`${key}Label`);
    if (labelEl) labelEl.innerText = "No file chosen";
  });
}

// File selection
async function selectFile(key) {
  const filePath = await ipcRenderer.invoke("open-file-dialog", key);
  if (filePath) {
    selectedFiles[key] = filePath;
    document.getElementById(`${key}Label`).innerText = filePath.split("\\").pop();
  }
}

async function loadModels() {
  const res = await fetch(`${apiBase}/models`);
  const data = await res.json();

  const container = document.getElementById("itemContainer");
  container.innerHTML = "";

  Object.entries(data).forEach(([item, models]) => {
    const card = document.createElement("div");
    card.className = "card";

    const img = getImagePath(item);

    card.innerHTML = `
      <div class="card-img-container">
        <img src="${img}" class="card-img">
      </div>

      <div class="card-body">
        <div class="card-header">
          <h2>${item.toUpperCase()}</h2>
        </div>

        <div class="model-buttons">
          ${Object.keys(models)
            .map(
              (m) => `<button onclick="selectModel('${item}','${m}')">${m.toUpperCase()}</button>`
            )
            .join("")}
        </div>

        <div class="delete-row">
          <button class="card-delete-btn" onclick="openDeleteModel('${item}')">
            <img src="assets/delete.svg" class="card-delete-icon">
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function getImagePath(item) {
  const formats = ["png", "jpg", "jpeg"];
  for (const ext of formats) {
    const path = `assets/${item}.${ext}`;
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("HEAD", path, false);
      xhr.send();
      if (xhr.status !== 404) return path;
    } catch {}
  }
  return "assets/placeholder.png";
}

function selectModel(item, model) {
  localStorage.setItem("item", item);
  localStorage.setItem("model", model);
  window.location.href = "mode.html";
}

// Add Model Modal
function openAddModel() {
  resetAddModelForm(); // Clear form when opened
  document.getElementById("addModelModal").style.display = "flex";
}

function closeAddModel() {
  resetAddModelForm(); // Clear form when closed
  document.getElementById("addModelModal").style.display = "none";
}

async function submitModel() {
  const name = document.getElementById("modelName").value.trim();
  if (!name) return alert("Enter item name");

  const payload = { name, ...selectedFiles };
  await ipcRenderer.invoke("add-model", payload);

  resetAddModelForm(); // Clear after successful upload
  closeAddModel();
  loadModels();
}

// Delete Model
function openDeleteModel(item) {
  deleteTargetItem = item;
  document.getElementById("deleteModelModal").style.display = "flex";
}

function closeDeleteModel() {
  deleteTargetItem = null;
  document.getElementById("deleteModelModal").style.display = "none";
}

document.getElementById("confirmDeleteBtn").onclick = async () => {
  if (!deleteTargetItem) return;
  await ipcRenderer.invoke("delete-model", deleteTargetItem);
  closeDeleteModel();
  loadModels();
};

loadModels();

// Expose functions to HTML onclick
window.selectFile = selectFile;
window.openAddModel = openAddModel;
window.closeAddModel = closeAddModel;
window.submitModel = submitModel;
window.selectModel = selectModel;
window.openDeleteModel = openDeleteModel;
window.closeDeleteModel = closeDeleteModel;
