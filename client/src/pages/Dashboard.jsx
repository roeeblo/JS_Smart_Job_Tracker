import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api";
import { useAuth } from "../store/auth";
import {
  PieChart, Pie, Cell, Legend, ResponsiveContainer,
} from "recharts";

const STATUS_CONFIG = {
  applied: { label: "applied", color: "#3d619bff" },
  interview: { label: "interview", color: "#a31eb4ff" },
  rejected: { label: "rejected", color: "#ef4444" },
  offer: { label: "offer", color: "#8b5cf6" },
  accepted: { label: "accepted", color: "#10b981" },
};

const STATUS_OPTIONS = Object.keys(STATUS_CONFIG);

function renderLabel(props) {
  const { cx, cy, midAngle, outerRadius, name, value } = props;
  if (!value) return null;
  const RAD = Math.PI / 180;
  const numOuter = typeof outerRadius === "number" ? outerRadius : 0;
  const r = numOuter + 18;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  const anchor = Math.abs(x - cx) < 2 ? "middle" : x > cx ? "start" : "end";
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={12}>
      {`${name} (${value})`}
    </text>
  );
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
  });

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const prof = await api.get("/profile");
        setMessage(`Displaying jobs for ${user?.name}`);
        const { data } = await api.get("/jobs");
        setJobs(data);
      } catch (e) {
        setMessage(e?.response?.data?.error || "Auth failed");
      }
    })();
  }, [user?.name]);

  const addJob = useCallback(async (e) => {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;
    try {
      const { data } = await api.post("/jobs", form);
      setJobs((prev) => [data, ...prev]);
      setForm({ company: "", role: "", source: "", location: "" });
    } catch (error) {
      console.error("Failed to add job:", error);
    }
  }, [form]);

  const updateStatus = useCallback(async (id, status) => {
    try {
      const { data } = await api.put(`/jobs/${id}`, { status });
      setJobs((prev) => prev.map((j) => (j.id === id ? data : j)));
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  }, []);

  const removeJob = useCallback(async (id) => {
    if (!window.confirm("Delete this job?")) return;
    try {
      await api.delete(`/jobs/${id}`);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (error) {
      console.error("Failed to delete job:", error);
    }
  }, []);

  const prettyDate = useCallback((dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? dateString : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return jobs.filter((j) => {
      const byStatus = statusFilter === "all" ? true : j.status === statusFilter;
      const byText =
        !term ||
        [j.company, j.role, j.source, j.location]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term));
      return byStatus && byText;
    });
  }, [jobs, q, statusFilter]);

  const statusData = useMemo(() => {
    const counts = {};
    filtered.forEach((j) => {
      counts[j.status] = (counts[j.status] || 0) + 1;
    });
    
    return STATUS_OPTIONS.map((status) => ({
      name: status,
      value: counts[status] || 0,
    }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header with title + logout */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Welcome</h1>
          <p className="text-gray-600 truncate">{message}</p>
        </div>
      </div>

      {/* Add Job Form */}
      <form onSubmit={addJob} className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          className="border p-2 rounded"
          placeholder="Company *"
          value={form.company}
          onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
        />
        <input
          className="border p-2 rounded"
          placeholder="Role *"
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
        />
        <input
          className="border p-2 rounded"
          placeholder="Source (e.g. LinkedIn)"
          value={form.source}
          onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
        />
        <input
          className="border p-2 rounded"
          placeholder="Location"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
        />
        <div className="md:col-span-4 flex justify-end">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={!form.company.trim() || !form.role.trim()}
          >
            Add
          </button>
        </div>
      </form>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <input
          className="border p-2 rounded flex-1 min-w-0"
          placeholder="Search (company, role, source, location)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="border p-2 rounded w-full md:w-56"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* Pie Chart */}
      <div className="bg-white rounded border p-4 select-none">
        <h2 className="font-semibold mb-2">Status distribution</h2>
        <div className="w-full max-w-[560px] mx-auto aspect-square">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart
              margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
              style={{ pointerEvents: "none" }}
            >
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
                style={{ shapeRendering: "geometricPrecision" }}
              >
                {statusData.map((slice, i) => (
                  <Cell key={i} fill={STATUS_CONFIG[slice.name]?.color || "#94a3b8"} />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Job List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-gray-500">No jobs match your filters</div>
        )}

        {filtered.map((j) => (
          <div key={j.id} className="bg-white rounded border p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">
                  {j.company} — {j.role}
                </div>
                <div className="text-sm text-gray-500">
                  {j.source && `Source: ${j.source} · `}
                  {j.location && `Location: ${j.location} · `}
                  {j.applied_at && `Applied: ${prettyDate(j.applied_at)}`}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {STATUS_OPTIONS.map((status) => {
                  const active = j.status === status;
                  return (
                    <button
                      key={status}
                      onClick={() => updateStatus(j.id, status)}
                      className={
                        "px-2 py-1 border rounded text-sm " +
                        (active
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white hover:bg-gray-50")
                      }
                      title={`Set status to ${status}`}
                    >
                      {status}
                    </button>
                  );
                })}
                <button
                  onClick={() => removeJob(j.id)}
                  className="px-2 py-1 border rounded text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}