// ---- CONFIG ----
const API_BASE = "https://neo4j-poc-backend-cxgamwfct0vy.uaimmiau.deno.net/";

// ---- DOM refs ----
const apiBaseEl = document.getElementById("apiBase");
const healthDot = document.getElementById("healthDot");
const healthText = document.getElementById("healthText");

const suppliersResults = document.getElementById("suppliersResults");
const btnLoadSuppliers = document.getElementById("btnLoadSuppliers");

const traceForm = document.getElementById("traceForm");
const traceInput = document.getElementById("serialInput");
const traceResults = document.getElementById("traceResults");
const traceError = document.getElementById("traceError");

const btnClearDb = document.getElementById("btnClearDb");
const btnSeedDb = document.getElementById("btnSeedDb");
const btnRandomSerials = document.getElementById("btnRandomSerials");
const randomSerialsResults = document.getElementById("randomSerialsResults");

apiBaseEl.textContent = API_BASE;

// ---- helpers ----
function setHealth(status, message) {
    if (status === "ok") {
        healthDot.classList.add("ok");
        healthDot.classList.remove("err");
        healthText.textContent = message || "Healthy";
    } else if (status === "err") {
        healthDot.classList.add("err");
        healthDot.classList.remove("ok");
        healthText.textContent = message || "Backend unreachable";
    } else {
        healthDot.classList.remove("ok", "err");
        healthText.textContent = message || "Checking health…";
    }
}

function setResultsEmpty(el, text) {
    el.classList.add("results-empty");
    el.innerHTML = text;
}

function setResultsContent(el, html) {
    el.classList.remove("results-empty");
    el.innerHTML = html;
}

// ---- API calls ----

async function checkHealth() {
    setHealth("pending", "Checking health…");
    try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && data.ok) {
            setHealth("ok", "Healthy");
        } else {
            setHealth("err", "Unexpected response");
        }
    } catch (err) {
        console.error("Health check failed", err);
        setHealth("err", "Failed to reach backend");
    }
}

