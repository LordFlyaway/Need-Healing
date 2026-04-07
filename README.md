# Healthcare Home Delivery — Setup Guide

## Project Structure

```
healthcare-delivery/
├── prisma/
│   └── schema.prisma          ← Database schema (PostgreSQL)
├── src/
│   ├── types/
│   │   └── index.ts           ← Shared TypeScript interfaces
│   ├── lib/
│   │   ├── prisma.ts          ← Prisma client singleton
│   │   ├── orderNumber.ts     ← Order number generator
│   │   └── deliverySlots.ts   ← Available delivery slots logic
│   ├── api/routes/
│   │   ├── addresses.ts       ← GET/POST/PATCH/DELETE /api/addresses
│   │   ├── orders.ts          ← GET/POST /api/orders + status/cancel
│   │   └── prescriptions.ts   ← GET /api/prescriptions
│   └── components/delivery/
│       ├── AddressManager.tsx ← Saved addresses + add new address
│       ├── PlaceOrder.tsx     ← 4-step order wizard
│       ├── OrderTracker.tsx   ← Live order status timeline
│       └── DeliveryDashboard.tsx ← Main delivery page (tabs)
```

## Setup

### 1. Environment
```bash
cp .env.example .env
# Set DATABASE_URL=postgresql://user:password@localhost:5432/healthcare
```

### 2. Database
```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
```

### 3. Next.js API Routes
Place each route file in:
```
app/api/addresses/route.ts          → export { GET, POST } from "@/api/routes/addresses"
app/api/addresses/[id]/route.ts     → export { PATCH, DELETE }
app/api/orders/route.ts             → export { GET, POST }
app/api/orders/[id]/status/route.ts → export { PATCH } (UPDATE_STATUS)
app/api/orders/[id]/cancel/route.ts → export { POST } (CANCEL)
app/api/prescriptions/route.ts      → export { GET }
```

### 4. Authentication
All routes read `x-user-id` from request headers.
Wire this up using your auth middleware (e.g. NextAuth, Clerk, or custom JWT).

```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  const session = getSession(req); // your auth logic
  req.headers.set("x-user-id", session.userId);
}
```

### 5. Use the components
```tsx
// app/delivery/page.tsx
import DeliveryDashboard from "@/components/delivery/DeliveryDashboard";
export default function DeliveryPage() {
  return <DeliveryDashboard />;
}
```

## Key Design Decisions

| Decision | Reason |
|---|---|
| Soft-delete addresses | Preserves historical order data integrity |
| Prescription-gated orders | Prevents medicine misuse; pharmacist verifies before dispatch |
| Order number collision retry | Human-readable IDs without UUID verbosity |
| Free delivery fee field | Easy to extend with distance-based or subscription pricing |
| Status log table | Full audit trail for every order status change |
| Poll every 30s in OrderTracker | Simple; upgrade to WebSockets for production |
