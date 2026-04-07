// ============================================================
// Order Routes — /api/orders
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { generateOrderNumber } from "../../lib/orderNumber";
import { CreateOrderInput } from "../../types";

// GET /api/orders — list orders for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "10");

    const where = { userId, ...(status ? { status: status as any } : {}) };

    const [orders, total] = await Promise.all([
      prisma.deliveryOrder.findMany({
        where,
        include: {
          address: true,
          prescription: { include: { medicines: true } },
          items: { include: { medicine: true } },
          statusHistory: { orderBy: { timestamp: "asc" } },
          agent: { select: { name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.deliveryOrder.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: orders, total, page, limit });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to fetch orders" }, { status: 500 });
  }
}

// POST /api/orders — place a new delivery order
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body: CreateOrderInput = await req.json();

    // Validate address belongs to user
    const address = await prisma.address.findFirst({ where: { id: body.addressId, userId, isActive: true } });
    if (!address) return NextResponse.json({ success: false, error: "Invalid address" }, { status: 400 });

    // Validate prescription belongs to user and is not expired
    const prescription = await prisma.prescription.findFirst({
      where: { id: body.prescriptionId, userId },
      include: { medicines: true },
    });
    if (!prescription)
      return NextResponse.json({ success: false, error: "Prescription not found" }, { status: 404 });

    if (prescription.expiresAt && new Date(prescription.expiresAt) < new Date())
      return NextResponse.json({ success: false, error: "Prescription has expired" }, { status: 400 });

    // All ordered medicines must be in this prescription
    const prescribedIds = new Set(prescription.medicines.map((m) => m.id));
    for (const item of body.items) {
      if (!prescribedIds.has(item.prescribedMedicineId))
        return NextResponse.json({ success: false, error: "Medicine not in prescription" }, { status: 400 });
    }

    // Generate unique order number
    let orderNumber = generateOrderNumber();
    let tries = 0;
    while (await prisma.deliveryOrder.findUnique({ where: { orderNumber } })) {
      orderNumber = generateOrderNumber();
      if (++tries > 10) throw new Error("Could not generate unique order number");
    }

    const order = await prisma.$transaction(async (tx) => {
      return tx.deliveryOrder.create({
        data: {
          orderNumber,
          userId,
          prescriptionId: body.prescriptionId,
          addressId: body.addressId,
          deliverySlot: body.deliverySlot,
          slotDate: new Date(body.slotDate),
          slotStartTime: body.slotStartTime,
          slotEndTime: body.slotEndTime,
          notes: body.notes,
          deliveryFee: 0,
          items: { create: body.items.map((i) => ({ prescribedMedicineId: i.prescribedMedicineId, quantityOrdered: i.quantityOrdered, unitPrice: 0, totalPrice: 0 })) },
          statusHistory: { create: { status: "PENDING", message: "Order placed", updatedBy: "system" } },
        },
        include: {
          address: true,
          prescription: { include: { medicines: true } },
          items: { include: { medicine: true } },
          statusHistory: true,
        },
      });
    });

    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: "Failed to place order" }, { status: 500 });
  }
}

// PATCH /api/orders/[id]/status — update order status (pharmacy/agent use)
export async function UPDATE_STATUS(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body: { status: string; message?: string; agentId?: string; estimatedETA?: string } = await req.json();

    const order = await prisma.deliveryOrder.findUnique({ where: { id: params.id } });
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.deliveryOrder.update({
        where: { id: params.id },
        data: {
          status: body.status as any,
          ...(body.agentId ? { deliveryAgentId: body.agentId } : {}),
          ...(body.estimatedETA ? { estimatedETA: new Date(body.estimatedETA) } : {}),
          ...(body.status === "DELIVERED" ? { deliveredAt: new Date() } : {}),
        },
      });
      await tx.orderStatusLog.create({ data: { orderId: params.id, status: body.status as any, message: body.message, updatedBy: body.agentId ?? "system" } });
      return u;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to update status" }, { status: 500 });
  }
}

// POST /api/orders/[id]/cancel — patient cancels their order
export async function CANCEL(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const order = await prisma.deliveryOrder.findFirst({ where: { id: params.id, userId } });
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });

    if (!["PENDING", "PRESCRIPTION_VERIFIED", "PROCESSING"].includes(order.status))
      return NextResponse.json({ success: false, error: "Cannot cancel at this stage" }, { status: 400 });

    await prisma.$transaction([
      prisma.deliveryOrder.update({ where: { id: params.id }, data: { status: "CANCELLED" } }),
      prisma.orderStatusLog.create({ data: { orderId: params.id, status: "CANCELLED", message: "Cancelled by patient", updatedBy: userId } }),
    ]);

    return NextResponse.json({ success: true, message: "Order cancelled" });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to cancel" }, { status: 500 });
  }
}
