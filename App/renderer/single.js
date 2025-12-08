const apiBase = "http://127.0.0.1:8000";
let selectedFile = null;

function goBack() {
  window.location.href = "mode.html";
}
window.goBack = goBack;

function triggerSelect() {
  document.getElementById("fileInput").click();
}

document.getElementById("fileInput").onchange = (e) => {
  handleFile(e.target.files[0]);
};

function onDragOver(e) {
  e.preventDefault();
}
function onDrop(e) {
  e.preventDefault();
  handleFile(e.dataTransfer.files[0]);
}

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return;

  selectedFile = file;

  const previewImg = document.getElementById("previewImage");
  const reader = new FileReader();
  reader.onload = () => {
    previewImg.src = reader.result;
    previewImg.style.display = "block";
    document.getElementById("uploadText").style.display = "none";
    document.getElementById("analyzeBtn").disabled = false;
  };
  reader.readAsDataURL(file);
}

document.getElementById("analyzeBtn").onclick = async () => {
  if (!selectedFile) return;

  const item = localStorage.getItem("item");
  const model = localStorage.getItem("model");

  // Fetch threshold properly
  const threshold = parseFloat(localStorage.getItem("threshold") || "0.7");

  const formData = new FormData();
  formData.append("file", selectedFile);
  formData.append("item", item);
  formData.append("model", model);
  formData.append("threshold", threshold.toString());

  const res = await fetch(`${apiBase}/analyze`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  document.getElementById("resultLabel").innerText = `Result: ${data.label}`;
  document.getElementById("resultScore").innerText = `Score: ${data.score}`;

  document.getElementById("resultLabel").style.color =
    data.label === "NORMAL" ? "#52ff7c" : "#ff4d4d";
};

window.triggerSelect = triggerSelect;
window.onDragOver = onDragOver;
window.onDrop = onDrop;
