function loadModelInfo() {
  let item = localStorage.getItem("item");
  const model = localStorage.getItem("model");

  if (!item || !model) {
    alert("No model selected!");
    window.location.href = "home.html";
    return;
  }

  document.getElementById("modelName").innerText = item.toUpperCase();
  document.getElementById("modelType").innerText = model.toUpperCase();

  const itemLower = item.toLowerCase();
  const imgEl = document.getElementById("modelImage");

  const formats = ["png", "jpg", "jpeg"];
  let found = false;

  formats.forEach(ext => {
    if (found) return;
    const testPath = `assets/${itemLower}.${ext}`;
    const img = new Image();
    img.onload = () => { imgEl.src = testPath; found = true; };
    img.onerror = () => {};
    img.src = testPath;
  });

  setTimeout(() => {
    if (!found) imgEl.src = "assets/placeholder.png";
  }, 200);
}

// Threshold setup
const slider = document.getElementById("thresholdSlider");
const labelValue = document.getElementById("thresholdValue");

const savedThreshold = localStorage.getItem("threshold") || "0.7";
slider.value = savedThreshold;
labelValue.innerText = savedThreshold;

slider.oninput = () => {
  labelValue.innerText = slider.value;
  localStorage.setItem("threshold", slider.value);
};

// Navigation funcs
function goBack() { window.location.href = "home.html"; }
function goLive() { window.location.href = "live.html"; }
function goBatch() { window.location.href = "batch.html"; }
function goSingle() { window.location.href = "single.html"; }

loadModelInfo();

window.goBack = goBack;
window.goLive = goLive;
window.goBatch = goBatch;
window.goSingle = goSingle;
