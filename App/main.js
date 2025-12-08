const { app, BrowserWindow, ipcMain, Menu, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

Menu.setApplicationMenu(null);

let mainWindow;

// Absolute paths to models and assets
const BASE_MODELS = "X:/projectAnomalyFinalFinal/models";
const BASE_ASSETS = "X:/projectAnomalyFinalFinal/App/renderer/assets";

// Ensure base folders exist
if (!fs.existsSync(BASE_MODELS)) fs.mkdirSync(BASE_MODELS, { recursive: true });
if (!fs.existsSync(BASE_ASSETS)) fs.mkdirSync(BASE_ASSETS, { recursive: true });

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    }
  });
  

  mainWindow.loadFile(path.join(__dirname, "renderer/home.html"));
}

app.whenReady().then(createWindow);

// FILE PICK DIALOG
ipcMain.handle("open-file-dialog", async (event, key) => {
  const filters =
    key.includes("Xml") ? [{ name: "XML", extensions: ["xml"] }] :
    key.includes("Bin") ? [{ name: "BIN", extensions: ["bin"] }] :
    [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }];

  const result = await dialog.showOpenDialog({ properties: ["openFile"], filters });
  return result.canceled ? null : result.filePaths[0];
});

// UTILITY: Safe file copy
function safeCopy(src, dest) {
  if (!src || !fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// ADD MODEL
ipcMain.handle("add-model", async (event, data) => {
  const item = data.name.trim().toLowerCase();
  const itemDir = path.join(BASE_MODELS, item);

  fs.mkdirSync(itemDir, { recursive: true });

  safeCopy(data.padimXml, path.join(itemDir, "padim", "model.xml"));
  safeCopy(data.padimBin, path.join(itemDir, "padim", "model.bin"));
  safeCopy(data.pcXml, path.join(itemDir, "patchcore", "model.xml"));
  safeCopy(data.pcBin, path.join(itemDir, "patchcore", "model.bin"));

  if (data.itemImage) {
    const ext = path.extname(data.itemImage);
    safeCopy(data.itemImage, path.join(BASE_ASSETS, `${item}${ext}`));
  }

  console.log("✔ Model saved:", item);
  return true;
});

// DELETE MODEL + Unload from FastAPI
ipcMain.handle("delete-model", async (event, item) => {
  const itemDir = path.join(BASE_MODELS, item);
  console.log("\n🗑 Deleting:", item);

  try {
    // 1️⃣ Ask FastAPI to unload models from memory first
    await fetch("http://127.0.0.1:8000/models/unload", { method: "POST" });
    console.log("✓ Backend models unloaded");

    // 2️⃣ Remove model folder
    if (fs.existsSync(itemDir)) {
      fs.rmSync(itemDir, { recursive: true, force: true });
      console.log("🗂️ Removed model folder:", itemDir);
    }

    // 3️⃣ Remove preview asset image
    ["png", "jpg", "jpeg"].forEach((ext) => {
      const img = path.join(BASE_ASSETS, `${item}.${ext}`);
      if (fs.existsSync(img)) {
        fs.unlinkSync(img);
        console.log("🖼️ Removed:", img);
      }
    });

    console.log("✔ Delete complete:", item);
    return true;

  } catch (err) {
    console.error("❌ Delete error:", err);
    return false;
  }
});
