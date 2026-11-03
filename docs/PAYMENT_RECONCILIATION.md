# TicketLelo Financial Reconciliation Engine

## 1. Overview & Purpose
The reconciliation engine (`lib/payments/reconciliation.js`) performs automated, three-way integrity audits comparing:
1. Internal order records in Firestore (`orders`)
2. Route transfer split records (`paymentSplits`)
3. Double-entry accounting entries (`ledgerEntries`)

It runs on demand via the Superadmin Dashboard or on a scheduled cron cadence.

---

## 2. Discrepancy Detection Rules

The engine audits each transaction and detects the following anomaly types:
- **`MISSING_LEDGER_ENTRIES`**: An order marked as paid or captured without corresponding balanced entries in `ledgerEntries`.
- **`UNBALANCED_LEDGER_TRANSACTION`**: Any transaction where total debits do not equal total credits.
- **`MISSING_ROUTE_SPLIT_RECORD`**: An order flagged for Route transfer where no transfer record exists.
- **`FAILED_ROUTE_TRANSFER`**: Route transfer failed at the gateway, requiring admin investigation.
- **`AMOUNT_MISMATCH`**: Discrepancy between order pricing and gateway captured amount.

---

## 3. Reconciliation Report Format
Reconciliation audits persist immutable reports in the `reconciliationReports` collection:
```json
{
  "reportId": "recon_1740000000000",
  "generatedAt": "2026-11-03T00:15:00.000Z",
  "totalOrdersChecked": 100,
  "matchedCount": 99,
  "discrepancyCount": 1,
  "discrepancies": [
    {
      "orderId": "order_xyz123",
      "grossPaise": 100000,
      "issues": [
        {
          "type": "FAILED_ROUTE_TRANSFER",
          "message": "Route transfer failed due to linked account restriction."
        }
      ]
    }
  ],
  "summary": {
    "totalGrossPaise": 10000000,
    "totalCommissionPaise": 300000,
    "totalOrganizerPaise": 9700000
  }
}
```

Historical records are never silently altered to force matching. All discrepancies are flagged explicitly for administrative action.
