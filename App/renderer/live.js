let stream = null;
let detectionLoop = null;
const apiBase = "http://127.0.0.1:8000";

function loadModelDetails() {
  const item = localStorage.getItem("item");
  const model = localStorage.getItem("model");

  if (!item || !model) {
    alert("No model selected!");
    window.location.href = "home.html";
    return;
  }

  document.getElementById("liveModelName").innerText = item.toUpperCase();
  document.getElementById("liveModelType").innerText = model.toUpperCase();

  const threshold = localStorage.getItem("threshold") || "0.7";
  document.getElementById("thresholdValue").innerText = threshold;
}


async function startCamera() {
  const video = document.getElementById("camera");
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    document.getElementById("startBtn").disabled = true;
    document.getElementById("stopBtn").disabled = false;
    document.getElementById("stopBtn").classList.add("enabled");

    startDetection();
  } catch {
    alert("Camera not accessible!");
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  stopDetection();

  document.getElementById("startBtn").disabled = false;
  document.getElementById("stopBtn").disabled = true;
  document.getElementById("stopBtn").classList.remove("enabled");

  resetOverlay();
}

async function startDetection() {
  const video = document.getElementById("camera");
  const overlay = document.getElementById("result-overlay");

  const item = localStorage.getItem("item");
  const model = localStorage.getItem("model");

  detectionLoop = setInterval(async () => {
    if (!stream) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.7)
    );

    // Get threshold correctly as a number
    const threshold = parseFloat(localStorage.getItem("threshold") || "0.7");

    const formData = new FormData();
    formData.append("file", blob, "frame.jpg");
    formData.append("item", item);
    formData.append("model", model);
    formData.append("threshold", threshold.toString());

    try {
      const res = await fetch(`${apiBase}/analyze`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      overlay.innerText = `${data.label} (${data.score})`;

      overlay.style.color =
        data.label === "NORMAL" ? "#52ff7c" : "#ff4d4d";
    } catch {
      overlay.innerText = "API ERROR";
      overlay.style.color = "#ff4d4d";
    }
  }, 300);
}

function stopDetection() {
  if (detectionLoop) clearInterval(detectionLoop);
  detectionLoop = null;
}

function resetOverlay() {
  const overlay = document.getElementById("result-overlay");
  overlay.innerText = "...";
  overlay.style.color = "var(--text)";
}

function goBack() {
  stopCamera();
  window.location.href = "mode.html";
}

document.getElementById("startBtn").onclick = startCamera;
document.getElementById("stopBtn").onclick = stopCamera;

loadModelDetails();
