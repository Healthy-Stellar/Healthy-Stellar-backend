# Billing & Financial Management API Documentation

## 🏥 Overview

Comprehensive billing and financial management system for healthcare organizations with automated processes, insurance claim management, and actionable financial insights.

## 📋 Table of Contents

- [API Endpoints](#api-endpoints)
- [Authentication](#authentication)
- [Billing & Invoicing](#billing--invoicing)
- [Payment Processing](#payment-processing)
- [Insurance Claims](#insurance-claims)
- [Insurance Verification](#insurance-verification)
- [Financial Reporting](#financial-reporting)
- [Revenue Cycle Management](#revenue-cycle-management)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

## 🔐 Authentication

All API endpoints require Bearer token authentication:

```http
Authorization: Bearer <your-jwt-token>
```

## 💰 Billing & Invoicing

### Create Patient Invoice
```http
POST /billing
Content-Type: application/json

{
  "patientId": "patient-12345-anon",
  "patientName": "John Doe",
  "serviceDate": "2024-01-15",
  "providerId": "provider-001",
  "providerName": "Dr. Smith",
  "lineItems": [
    {
      "cptCode": "99213",
      "cptDescription": "Office visit, established patient",
      "unitCharge": 125.00,
      "units": 1,
      "diagnosisCodes": ["Z00.00"]
    }
  ]
}
```

**Response:**
```json
{
  "id": "billing-uuid",
  "invoiceNumber": "INV-2024-0001",
  "totalCharges": 125.00,
  "balance": 125.00,
  "status": "open"
}
```

### Get Patient Billing History
```http
GET /billing/patient/{patientId}?page=1&limit=20
```

### A/R Aging Report
```http
GET /billing/reports/aging
```

**Response:**
```json
{
  "current": { "count": 45, "total": 12500.00 },
  "days30": { "count": 23, "total": 8750.00 },
  "days60": { "count": 12, "total": 4200.00 },
  "days90": { "count": 8, "total": 2100.00 },
  "days120Plus": { "count": 5, "total": 1500.00 }
}
```

## 💳 Payment Processing

### Process Payment
```http
POST /payments
Content-Type: application/json

{
  "billingId": "billing-uuid",
  "amount": 125.00,
  "paymentMethod": "credit_card",
  "transactionId": "TXN-2024-001",
  "paymentDate": "2024-01-15"
}
```

### Daily Payment Report
```http
GET /payments/reports/daily?date=2024-01-15
```

**Response:**
```json
{
  "date": "2024-01-15",
  "totalPayments": 45,
  "totalAmount": 12500.00,
  "byMethod": {
    "credit_card": 8500.00,
    "cash": 2000.00,
    "check": 2000.00
  }
}
```

### Process Refund
```http
POST /payments/{id}/refund
Content-Type: application/json

{
  "amount": 50.00,
  "reason": "Overpayment"
}
```

## 🏥 Insurance Claims

### Create Insurance Claim
```http
POST /claims
Content-Type: application/json

{
  "billingId": "billing-uuid",
  "insuranceId": "insurance-uuid",
  "patientId": "patient-12345-anon",
  "serviceDate": "2024-01-15",
  "diagnosisCodes": ["Z00.00"],
  "procedureCodes": ["99213"]
}
```

### Submit Claim to Payer
```http
POST /claims/{id}/submit
Content-Type: application/json

{
  "submissionMethod": "electronic",
  "payerId": "payer-001"
}
```

### Check Claim Status
```http
GET /claims/{id}/status
```

**Response:**
```json
{
  "claimId": "claim-uuid",
  "status": "in_process",
  "payerStatus": "Pending Review",
  "submittedDate": "2024-01-15",
  "lastUpdated": "2024-01-20T10:30:00Z"
}
```

### Denial Analysis Report
```http
GET /claims/reports/denial-analysis?startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "totalDenials": 25,
  "denialRate": 16.67,
  "topReasons": [
    { "reason": "Missing information", "count": 10, "amount": 7500.00 },
    { "reason": "Authorization required", "count": 8, "amount": 6200.00 }
  ],
  "recoveryOpportunity": 18750.00
}
```

## 🔍 Insurance Verification

### Verify Eligibility
```http
POST /insurance/verify
Content-Type: application/json

{
  "patientId": "patient-12345-anon",
  "insuranceId": "insurance-uuid",
  "serviceDate": "2024-01-15",
  "serviceType": "consultation"
}
```

**Response:**
```json
{
  "eligible": true,
  "payer": "Blue Cross Blue Shield",
  "planName": "PPO Gold",
  "copay": 25.00,
  "deductible": 1500.00,
  "deductibleMet": 750.00,
  "outOfPocketMax": 5000.00,
  "effectiveDate": "2024-01-01",
  "terminationDate": "2024-12-31"
}
```

### Verify Specific Benefits
```http
POST /insurance/{id}/verify-benefits
Content-Type: application/json

{
  "cptCode": "99213",
  "serviceType": "consultation"
}
```

**Response:**
```json
{
  "covered": true,
  "copay": 25.00,
  "coinsurance": 20,
  "priorAuthRequired": false,
  "allowedAmount": 125.00
}
```

## 📊 Financial Reporting & Analytics

### Revenue Cycle Metrics
```http
GET /financial-reports/revenue-cycle?startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "period": { "start": "2024-01-01", "end": "2024-01-31" },
  "metrics": {
    "totalCharges": 250000.00,
    "totalCollections": 215000.00,
    "collectionRate": 86.00,
    "daysInAR": 42.5,
    "denialRate": 8.5,
    "netCollectionRate": 82.3
  }
}
```

### Profitability Analysis
```http
GET /financial-reports/profitability?startDate=2024-01-01&endDate=2024-01-31&groupBy=service
```

**Response:**
```json
{
  "totalRevenue": 250000.00,
  "totalCosts": 175000.00,
  "grossProfit": 75000.00,
  "profitMargin": 30.00,
  "byCategory": [
    {
      "category": "Cardiology",
      "revenue": 85000.00,
      "costs": 57000.00,
      "profit": 28000.00,
      "margin": 32.94
    }
  ]
}
```

### Payer Mix Analysis
```http
GET /financial-reports/payer-mix?startDate=2024-01-01&endDate=2024-01-31
```

**Response:**
```json
{
  "totalRevenue": 250000.00,
  "distribution": [
    { "payer": "Medicare", "amount": 100000.00, "percentage": 40.00 },
    { "payer": "Commercial", "amount": 87500.00, "percentage": 35.00 },
    { "payer": "Medicaid", "amount": 37500.00, "percentage": 15.00 },
    { "payer": "Self-Pay", "amount": 25000.00, "percentage": 10.00 }
  ]
}
```

### Cash Flow Projection
```http
GET /financial-reports/cash-flow?months=3
```

**Response:**
```json
{
  "currentAR": 125000.00,
  "projections": [
    { "month": "2024-02", "projected": 85000.00, "confidence": 0.85 },
    { "month": "2024-03", "projected": 72000.00, "confidence": 0.75 },
    { "month": "2024-04", "projected": 58000.00, "confidence": 0.65 }
  ]
}
```

### Financial Dashboard
```http
GET /financial-reports/dashboard
```

**Response:**
```json
{
  "today": {
    "collections": 12500.00,
    "charges": 15000.00,
    "payments": 45
  },
  "mtd": {
    "collections": 215000.00,
    "charges": 250000.00,
    "collectionRate": 86.0
  },
  "alerts": [
    { "type": "warning", "message": "Days in A/R increased to 45 days" },
    { "type": "info", "message": "Collection rate above target" }
  ]
}
```

## 🔄 Revenue Cycle Management

### Key Performance Indicators

1. **Days in A/R**: Average time to collect payment
2. **Collection Rate**: Percentage of charges collected
3. **Denial Rate**: Percentage of claims denied
4. **Net Collection Rate**: Collections after adjustments
5. **First Pass Resolution Rate**: Claims paid on first submission

### Optimization Strategies

1. **Automated Eligibility Verification**: Verify before service
2. **Clean Claim Submission**: Reduce denials with validation
3. **Denial Management**: Track and appeal systematically
4. **Payment Plans**: Offer flexible payment options
5. **Collections Management**: Timely follow-up on outstanding balances

## ⚠️ Error Handling

### Standard Error Response
```json
{
  "statusCode": 400,
  "message": "Invalid billing data",
  "error": "Bad Request",
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/billing"
}
```

### Common Error Codes

- `400` - Bad Request (invalid data)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate invoice number)
- `422` - Unprocessable Entity (validation failed)
- `500` - Internal Server Error

## 📝 Best Practices

### Billing
1. Always verify insurance eligibility before service
2. Submit claims within 24-48 hours of service
3. Include all required diagnosis and procedure codes
4. Document medical necessity for services

### Payments
1. Process payments promptly to update balances
2. Reconcile daily payment batches
3. Issue receipts for all payments
4. Track payment methods for reporting

### Claims
1. Validate claims before submission
2. Monitor claim status regularly
3. Appeal denials within payer timeframes
4. Document all claim communications

### Financial Reporting
1. Review KPIs weekly
2. Analyze denial patterns monthly
3. Benchmark against industry standards
4. Use data for process improvements

## 🔒 Compliance & Security

- All financial data is encrypted at rest and in transit
- Audit trails maintained for all transactions
- HIPAA-compliant data handling
- PCI-DSS compliant payment processing
- Regular security audits and penetration testing

## 📞 Support

For API support and technical questions:
- Email: api-support@medical-system.com
- Documentation: https://docs.medical-system.com
- Status Page: https://status.medical-system.com