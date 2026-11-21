Issue1:#858 Roles: reusable role templates library for common hospital job functions

Description
Every tenant currently has to build up permission sets for standard job functions (ward nurse, attending physician, lab technician, billing clerk) from scratch, which is repetitive and error-prone for new tenant onboarding.

Acceptance Criteria
 Ship a library of predefined role templates covering common hospital job functions with sane default permissions
 Endpoint to instantiate a tenant role from a template, allowing permission overrides afterward
 Templates versioned so future permission additions can be optionally synced to tenants using a template
 Admin UI/endpoint listing available templates and their default permission sets
 Test verifying a role created from a template has the expected permission set
Related Modules
src/roles/, src/rbac/, src/tenant-provisioning-and-onboarding-workflow/


Issue2:#859 i18n: RTL layout/locale support for Arabic and Hebrew

Description
src/i18n validates translation coverage but the locale/content pipeline assumes left-to-right languages. Tenants in Arabic- and Hebrew-speaking regions need RTL-aware content (emails, PDFs, generated reports) to be usable.

Acceptance Criteria
 Add ar and he locale bundles alongside existing translations
 Email templates and generated PDFs detect RTL locales and render with appropriate text direction/layout
 check-translation-coverage script extended to validate RTL locale completeness
 Locale-aware date/number formatting verified for ar/he
 Test rendering a sample email/PDF in an RTL locale and asserting dir="rtl"/mirrored layout
Related Modules
src/i18n/, src/email-templates/, src/reports/




Issue3:#856 GraphQL subscriptions: per-connection rate limiting and idle timeout

Description
src/subscriptions and src/pubsub allow unlimited concurrent GraphQL subscriptions per client with no idle timeout, so a misbehaving or abandoned client can hold connections and consume server resources indefinitely.

Acceptance Criteria
 Enforce a configurable max concurrent subscriptions per user/connection
 Add idle timeout that closes subscriptions with no client ping/activity within a configurable window
 Reject new subscription attempts once the per-connection limit is reached, with a clear GraphQL error
 Metrics for active subscription count and rejected/timed-out connections
 Test simulating an idle subscription being closed after timeout
Related Modules
src/subscriptions/, src/pubsub/, src/graphql/

Issue4:#857 Access control: break-glass emergency access with mandatory post-hoc review

Description
Emergency clinicians sometimes need immediate access to a patient's record outside their normal care-team assignment (e.g. unconscious patient in a different department), but the access-control module has no override path — clinicians are simply blocked.

Acceptance Criteria
 Add a "break-glass" access request that grants temporary elevated access with a required justification reason
 All break-glass accesses are flagged in the PHI audit log for mandatory supervisor review
 Scheduled job/report listing unreviewed break-glass accesses past a configurable SLA
 Break-glass access automatically expires after a short, configurable window
 Test covering grant, usage, expiry, and audit-flagging of a break-glass session
Related Modules
src/access-control/, src/rbac/, src/incident/