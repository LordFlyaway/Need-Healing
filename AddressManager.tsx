"use client";
// ============================================================
// AddressManager.tsx
// Displays saved addresses + add new address form
// Connected to: GET/POST/PATCH/DELETE /api/addresses
// ============================================================

import { useState, useEffect } from "react";
import { Address, CreateAddressInput, AddressType } from "../../types";

interface Props {
  onAddressSelect?: (address: Address) => void;
  selectedId?: string;
  mode?: "manage" | "select"; // manage = full CRUD, select = pick for order
}

export default function AddressManager({ onAddressSelect, selectedId, mode = "manage" }: Props) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [form, setForm] = useState<CreateAddressInput>({
    label: "",
    recipientName: "",
    phone: "",
    street: "",
    city: "",
    state: "Tamil Nadu",
    pinCode: "",
    landmark: "",
    addressType: "HOME",
    isDefault: false,
  });

  useEffect(() => {
    fetchAddresses();
  }, []);

  async function fetchAddresses() {
    setLoading(true);
    try {
      const res = await fetch("/api/addresses");
      const json = await res.json();
      if (json.success) setAddresses(json.data);
    } catch {
      setError("Could not load addresses");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      setAddresses((prev) => {
        const updated = json.data.isDefault
          ? prev.map((a) => ({ ...a, isDefault: false }))
          : prev;
        return [...updated, json.data];
      });

      setForm({ label: "", recipientName: "", phone: "", street: "", city: "", state: "Tamil Nadu", pinCode: "", landmark: "", addressType: "HOME", isDefault: false });
      setShowForm(false);
      setSuccessMsg("Address saved!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (e: any) {
      setError(e.message ?? "Failed to save address");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await fetch(`/api/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, isDefault: a.id === id }))
      );
    } catch {
      setError("Failed to update default");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this address?")) return;
    try {
      const res = await fetch(`/api/addresses/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) {
      setError(e.message ?? "Failed to remove address");
    }
  }

  if (loading) return <p className="text-sm text-gray-500 p-4">Loading addresses…</p>;

  return (
    <div className="space-y-4">
      {/* Saved Addresses */}
      {addresses.map((addr) => (
        <div
          key={addr.id}
          className={`border rounded-xl p-4 transition-all ${
            selectedId === addr.id
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 bg-white hover:border-gray-300"
          } ${mode === "select" ? "cursor-pointer" : ""}`}
          onClick={() => mode === "select" && onAddressSelect?.(addr)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-medium text-sm">{addr.label}</span>
                {addr.isDefault && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    Default
                  </span>
                )}
                {selectedId === addr.id && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Selected
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">{addr.recipientName} · {addr.phone}</p>
              <p className="text-sm text-gray-600 mt-0.5">
                {addr.street}, {addr.city}, {addr.state} – {addr.pinCode}
              </p>
              {addr.landmark && (
                <p className="text-xs text-gray-400 mt-0.5">Near: {addr.landmark}</p>
              )}
            </div>

            {mode === "manage" && (
              <div className="flex flex-col gap-1.5 shrink-0">
                {!addr.isDefault && (
                  <button
                    onClick={() => handleSetDefault(addr.id)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Set default
                  </button>
                )}
                <button
                  onClick={() => handleDelete(addr.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {addresses.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">No saved addresses yet.</p>
      )}

      {/* Success / Error */}
      {successMsg && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {/* Add Address Form */}
      {showForm ? (
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
          <p className="font-medium text-sm">New address</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Label</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Home"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Type</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.addressType}
                onChange={(e) => setForm((f) => ({ ...f, addressType: e.target.value as AddressType }))}
              >
                <option value="HOME">Home</option>
                <option value="OFFICE">Office</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Recipient name</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Full name"
                value={form.recipientName}
                onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Phone</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Street address</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="House no., street, locality"
              value={form.street}
              onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">City</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Chennai"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">State</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">PIN code</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="600040"
                maxLength={6}
                value={form.pinCode}
                onChange={(e) => setForm((f) => ({ ...f, pinCode: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Landmark (optional)</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Nearest pharmacy, hospital…"
              value={form.landmark}
              onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))}
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            />
            Set as default delivery address
          </label>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save address"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full text-sm border border-dashed border-gray-300 rounded-xl py-3 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          + Add new address
        </button>
      )}
    </div>
  );
}
