import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EmailJobRepository } from '../../lib/email/job-repository.js';
import { EmailStatus, EmailPriority, EmailType } from '../../lib/email/types.js';
import { processEmailJob, enqueueEmail } from '../../lib/email/queue.js';
import { setMockSendHandler, clearMockSendHandler } from '../../lib/email/resend.js';
import { buildTicketEmailSubject } from '../../lib/email/templates/ticket-pass.js';
import {
  createSupportTicket,
  listTicketsForOrganizer,
  listTicketsForSuperAdmin,
  getTicketById,
  addMessageToTicket,
} from '../../lib/support/support-service.js';
import { validateTicketPayload } from '../../lib/support/support-validator.js';
import { SUPPORT_STATUSES, SUPPORT_ROLES, SUPPORT_PRIORITIES } from '../../lib/support/types.js';

describe('PHASE 2: EMAIL DELIVERY & SUPPORT SYSTEM REMEDIATION SUITE', () => {
  beforeEach(() => {
    EmailJobRepository.resetMemoryStore();
    clearMockSendHandler();
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * C3 — TICKET EMAILS STUCK IN PENDING OR PROCESSING
   * ───────────────────────────────────────────────────────────────────────────── */
  describe('C3: Email Queue Lifecycle, Concurrency Control, and Stale Recovery', () => {
    it('Atomic claiming prevents concurrent execution of the same job', async () => {
      const job = await EmailJobRepository.createJob({
        recipient: 'attendee@example.com',
        subject: 'Ticket Pass',
        html: '<p>Your ticket</p>',
        emailType: EmailType.TICKET_DELIVERY,
        priority: EmailPriority.P0,
      });

      // First worker claims the job
      const claim1 = await EmailJobRepository.claimJob(job.id, 'worker-1');
      assert.ok(claim1, 'First worker must successfully claim job');
      assert.equal(claim1.status, EmailStatus.PROCESSING);
      assert.equal(claim1.workerId, 'worker-1');
      assert.equal(claim1.attemptCount, 1);

      // Concurrent second worker attempts to claim the same active job
      const claim2 = await EmailJobRepository.claimJob(job.id, 'worker-2');
      assert.equal(claim2, null, 'Second worker must be rejected from claiming active PROCESSING job');
    });

    it('Reclaims abandoned PROCESSING jobs when the processing lease expires', async () => {
      const job = await EmailJobRepository.createJob({
        recipient: 'attendee@example.com',
        subject: 'Ticket Pass',
        html: '<p>Your ticket</p>',
        emailType: EmailType.TICKET_DELIVERY,
        priority: EmailPriority.P0,
      });

      // Claim job
      await EmailJobRepository.claimJob(job.id, 'crashed-worker');

      // Simulate worker crash 10 minutes ago
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      await EmailJobRepository.updateJob(job.id, {
        updatedAt: tenMinutesAgo,
      });

      // Recovery worker claims stale job (> 5 min threshold)
      const reclaimed = await EmailJobRepository.claimJob(job.id, 'recovery-worker', 5 * 60 * 1000);
      assert.ok(reclaimed, 'Recovery worker must successfully reclaim stale processing job');
      assert.equal(reclaimed.workerId, 'recovery-worker');
      assert.equal(reclaimed.attemptCount, 2);
    });

    it('recoverStaleJobs dead-letters jobs that exhausted max retry attempts', async () => {
      const job = await EmailJobRepository.createJob({
        recipient: 'attendee@example.com',
        subject: 'Poison Pill Job',
        html: '<p>Error payload</p>',
        emailType: EmailType.TICKET_DELIVERY,
        maxAttempts: 3,
      });

      // Set job to PROCESSING with attemptCount = 3 and stale updatedAt (from 13 Nov)
      await EmailJobRepository.updateJob(job.id, {
        status: EmailStatus.PROCESSING,
        attemptCount: 3,
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const recovered = await EmailJobRepository.recoverStaleJobs({ staleMs: 5 * 60 * 1000 });
      assert.equal(recovered.length, 1);
      assert.equal(recovered[0].recoveryAction, 'dead_lettered');

      const deadJob = await EmailJobRepository.getJob(job.id);
      assert.equal(deadJob.status, EmailStatus.FAILED);
      assert.ok(deadJob.error.includes('Exhausted maximum retry budget'));
    });

    it('recoverStaleJobs reschedules retryable jobs with bounded backoff', async () => {
      const job = await EmailJobRepository.createJob({
        recipient: 'attendee@example.com',
        subject: 'Transient Failure Job',
        html: '<p>Content</p>',
        emailType: EmailType.TICKET_DELIVERY,
        maxAttempts: 5,
      });

      // Set job to PROCESSING with attemptCount = 1 and stale updatedAt
      await EmailJobRepository.updateJob(job.id, {
        status: EmailStatus.PROCESSING,
        attemptCount: 1,
        updatedAt: new Date(Date.now() - 15 * 60 * 1000),
      });

      const recovered = await EmailJobRepository.recoverStaleJobs({ staleMs: 5 * 60 * 1000 });
      assert.equal(recovered.length, 1);
      assert.equal(recovered[0].recoveryAction, 'rescheduled');

      const rescheduledJob = await EmailJobRepository.getJob(job.id);
      assert.equal(rescheduledJob.status, EmailStatus.SCHEDULED);
      assert.ok(new Date(rescheduledJob.nextScheduledAttempt) > new Date());
    });

    it('getQueuedJobs respects nextScheduledAttempt deferral timestamps', async () => {
      const futureDate = new Date(Date.now() + 60 * 1000);
      const job = await EmailJobRepository.createJob({
        recipient: 'attendee@example.com',
        subject: 'Deferred Job',
        html: '<p>Content</p>',
      });

      await EmailJobRepository.updateJob(job.id, {
        status: EmailStatus.QUEUED,
        nextScheduledAttempt: futureDate,
      });

      const readyNow = await EmailJobRepository.getQueuedJobs(50, new Date());
      assert.equal(readyNow.length, 0, 'Job scheduled for future must not be returned');

      const readyLater = await EmailJobRepository.getQueuedJobs(50, new Date(Date.now() + 120 * 1000));
      assert.equal(readyLater.length, 1, 'Job must become ready once nextScheduledAttempt has passed');
    });

    it('Records provider response ID on success and error reason on failure', async () => {
      // 1. Success case
      setMockSendHandler(async () => ({ id: 'resend_msg_test_999' }));

      const successJob = await EmailJobRepository.createJob({
        recipient: 'attendee@example.com',
        subject: 'Success Test',
        html: '<p>Success</p>',
      });

      const resSuccess = await processEmailJob(successJob.id);
      assert.equal(resSuccess.success, true);
      assert.equal(resSuccess.providerMessageId, 'resend_msg_test_999');

      const savedSuccess = await EmailJobRepository.getJob(successJob.id);
      assert.equal(savedSuccess.status, EmailStatus.SENT);
      assert.equal(savedSuccess.providerMessageId, 'resend_msg_test_999');
      assert.equal(savedSuccess.error, null);

      // 2. Failure case
      setMockSendHandler(async () => {
        const err = new Error('Mailbox full');
        err.isRetryable = false;
        throw err;
      });

      const failJob = await EmailJobRepository.createJob({
        recipient: 'attendee2@example.com',
        subject: 'Fail Test',
        html: '<p>Fail</p>',
      });

      const resFail = await processEmailJob(failJob.id);
      assert.equal(resFail.success, false);

      const savedFail = await EmailJobRepository.getJob(failJob.id);
      assert.equal(savedFail.status, EmailStatus.FAILED);
      assert.equal(savedFail.error, 'Mailbox full');
    });
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * M2 — EMAIL COUNTERS DO NOT MATCH THE LIST
   * ───────────────────────────────────────────────────────────────────────────── */
  describe('M2: Truthful Email Counters, Categorization, and Pagination', () => {
    it('listJobs returns truthful totalAll, totalMatching, and paginated slice', async () => {
      // Create 25 jobs
      for (let i = 0; i < 25; i++) {
        await EmailJobRepository.createJob({
          recipient: `user${i}@example.com`,
          subject: `Test ${i}`,
          html: '<p>Content</p>',
          emailType: EmailType.TRANSACTIONAL,
        });
      }

      // Page 1 with limit 10
      const page1 = await EmailJobRepository.listJobs({}, { page: 1, limit: 10 });
      assert.equal(page1.totalAll, 25);
      assert.equal(page1.totalMatching, 25);
      assert.equal(page1.totalLoaded, 10);
      assert.equal(page1.totalPages, 3);
      assert.equal(page1.jobs.length, 10);

      // Page 3 with limit 10
      const page3 = await EmailJobRepository.listJobs({}, { page: 3, limit: 10 });
      assert.equal(page3.jobs.length, 5);
      assert.equal(page3.page, 3);
    });

    it('Status filter aliases correctly match multi-state groupings without count mismatch', async () => {
      // 1 SENT
      const j1 = await EmailJobRepository.createJob({ recipient: 'a@example.com', subject: 'A', html: '<p>A</p>' });
      await EmailJobRepository.updateJob(j1.id, { status: EmailStatus.SENT });

      // 1 DELIVERED
      const j2 = await EmailJobRepository.createJob({ recipient: 'b@example.com', subject: 'B', html: '<p>B</p>' });
      await EmailJobRepository.updateJob(j2.id, { status: EmailStatus.DELIVERED });

      // 1 PROCESSING
      const j3 = await EmailJobRepository.createJob({ recipient: 'c@example.com', subject: 'C', html: '<p>C</p>' });
      await EmailJobRepository.updateJob(j3.id, { status: EmailStatus.PROCESSING });

      // 1 FAILED
      const j4 = await EmailJobRepository.createJob({ recipient: 'd@example.com', subject: 'D', html: '<p>D</p>' });
      await EmailJobRepository.updateJob(j4.id, { status: EmailStatus.FAILED });

      // Query DELIVERED tab -> matches SENT and DELIVERED (2)
      const deliveredGroup = await EmailJobRepository.listJobs({ status: 'DELIVERED' });
      assert.equal(deliveredGroup.totalMatching, 2);

      // Query PENDING tab -> matches PROCESSING, QUEUED, PENDING (1)
      const pendingGroup = await EmailJobRepository.listJobs({ status: 'PENDING' });
      assert.equal(pendingGroup.totalMatching, 1);

      // Query FAILED tab -> matches FAILED, BOUNCED, COMPLAINED (1)
      const failedGroup = await EmailJobRepository.listJobs({ status: 'FAILED' });
      assert.equal(failedGroup.totalMatching, 1);

      // Total all remains truthful (4)
      assert.equal(deliveredGroup.totalAll, 4);
    });

    it('Email monitoring component does not bind All tab counter to totalSent', () => {
      const componentPath = resolve('components/admin/email-monitoring.jsx');
      const content = readFileSync(componentPath, 'utf8');

      // Defect verification: ensure `totalCount = stats.totalSent || rawJobs.length` was removed
      assert.ok(
        !content.includes('const totalCount = stats.totalSent || rawJobs.length;'),
        'Component must not set totalCount strictly to stats.totalSent'
      );
      assert.ok(
        content.includes('stats.totalAll'),
        'Component must reference stats.totalAll for truthful count'
      );
    });
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * M3 — RESEND APPROVAL EMAIL REPORTS SUCCESS BUT IS NOT LOGGED
   * ───────────────────────────────────────────────────────────────────────────── */
  describe('M3: Hosting Approval Email Resend Workflow & Idempotency Scoping', () => {
    it('Approval route generates distinct attempt-scoped idempotency key for resends', () => {
      const routePath = resolve('src/app/api/send-approval-email/route.js');
      const content = readFileSync(routePath, 'utf8');

      assert.ok(
        content.includes('isResend'),
        'Approval route must accept isResend flag'
      );
      assert.ok(
        content.includes('resendHistory'),
        'Approval route must link resend attempt into parent resendHistory'
      );
      assert.ok(
        content.includes('_resend_'),
        'Resend attempts must produce distinct idempotency keys'
      );
    });

    it('Enforcing debounce window prevents rapid double-clicks from sending duplicate resends', () => {
      const routePath = resolve('src/app/api/send-approval-email/route.js');
      const content = readFileSync(routePath, 'utf8');

      assert.ok(
        content.includes('10000') || content.includes('10 * 1000'),
        'Route must enforce a 10s debounce window between rapid resend clicks'
      );
      assert.ok(
        content.includes('429'),
        'Route must return 429 when resending too rapidly'
      );
    });

    it('Hosting request management client passes isResend: true and requestId', () => {
      const clientPath = resolve('components/admin/hosting-request-management.jsx');
      const content = readFileSync(clientPath, 'utf8');

      assert.ok(
        content.includes('isResend: true'),
        'Hosting request management must pass isResend: true when resending approval email'
      );
      assert.ok(
        content.includes('requestId: reqId') || content.includes('requestId: req.id'),
        'Hosting request management must pass requestId when resending'
      );
    });
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * H4 — ORGANISER CREATE NEW SUPPORT TICKET DOES NOTHING
   * ───────────────────────────────────────────────────────────────────────────── */
  describe('H4: Organiser Support Ticket Creation & Role Privacy', () => {
    it('Validates required fields for support ticket creation', () => {
      // Missing subject -> rejects
      assert.throws(() => {
        validateTicketPayload({
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+91 9876543210',
          category: 'Settlements and Payouts',
          subject: '',
          description: 'Valid issue description longer than 10 chars',
        });
      });

      // Description under 10 chars -> rejects
      assert.throws(() => {
        validateTicketPayload({
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+91 9876543210',
          category: 'Settlements and Payouts',
          subject: 'Valid Subject',
          description: 'Too short',
        });
      });

      // Valid payload passes
      const validated = validateTicketPayload({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+91 9876543210',
        category: 'Event Management',
        subject: 'Need help with venue setup',
        description: 'Venue setup configuration is not showing in the organizer dashboard.',
        eventId: 'evt_hackfest_2026',
        priority: SUPPORT_PRIORITIES.HIGH,
      });

      assert.equal(validated.fullName, 'Jane Doe');
      assert.equal(validated.eventId, 'evt_hackfest_2026');
      assert.equal(validated.priority, 'HIGH');
    });

    it('Creates ticket with unique reference, persists initial message, and sets OPEN status', async () => {
      const ticket = await createSupportTicket({
        organizerId: 'org_user_123',
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+91 9876543210',
        category: 'Event Management',
        subject: 'Custom Ticket Design Question',
        description: 'How do I add custom sponsor logos to ticket passes?',
        eventId: 'evt_hackfest_2026',
        priority: SUPPORT_PRIORITIES.MEDIUM,
      });

      assert.ok(ticket.ticketId.startsWith('TKT-'), 'Ticket ID must match monotonic format TKT-XXXXX');
      assert.equal(ticket.status, SUPPORT_STATUSES.OPEN);
      assert.equal(ticket.organizerId, 'org_user_123');
      assert.equal(ticket.eventId, 'evt_hackfest_2026');
      assert.equal(ticket.messageCount, 1);
      assert.equal(ticket.messages.length, 1);
      assert.equal(ticket.messages[0].content, 'How do I add custom sponsor logos to ticket passes?');
    });

    it('Enforces organizer role isolation (organizer cannot view another organizer private tickets)', async () => {
      const ticket1 = await createSupportTicket({
        organizerId: 'org_A',
        fullName: 'Org A',
        email: 'orga@example.com',
        phone: '+91 9876543210',
        category: 'Technical Issues',
        subject: 'Org A Private Ticket',
        description: 'Confidential inquiry about revenue distribution',
      });

      // Org A queries tickets
      const orgATickets = await listTicketsForOrganizer('org_A');
      assert.equal(orgATickets.length, 1);
      assert.equal(orgATickets[0].ticketId, ticket1.ticketId);

      // Org B queries tickets -> should see 0
      const orgBTickets = await listTicketsForOrganizer('org_B');
      assert.equal(orgBTickets.length, 0);

      // Org B attempts to directly fetch Org A ticket by ID -> must throw 403 Access Denied
      await assert.rejects(
        async () => {
          await getTicketById(ticket1.ticketId, {
            callerRole: SUPPORT_ROLES.ORGANIZER,
            callerId: 'org_B',
          });
        },
        (err) => err.statusCode === 403 || err.message.includes('Access denied')
      );
    });

    it('Strips private internal notes when ticket is fetched by organizer', async () => {
      const ticket = await createSupportTicket({
        organizerId: 'org_C',
        fullName: 'Org C',
        email: 'orgc@example.com',
        phone: '+91 9876543210',
        category: 'Settlements and Payouts',
        subject: 'Payout Delay Inquiry',
        description: 'Where is my payout?',
      });

      // Admin posts a private internal note
      await addMessageToTicket(ticket.ticketId, {
        senderId: 'superadmin_1',
        senderName: 'Adil SuperAdmin',
        senderRole: SUPPORT_ROLES.SUPERADMIN,
        content: 'INTERNAL NOTE: Organizer bank account undergoing KYC review. Do not disclose yet.',
        isInternalNote: true,
      });

      // Organizer views ticket thread -> internal note must be omitted
      const orgView = await getTicketById(ticket.ticketId, {
        callerRole: SUPPORT_ROLES.ORGANIZER,
        callerId: 'org_C',
      });
      assert.equal(orgView.messages.length, 1, 'Internal note must be stripped from organizer view');
      assert.ok(!orgView.messages.some((m) => m.isInternalNote));

      // Super Admin views ticket thread -> internal note must be included
      const adminView = await getTicketById(ticket.ticketId, {
        callerRole: SUPPORT_ROLES.SUPERADMIN,
        callerId: 'superadmin_1',
      });
      assert.equal(adminView.messages.length, 2, 'Super Admin must see both messages');
      assert.ok(adminView.messages.some((m) => m.isInternalNote));
    });
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * H5 — SUPER ADMIN SUPPORT QUEUE DOES NOT MATCH EMAIL LOG
   * ───────────────────────────────────────────────────────────────────────────── */
  describe('H5: Super Admin Support Queue & Authoritative Data Source', () => {
    it('listTicketsForSuperAdmin returns tickets in all statuses including RESOLVED', async () => {
      const tOpen = await createSupportTicket({
        organizerId: 'org_1',
        fullName: 'Org One',
        email: 'org1@example.com',
        phone: '+91 9876543210',
        category: 'Technical Issues',
        subject: 'Open Issue',
        description: 'Description 1234567890',
      });

      const tResolved = await createSupportTicket({
        organizerId: 'org_alpha_001',
        fullName: 'Organizer Alpha',
        email: 'alpha@example.com',
        phone: '+91 9123456789',
        category: 'Settlements and Payouts',
        subject: 'T+4 Payout Timing Dispute',
        description: 'When will funds for order ord_12345 settle into my account?',
      });

      // Resolve the second ticket
      tResolved.status = SUPPORT_STATUSES.RESOLVED;

      // Super admin list query without status filter returns all tickets
      const allSuperAdmin = await listTicketsForSuperAdmin({ status: 'ALL' });
      assert.ok(allSuperAdmin.length >= 2);
      assert.ok(allSuperAdmin.some((t) => t.ticketId === tResolved.ticketId));

      // Ticket mapping preserves both id and ticketId, organizerEmail and email
      const matched = allSuperAdmin.find((t) => t.ticketId === tResolved.ticketId);
      assert.equal(matched.id, tResolved.ticketId);
      assert.equal(matched.ticketId, tResolved.ticketId);
      assert.equal(matched.organizerEmail, 'alpha@example.com');
      assert.equal(matched.email, 'alpha@example.com');
      assert.equal(matched.phone, '+91 9123456789');
    });

    it('Superadmin support view fetches with all=true or from superadmin route', () => {
      const viewPath = resolve('components/admin/support/superadmin-support-view.jsx');
      const content = readFileSync(viewPath, 'utf8');

      assert.ok(
        content.includes('params.set("all", "true")') || content.includes('/api/superadmin/support'),
        'Superadmin support view must request all tickets with all=true or use superadmin endpoint'
      );
      assert.ok(
        content.includes('tkt.id || tkt.ticketId') || content.includes('targetId'),
        'handleSelectTicket must fall back to ticketId if id is not direct property'
      );
    });

    it('Support messages route accepts both body.content and body.message', () => {
      const routePath = resolve('src/app/api/support/tickets/[id]/messages/route.js');
      const content = readFileSync(routePath, 'utf8');

      assert.ok(
        content.includes('body.content || body.message'),
        'Messages route must accept both body.content and body.message'
      );
    });
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * L7 — TICKET EMAIL SUBJECT IS TOO GENERIC
   * ───────────────────────────────────────────────────────────────────────────── */
  describe('L7: Dynamic, Sanitized Event Name in Ticket Email Subject', () => {
    it('Includes event name dynamically in subject line', () => {
      const subject = buildTicketEmailSubject('HackFest 2026');
      assert.equal(subject, 'Your Ticket for HackFest 2026 is Ready – TicketLelo');
    });

    it('Handles missing, null, or empty event name safely with branded fallback', () => {
      assert.equal(buildTicketEmailSubject(''), 'Your Ticket is Ready – TicketLelo');
      assert.equal(buildTicketEmailSubject(null), 'Your Ticket is Ready – TicketLelo');
      assert.equal(buildTicketEmailSubject(undefined), 'Your Ticket is Ready – TicketLelo');
      assert.equal(buildTicketEmailSubject('   '), 'Your Ticket is Ready – TicketLelo');
    });

    it('Sanitizes HTML tags, control characters, and newlines from dynamic event title', () => {
      const maliciousInput = 'HackFest 2026\r\n<script>alert(1)</script><b>Special Edition</b>';
      const cleanSubject = buildTicketEmailSubject(maliciousInput);

      assert.ok(!cleanSubject.includes('<script>'), 'HTML tags must be stripped');
      assert.ok(!cleanSubject.includes('\r'), 'CR must be stripped');
      assert.ok(!cleanSubject.includes('\n'), 'LF must be stripped');
      assert.equal(cleanSubject, 'Your Ticket for HackFest 2026 alert(1)Special Edition is Ready – TicketLelo');
    });

    it('Truncates excessively long event names to keep subject line within RFC limits', () => {
      const longTitle = 'Super Long Event Name That Goes On And On And On Exceeding Eighty Characters In Total Length For Security And Deliverability Standards';
      const subject = buildTicketEmailSubject(longTitle);

      assert.ok(subject.length <= 150);
      assert.ok(subject.includes('...'));
      assert.ok(subject.startsWith('Your Ticket for Super Long Event Name'));
    });
  });

  /* ─────────────────────────────────────────────────────────────────────────────
   * L9 — BUTTONS COPY TO CLIPBOARD WITHOUT ASKING
   * ───────────────────────────────────────────────────────────────────────────── */
  describe('L9: Action Button Integrity (No Unintended Clipboard Access)', () => {
    it('Confirm Hold button in payout management does not call clipboard writeText', () => {
      const payoutPath = resolve('components/admin/payments/superadmin-payout-management.jsx');
      const content = readFileSync(payoutPath, 'utf8');

      // Find Confirm Hold block
      const holdBlock = content.slice(content.indexOf('Confirm Hold') - 200, content.indexOf('Confirm Hold') + 100);
      assert.ok(!holdBlock.includes('clipboard'), 'Confirm Hold must not touch clipboard');
      assert.ok(!holdBlock.includes('writeText'), 'Confirm Hold must not write to clipboard');
    });

    it('Confirm Hold button in support view does not call clipboard writeText', () => {
      const supportViewPath = resolve('components/admin/support/superadmin-support-view.jsx');
      const content = readFileSync(supportViewPath, 'utf8');

      const holdBlock = content.slice(content.indexOf('Confirm Hold') - 200, content.indexOf('Confirm Hold') + 100);
      assert.ok(!holdBlock.includes('clipboard'), 'Confirm Hold in support view must not touch clipboard');
      assert.ok(!holdBlock.includes('writeText'), 'Confirm Hold in support view must not write to clipboard');
    });

    it('Create New Ticket button in SupportCenter opens modal without clipboard access', () => {
      const centerPath = resolve('components/admin/support/support-center.jsx');
      const content = readFileSync(centerPath, 'utf8');

      const ticketButtonBlock = content.slice(
        content.indexOf('Create New Ticket') - 400,
        content.indexOf('Create New Ticket') + 100
      );
      assert.ok(ticketButtonBlock.includes('setIsModalOpen(true)'), 'Create New Ticket must open modal');
      assert.ok(!ticketButtonBlock.includes('clipboard'), 'Create New Ticket must not touch clipboard');
      assert.ok(!ticketButtonBlock.includes('writeText'), 'Create New Ticket must not write to clipboard');
    });
  });
});
