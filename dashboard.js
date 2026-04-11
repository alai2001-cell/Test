// Master Dashboard - vanilla JS, no dependencies.

const state = {
  range: 7,
  data: generateMockData(),
};

function generateMockData() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const series = [];
  for (let i = 89; i >= 0; i--) {
    const t = now - i * day;
    const base = 4200 + Math.sin(i / 6) * 800 + Math.cos(i / 3) * 400;
    const noise = (Math.random() - 0.5) * 600;
    series.push({ t, value: Math.max(800, Math.round(base + noise)) });
  }
  return {
    revenueSeries: series,
    traffic: [
      { label: "Direct", value: 38, color: "#6366f1" },
      { label: "Organic", value: 27, color: "#22c55e" },
      { label: "Referral", value: 18, color: "#f59e0b" },
      { label: "Social", value: 12, color: "#ef4444" },
      { label: "Email", value: 5, color: "#8b5cf6" },
    ],
    orders: [
      { id: "#10293", customer: "Jane Cooper", status: "paid", amount: 1240 },
      { id: "#10292", customer: "Cody Fisher", status: "pending", amount: 580 },
      { id: "#10291", customer: "Esther Howard", status: "paid", amount: 3210 },
      { id: "#10290", customer: "Jenny Wilson", status: "refunded", amount: 215 },
      { id: "#10289", customer: "Robert Fox", status: "paid", amount: 925 },
      { id: "#10288", customer: "Leslie Alexander", status: "paid", amount: 4470 },
    ],
    activity: [
      { text: "New order #10293 from Jane Cooper", time: "2 minutes ago" },
      { text: "User Esther Howard upgraded to Pro", time: "18 minutes ago" },
      { text: "Refund issued for order #10290", time: "1 hour ago" },
      { text: "Server deployment completed", time: "3 hours ago" },
      { text: "Daily report generated", time: "6 hours ago" },
      { text: "12 new signups today", time: "9 hours ago" },
    ],
  };
}

function formatCurrency(n) {
  return "$" + n.toLocaleString("en-US");
}

function renderKpis() {
  const recent = state.data.revenueSeries.slice(-state.range);
  const total = recent.reduce((s, p) => s + p.value, 0);
  document.getElementById("kpiRevenue").textContent = formatCurrency(total);
  document.getElementById("kpiUsers").textContent = (12480 + Math.round(Math.random() * 200)).toLocaleString();
  document.getElementById("kpiOrders").textContent = (320 + Math.round(Math.random() * 30)).toLocaleString();
  document.getElementById("kpiConversion").textContent = (3.2 + Math.random() * 0.5).toFixed(2) + "%";
}

function renderRevenueChart() {
  const canvas = document.getElementById("revenueChart");
  const ctx = canvas.getContext("2d");
  // Handle hi-DPI for crisp rendering.
  const cssWidth = canvas.clientWidth || canvas.width;
  const cssHeight = 280;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.height = cssHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const data = state.data.revenueSeries.slice(-state.range);
  if (data.length === 0) return;

  const padding = { top: 20, right: 16, bottom: 30, left: 50 };
  const w = cssWidth - padding.left - padding.right;
  const h = cssHeight - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const yMin = min - range * 0.1;
  const yMax = max + range * 0.1;

  // Grid lines + y labels.
  ctx.strokeStyle = "#262c38";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#8b93a7";
  ctx.font = "11px -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (h / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + w, y);
    ctx.stroke();
    const v = yMax - ((yMax - yMin) / gridLines) * i;
    ctx.fillText("$" + Math.round(v).toLocaleString(), padding.left - 8, y);
  }

  // X axis labels (sparse).
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const xStep = w / Math.max(1, data.length - 1);
  const labelEvery = Math.max(1, Math.floor(data.length / 6));
  for (let i = 0; i < data.length; i++) {
    if (i % labelEvery !== 0 && i !== data.length - 1) continue;
    const x = padding.left + xStep * i;
    const d = new Date(data[i].t);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    ctx.fillText(label, x, padding.top + h + 8);
  }

  // Area gradient.
  const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + h);
  grad.addColorStop(0, "rgba(99, 102, 241, 0.4)");
  grad.addColorStop(1, "rgba(99, 102, 241, 0)");

  const points = data.map((d, i) => {
    const x = padding.left + xStep * i;
    const y = padding.top + h - ((d.value - yMin) / (yMax - yMin)) * h;
    return { x, y };
  });

  ctx.beginPath();
  ctx.moveTo(points[0].x, padding.top + h);
  points.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, padding.top + h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line.
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = "#7c7ff4";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Dots on the last point.
  const last = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#7c7ff4";
  ctx.fill();
  ctx.strokeStyle = "#161a22";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function renderTrafficChart() {
  const canvas = document.getElementById("trafficChart");
  const ctx = canvas.getContext("2d");
  const cssWidth = canvas.clientWidth || 320;
  const cssHeight = 280;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.height = cssHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const cx = cssWidth / 2;
  const cy = cssHeight / 2;
  const outerR = Math.min(cssWidth, cssHeight) / 2 - 16;
  const innerR = outerR * 0.62;

  const total = state.data.traffic.reduce((s, t) => s + t.value, 0);
  let start = -Math.PI / 2;
  state.data.traffic.forEach((seg) => {
    const angle = (seg.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    start += angle;
  });

  // Cut the inner hole.
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // Center label.
  ctx.fillStyle = "#e6e9ef";
  ctx.font = "600 22px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(total + "%", cx, cy - 6);
  ctx.fillStyle = "#8b93a7";
  ctx.font = "11px -apple-system, sans-serif";
  ctx.fillText("TOTAL", cx, cy + 14);

  // Legend.
  const legend = document.getElementById("trafficLegend");
  legend.innerHTML = state.data.traffic
    .map(
      (t) => `
        <li>
          <span class="dot" style="background:${t.color}"></span>
          ${t.label}
          <span class="value">${t.value}%</span>
        </li>`
    )
    .join("");
}

function renderOrders() {
  const tbody = document.getElementById("ordersTable");
  tbody.innerHTML = state.data.orders
    .map(
      (o) => `
        <tr>
          <td><strong>${o.id}</strong></td>
          <td>${o.customer}</td>
          <td><span class="status ${o.status}">${o.status}</span></td>
          <td>${formatCurrency(o.amount)}</td>
        </tr>`
    )
    .join("");
}

function renderActivity() {
  const ul = document.getElementById("activityFeed");
  ul.innerHTML = state.data.activity
    .map(
      (a) => `
        <li>
          <span class="bullet"></span>
          <div>
            <div class="text">${a.text}</div>
            <div class="time">${a.time}</div>
          </div>
        </li>`
    )
    .join("");
}

function renderAll() {
  renderKpis();
  renderRevenueChart();
  renderTrafficChart();
  renderOrders();
  renderActivity();
}

function bindEvents() {
  document.querySelectorAll(".chip[data-range]").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip[data-range]").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.range = parseInt(chip.dataset.range, 10);
      renderKpis();
      renderRevenueChart();
    });
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
      item.classList.add("active");
      const view = item.dataset.view;
      const title = item.textContent.trim();
      document.getElementById("pageTitle").textContent = title;
    });
  });

  document.getElementById("refreshBtn").addEventListener("click", () => {
    state.data = generateMockData();
    renderAll();
  });

  window.addEventListener("resize", () => {
    renderRevenueChart();
    renderTrafficChart();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  renderAll();
});
