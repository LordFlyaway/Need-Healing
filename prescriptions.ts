// ============================================================
// Prescription Routes — /api/prescriptions
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

// GET /api/prescriptions — list prescriptions (optionally only valid/non-expired)
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const validOnly = new URL(req.url).searchParams.get("validOnly") === "true";

    const prescriptions = await prisma.prescription.findMany({
      where: {
        userId,
        ...(validOnly ? { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } : {}),
      },
      include: { medicines: true },
      orderBy: { issuedAt: "desc" },
    });

    return NextResponse.json({ success: true, data: prescriptions });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to fetch prescriptions" }, { status: 500 });
  }
}

// GET /api/prescriptions/[id]/orderable — medicines remaining to order
export async function GET_ORDERABLE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const prescription = await prisma.prescription.findFirst({
      where: { id: params.id, userId },
      include: { medicines: { include: { orderItems: { include: { order: { select: { status: true } } } } } } },
    });
    if (!prescription) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const medicines = prescription.medicines.map((med) => {
      const fulfilled = med.orderItems
        .filter((oi) => !["CANCELLED", "FAILED"].includes(oi.order.status))
        .reduce((sum, oi) => sum + oi.quantityOrdered, 0);
      return { ...med, fulfilledQty: fulfilled, remainingQty: Math.max(0, med.quantity - fulfilled), canOrder: fulfilled < med.quantity };
    });

    return NextResponse.json({ success: true, data: { prescription, medicines } });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
