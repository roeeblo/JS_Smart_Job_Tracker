// client/src/pages/Dashboard.jsx
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
  applied: "#06b6d4",
  interview: "#f59e0b",
  test: "#22d3ee",
  "home test": "#0ea5e9",
  "test 2": "#14b8a6",
  offer: "#a855f7",
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
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="middle"
      fontSize={12}
      fill="#e5e7eb"
    >
      {`${name} (${value})`}
    </text>
  );
}

/* =======================
   Export helpers
   ======================= */
function toCSVRows(rows) {
  const cols = ["id", "company", "role", "status", "source", "location", "notes"];
  const header = cols.join(",");
  const body = rows
    .map((r) =>
      cols
        .map((k) => {
          const val = r[k] == null ? "" : String(r[k]);
          const needsQuotes = /[",\n]/.test(val);
          const clean = val.replace(/"/g, '""');
          return needsQuotes ? `"${clean}"` : clean;
        })
        .join(",")
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

/* =======================
   Editable (inline)
   ======================= */
function Editable({
  value,
  onSave,
  placeholder = "",
  className = "",
  textClassName = "",
  title = "",
  disabled = false,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  useEffect(() => {
    if (!editing) setDraft(value || "");
  }, [value, editing]);

  const commit = async () => {
    if (disabled) return setEditing(false);
    const v = (draft || "").trim();
    if (v !== (value || "")) {
      await onSave(v);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value || "");
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => !disabled && setEditing(true)}
        className={`px-1 py-0.5 rounded ${disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-800/60"} text-left ${textClassName}`}
        title={title ? `${title}${disabled ? "" : " — click to edit"}` : disabled ? "" : "Click to edit"}
      >
        {value ? (
          <span className="underline decoration-dotted underline-offset-2">{value}</span>
        ) : (
          <span className="text-slate-500">{placeholder}</span>
        )}
      </button>
    );
  }

  return (
    <input
      autoFocus
      disabled={disabled}
      className={`input ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${className}`}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") cancel();
      }}
    />
  );
}

/* =======================
   Demo data for Guest mode
   ======================= */
const DEMO_JOBS = [
  { id: -1, company: "StellarAI", role: "Frontend Engineer", status: "applied", source: "LinkedIn", location: "Remote", notes: "Nice stack: React + TS" },
  { id: -2, company: "Nimbus Cloud", role: "DevOps Engineer", status: "interview", source: "Company site", location: "Tel Aviv", notes: "K8s + Terraform" },
  { id: -3, company: "Orbital", role: "Data Analyst", status: "offer", source: "Referral", location: "Hybrid", notes: "SQL + Python" },
  { id: -4, company: "QuantumX", role: "Full-stack", status: "rejected", source: "LinkedIn", location: "Remote", notes: "Too senior" },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [message, setMessage] = useState("Loading...");
  const [jobs, setJobs] = useState([]);
  const [guest, setGuest] = useState(false);

  const [form, setForm] = useState({
    company: "",
    role: "",
    source: "",
    location: "",
    status: "applied",
    notes: "",
  });

  // Filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Load initial (with graceful guest fallback)
  useEffect(() => {
    (async () => {
      try {
        const prof = await api.get("/profile");
        setMessage(`Hello ${user?.name}`);
        const { data } = await api.get("/jobs");
        setJobs(data);
        setGuest(false);
      } catch (e) {
        // Guest mode
        setGuest(true);
        setMessage("Guest mode — demo data");
        setJobs(DEMO_JOBS);
      }
    })();
  }, [user?.name]);

  // Create
  const addJob = useCallback(
    async (e) => {
      e.preventDefault();
      if (guest) return alert("Login required to add jobs (guest mode).");
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
    [form, guest]
  );

  // Update field
  const updateField = useCallback(async (id, field, value) => {
    if (guest) return; // disabled in guest mode
    try {
      const { data } = await api.put(`/jobs/${id}`, { [field]: value });
      setJobs((prev) => prev.map((j) => (j.id === id ? data : j)));
    } catch (error) {
      console.error("Failed to update job:", error);
    }
  }, [guest]);

  // Delete
  const removeJob = useCallback(async (id) => {
    if (guest) return;
    if (!window.confirm("Delete this job?")) return;
    try {
      await api.delete(`/jobs/${id}`);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (error) {
      console.error("Failed to delete job:", error);
    }
  }, [guest]);

  // filtered list
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

  // chart data
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

  // export
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
      <div className="glass p-4 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-sm muted">Smart Job Tracker</div>
          <div className="text-lg font-semibold tracking-tight">{message}</div>
        </div>
        <div className="flex gap-2">
          {!guest && <button onClick={logout} className="btn">Logout</button>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="kpi">
          <div className="muted text-sm">Total</div>
          <div className="text-2xl font-semibold">{kpis.total}</div>
        </div>
        {["applied", "interview", "offer", "accepted"].map((key) => (
          <div key={key} className="kpi">
            <div className="muted text-sm capitalize">{key}</div>
            <div className="text-2xl font-semibold">{kpis.counts[key] || 0}</div>
          </div>
        ))}
      </div>

      {/* Export + Filters */}
      <div className="glass p-4 flex flex-col md:flex-row gap-3 md:items-center justify-between">
        <div className="flex gap-2">
          <button onClick={doExportCSV} className="btn" title="Export current view to CSV">
            Export CSV
          </button>
          <button onClick={doExportExcel} className="btn" title="Export current view to Excel">
            Export Excel
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:items-center w-full md:w-auto">
          <input
            className="input flex-1 min-w-0"
            placeholder="Search (company, role, source, location, notes)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="select w-full md:w-56"
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
      <div className="card">
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
                stroke="rgba(2,6,23,0.6)"
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

      {/* Add new job */}
      <form onSubmit={addJob} className="card space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input
            className="input"
            placeholder="Company"
            value={form.company}
            onChange={(e) => setForm((s) => ({ ...s, company: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Role"
            value={form.role}
            onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Source"
            value={form.source}
            onChange={(e) => setForm((s) => ({ ...s, source: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))}
          />
          <select
            className="select"
            value={form.status}
            onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="textarea w-full"
          rows={2}
          placeholder="Notes..."
          value={form.notes}
          onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
        />
        <div className="text-right">
          <button
            className={`px-5 py-2 rounded-xl ${guest ? "btn opacity-60 cursor-not-allowed" : "btn-primary"}`}
            disabled={guest}
          >
            {guest ? "Login to add" : "Add"}
          </button>
        </div>
      </form>

      {/* Job List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="muted">No jobs match your filters</div>
        )}

        {filtered.map((j) => (
          <div key={j.id} className="card">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div className="min-w-0">
                {/* Title line */}
                <div className="font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Editable
                    value={j.company || ""}
                    placeholder="(company)"
                    title="Company"
                    textClassName="text-base"
                    onSave={(v) => updateField(j.id, "company", v)}
                    disabled={guest}
                  />
                  <span className="muted">—</span>
                  <Editable
                    value={j.role || ""}
                    placeholder="(role)"
                    title="Role"
                    textClassName="text-base"
                    onSave={(v) => updateField(j.id, "role", v)}
                    disabled={guest}
                  />
                </div>

                {/* Meta */}
                <div className="text-sm text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                  <span>Source:</span>
                  <Editable
                    value={j.source || ""}
                    placeholder="(source)"
                    title="Source"
                    onSave={(v) => updateField(j.id, "source", v)}
                    disabled={guest}
                  />
                  <span>·</span>
                  <span>Location:</span>
                  <Editable
                    value={j.location || ""}
                    placeholder="(location)"
                    title="Location"
                    onSave={(v) => updateField(j.id, "location", v)}
                    disabled={guest}
                  />
                </div>

                {/* Notes */}
                <div className="mt-2">
                  <textarea
                    className={`textarea w-full text-sm ${guest ? "opacity-60 cursor-not-allowed" : ""}`}
                    rows={2}
                    placeholder="Notes..."
                    value={j.notes || ""}
                    onChange={(e) => !guest && updateField(j.id, "notes", e.target.value)}
                    readOnly={guest}
                  />
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex flex-col items-stretch gap-2 w-full md:w-auto">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-400">Status:</span>
                  <select
                    className="select text-sm"
                    value={j.status}
                    onChange={(e) => updateField(j.id, "status", e.target.value)}
                    disabled={guest}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeJob(j.id)}
                    className={`btn text-red-300 hover:text-red-200 ${guest ? "opacity-60 cursor-not-allowed" : ""}`}
                    disabled={guest}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {guest && (
        <div className="text-center text-sm text-slate-400">
          You’re in <span className="text-sky-400">guest mode</span>. Login to add or edit your jobs.
        </div>
      )}
    </div>
  );
}
