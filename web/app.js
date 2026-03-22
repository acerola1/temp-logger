import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  limit,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const temperatureEl = document.getElementById("temperature");
const humidityEl = document.getElementById("humidity");
const deviceIdEl = document.getElementById("deviceId");
const updatedAtEl = document.getElementById("updatedAt");
const tableBodyEl = document.getElementById("readingsTableBody");
const refreshButton = document.getElementById("refreshButton");

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function renderTable(items) {
  if (!items.length) {
    tableBodyEl.innerHTML = "<tr><td colspan=\"4\">Nincs adat.</td></tr>";
    return;
  }

  tableBodyEl.innerHTML = items
    .map(
      (item) => `
        <tr>
          <td>${formatTime(item.recordedAt)}</td>
          <td>${item.deviceId}</td>
          <td>${item.temperatureC.toFixed(1)} C</td>
          <td>${item.humidity.toFixed(1)} %</td>
        </tr>
      `
    )
    .join("");
}

async function loadReadings() {
  refreshButton.disabled = true;
  refreshButton.textContent = "Frissites...";

  try {
    const readingsQuery = query(
      collection(db, "sensorReadings"),
      orderBy("createdAt", "desc"),
      limit(25)
    );
    const snapshot = await getDocs(readingsQuery);
    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    renderTable(items);

    if (items.length > 0) {
      const latest = items[0];
      temperatureEl.textContent = `${latest.temperatureC.toFixed(1)} C`;
      humidityEl.textContent = `${latest.humidity.toFixed(1)} %`;
      deviceIdEl.textContent = latest.deviceId;
      updatedAtEl.textContent = formatTime(latest.recordedAt);
    }
  } catch (error) {
    console.error(error);
    tableBodyEl.innerHTML =
      "<tr><td colspan=\"4\">Nem sikerult beolvasni az adatokat.</td></tr>";
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Frissites";
  }
}

refreshButton.addEventListener("click", () => {
  loadReadings();
});

loadReadings();
