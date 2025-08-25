import React, { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../store/auth";

const STATUS = ["applied", "interview", "rejected", "offer", "accepted"];

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

  // טעינה ראשונית: פרופיל + משרות
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addJob = async (e) => {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;
    const { data } = await api.post("/jobs", form);
    setJobs((prev) => [data, ...prev]);
    setForm({ company: "", role: "", source: "", location: "" });
  };

  const updateStatus = async (id, status) => {
    const { data } = await api.put(`/jobs/${id}`, { status });
    setJobs((prev) => prev.map((j) => (j.id === id ? data : j)));
  };

  const removeJob = async (id) => {
    if (!confirm("Delete this job?")) return;
    await api.delete(`/jobs/${id}`);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const prettyDate = (d) => {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6">
      {/* כותרת עליונה */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Smart Job Tracker</h1>
          <p className="text-gray-600">{message}</p>
        </div>
        <button onClick={logout} className="text-red-600">
          Logout
        </button>
      </div>

      {/* טופס יצירת משרה */}
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

      {/* רשימת משרות */}
      <div className="space-y-3">
        {jobs.length === 0 && <div className="text-gray-500">No jobs yet</div>}

        {jobs.map((j) => (
          <div key={j.id} className="bg-white rounded border p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <div className="font-medium">
                  {j.company} — {j.role}
                </div>
                <div className="text-sm text-gray-500">
                  {j.source ? `Source: ${j.source} · ` : ""}
                  {j.location ? `Location: ${j.location} · ` : ""}
                  {j.applied_at ? `Applied: ${prettyDate(j.applied_at)}` : ""}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {STATUS.map((s) => {
                  const active = j.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => updateStatus(j.id, s)}
                      className={
                        "px-2 py-1 border rounded text-sm " +
                        (active
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white hover:bg-gray-50")
                      }
                      title={`Set status to ${s}`}
                    >
                      {s}
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
