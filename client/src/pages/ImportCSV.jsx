import React, { useState } from "react";
import api from "../api";

export default function ImportCSV() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/import/csv", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
    } catch (err) {
      setResult({ error: err?.response?.data?.error || err.message });
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const header = "company,role,status,source,location,notes\n";
    const BOM = "\uFEFF"; // מוסיף BOM כדי שאקסל יזהה UTF-8
    const blob = new Blob([BOM + header], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jobs_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Import Jobs (CSV)</h1>

      <div className="text-sm text-gray-600 space-y-1">
        <div>
          Expected columns:&nbsp;
          <code>company, role, status, source, location, notes</code>
        </div>
        <div>
          Valid statuses:&nbsp;
          <code>applied, interview, test, home test, test 2, offer, accepted, rejected</code>
        </div>
        <div className="text-red-600 font-bold uppercase">
          *** English Only ***
        </div>
      </div>

      <div>
        <button
          onClick={downloadTemplate}
          className="border px-3 py-2 rounded bg-white hover:bg-gray-50"
        >
          Download CSV Template
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <div>
          <button
            disabled={!file || busy}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {busy ? "Importing..." : "Import"}
          </button>
        </div>
      </form>

      {result && (
        <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
