# API Testing Guide
Ready-to-use curl commands for interacting with the Multi-Tenant Payment Platform.

### 1. Create a payment (bank1 tenant)
```bash
curl -X POST http://localhost:3000/payments \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: bank1" \
  -d '{"amount": 1500, "currency": "INR", "status": "pending"}'
```

### 2. Get all payments (bank1 tenant)
```bash
curl http://localhost:3000/payments \
  -H "X-Tenant-ID: bank1"
```

### 3. Get all payments (hdfc tenant - should see different data)
```bash
curl http://localhost:3000/payments \
  -H "X-Tenant-ID: hdfc"
```

### 4. Test rate limiting
Run this 61 times to trigger a 429 Too Many Requests error for the `bank1` tenant (Starter tier limit is 60/min).
```bash
curl http://localhost:3000/payments \
  -H "X-Tenant-ID: bank1" \
  -v 2>&1 | grep "X-RateLimit"
```
Or use a simple bash loop to test it automatically:
```bash
for i in {1..65}; do curl -s -I -H "X-Tenant-ID: bank1" http://localhost:3000/payments | grep "HTTP/1.1\|X-RateLimit"; echo "---"; done
```

### 5. Test inactive tenant
First, update the `bank1` tenant's `isActive` field to `false` in MongoDB.
Then run:
```bash
curl http://localhost:3000/payments \
  -H "X-Tenant-ID: bank1"
```
*(This will return a 401 Unauthorized since inactive tenants are blocked by the middleware)*
