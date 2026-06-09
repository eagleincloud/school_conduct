import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Cable,
  Copy,
  Download,
  KeyRound,
  Network,
  Plus,
  RefreshCcw,
  Save,
  ServerCog,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "react-hot-toast";

import authService from "../../services/authService";
import api from "../../services/api";
import biometricDeviceService from "../../services/biometricDeviceService";

const defaultForm = {
  school: "",
  name: "",
  site_label: "",
  device_type: "hybrid",
  device_ip: "",
  device_port: 4370,
  device_password: 0,
  machine_number: 1,
  bridge_server_url: "",
  notes: "",
  is_active: true,
};

const fmtDateTime = (value) => {
  if (!value) return "Never";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const statusTone = (statusLabel) => {
  if (statusLabel === "online") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (statusLabel === "offline") return "bg-rose-50 text-rose-700 border-rose-200";
  if (statusLabel === "disabled") return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
};

const SectionTitle = ({ icon: Icon, title, body }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-school-navy text-white shadow-lg shadow-school-navy/15">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <h2 className="text-lg font-black text-slate-900">{title}</h2>
      <p className="mt-1 text-sm font-semibold text-slate-500">{body}</p>
    </div>
  </div>
);

export default function BiometricMachines() {
  const currentUser = authService.getCurrentUser();
  const isSuperadmin = currentUser.role === "superadmin";

  const [devices, setDevices] = useState([]);
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(currentUser.school_id || "");
  const [form, setForm] = useState({ ...defaultForm, school: currentUser.school_id || "" });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingDraft, setTestingDraft] = useState(false);
  const [launchingBridges, setLaunchingBridges] = useState(false);
  const [draftProbe, setDraftProbe] = useState(null);
  const [preview, setPreview] = useState(null);
  const [activePreviewId, setActivePreviewId] = useState(null);

  const loadSchools = async () => {
    if (!isSuperadmin) return;
    const response = await api.get("schools/admin-schools/");
    setSchools(response.data || []);
  };

  const loadDevices = async (schoolFilter = selectedSchool) => {
    setLoading(true);
    try {
      const params = isSuperadmin && schoolFilter ? { school: schoolFilter } : {};
      const data = await biometricDeviceService.list(params);
      setDevices(data);
    } catch (error) {
      toast.error("Failed to load biometric machines");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperadmin) {
      loadSchools().catch(() => toast.error("Failed to load schools"));
    }
    loadDevices(currentUser.school_id || "").catch(() => toast.error("Failed to load machines"));
  }, []);

  useEffect(() => {
    if (!isSuperadmin) return;
    loadDevices(selectedSchool).catch(() => toast.error("Failed to refresh machine list"));
  }, [selectedSchool]);

  useEffect(() => {
    const school = isSuperadmin ? selectedSchool : currentUser.school_id || "";
    const stream = biometricDeviceService.createStatusStream({ school });

    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setDevices(payload.devices || []);
      } catch {
        // Ignore malformed stream messages.
      }
    };

    stream.onerror = () => {
      // Allow EventSource to retry automatically.
    };

    return () => {
      stream.close();
    };
  }, [isSuperadmin, selectedSchool, currentUser.school_id]);

  const summary = useMemo(() => {
    const total = devices.length;
    const active = devices.filter((device) => device.is_active).length;
    const online = devices.filter((device) => device.status_label === "online").length;
    const recentlySeen = devices.filter((device) => device.last_seen_at).length;
    return { total, active, online, recentlySeen };
  }, [devices]);

  const resetForm = () => {
    setEditingId(null);
    setDraftProbe(null);
    setForm({ ...defaultForm, school: isSuperadmin ? selectedSchool : currentUser.school_id || "" });
  };

  const handleEdit = (device) => {
    setEditingId(device.id);
    setDraftProbe(null);
    setForm({
      school: device.school_code || device.school || "",
      name: device.name || "",
      site_label: device.site_label || "",
      device_type: device.device_type || "hybrid",
      device_ip: device.device_ip || "",
      device_port: device.device_port || 4370,
      device_password: device.device_password ?? 0,
      machine_number: device.machine_number || 1,
      bridge_server_url: device.bridge_server_url || "",
      notes: device.notes || "",
      is_active: !!device.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        device_port: Number(form.device_port),
        device_password: Number(form.device_password),
        machine_number: Number(form.machine_number),
      };
      if (!isSuperadmin) {
        delete payload.school;
      }

      if (editingId) {
        await biometricDeviceService.update(editingId, payload);
        toast.success("Machine updated");
      } else {
        await biometricDeviceService.create(payload);
        toast.success("Machine registered");
      }
      resetForm();
      await loadDevices();
    } catch (error) {
      const detail = error.response?.data;
      toast.error(
        detail?.error ||
          detail?.school?.[0] ||
          detail?.device_port?.[0] ||
          detail?.machine_number?.[0] ||
          "Failed to save machine",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (deviceId) => {
    if (!window.confirm("Delete this machine setup?")) return;
    try {
      await biometricDeviceService.remove(deviceId);
      toast.success("Machine deleted");
      if (editingId === deviceId) resetForm();
      await loadDevices();
    } catch {
      toast.error("Failed to delete machine");
    }
  };

  const handleDraftProbe = async () => {
    if (!form.device_ip) {
      toast.error("Enter a machine IP first");
      return;
    }

    setTestingDraft(true);
    setDraftProbe(null);
    try {
      const result = await biometricDeviceService.probeConnection({
        device_ip: form.device_ip,
        device_port: Number(form.device_port),
      });
      setDraftProbe(result);
      toast.success(result.ok ? "Machine is reachable" : "Machine is not reachable");
    } catch {
      toast.error("Connection probe failed");
    } finally {
      setTestingDraft(false);
    }
  };

  const handleDeviceTest = async (deviceId) => {
    try {
      const result = await biometricDeviceService.testDevice(deviceId);
      toast.success(result.ok ? "Live test passed" : "Live test failed");
      await loadDevices();
      if (activePreviewId === deviceId) {
        const nextPreview = await biometricDeviceService.getBridgePreview(deviceId);
        setPreview(nextPreview);
      }
    } catch {
      toast.error("Unable to test this machine");
    }
  };

  const handleRotateSecret = async (deviceId) => {
    if (!window.confirm("Rotate this device token? The bridge config will need to be updated after this.")) {
      return;
    }
    try {
      await biometricDeviceService.rotateSecret(deviceId);
      toast.success("Device token rotated");
      await loadDevices();
      if (activePreviewId === deviceId) {
        const nextPreview = await biometricDeviceService.getBridgePreview(deviceId);
        setPreview(nextPreview);
      }
    } catch {
      toast.error("Unable to rotate token");
    }
  };

  const handleDownloadConfig = async (deviceId) => {
    try {
      const response = await biometricDeviceService.downloadConfig(deviceId);
      const blob = new Blob([response.data], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const contentDisposition = response.headers["content-disposition"] || "";
      const fileMatch = contentDisposition.match(/filename="(.+)"/);
      link.href = url;
      link.download = fileMatch?.[1] || `device_${deviceId}_bridge_config.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Bridge config downloaded");
    } catch {
      toast.error("Unable to download config");
    }
  };

  const handlePreview = async (deviceId) => {
    try {
      const data = await biometricDeviceService.getBridgePreview(deviceId);
      setPreview(data);
      setActivePreviewId(deviceId);
    } catch {
      toast.error("Unable to load bridge preview");
    }
  };

  const handleLaunchBridges = async (visible = true) => {
    setLaunchingBridges(true);
    try {
      const payload = {
        restart: true,
        visible,
      };
      if (isSuperadmin && selectedSchool) {
        payload.school = selectedSchool;
      }

      const result = await biometricDeviceService.launchBridges(payload);
      toast.success(result.message || "Bridge launcher started");
      await loadDevices();
    } catch (error) {
      toast.error(error.response?.data?.error || "Unable to launch biometric bridges");
    } finally {
      setLaunchingBridges(false);
    }
  };

  const copyText = async (value, successMessage) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Clipboard access failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <SectionTitle
              icon={ServerCog}
              title="Biometric Machine Control"
              body="Register machines, test LAN connectivity, rotate secure tokens, and export bridge configs for each school or office entrance."
            />
            <div className="flex flex-wrap gap-3">
              <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500">
                {isSuperadmin ? "Platform Control" : currentUser.school_name || "School Admin"}
              </span>
              <span className="rounded-full border border-school-blue/20 bg-school-blue/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-school-blue">
                Bridge-ready configs
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {isSuperadmin ? (
              <select
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none"
                value={selectedSchool}
                onChange={(event) => {
                  setSelectedSchool(event.target.value);
                  setForm((prev) => ({ ...prev, school: event.target.value }));
                }}
              >
                <option value="">All schools / offices</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.school_id}>
                    {school.name} ({school.school_id})
                  </option>
                ))}
              </select>
            ) : null}

            <button
              type="button"
              onClick={() => handleLaunchBridges(true)}
              disabled={launchingBridges || devices.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-school-navy px-4 py-3 text-sm font-bold text-white shadow-lg shadow-school-navy/20 disabled:opacity-50"
            >
              <ServerCog className="h-4 w-4" />
              {launchingBridges ? "Launching..." : "Launch all bridges"}
            </button>

            <button
              type="button"
              onClick={() => loadDevices()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Machines", value: summary.total, icon: Network },
            { label: "Active Machines", value: summary.active, icon: ShieldCheck },
            { label: "Reachable on Last Test", value: summary.online, icon: Wifi },
            { label: "Seen by Backend", value: summary.recentlySeen, icon: Activity },
          ].map((card) => (
            <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
                  <p className="mt-3 text-3xl font-black text-slate-900">{card.value}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-school-navy/10 text-school-navy">
                  <card.icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_1.35fr]">
          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{editingId ? "Edit machine" : "Register machine"}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Add one device per gate, floor, reception, or campus point.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-600"
                >
                  <Plus className="h-4 w-4" />
                  New
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                {isSuperadmin ? (
                  <label className="md:col-span-2">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">School / office</span>
                    <select
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none"
                      value={form.school}
                      onChange={(event) => setForm((prev) => ({ ...prev, school: event.target.value }))}
                      required
                    >
                      <option value="">Select a school / office</option>
                      {schools.map((school) => (
                        <option key={school.id} value={school.school_id}>
                          {school.name} ({school.school_id})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <label>
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Machine name</span>
                  <input
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Main gate terminal"
                    required
                  />
                </label>

                <label>
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Site label</span>
                  <input
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
                    value={form.site_label}
                    onChange={(event) => setForm((prev) => ({ ...prev, site_label: event.target.value }))}
                    placeholder="North gate"
                  />
                </label>

                <label>
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Device type</span>
                  <select
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none"
                    value={form.device_type}
                    onChange={(event) => setForm((prev) => ({ ...prev, device_type: event.target.value }))}
                  >
                    <option value="hybrid">Hybrid</option>
                    <option value="fingerprint">Fingerprint</option>
                    <option value="rfid">RFID</option>
                  </select>
                </label>

                <label>
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Machine number</span>
                  <input
                    type="number"
                    min="1"
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
                    value={form.machine_number}
                    onChange={(event) => setForm((prev) => ({ ...prev, machine_number: event.target.value }))}
                  />
                </label>

                <label>
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">IP address</span>
                  <input
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
                    value={form.device_ip}
                    onChange={(event) => setForm((prev) => ({ ...prev, device_ip: event.target.value }))}
                    placeholder="192.168.0.150"
                    required
                  />
                </label>

                <label>
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Port</span>
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
                    value={form.device_port}
                    onChange={(event) => setForm((prev) => ({ ...prev, device_port: event.target.value }))}
                  />
                </label>

                <label>
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Device password</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
                    value={form.device_password}
                    onChange={(event) => setForm((prev) => ({ ...prev, device_password: event.target.value }))}
                  />
                </label>

                <label className="md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Bridge server URL</span>
                  <input
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
                    value={form.bridge_server_url}
                    onChange={(event) => setForm((prev) => ({ ...prev, bridge_server_url: event.target.value }))}
                    placeholder="Optional override if the bridge posts to a remote API"
                  />
                </label>

                <label className="md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-wide text-slate-500">Notes</span>
                  <textarea
                    className="mt-1 min-h-[96px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
                    value={form.notes}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Installation notes, VLAN, floor, vendor details, fallback instructions..."
                  />
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  <span className="text-sm font-bold text-slate-700">Machine active and eligible to send attendance</span>
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleDraftProbe}
                  disabled={testingDraft}
                  className="inline-flex items-center gap-2 rounded-2xl border border-school-blue/20 bg-school-blue/5 px-4 py-3 text-sm font-black text-school-blue disabled:opacity-50"
                >
                  <Cable className="h-4 w-4" />
                  {testingDraft ? "Testing..." : "Test connection"}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-school-navy px-5 py-3 text-sm font-black text-white shadow-lg shadow-school-navy/20 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : editingId ? "Save changes" : "Register machine"}
                </button>
              </div>

              {draftProbe ? (
                <div
                  className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                    draftProbe.ok
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {draftProbe.ok ? <Wifi className="mt-0.5 h-4 w-4" /> : <WifiOff className="mt-0.5 h-4 w-4" />}
                    <div>
                      <p>{draftProbe.message}</p>
                      {draftProbe.latency_ms ? <p className="mt-1 text-xs font-black uppercase tracking-wide">Latency {draftProbe.latency_ms} ms</p> : null}
                      {draftProbe.note ? <p className="mt-1 text-xs">{draftProbe.note}</p> : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </form>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-black text-slate-900">Setup flow</h3>
              <div className="mt-4 space-y-3 text-sm font-semibold text-slate-600">
                <p>1. Register a machine for the school or office entry point and test the LAN IP/port.</p>
                <p>2. Click Launch all bridges to start one worker per active registered machine in this school scope.</p>
                <p>3. Download the bridge config JSON for any single machine only when you need to inspect or debug its exact payload.</p>
                <p>4. Watch the machine card for last seen and last punch updates after live scans begin.</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Registered machines</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {loading ? "Refreshing machine inventory..." : `${devices.length} machine records in scope`}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {devices.length === 0 && !loading ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-semibold text-slate-500">
                    No biometric machines registered yet.
                  </div>
                ) : null}

                {devices.map((device) => (
                  <div key={device.id} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-black text-slate-900">{device.name}</h4>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone(device.status_label)}`}>
                            {device.status_label.replace("_", " ")}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {device.device_type}
                          </span>
                          {device.school_name ? (
                            <span className="rounded-full border border-school-blue/20 bg-school-blue/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-school-blue">
                              {device.school_name}
                            </span>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-1 gap-3 text-sm font-semibold text-slate-600 md:grid-cols-2">
                          <p><span className="font-black text-slate-800">Location:</span> {device.site_label || "Unspecified"}</p>
                          <p><span className="font-black text-slate-800">Network:</span> {device.device_ip}:{device.device_port}</p>
                          <p><span className="font-black text-slate-800">Machine No:</span> {device.machine_number}</p>
                          <p><span className="font-black text-slate-800">Last punch:</span> {fmtDateTime(device.last_punch_at)}</p>
                          <p><span className="font-black text-slate-800">Last seen:</span> {fmtDateTime(device.last_seen_at)}</p>
                          <p><span className="font-black text-slate-800">Last test:</span> {fmtDateTime(device.last_tested_at)}</p>
                        </div>

                        {device.last_test_message ? (
                          <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
                            {device.last_test_message}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2 lg:max-w-[280px] lg:justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeviceTest(device.id)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700"
                        >
                          <Wifi className="h-4 w-4" />
                          Test
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadConfig(device.id)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700"
                        >
                          <Download className="h-4 w-4" />
                          Config
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePreview(device.id)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700"
                        >
                          <ServerCog className="h-4 w-4" />
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(device)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRotateSecret(device.id)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-amber-700"
                        >
                          <KeyRound className="h-4 w-4" />
                          Rotate key
                        </button>
                        <button
                          type="button"
                          onClick={() => copyText(device.device_secret_key, "Device token copied")}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700"
                        >
                          <Copy className="h-4 w-4" />
                          Copy token
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(device.id)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Bridge preview</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Downloaded configs match this payload. Use it with the Windows bridge app.
                  </p>
                </div>
                {preview?.device?.device_secret_key ? (
                  <button
                    type="button"
                    onClick={() => copyText(preview.device.device_secret_key, "Bridge token copied")}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700"
                  >
                    <Copy className="h-4 w-4" />
                    Copy token
                  </button>
                ) : null}
              </div>

              {preview ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                    <p><span className="font-black text-slate-900">Device:</span> {preview.device.name}</p>
                    <p className="mt-1"><span className="font-black text-slate-900">Target API:</span> {preview.config.server_url}</p>
                    <p className="mt-1"><span className="font-black text-slate-900">Launch note:</span> {preview.launch_note}</p>
                  </div>
                  <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs font-semibold text-emerald-200">
                    {JSON.stringify(preview.config, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                  Choose a machine and open <strong>Preview</strong> to inspect the exact bridge config.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
