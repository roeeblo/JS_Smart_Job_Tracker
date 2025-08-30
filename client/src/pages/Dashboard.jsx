import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api";
import { useAuth } from "../store/auth";
import { PieChart, Pie, Cell, Legend, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";

/* =======================
   Status Config
   ======================= */

const STATUS_OPTIONS = [
  "applied",
  "interview",
  "test",
  "home test",
  "test 2",
  "offer",
  "accepted",
  "rejected",
];

const STATUS_COLORS = {
  applied: "#3b82f6",
  interview: "#f59e0b",
  test: "#06b6d4",
  "home test": "#0ea5e9",
  "test 2": "#14b8a6",
  offer: "#8b5cf6",
  accepted: "#10b981",
  rejected: "#ef4444",
};

function renderLabel({ cx, cy, midAngle, outerRadius, name, value }) {
  if (!value) return null;
  const RAD = Math.PI / 180;
  const r = (typeof outerRadius === "number" ? outerRadius : 0) + 18;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  const anchor = Math.abs(x - cx) < 2 ? "middle" : x > cx ? "start" : "end";
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={12}>
      {`${name} (${value})`}
    </text>
  );
}

/* =======================
   Export helpers
   ======================= */

function toCSVRows(rows) {
  // עמודות לייצוא
  const cols = ["id", "company", "role", "status", "source", "location", "notes"];
  const header = cols.join(",");
  const body = rows
    .map((r) =>
      cols
        .map((k) => {
          const val = r[k] == null ? "" : String(r[k]);
          // בריחה בסיסית של פסיקים/מרכאות/שורות
          const needsQuotes = /[",\n]/.test(val);
          const clean = val.replace(/"/g, '""');
          return needsQuotes ? `"${clean}"` : clean;
        })
        .join(","),
    )
    .join("\n");
  return `${header}\n${body}`;
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [message, setMessage] = useState("Loading...");
  const [jobs, setJobs] = useState([]);

  const [form, setForm] = useState({
    company: "",
    role: "",
    source: "",
    location: "",
    status: "applied",
    notes: "",
  });

  // חיפוש/סינון
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // טעינה ראשונית
  useEffect(() => {
    (async () => {
      try {
        const prof = await api.get("/profile");
        setMessage(`Hello ${user?.name}, uid=${prof.data.userId}`);
        const { data } = await api.get("/jobs");
        setJobs(data);
      } catch (e) {
        setMessage(e?.response?.data?.error || "Auth failed");
      }
    })();
  }, [user?.name]);

  // יצירת משרה
  const addJob = useCallback(
    async (e) => {
      e.preventDefault();
      if (!form.company.trim() || !form.role.trim()) return;
      try {
        const { data } = await api.post("/jobs", form);
        setJobs((prev) => [data, ...prev]);
        setForm({
          company: "",
          role: "",
          source: "",
          location: "",
          status: "applied",
          notes: "",
        });
      } catch (error) {
        console.error("Failed to add job:", error);
      }
    },
    [form],
  );

  // עדכון שדה בודד
  const updateField = useCallback(async (id, field, value) => {
    try {
      const { data } = await api.put(`/jobs/${id}`, { [field]: value });
      setJobs((prev) => prev.map((j) => (j.id === id ? data : j)));
    } catch (error) {
      console.error("Failed to update job:", error);
    }
  }, []);

  // מחיקה
  const removeJob = useCallback(async (id) => {
    if (!window.confirm("Delete this job?")) return;
    try {
      await api.delete(`/jobs/${id}`);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (error) {
      console.error("Failed to delete job:", error);
    }
  }, []);

  // סינון להצגה
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return jobs.filter((j) => {
      const byStatus = statusFilter === "all" ? true : j.status === statusFilter;
      const byText =
        !term ||
        [j.company, j.role, j.source, j.location, j.notes]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      return byStatus && byText;
    });
  }, [jobs, q, statusFilter]);

  // דטה לגרף
  const statusData = useMemo(() => {
    const counts = {};
    filtered.forEach((j) => {
      counts[j.status] = (counts[j.status] || 0) + 1;
    });
    return STATUS_OPTIONS.map((status) => ({ name: status, value: counts[status] || 0 }));
  }, [filtered]);

  // KPIs
  const kpis = useMemo(() => {
    const total = jobs.length;
    const counts = STATUS_OPTIONS.reduce((acc, s) => ((acc[s] = 0), acc), {});
    jobs.forEach((j) => (counts[j.status] = (counts[j.status] || 0) + 1));
    const accepted = counts.accepted || 0;
    const offer = counts.offer || 0;
    const interview = counts.interview || 0;
    return {
      total,
      counts,
      conversionAcceptedPct: total ? Math.round((accepted / total) * 100) : 0,
      offerRatePct: total ? Math.round((offer / total) * 100) : 0,
      interviewRatePct: total ? Math.round((interview / total) * 100) : 0,
    };
  }, [jobs]);

  // Export (filtered)
  const doExportCSV = useCallback(() => {
    const csv = toCSVRows(filtered);
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadBlob(csv, `jobs-${ts}.csv`, "text/csv;charset=utf-8;");
  }, [filtered]);

  const doExportExcel = useCallback(() => {
    const cols = ["id", "company", "role", "status", "source", "location", "notes"];
    const data = filtered.map((r) => {
      const o = {};
      cols.forEach((c) => (o[c] = r[c] ?? ""));
      return o;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, { header: cols });
    XLSX.utils.book_append_sheet(wb, ws, "Jobs");
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    XLSX.writeFile(wb, `jobs-${ts}.xlsx`);
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-gray-600 truncate">{message}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={logout} className="text-red-600">Logout</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl border bg-white p-3">
          <div className="text-sm text-gray-500">Total</div>
          <div className="text-2xl font-semibold">{kpis.total}</div>
        </div>
        {["applied", "interview", "offer", "accepted"].map((key) => (
          <div key={key} className="rounded-xl border bg-white p-3">
            <div className="text-sm text-gray-500 capitalize">{key}</div>
            <div className="text-2xl font-semibold">{kpis.counts[key] || 0}</div>
          </div>
        ))}
      </div>

      {/* Export + Filters */}
      <div className="flex flex-col md:flex-row gap-2 md:items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={doExportCSV}
            className="border px-3 py-2 rounded bg-white hover:bg-gray-50"
            title="Export current view to CSV"
          >
            Export CSV (filtered)
          </button>
          <button
            onClick={doExportExcel}
            className="border px-3 py-2 rounded bg-white hover:bg-gray-50"
            title="Export current view to Excel"
          >
            Export Excel (filtered)
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:items-center w-full md:w-auto">
          <input
            className="border p-2 rounded flex-1 min-w-0"
            placeholder="Search (company, role, source, location, notes)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="border p-2 rounded w-full md:w-56"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pie Chart */}
      <div className="bg-white rounded border p-4 select-none">
        <h2 className="font-semibold mb-2">Status distribution</h2>
        <div className="w-full max-w-[560px] mx-auto aspect-square">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="75%"
                isAnimationActive={false}
                paddingAngle={0}
                label={renderLabel}
                labelLine={false}
                stroke="#ffffff"
                strokeWidth={2}
              >
                {statusData.map((slice, i) => (
                  <Cell key={i} fill={STATUS_COLORS[slice.name] || "#94a3b8"} />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Job List */}
      <div className="space-y-3">
        {filtered.length === 0 && <div className="text-gray-500">No jobs match your filters</div>}

        {filtered.map((j) => (
          <div key={j.id} className="bg-white rounded border p-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">
                  {j.company} — {j.role}
                </div>
                <div className="text-sm text-gray-500">
                  {j.source && `Source: ${j.source} · `}
                  {j.location && `Location: ${j.location}`}
                </div>

                {j.notes && (
                  <div className="text-sm text-gray-700 mt-1 break-words">Notes: {j.notes}</div>
                )}
              </div>

              {/* Quick actions */}
              <div className="flex flex-col items-stretch gap-2 w-full md:w-auto">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-500">Status:</span>
                  <select
                    className="border p-1 rounded text-sm"
                    value={j.status}
                    onChange={(e) => updateField(j.id, "status", e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeJob(j.id)}
                    className="px-2 py-1 border rounded text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>

                <div>
                  <textarea
                    className="border p-2 rounded w-full text-sm"
                    rows={2}
                    placeholder="Notes..."
                    value={j.notes || ""}
                    onChange={(e) => updateField(j.id, "notes", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
