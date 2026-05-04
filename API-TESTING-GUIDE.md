# API Testing Guide

Ready-to-use curl commands for interacting with the Multi-Tenant Payment Platform.

## 1. Setup & Seeding
First, ensure your database is seeded with the test tenants and users:
```bash
npm run seed
```
This creates:
- **Tenant `bank1`** with users: `admin@bank1.com`, `user@bank1.com`
- **Tenant `hdfc`** with user: `admin@hdfc.com`
- Default password for all: `password123`

## 2. Authentication (Login)
Login to get your JWT access token. 
*Note: You must provide the `X-Tenant-ID` header so the system knows which tenant you are logging into.*

```bash
# Login as Bank1 Admin
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: bank1" \
  -d '{"email": "admin@bank1.com", "password": "password123", "tenantId": "bank1"}'
```

The response will contain the `refreshToken` and a `Set-Cookie` header with the `jwt`.

## 3. Accessing Protected Routes
Now that you have a JWT, you can access protected routes.

```bash
# Get payments (using the cookie set by login)
# Note: If using curl, you may need to manually pass the token in Authorization header
# if you didn't save the cookie.
curl http://localhost:3000/payments \
  -H "X-Tenant-ID: bank1" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

## 4. Testing Tenant Isolation (Security)
Try to access `hdfc` data using a `bank1` token. This should be blocked by the `TenantMatchGuard`.

```bash
# Use bank1 token but target hdfc tenant
curl http://localhost:3000/payments \
  -H "X-Tenant-ID: hdfc" \
  -H "Authorization: Bearer <BANK1_TOKEN>"
```
**Expected Result:** `403 Forbidden` with message "Cross-tenant access denied".

## 5. Testing Role-Based Access
Some routes may be restricted to `TENANT_ADMIN`.

```bash
# Try to access admin-only route with a regular USER token
# (Assuming you add @Roles(Role.TENANT_ADMIN) to a route)
curl -X DELETE http://localhost:3000/payments/some-id \
  -H "X-Tenant-ID: bank1" \
  -H "Authorization: Bearer <USER_TOKEN>"
```
**Expected Result:** `403 Forbidden` with message "Insufficient permissions".

## 6. Rate Limiting
The `RateLimitGuard` is still active. Starter tenants (bank1) are limited to 60 req/min.

```bash
for i in {1..65}; do curl -s -I -H "X-Tenant-ID: bank1" -H "Authorization: Bearer <TOKEN>" http://localhost:3000/payments | grep "HTTP/1.1\|X-RateLimit"; done
```
