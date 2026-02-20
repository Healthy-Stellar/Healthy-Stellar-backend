# 🚀 Billing API Quick Reference

## Common Use Cases

### 1. Create Invoice and Process Payment
```typescript
// Step 1: Create invoice
POST /billing
{
  "patientId": "patient-12345-anon",
  "patientName": "John Doe",
  "serviceDate": "2024-01-15",
  "providerId": "provider-001",
  "providerName": "Dr. Smith",
  "lineItems": [{
    "cptCode": "99213",
    "cptDescription": "Office visit",
    "unitCharge": 125.00,
    "units": 1
  }]
}
// Response: { id: "billing-uuid", invoiceNumber: "INV-2024-0001", balance: 125.00 }

// Step 2: Process payment
POST /payments
{
  "billingId": "billing-uuid",
  "amount": 125.00,
  "paymentMethod": "credit_card",
  "transactionId": "TXN-001"
}
// Response: { id: "payment-uuid", status: "completed" }
```

### 2. Verify Insurance and Submit Claim
```typescript
// Step 1: Verify eligibility
POST /insurance/verify
{
  "patientId": "patient-12345-anon",
  "insuranceId": "insurance-uuid",
  "serviceDate": "2024-01-15"
}
// Response: { eligible: true, copay: 25.00, deductible: 1500.00 }

// Step 2: Create claim
POST /claims
{
  "billingId": "billing-uuid",
  "insuranceId": "insurance-uuid",
  "patientId": "patient-12345-anon"
}
// Response: { id: "claim-uuid", claimNumber: "CLM-2024-0001" }

// Step 3: Submit claim
POST /claims/{claim-uuid}/submit
{
  "submissionMethod": "electronic",
  "payerId": "payer-001"
}
// Response: { status: "submitted", submittedDate: "2024-01-15" }
```

### 3. Generate Financial Reports
```typescript
// Revenue cycle metrics
GET /financial-reports/revenue-cycle?startDate=2024-01-01&endDate=2024-01-31
// Response: { collectionRate: 86.00, daysInAR: 42.5, denialRate: 8.5 }

// Profitability analysis
GET /financial-reports/profitability?startDate=2024-01-01&endDate=2024-01-31&groupBy=service
// Response: { totalRevenue: 250000.00, grossProfit: 75000.00, profitMargin: 30.00 }

// Financial dashboard
GET /financial-reports/dashboard
// Response: { today: {...}, mtd: {...}, alerts: [...] }
```

## API Endpoint Categories

### 💰 Billing (`/billing`)
- `POST /billing` - Create invoice
- `GET /billing/:id` - Get invoice
- `GET /billing/patient/:patientId` - Patient history
- `PUT /billing/:id` - Update invoice
- `POST /billing/:id/line-items` - Add line item
- `GET /billing/reports/aging` - A/R aging

### 💳 Payments (`/payments`)
- `POST /payments` - Process payment
- `GET /payments/:id` - Get payment
- `POST /payments/:id/refund` - Process refund
- `GET /payments/reports/daily` - Daily report

### 🏥 Claims (`/claims`)
- `POST /claims` - Create claim
- `POST /claims/:id/submit` - Submit claim
- `GET /claims/:id/status` - Check status
- `POST /claims/:id/appeal` - Appeal denial
- `GET /claims/reports/denial-analysis` - Denial analysis

### 🔍 Insurance (`/insurance`)
- `POST /insurance/verify` - Verify eligibility
- `GET /insurance/patient/:patientId` - Get policies
- `POST /insurance/:id/verify-benefits` - Verify benefits

### 📊 Reports (`/financial-reports`)
- `GET /financial-reports/revenue-cycle` - KPIs
- `GET /financial-reports/profitability` - Profitability
- `GET /financial-reports/payer-mix` - Payer analysis
- `GET /financial-reports/dashboard` - Dashboard

## Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Check request data |
| 401 | Unauthorized | Check authentication token |
| 404 | Not Found | Resource doesn't exist |
| 422 | Validation Error | Fix validation errors |
| 500 | Server Error | Contact support |

## Authentication

All endpoints require Bearer token:
```
Authorization: Bearer <your-jwt-token>
```

## Swagger UI

Access interactive API documentation:
```
http://localhost:3000/api
```

## Key Metrics

### Revenue Cycle KPIs
- **Days in A/R**: Target < 40 days
- **Collection Rate**: Target > 85%
- **Denial Rate**: Target < 10%
- **Net Collection Rate**: Target > 80%

### Claim Metrics
- **First Pass Rate**: Target > 90%
- **Denial Rate**: Target < 10%
- **Appeal Success**: Target > 70%

## Best Practices

1. ✅ Verify eligibility before service
2. ✅ Submit claims within 24-48 hours
3. ✅ Monitor KPIs weekly
4. ✅ Appeal denials promptly
5. ✅ Reconcile payments daily
6. ✅ Review aging reports weekly

## Support

- 📚 Full Documentation: `BILLING_API_DOCUMENTATION.md`
- 🎯 Implementation Summary: `IMPLEMENTATION_SUMMARY.md`
- 📖 System README: `BILLING_SYSTEM_README.md`
- 🔧 Swagger UI: http://localhost:3000/api