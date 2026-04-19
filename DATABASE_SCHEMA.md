# Database Schema - TicketLelo SaaS Platform

## Collections Overview

### 1. **users**

```javascript
{
  id: string (auto-generated),
  fullName: string,
  email: string (unique),
  password: string (hashed),
  whatsappPhone: string,
  role: "superAdmin" | "organiser" | "participant",
  isAdmin: boolean,
  plan: "free" | "starter" | "pro",
  planStartDate: Timestamp,
  planEndDate: Timestamp,
  eventsCreated: number,
  eventsAllowed: number, // Based on plan
  stripeCustomerId: string (optional),
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 2. **events**

```javascript
{
  id: string (auto-generated),
  name: string,
  description: string,
  location: string,
  date: Timestamp,
  formId: string (reference to customForms),
  createdBy: string (userId),
  isActive: boolean,

  // Customization fields
  slug: string (unique, URL-friendly),
  bannerUrl: string (optional),
  themeColor: string (hex color),
  socialLinks: {
    facebook: string,
    twitter: string,
    instagram: string
  },

  // Pricing
  ticketPrice: number,
  isPaid: boolean,

  // Stats (denormalized for performance)
  totalRegistrations: number,
  totalRevenue: number,

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 3. **registrations**

```javascript
{
  id: string (auto-generated),
  eventId: string,
  userId: string,
  ticketId: string (unique),
  formData: object, // Dynamic form responses
  amount: number,
  paymentStatus: "pending" | "completed" | "failed",
  paymentId: string (optional),
  status: "unused" | "used",
  qrCode: string (base64),
  usedAt: Timestamp (optional),
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 4. **messages** (NEW - Broadcast Messaging)

```javascript
{
  id: string (auto-generated),
  eventId: string,
  title: string,
  content: string (text),
  recipientCount: number,
  status: "draft" | "scheduled" | "sending" | "sent" | "failed",
  scheduledAt: Timestamp (optional),
  sentAt: Timestamp (optional),
  failedRecipients: array of emails,
  successCount: number,
  failureCount: number,
  createdBy: string (userId),
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 5. **messageReceipts** (NEW - Message Tracking)

```javascript
{
  id: string (auto-generated),
  messageId: string,
  recipientEmail: string,
  recipientName: string,
  status: "pending" | "sent" | "failed",
  error: string (optional),
  sentAt: Timestamp (optional),
  createdAt: Timestamp
}
```

### 6. **analytics** (NEW - Event Analytics)

```javascript
{
  id: string (auto-generated),
  eventId: string,
  date: string (YYYY-MM-DD),

  // Daily metrics
  registrations: number,
  revenue: number,

  // Cumulative
  totalRegistrations: number,
  totalRevenue: number,

  // Conversion tracking
  pageViews: number,
  formStarts: number,
  formCompletes: number,
  dropOffRate: number,

  createdAt: Timestamp
}
```

### 7. **plans** (NEW - Pricing Plans)

```javascript
{
  id: "free" | "starter" | "pro",
  name: string,
  price: number,
  currency: "INR",
  interval: "month" | "year",

  features: {
    eventsAllowed: number,
    participantsPerEvent: number,
    customBranding: boolean,
    paymentIntegration: boolean,
    socialLinks: boolean,
    analytics: boolean,
    emailSupport: boolean,
    prioritySupport: boolean
  },

  isActive: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 8. **customForms** (Existing - Enhanced)

```javascript
{
  id: string (auto-generated),
  eventId: string,
  fields: array of field objects,
  createdBy: string (userId),
  isActive: boolean,
  submissionCount: number,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 9. **hostingRequests** (Existing)

```javascript
{
  id: string (auto-generated),
  name: string,
  email: string,
  phone: string,
  eventTitle: string,
  eventDescription: string,
  expectedAttendees: number,
  eventDate: Timestamp,
  status: "pending" | "approved" | "rejected",
  organiserId: string (optional, set after approval),
  reviewedBy: string (superAdmin userId),
  reviewedAt: Timestamp (optional),
  rejectionReason: string (optional),
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 10. **coupons** (Existing)

```javascript
{
  id: string (auto-generated),
  code: string (unique),
  discountPercent: number,
  eventId: string,
  isUsed: boolean,
  usedBy: string (userId, optional),
  usedAt: Timestamp (optional),
  expiresAt: Timestamp,
  createdAt: Timestamp
}
```

### 11. **eventPublications** (NEW - Event Publishing)

```javascript
{
  id: string (auto-generated),
  eventId: string,
  publicUrl: string (unique),
  isPublished: boolean,
  publishedAt: Timestamp,
  unpublishedAt: Timestamp (optional),
  totalViews: number,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 12. **scheduledJobs** (NEW - Email Reminders)

```javascript
{
  id: string (auto-generated),
  type: "eventReminder1Day" | "eventReminder2Hour",
  eventId: string,
  scheduledFor: Timestamp,
  status: "pending" | "processing" | "completed" | "failed",
  processedAt: Timestamp (optional),
  error: string (optional),
  recipientCount: number,
  createdAt: Timestamp
}
```

## Indexes Required

### events

- `createdBy` (ASC)
- `slug` (ASC) - Unique
- `isActive` (ASC)
- `createdAt` (DESC)

### registrations

- `eventId` (ASC)
- `userId` (ASC)
- `ticketId` (ASC) - Unique
- `createdAt` (DESC)
- Composite: `eventId` + `createdAt` (DESC)

### messages

- `eventId` (ASC)
- `status` (ASC)
- `scheduledAt` (ASC)
- `createdAt` (DESC)
- Composite: `eventId` + `createdAt` (DESC)

### analytics

- `eventId` (ASC)
- `date` (ASC)
- Composite: `eventId` + `date` (DESC)

### scheduledJobs

- `status` (ASC)
- `scheduledFor` (ASC)
- Composite: `status` + `scheduledFor` (ASC)

## Security Rules

All collections follow principle of least privilege:

- **users**: Read by all, write by owner/admin only
- **events**: Read by all, write by creator/admin only
- **registrations**: Read by participant/organiser, write restricted
- **messages**: Read/write by event creator/admin only
- **analytics**: Read by event creator/admin, write server-side only
- **plans**: Read by all, write by super admin only

## Migration Notes

When deploying:

1. Create initial plans documents (free, starter, pro)
2. Add `plan: "free"` to existing users
3. Add `eventsAllowed` based on plan to users
4. Backfill `totalRegistrations` and `totalRevenue` for existing events
5. Create composite indexes in Firestore console
