const apiBase = "http://127.0.0.1:8000";

function goBack() {
  window.location.href = "mode.html";
}

window.goBack = goBack;

document
  .getElementById("folderInput")
  .addEventListener("change", handleFolderSelect);

function triggerFolderSelect() {
  const input = document.getElementById("folderInput");
  input.value = ""; // allow selecting same folder again
  input.click();
}

async function handleFolderSelect(event) {
  const files = Array.from(event.target.files).filter(f =>
    f.type.startsWith("image/")
  );

  if (files.length === 0) return alert("No images found in selected folder");

  document.getElementById("folderName").innerText =
    event.target.files[0].webkitRelativePath.split("/")[0];

  runBatch(files);

  // reset so selecting same folder again works
  document.getElementById("folderInput").value = "";
}

async function runBatch(files) {
  const resultsTable = document.getElementById("resultsTable");
  const tbody = resultsTable.querySelector("tbody");
  const resultsContainer = document.getElementById("resultsContainer");

  tbody.innerHTML = "";
  resultsContainer.innerHTML = "";
  resultsTable.classList.remove("hidden");

  const progressBox = document.getElementById("progressBox");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  progressBox.classList.remove("hidden");

  const item = localStorage.getItem("item");
  const model = localStorage.getItem("model");
  const threshold = localStorage.getItem("threshold") || "0.7";

  for (let i = 0; i < files.length; i++) {
    const formData = new FormData();
    formData.append("item", item);
    formData.append("model", model);
    formData.append("threshold", threshold);
    formData.append("file", files[i]);

    const res = await fetch(`${apiBase}/analyze`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    const statusClass = data.label === "ANOMALY" ? "danger" : "success";

    // Add to table
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${files[i].name}</td>
      <td class="${statusClass}">${data.label}</td>
      <td>${data.score}</td>
    `;
    tbody.appendChild(row);

    // Add to card grid
    const imgURL = URL.createObjectURL(files[i]);
    const card = document.createElement("div");
    card.className = `card ${statusClass}`;
    card.innerHTML = `
      <img class="card-img" src="${imgURL}">
      <div class="card-body">
        <p><strong>${files[i].name}</strong></p>
        <p class="${statusClass}">${data.label}</p>
        <p>Score: ${data.score}</p>
      </div>
    `;
    resultsContainer.appendChild(card);

    progressText.innerText = `${i + 1} / ${files.length}`;
    progressBar.style.width = `${((i + 1) / files.length) * 100}%`;
  }

  progressBox.classList.add("hidden");
}
