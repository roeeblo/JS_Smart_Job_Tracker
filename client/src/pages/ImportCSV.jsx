import React, { useState } from "react";
import api from "../api";

export default function ImportCSV() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // ----- CSV flow (קיים) -----
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
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + header], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jobs_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ----- JSON flow (חדש) -----
  const [jsonText, setJsonText] = useState("");

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setJsonText(text);
    } catch (e) {
      setResult({ error: "Failed to read clipboard: " + e.message });
    }
  }

  async function importJson(text) {
    try {
      setBusy(true);
      setResult(null);

      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch (e) {
        return setResult({ error: "Invalid JSON" });
      }
      const items = Array.isArray(payload) ? payload : [payload];

      // מיפוי שדות מה־bookmarklet למה שהשרת מצפה
      const normalized = items.map((r) => ({
        company: (r.company || "").trim(),
        role: (r.role || r.title || "").trim(),
        status: ((r.status || "applied") + "").trim().toLowerCase(),
        source: (r.source || "LinkedIn").trim(),
        location: (r.location || "").trim(),
        // נשמור URL בתוך notes כברירת מחדל
        notes: (r.notes || r.url || "").toString().trim(),
      }));

      const { data } = await api.post("/import/json", { items: normalized });
      setResult(data);
    } catch (e) {
      setResult({ error: e?.response?.data?.error || e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Import Jobs</h1>

      <div className="text-sm text-gray-600 space-y-1">
        <div>
          Expected columns (CSV): <code>company, role, status, source, location, notes</code>
        </div>
        <div>
          Valid statuses:{" "}
          <code>applied, interview, test, home test, test 2, offer, accepted, rejected</code>
        </div>
        <div className="text-red-600 font-bold uppercase">
          *** English Only (no Hebrew supported) ***
        </div>
      </div>

      {/* CSV section */}
      <div className="space-y-3">
        <button
          onClick={downloadTemplate}
          className="border px-3 py-2 rounded bg-white hover:bg-gray-50"
        >
          Download CSV Template
        </button>

        <form onSubmit={submit} className="space-y-2">
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
              {busy ? "Importing..." : "Import CSV"}
            </button>
          </div>
        </form>
      </div>

      <hr />

      {/* JSON section */}
      <div className="space-y-2">
        <div className="font-semibold">Import JSON</div>
        <div className="flex gap-2">
          <button
            onClick={pasteFromClipboard}
            className="border px-3 py-2 rounded bg-white hover:bg-gray-50"
            disabled={busy}
            title="Reads JSON from your clipboard"
          >
            Paste from clipboard
          </button>
          <button
            onClick={() => importJson(jsonText)}
            className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={busy || !jsonText.trim()}
          >
            {busy ? "Importing..." : "Import JSON"}
          </button>
        </div>
        <textarea
          className="border p-2 rounded w-full min-h-40 font-mono text-sm"
          placeholder='Paste JSON here (object or array of objects)'
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />
      </div>

      {result && (
        <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
{JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
