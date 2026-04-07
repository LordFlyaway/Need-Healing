"use client";
// ============================================================
// OrderTracker.tsx
// Real-time order status timeline
// ============================================================

import { useState, useEffect } from "react";
import { DeliveryOrder, OrderStatus } from "../../types";

interface Props {
  orderId?: string;
  orderNumber?: string;
}

const STATUS_STEPS: { status: OrderStatus; label: string; description: string }[] = [
  { status: "PENDING", label: "Order placed", description: "Your order has been received" },
  { status: "PRESCRIPTION_VERIFIED", label: "Prescription verified", description: "Pharmacist approved your prescription" },
  { status: "PROCESSING", label: "Being packed", description: "Medicines are being prepared" },
  { status: "PACKED", label: "Packed", description: "Order is packed and ready" },
  { status: "OUT_FOR_DELIVERY", label: "Out for delivery", description: "Your order is on the way" },
  { status: "DELIVERED", label: "Delivered", description: "Order delivered successfully" },
];

function getStepIndex(status: OrderStatus): number {
  return STATUS_STEPS.findIndex((s) => s.status === status);
}

export default function OrderTracker({ orderId, orderNumber }: Props) {
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId && !orderNumber) return;
    fetchOrder();
    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchOrder, 30_000);
    return () => clearInterval(interval);
  }, [orderId, orderNumber]);

  async function fetchOrder() {
    try {
      const url = orderId ? `/api/orders/${orderId}` : `/api/orders?orderNumber=${orderNumber}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setOrder(json.data?.data ?? json.data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load order");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-500 p-4">Loading order…</p>;
  if (error) return <p className="text-sm text-red-500 p-4">{error}</p>;
  if (!order) return <p className="text-sm text-gray-400 p-4">Order not found.</p>;

  const currentStepIndex = getStepIndex(order.status);
  const isCancelled = order.status === "CANCELLED";
  const isFailed = order.status === "FAILED";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">{order.orderNumber}</p>
          <p className="text-sm text-gray-500">
            Placed {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            {" · "}
            {order.items.length} item{order.items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Delivery info */}
      <div className="bg-gray-50 rounded-xl p-4 text-sm">
        <div className="flex justify-between items-start gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Delivering to</p>
            <p className="font-medium">{order.address.label}</p>
            <p className="text-gray-600 text-xs mt-0.5">
              {order.address.street}, {order.address.city} – {order.address.pinCode}
            </p>
            <p className="text-gray-500 text-xs">{order.address.recipientName} · {order.address.phone}</p>
          </div>
          {order.estimatedETA && order.status === "OUT_FOR_DELIVERY" && (
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">ETA</p>
              <p className="font-medium text-blue-600 text-sm">
                {new Date(order.estimatedETA).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cancelled / Failed state */}
      {(isCancelled || isFailed) ? (
        <div className={`rounded-xl p-4 text-sm ${isCancelled ? "bg-gray-50 text-gray-600" : "bg-red-50 text-red-700"}`}>
          {isCancelled ? "This order was cancelled." : "Delivery failed. Please contact support."}
        </div>
      ) : (
        /* Timeline */
        <div className="relative pl-7 space-y-4">
          <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-200" />

          {STATUS_STEPS.map((step, i) => {
            const isDone = currentStepIndex > i;
            const isCurrent = currentStepIndex === i;
            const isPending = currentStepIndex < i;

            // Find the log entry for this status
            const logEntry = order.statusHistory.find((l) => l.status === step.status);

            return (
              <div key={step.status} className="relative">
                <div
                  className={`absolute -left-7 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                    isDone
                      ? "bg-green-500 text-white"
                      : isCurrent
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {isDone ? "✓" : isCurrent ? "→" : ""}
                </div>

                <div className={isPending ? "opacity-40" : ""}>
                  <p className={`text-sm font-medium ${isCurrent ? "text-blue-600" : ""}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-gray-500">{step.description}</p>
                  {logEntry && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(logEntry.timestamp).toLocaleTimeString("en-IN", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                      {logEntry.updatedBy && logEntry.updatedBy !== "system"
                        ? ` · ${logEntry.updatedBy}`
                        : ""}
                    </p>
                  )}
                  {isCurrent && order.agentName && step.status === "OUT_FOR_DELIVERY" && (
                    <div className="mt-2 flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-xs font-medium text-blue-700">Delivery agent</p>
                        <p className="text-xs text-blue-600">{order.agentName}</p>
                      </div>
                      {order.agentPhone && (
                        <a href={`tel:${order.agentPhone}`} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg">
                          Call
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Items */}
      <div className="border border-gray-100 rounded-xl p-4">
        <p className="text-xs text-gray-400 mb-3">Items in this order</p>
        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.medicine.name} {item.medicine.dosage}</span>
              <span className="text-gray-400">× {item.quantityOrdered}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-gray-100 text-gray-600" },
    PRESCRIPTION_VERIFIED: { label: "Verified", className: "bg-blue-100 text-blue-700" },
    PROCESSING: { label: "Processing", className: "bg-amber-100 text-amber-700" },
    PACKED: { label: "Packed", className: "bg-amber-100 text-amber-700" },
    OUT_FOR_DELIVERY: { label: "Out for delivery", className: "bg-blue-100 text-blue-700" },
    DELIVERED: { label: "Delivered", className: "bg-green-100 text-green-700" },
    FAILED: { label: "Failed", className: "bg-red-100 text-red-700" },
    CANCELLED: { label: "Cancelled", className: "bg-gray-100 text-gray-500" },
  };
  const { label, className } = map[status];
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${className}`}>{label}</span>
  );
}
