// ---- CONFIG ----
const API_BASE = "https://neo4j-poc-backend-69d2dh8rr0ee.uaimmiau.deno.net";

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
                ? `<ul style="margin:4px 0 0 16px;padding:0;">
            ${data.affectedSerials
                .map(
                    (s) =>
                        `<li style="margin:2px 0;font-family:ui-monospace;">${s}</li>`
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

// ---- init ----
document.addEventListener("DOMContentLoaded", () => {
    checkHealth();
    btnLoadSuppliers.addEventListener("click", loadSuppliers);
    traceForm.addEventListener("submit", handleTraceSubmit);
});
