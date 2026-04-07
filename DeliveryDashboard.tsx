"use client";
// ============================================================
// DeliveryDashboard.tsx
// Top-level delivery page — tabs: Overview | Addresses | New Order | Track
// ============================================================

import { useState, useEffect } from "react";
import AddressManager from "./AddressManager";
import PlaceOrder from "./PlaceOrder";
import OrderTracker from "./OrderTracker";
import { DeliveryOrder } from "../../types";

type Tab = "overview" | "addresses" | "order" | "track";

export default function DeliveryDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [trackingId, setTrackingId] = useState<string>("");
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    try {
      const res = await fetch("/api/orders?limit=5");
      const json = await res.json();
      if (json.success) setOrders(json.data);
    } finally {
      setLoadingOrders(false);
    }
  }

  function handleOrderPlaced(orderNumber: string) {
    fetchOrders();
    setTrackingId(orderNumber);
    setTab("track");
  }

  const activeOrders = orders.filter((o) =>
    ["PENDING", "PRESCRIPTION_VERIFIED", "PROCESSING", "PACKED", "OUT_FOR_DELIVERY"].includes(o.status)
  );

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "addresses", label: "My addresses" },
    { id: "order", label: "New order" },
    { id: "track", label: "Track order" },
  ];

  return (
    <div className="max-w-xl mx-auto p-4 font-sans">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-full text-sm border transition-all ${
              tab === t.id
                ? "bg-gray-900 text-white border-gray-900"
                : "border-gray-200 text-gray-500 hover:border-gray-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* Metric cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-medium text-blue-600">{activeOrders.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Active orders</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-medium text-green-600">
                {orders.filter((o) => o.status === "DELIVERED").length}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Delivered</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-medium text-gray-700">{orders.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total orders</p>
            </div>
          </div>

          {/* Active orders */}
          {loadingOrders ? (
            <p className="text-sm text-gray-400">Loading orders…</p>
          ) : activeOrders.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center">
              <p className="text-gray-400 text-sm mb-3">No active orders</p>
              <button
                onClick={() => setTab("order")}
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Order medicines
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Active orders</p>
              {activeOrders.map((order) => (
                <div
                  key={order.id}
                  className="border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-gray-300 transition-all"
                  onClick={() => { setTrackingId(order.id); setTab("track"); }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-sm">{order.orderNumber}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {order.address.label} · {order.address.city}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{order.deliverySlot}</p>
                </div>
              ))}
            </div>
          )}

          {/* Recent delivered */}
          {orders.filter((o) => o.status === "DELIVERED").length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Recent deliveries</p>
              {orders.filter((o) => o.status === "DELIVERED").slice(0, 3).map((order) => (
                <div key={order.id} className="flex justify-between items-center text-sm py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <span className="font-medium">{order.orderNumber}</span>
                    <span className="text-gray-400 text-xs ml-2">
                      {new Date(order.deliveredAt ?? order.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <button className="text-xs text-blue-600 hover:underline">Reorder</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Addresses */}
      {tab === "addresses" && <AddressManager mode="manage" />}

      {/* New Order */}
      {tab === "order" && <PlaceOrder onOrderPlaced={handleOrderPlaced} />}

      {/* Track */}
      {tab === "track" && (
        <div className="space-y-4">
          {/* Search by order number */}
          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm"
              placeholder="Enter order number e.g. ORD-8821"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
            />
            <button
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700"
              onClick={() => {}} // triggers re-render with new trackingId
            >
              Track
            </button>
          </div>

          {trackingId ? (
            <OrderTracker orderId={trackingId} />
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Your orders</p>
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-gray-300 flex justify-between items-center"
                  onClick={() => setTrackingId(order.id)}
                >
                  <div>
                    <p className="font-medium text-sm">{order.orderNumber}</p>
                    <p className="text-xs text-gray-400">{order.deliverySlot}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-600",
    PRESCRIPTION_VERIFIED: "bg-blue-100 text-blue-700",
    PROCESSING: "bg-amber-100 text-amber-700",
    PACKED: "bg-amber-100 text-amber-700",
    OUT_FOR_DELIVERY: "bg-blue-100 text-blue-700",
    DELIVERED: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
    CANCELLED: "bg-gray-100 text-gray-500",
  };
  const labels: Record<string, string> = {
    PENDING: "Pending", PRESCRIPTION_VERIFIED: "Verified",
    PROCESSING: "Processing", PACKED: "Packed",
    OUT_FOR_DELIVERY: "Out for delivery", DELIVERED: "Delivered",
    FAILED: "Failed", CANCELLED: "Cancelled",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {labels[status] ?? status}
    </span>
  );
}
