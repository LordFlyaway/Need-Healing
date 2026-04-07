// ============================================================
// Address Routes — /api/addresses
// Framework: Next.js App Router (Route Handlers)
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { CreateAddressInput, UpdateAddressInput } from "../../types";

// GET /api/addresses — fetch all active addresses for the user
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const addresses = await prisma.address.findMany({
      where: { userId, isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ success: true, data: addresses });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to fetch addresses" }, { status: 500 });
  }
}

// POST /api/addresses — create a new address linked to the user account
export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body: CreateAddressInput = await req.json();

    const required = ["label", "recipientName", "phone", "street", "city", "state", "pinCode"];
    for (const field of required) {
      if (!body[field as keyof CreateAddressInput])
        return NextResponse.json({ success: false, error: `Missing field: ${field}` }, { status: 400 });
    }

    if (!/^\d{6}$/.test(body.pinCode))
      return NextResponse.json({ success: false, error: "PIN code must be 6 digits" }, { status: 400 });

    // If setting as default, clear existing default
    if (body.isDefault) {
      await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    // Auto-default if first address
    const existingCount = await prisma.address.count({ where: { userId, isActive: true } });
    const isDefault = body.isDefault ?? existingCount === 0;

    const address = await prisma.address.create({
      data: { userId, ...body, addressType: body.addressType ?? "HOME", isDefault },
    });

    return NextResponse.json({ success: true, data: address }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to create address" }, { status: 500 });
  }
}

// PATCH /api/addresses/[id] — update a specific address
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const existing = await prisma.address.findFirst({ where: { id: params.id, userId } });
    if (!existing) return NextResponse.json({ success: false, error: "Address not found" }, { status: 404 });

    const body: UpdateAddressInput = await req.json();

    if (body.isDefault) {
      await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    const updated = await prisma.address.update({ where: { id: params.id }, data: body });
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to update address" }, { status: 500 });
  }
}

// DELETE /api/addresses/[id] — soft delete (preserves order history)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const existing = await prisma.address.findFirst({ where: { id: params.id, userId } });
    if (!existing) return NextResponse.json({ success: false, error: "Address not found" }, { status: 404 });

    const activeCount = await prisma.address.count({ where: { userId, isActive: true } });
    if (activeCount <= 1)
      return NextResponse.json({ success: false, error: "Cannot delete your only address" }, { status: 400 });

    await prisma.address.update({ where: { id: params.id }, data: { isActive: false, isDefault: false } });

    // Promote next address as default if this was the default
    if (existing.isDefault) {
      const next = await prisma.address.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } });
      if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }

    return NextResponse.json({ success: true, message: "Address removed" });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to delete address" }, { status: 500 });
  }
}
