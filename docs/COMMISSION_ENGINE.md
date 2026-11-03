# TicketLelo Marketplace Commission Engine

## 1. Core Principles & Pure Integer Arithmetic
Financial computations must never use floating-point numbers.
All operations in `lib/payments/commission-engine.js` are executed in **integer paise** (1 INR = 100 paise).

### Conservation Invariant
For every order or ticket purchase:
$$\text{Gross Amount (Paise)} = \text{Platform Commission (Paise)} + \text{Organizer Share (Paise)}$$

The calculation engine throws an error if this invariant is violated.

---

## 2. Commission Types & Calculation Formulas

### 2.1 Percentage Commission (`percentage`)
Calculated using integer basis points:
$$\text{Basis Points} = \text{round}(\text{Rate Percent} \times 100)$$
$$\text{Commission (Paise)} = \text{round}\left(\frac{\text{Gross Amount (Paise)} \times \text{Basis Points}}{10000}\right)$$

*Example: ₹1,000 gross with 3% commission:*
- $\text{Gross} = 100,000 \text{ paise}$
- $\text{Commission} = \text{round}\left(\frac{100,000 \times 300}{10000}\right) = 3,000 \text{ paise} = ₹30.00$
- $\text{Organizer Share} = 100,000 - 3,000 = 97,000 \text{ paise} = ₹970.00$

### 2.2 Fixed Commission (`fixed`)
A flat integer fee in paise per ticket (e.g. ₹20.00 flat = 2,000 paise).
$$\text{Commission (Paise)} = \min(\text{Gross Amount (Paise)}, \text{Fixed Fee (Paise)})$$

### 2.3 Percentage Plus Fixed Commission (`percentage_plus_fixed`)
$$\text{Commission (Paise)} = \text{Percentage Portion} + \text{Fixed Fee (Paise)}$$

### 2.4 Minimum and Maximum Caps
- `minCommissionPaise`: Ensures platform earns at least a minimum threshold per transaction.
- `maxCommissionPaise`: Caps the platform commission for high-ticket events.
- Hard clamp: Platform commission is always clamped to $[0, \text{Gross Amount (Paise)}]$.

---

## 3. Hierarchical Commission Resolution
When calculating commission for an order, the engine resolves the applicable rule in order of priority:
1. **Event-Specific Rule**: `marketplaceCommissions/event_{eventId}` (Highest priority)
2. **Organizer-Specific Tier**: `marketplaceCommissions/organizer_{organizerId}` (Medium priority)
3. **Platform Default Rule**: `marketplaceCommissions/global_default` (Default fallback: 3.00% + ₹0)

---

## 4. Immutability & Historical Auditing
Every payment record stores an immutable snapshot (`commissionRuleSnapshot`) containing:
- `version`
- `targetType`
- `targetId`
- `ratePercent`
- `fixedFeePaise`
- `timestamp`

Changes to platform commission settings never alter historical transaction earnings.
