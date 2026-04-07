"use client";
// ============================================================
// PlaceOrder.tsx
// Step-by-step order placement: pick prescription → address → slot → confirm
// ============================================================

import { useState, useEffect } from "react";
import { Prescription, Address, DeliverySlot, CreateOrderInput } from "../../types";

interface Props {
  onOrderPlaced?: (orderNumber: string) => void;
}

type Step = "prescription" | "address" | "slot" | "confirm";

export default function PlaceOrder({ onOrderPlaced }: Props) {
  const [step, setStep] = useState<Step>("prescription");
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [slots, setSlots] = useState<DeliverySlot[]>([]);

  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<DeliverySlot | null>(null);

  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [rxRes, addrRes] = await Promise.all([
          fetch("/api/prescriptions?validOnly=true"),
          fetch("/api/addresses"),
        ]);
        const [rxJson, addrJson] = await Promise.all([rxRes.json(), addrRes.json()]);
        if (rxJson.success) setPrescriptions(rxJson.data);
        if (addrJson.success) {
          setAddresses(addrJson.data);
          // Auto-select default address
          const def = addrJson.data.find((a: Address) => a.isDefault);
          if (def) setSelectedAddress(def);
        }
      } finally {
        setLoading(false);
      }
    }

    async function loadSlots() {
      const res = await fetch("/api/delivery-slots");
      const json = await res.json();
      if (json.success) setSlots(json.data);
      else {
        // Fallback: compute client-side
        const now = new Date();
        const h = now.getHours();
        const today = now.toISOString().split("T")[0];
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tom = tomorrow.toISOString().split("T")[0];
        setSlots([
          { id: "1", label: "Today 10 AM – 12 PM", date: today, startTime: "10:00", endTime: "12:00", available: h < 9 },
          { id: "2", label: "Today 4 PM – 6 PM", date: today, startTime: "16:00", endTime: "18:00", available: h < 15 },
          { id: "3", label: "Tomorrow 9 AM – 11 AM", date: tom, startTime: "09:00", endTime: "11:00", available: true },
          { id: "4", label: "Tomorrow 2 PM – 4 PM", date: tom, startTime: "14:00", endTime: "16:00", available: true },
        ]);
      }
    }

    load();
    loadSlots();
  }, []);

  async function handlePlaceOrder() {
    if (!selectedPrescription || !selectedAddress || !selectedSlot) return;
    setPlacing(true);
    setError("");

    const payload: CreateOrderInput = {
      prescriptionId: selectedPrescription.id,
      addressId: selectedAddress.id,
      deliverySlot: selectedSlot.label,
      slotDate: selectedSlot.date,
      slotStartTime: selectedSlot.startTime,
      slotEndTime: selectedSlot.endTime,
      items: selectedPrescription.medicines.map((m) => ({
        prescribedMedicineId: m.id,
        quantityOrdered: m.quantity,
      })),
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onOrderPlaced?.(json.data.orderNumber);
    } catch (e: any) {
      setError(e.message ?? "Failed to place order");
    } finally {
      setPlacing(false);
    }
  }

  const steps: Step[] = ["prescription", "address", "slot", "confirm"];
  const stepLabels = ["Prescription", "Address", "Slot", "Confirm"];

  if (loading) return <p className="text-sm text-gray-500 p-4">Loading…</p>;

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                step === s
                  ? "bg-blue-600 text-white"
                  : steps.indexOf(step) > i
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {steps.indexOf(step) > i ? "✓" : i + 1}
            </div>
            <span className={`text-xs ${step === s ? "text-blue-600 font-medium" : "text-gray-400"}`}>
              {stepLabels[i]}
            </span>
            {i < steps.length - 1 && <div className="w-6 h-px bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step: Prescription */}
      {step === "prescription" && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Select prescription</p>
          {prescriptions.length === 0 && (
            <p className="text-sm text-gray-400">No valid prescriptions found.</p>
          )}
          {prescriptions.map((rx) => (
            <div
              key={rx.id}
              onClick={() => setSelectedPrescription(rx)}
              className={`border rounded-xl p-4 cursor-pointer transition-all ${
                selectedPrescription?.id === rx.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-sm">{rx.doctorName}</p>
                  <p className="text-xs text-gray-500">
                    {rx.hospitalName ? `${rx.hospitalName} · ` : ""}
                    {new Date(rx.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {rx.medicines.map((m) => (
                      <span key={m.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                        {m.name} {m.dosage}
                      </span>
                    ))}
                  </div>
                </div>
                {!rx.isVerified && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">
                    Pending verification
                  </span>
                )}
              </div>
            </div>
          ))}
          <button
            disabled={!selectedPrescription}
            onClick={() => setStep("address")}
            className="w-full bg-blue-600 text-white text-sm py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-40"
          >
            Continue →
          </button>
        </div>
      )}

      {/* Step: Address */}
      {step === "address" && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Deliver to</p>
          {addresses.map((addr) => (
            <div
              key={addr.id}
              onClick={() => setSelectedAddress(addr)}
              className={`border rounded-xl p-4 cursor-pointer transition-all ${
                selectedAddress?.id === addr.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Default</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{addr.street}, {addr.city} – {addr.pinCode}</p>
                  {addr.landmark && <p className="text-xs text-gray-400 mt-0.5">Near: {addr.landmark}</p>}
                </div>
                {selectedAddress?.id === addr.id && <span className="text-blue-500 text-lg">✓</span>}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={() => setStep("prescription")} className="flex-1 border border-gray-200 text-sm py-2.5 rounded-xl hover:bg-gray-50">
              ← Back
            </button>
            <button
              disabled={!selectedAddress}
              onClick={() => setStep("slot")}
              className="flex-1 bg-blue-600 text-white text-sm py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-40"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step: Delivery Slot */}
      {step === "slot" && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Choose delivery slot</p>
          <div className="grid grid-cols-2 gap-2">
            {slots.map((slot) => (
              <button
                key={slot.id}
                disabled={!slot.available}
                onClick={() => setSelectedSlot(slot)}
                className={`border rounded-xl p-3 text-sm text-left transition-all ${
                  !slot.available
                    ? "border-gray-100 text-gray-300 cursor-not-allowed bg-gray-50"
                    : selectedSlot?.id === slot.id
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {slot.label}
                {!slot.available && <span className="block text-xs text-gray-300">Unavailable</span>}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep("address")} className="flex-1 border border-gray-200 text-sm py-2.5 rounded-xl hover:bg-gray-50">
              ← Back
            </button>
            <button
              disabled={!selectedSlot}
              onClick={() => setStep("confirm")}
              className="flex-1 bg-blue-600 text-white text-sm py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-40"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === "confirm" && selectedPrescription && selectedAddress && selectedSlot && (
        <div className="space-y-4">
          <p className="text-sm font-medium">Order summary</p>

          <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-1">Prescription</p>
              <p className="font-medium">{selectedPrescription.doctorName}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {selectedPrescription.medicines.map((m) => (
                  <span key={m.id} className="text-xs bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                    {m.name} {m.dosage} × {m.quantity}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3">
              <p className="text-xs text-gray-400 mb-1">Deliver to</p>
              <p className="font-medium">{selectedAddress.label}</p>
              <p className="text-gray-600">{selectedAddress.street}, {selectedAddress.city} – {selectedAddress.pinCode}</p>
            </div>

            <div className="border-t border-gray-200 pt-3">
              <p className="text-xs text-gray-400 mb-1">Delivery slot</p>
              <p className="font-medium">{selectedSlot.label}</p>
            </div>

            <div className="border-t border-gray-200 pt-3 flex justify-between">
              <span className="text-gray-600">Delivery fee</span>
              <span className="font-medium text-green-600">Free</span>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          <p className="text-xs text-gray-400">
            Your prescription will be verified by our pharmacist before medicines are dispatched.
          </p>

          <div className="flex gap-2">
            <button onClick={() => setStep("slot")} className="flex-1 border border-gray-200 text-sm py-2.5 rounded-xl hover:bg-gray-50">
              ← Back
            </button>
            <button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="flex-1 bg-blue-600 text-white text-sm py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {placing ? "Placing order…" : "Place order"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