async function loadSuppliers() {
    btnLoadSuppliers.disabled = true;
    btnLoadSuppliers.textContent = "Loading…";
    setResultsEmpty(suppliersResults, "Loading supplier quality data…");

    try {
        const res = await fetch(`${API_BASE}/api/suppliers/quality`);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
            setResultsEmpty(
                suppliersResults,
                "No supplier data returned. Did you seed the Neo4j database?"
            );
            return;
        }

        const rowsHtml = data
            .map((row) => {
                const rate =
                    typeof row.rejectRatePercent === "number"
                        ? `${row.rejectRatePercent.toFixed(2)}%`
                        : "-";

                const pillClass =
                    row.rejectRatePercent >= 10
                        ? "pill pill-reject"
                        : "pill pill-ok";

                return `
          <tr>
            <td>${row.supplier ?? "-"}</td>
            <td class="muted">${row.supplierId ?? "-"}</td>
            <td>${row.total}</td>
            <td>${row.rejected}</td>
            <td><span class="${pillClass}">${rate}</span></td>
          </tr>
        `;
            })
            .join("");

        const tableHtml = `
      <div class="muted">Sorted by highest reject rate first.</div>
      <table class="table">
        <thead>
          <tr>
            <th>Supplier</th>
            <th>ID</th>
            <th>Total serials</th>
            <th>Rejected</th>
            <th>Reject rate</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

        setResultsContent(suppliersResults, tableHtml);
    } catch (err) {
        console.error("Failed to load suppliers", err);
        setResultsEmpty(
            suppliersResults,
            "Error fetching data. Check console for details."
        );
    } finally {
        btnLoadSuppliers.disabled = false;
        btnLoadSuppliers.textContent = "Load data";
    }
}

async function handleTraceSubmit(event) {
    event.preventDefault();
    traceError.style.display = "none";

    const serial = (traceInput.value || "").trim();
    if (!serial) {
        traceError.textContent = "Please enter a serial number.";
        traceError.style.display = "block";
        return;
    }

    setResultsEmpty(traceResults, "Tracing serial…");

    try {
        const url = `${API_BASE}/api/serial/${encodeURIComponent(
            serial
        )}/trace`;
        const res = await fetch(url);

        if (res.status === 404) {
            setResultsEmpty(
                traceResults,
                "Serial not found. Try a different serial number."
            );
            return;
        }
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const statusClass =
            data.status === "REJECT" ? "pill pill-reject" : "pill pill-ok";

        const affected =
            Array.isArray(data.affectedSerials) && data.affectedSerials.length
                ? `<ul class="serial-list">
            ${data.affectedSerials
                .map(
                    (s) =>
                        `<li><span class="muted">•</span> <span style="font-family:ui-monospace;">${s}</span></li>`
                )
                .join("")}
           </ul>`
                : '<span class="muted">No other serials in this batch.</span>';

        const html = `
      <div>
        <div style="margin-bottom:6px;">
          <span class="${statusClass}">Status: ${data.status}</span>
        </div>

        <div class="muted">Serial</div>
        <div style="font-family:ui-monospace;">${data.serial ?? "-"}</div>

        <div style="margin-top:8px;">
          <div class="muted">Batch</div>
          <div style="font-family:ui-monospace;">${data.batchId ?? "-"}</div>
        </div>

        <div style="margin-top:8px;">
          <div class="muted">Supplier</div>
          <div>
            ${data.supplierName ?? "-"}
            <span class="muted">(${data.supplierId ?? "-"})</span>
          </div>
        </div>

        <div style="margin-top:8px;">
          <div class="muted">All serials in this batch</div>
          ${affected}
        </div>
      </div>
    `;
        setResultsContent(traceResults, html);
    } catch (err) {
        console.error("Trace request failed", err);
        setResultsEmpty(
            traceResults,
            "Error while tracing serial. Check console for details."
        );
    }
}

async function clearDatabase() {
    if (!confirm("This will delete ALL data in Neo4j. Continue?")) {
        return;
    }
    btnClearDb.disabled = true;
    btnClearDb.textContent = "Clearing…";
    setResultsEmpty(suppliersResults, "Database cleared (or in progress).");

    try {
        const res = await fetch(`${API_BASE}/api/admin/clear`, {
            method: "POST",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log("Clear result:", data);
        setResultsEmpty(
            suppliersResults,
            "Database cleared. Seed data again to get demo content."
        );
        setResultsEmpty(
            randomSerialsResults,
            "Database is empty – seed data first."
        );
        setResultsEmpty(traceResults, "Database cleared.");
    } catch (err) {
        console.error("Clear DB failed", err);
        setResultsEmpty(
            suppliersResults,
            "Error clearing DB. Check console for details."
        );
    } finally {
        btnClearDb.disabled = false;
        btnClearDb.textContent = "Clear DB";
    }
}

async function seedDatabase() {
    btnSeedDb.disabled = true;
    btnSeedDb.textContent = "Seeding…";
    setResultsEmpty(
        suppliersResults,
        "Seeding sample data… this may take a moment."
    );

    try {
        const res = await fetch(`${API_BASE}/api/admin/seed`, {
            method: "POST",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log("Seed result:", data);
        setResultsEmpty(
            suppliersResults,
            "Seeding finished. Click “Load data” to see supplier metrics."
        );
    } catch (err) {
        console.error("Seed DB failed", err);
        setResultsEmpty(
            suppliersResults,
            "Error seeding DB. Check console for details."
        );
    } finally {
        btnSeedDb.disabled = false;
        btnSeedDb.textContent = "Seed data";
    }
}

async function loadRandomSerials() {
    btnRandomSerials.disabled = true;
    btnRandomSerials.textContent = "Loading…";
    setResultsEmpty(randomSerialsResults, "Fetching random serials…");

    try {
        const res = await fetch(`${API_BASE}/api/serial/random`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (
            !data ||
            !Array.isArray(data.serials) ||
            data.serials.length === 0
        ) {
            setResultsEmpty(
                randomSerialsResults,
                "No serials found. Seed the database first."
            );
            return;
        }

        const listHtml = `
      <ul class="serial-list">
        ${data.serials
            .map(
                (s) =>
                    `<li><button type="button" class="serial-button" data-serial="${s}">${s}</button></li>`
            )
            .join("")}
      </ul>
      <p class="muted">Click a serial to fill the trace form.</p>
    `;

        setResultsContent(randomSerialsResults, listHtml);
    } catch (err) {
        console.error("Random serials failed", err);
        setResultsEmpty(
            randomSerialsResults,
            "Error fetching random serials. Check console for details."
        );
    } finally {
        btnRandomSerials.disabled = false;
        btnRandomSerials.textContent = "Load 10 serials";
    }
}

// ---- init ----
document.addEventListener("DOMContentLoaded", () => {
    checkHealth();
    btnLoadSuppliers.addEventListener("click", loadSuppliers);
    traceForm.addEventListener("submit", handleTraceSubmit);
    btnClearDb.addEventListener("click", clearDatabase);
    btnSeedDb.addEventListener("click", seedDatabase);
    btnRandomSerials.addEventListener("click", loadRandomSerials);

    // click on random serial → fill trace input
    randomSerialsResults.addEventListener("click", (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.dataset.serial) {
            traceInput.value = target.dataset.serial;
            traceInput.focus();
        }
    });
});
