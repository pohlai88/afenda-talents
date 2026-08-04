# Afenda Talents — Complete UI/UX Requirements

**Document status:** Proposed UI/UX authority  
**Date:** 2026-08-05  
**Product:** Afenda Talents  
**Scope:** Hiring-manager workspace and invitation-only candidate self-assessment  
**Implementation stack:** Next.js, Tailwind CSS v4, shadcn/ui  
**Source authority:** Existing architecture design, MVP build specification, implementation plan, decisions log, and README

---

## 1. Purpose of this document

This document defines how Afenda Talents must present itself, organise information, guide users, and communicate assessment results.

The application is currently functionally valid but visually and experientially under-defined. A plain sidebar, a few metric cards, basic forms, and raw tables are not sufficient merely because they are “simple.” The desired interface is not decorative or busy. It must be:

- purposeful;
- operationally clear;
- trustworthy;
- assessment-aware;
- suitable for HR decision support;
- calm without feeling empty;
- information-dense without becoming complicated.

The UI must make it immediately clear:

1. what Afenda Talents does;
2. what the hiring manager should do next;
3. what is happening across the candidate pipeline;
4. what an assessment result means and does not mean;
5. where attention, risk, or follow-up is required;
6. which actions are available to the current role.

---

# 2. Product experience definition

## 2.1 Product promise

> **Afenda Talents helps hiring teams invite candidates, monitor assessment completion, and review structured behavioural profiles responsibly.**

The interface must not present itself as a generic admin dashboard, survey tool, applicant tracking system, or psychometric scoring platform.

## 2.2 Experience characteristics

The experience must feel:

- **Professional:** suitable for HR and management use.
- **Human:** candidates are people, not records.
- **Structured:** status, progress, actions, and results are easy to scan.
- **Evidence-aware:** scores and validity context are explained honestly.
- **Calm:** no unnecessary animation, decoration, or alarming colours.
- **Decisive:** each screen has a clear primary purpose and next action.
- **Private:** access, data handling, retention, and destructive actions feel controlled.

## 2.3 What “minimal” means here

Minimalism must not mean:

- empty pages;
- only a heading and table;
- removal of useful context;
- hiding actions behind unexplained icons;
- using muted grey for everything;
- relying on users to infer workflow.

Minimalism means:

- every element has a job;
- hierarchy is obvious;
- repeated information is removed;
- secondary information is progressively disclosed;
- actions appear at the moment they are relevant;
- visual treatments are consistent.

---

# 3. User roles and experience boundaries

## 3.1 Administrator

Administrators may:

- view all candidates and results;
- invite candidates;
- resend or revoke invitations;
- delete candidate records;
- export results;
- purge candidate data;
- create, reset, and remove hiring-team users;
- change their own password.

The UI must clearly distinguish high-risk administrative actions from routine hiring actions.

## 3.2 Viewer

Viewers may:

- view the dashboard;
- browse and search candidates;
- open candidate profiles;
- review dimension scores, validity context, timing, and responses;
- print profiles.

Viewers must not see enabled mutation controls. Prefer removing unavailable actions rather than showing many disabled buttons.

## 3.3 Candidate

Candidates:

- do not create accounts;
- enter through a personal invitation link;
- consent before viewing questions;
- complete 34 fixed-order items;
- may leave and resume;
- submit once;
- see a neutral completion page.

The candidate interface must not expose admin navigation, internal status terminology, comparative scoring, validity rules, or hiring recommendations.

---

# 4. Global information architecture

## 4.1 Admin navigation

The primary admin shell must contain:

1. **Overview**
2. **Candidates**
3. **Invite**
4. **Team** — administrator only
5. **Data & Audit** — administrator only

The current product may technically route Overview and Candidates to related data, but they must be distinct experiences:

- **Overview** answers: “What is happening and what needs attention?”
- **Candidates** answers: “Find, inspect, and manage a specific candidate.”

## 4.2 Utility navigation

The shell footer or user menu must contain:

- signed-in user name;
- role badge;
- change password;
- sign out.

Do not mix account utilities into the main operational navigation.

## 4.3 Page title hierarchy

Every admin page must use:

- eyebrow or breadcrumb;
- page title;
- one-sentence purpose;
- page-level actions aligned to the right;
- optional contextual metadata below.

Example:

**Hiring overview**  
Monitor invitations, completion progress, and profiles awaiting review.

Primary action: **Invite candidates**

---

# 5. Admin shell and facade presentation

## 5.1 Sidebar

### Required structure

**Brand area**
- Afenda symbol or monogram.
- “Afenda Talents.”
- Supporting label: “Hiring Assessment Workspace.”

**Primary navigation**
- text label and restrained icon;
- current location shown through background, text weight, and left indicator;
- generous row height;
- no icon-only navigation.

**Footer**
- user identity;
- role;
- account menu.

### Behaviour

- Desktop: fixed sidebar, approximately 240–264 px.
- Tablet: collapsible sidebar.
- Mobile admin: drawer navigation with persistent top bar.
- The sidebar must not print on candidate profiles.
- The layout must contain one main landmark only.

## 5.2 Top bar

The top bar may include:

- current page or breadcrumb;
- search trigger on candidate-heavy pages;
- environment indicator only outside production;
- user menu on smaller layouts.

Avoid a global top bar filled with decorative utilities.

## 5.3 Content canvas

- Maximum content width should vary by page type.
- Dashboards and tables: wide canvas.
- Forms: narrower reading width.
- Profiles: readable report width.
- Use section spacing rather than enclosing everything in cards.
- Cards must represent meaningful groups, not be the default container for every element.

---

# 6. Overview dashboard requirements

## 6.1 Purpose

The Overview is the operational facade of Afenda Talents. It must tell the hiring manager:

- how many candidates are in the round;
- where they are in the workflow;
- what changed recently;
- what needs follow-up;
- which profiles are ready for review.

It must not be merely a row of status counts.

## 6.2 Required layout

### A. Welcome and round summary

Display:

- contextual greeting;
- current hiring-round summary;
- number of candidates;
- number completed;
- completion percentage;
- last activity timestamp.

Example:

> **Good morning, Jack.**  
> 18 candidates are in this hiring round. 11 have completed their assessment, and 3 invitations may need follow-up.

### B. Workflow status strip

Use a horizontal process presentation:

1. Invited
2. Opened / Started
3. Submitted
4. Ready for review

Each stage shows:

- count;
- percentage of total;
- concise explanation;
- click-through filter.

Expired and revoked records must be shown separately as exceptions, not as normal progress stages.

### C. Attention panel

This is a prioritised action queue, not a generic notification list.

Possible items:

- invitations sent but not opened after a defined period;
- started but not submitted;
- invitations nearing expiry;
- newly completed profiles not yet reviewed;
- temporary-password users awaiting password change.

Each row includes:

- person or subject;
- reason for attention;
- age or due context;
- direct action.

Do not invent automated reminders if the backend does not support them. “Resend invitation” remains an explicit administrator action.

### D. Recently completed profiles

Show the most recent completed candidates with:

- name;
- completion date/time;
- five compact dimension indicators;
- triggered validity-context count, phrased neutrally;
- “Review profile” action.

Do not show a total score, rank, recommendation, or pass/fail indication.

### E. Recent activity

Show human-readable activity such as:

- invitation sent;
- invitation resent;
- candidate consented;
- assessment submitted;
- profile reviewed;
- CSV exported.

Avoid exposing raw internal event codes in the main UI.

### F. Primary actions

The dashboard must make these prominent:

- Invite candidates
- View all candidates
- Export results — administrator only

Destructive data actions must not appear on the overview.

## 6.3 Empty state

When no candidates exist:

- explain the workflow;
- show the three-step journey;
- provide a prominent “Invite your first candidates” action;
- include a secondary “Preview invitation email” action.

Do not show six zero-valued cards and an empty table.

---

# 7. Candidates workspace

## 7.1 Purpose

This page is the operational registry for locating, filtering, and acting on candidate records.

## 7.2 Page header

Include:

- title and candidate count;
- short description;
- search;
- Invite candidates;
- Export CSV for administrators.

## 7.3 Filters

Required filters:

- status;
- invitation state;
- completion state;
- result availability;
- inviter;
- date invited;
- date submitted.

Provide useful saved shortcuts:

- Needs follow-up
- In progress
- Ready for review
- Closed

The MVP need not persist custom saved views.

## 7.4 Candidate table

Columns:

- Candidate
- Contact
- Progress
- Invitation
- Last activity
- Submitted
- Invited by
- Actions

### Candidate cell

Show:

- full name;
- email as secondary text;
- optional initials avatar.

### Progress cell

Use human-facing labels:

- Invitation prepared
- Invitation sent
- Assessment started
- Completed
- Expired
- Revoked

Avoid displaying only raw uppercase database values.

### Row actions

Use one clear primary action and an overflow menu:

- Review profile, when scored;
- View progress, when open;
- Resend invitation;
- Revoke invitation;
- Delete candidate.

Destructive actions require confirmation.

## 7.5 Table behaviour

- sticky table header on long lists;
- row click opens the candidate detail;
- actions must remain independently clickable;
- clear hover and keyboard focus;
- responsive transformation into structured cards on narrow screens;
- visible result count and active-filter count;
- pagination or controlled loading when data grows.

## 7.6 Empty and no-result states

Differentiate:

- no candidates in the round;
- no candidates match filters;
- search returned no result.

Each state should give the appropriate recovery action.

---

# 8. Candidate detail and profile facade

## 8.1 Purpose

The candidate profile is the most important decision-support screen. It must turn raw results into a responsible, readable profile without pretending to make the hiring decision.

## 8.2 Profile header

Show:

- candidate name;
- email;
- current status;
- invited date;
- completed date;
- inviter;
- assessment duration context;
- print action;
- administrative overflow actions where allowed.

Include the statement:

> This profile is a self-report and one input into a hiring decision. It is not a test score, ranking, or recommendation.

## 8.3 Profile overview composition

### A. Five-dimension profile

Each dimension requires:

- full dimension name;
- scaled value;
- band;
- horizontal scale;
- concise plain-language interpretation;
- no traffic-light judgement.

Dimensions:

- Work ethic and reliability
- Communication and collaboration
- Problem solving and learning agility
- Adaptability and resilience
- Integrity and accountability

### B. Visual scale

The scale must show:

- 0–100 range;
- Developing, Effective, and Strong regions;
- candidate position;
- band boundaries;
- accessible text equivalent.

Do not use a radar chart as the primary visual. Radar charts distort comparison and are difficult to read accurately. A radar chart may be offered only as a secondary optional view later.

### C. Interpretation language

Use neutral language.

Acceptable:
- “Responses indicate a generally consistent preference for…”
- “This dimension falls within the Effective band.”
- “Explore examples during the interview.”

Unacceptable:
- “Excellent candidate.”
- “Weak communicator.”
- “Recommended for hire.”
- “Top performer.”

The system currently stores scores and bands, not validated narrative interpretations. Any dimension narrative must therefore be deterministic, conservative, and approved before implementation.

## 8.4 Response-validity context

Rename the visible section:

> **Response context**

Do not lead with “Validity flags,” which sounds accusatory.

For each indicator show:

- title;
- status: “Not observed” or “Review context”;
- explanation;
- explicit reminder that it does not change the score.

Indicators:

- Impression management
- Response consistency
- Answer variation
- Time on task

For timing, clearly distinguish:

- self-reported active time;
- server-observed elapsed window.

Do not imply that client-reported timing is authoritative.

## 8.5 Hiring conversation guide

The UI may provide non-evaluative interview prompts derived from the five fixed dimensions, such as:

- “Ask for an example of managing a missed deadline.”
- “Explore how the candidate responds to unclear instructions.”
- “Ask about a situation where priorities changed suddenly.”

These are dimension-based prompts, not AI recommendations and not generated from sensitive candidate data. They must be labelled as optional discussion prompts.

## 8.6 Item-level responses

- collapsed by default;
- grouped by dimension;
- show item number, statement, response label, raw response value;
- identify reverse-scored items only in an admin explanation, not as suspicious responses;
- include search or dimension jump links if the list is long;
- expand automatically in print view if required.

## 8.7 Candidate activity timeline

Show key events:

- invited;
- opened;
- consented;
- started;
- submitted;
- scored;
- resent or revoked, where applicable.

Use readable event descriptions and timestamps. Do not expose token information.

## 8.8 Record administration

Administrator-only section:

- resend invitation;
- revoke invitation;
- delete candidate.

The delete action must explain that responses and results are also removed. Require explicit confirmation.

---

# 9. Invite candidates experience

## 9.1 Purpose

The invite page must make the invitation workflow understandable before asking for data.

## 9.2 Page composition

### A. Workflow explainer

Show three steps:

1. Add candidate details
2. Review invitation
3. Send personal links

Include:

- estimated assessment time;
- invitation expiry;
- statement that links are personal;
- explanation that resending invalidates the old link.

### B. Entry modes

Use tabs or segmented control:

- Single candidate
- Add many

Do not put a single-entry form and a large paste field together without hierarchy.

### C. Single candidate form

Fields:

- full name;
- email.

Show inline validation and duplicate-candidate handling.

### D. Bulk entry

Support:

- pasted `Name, email` lines;
- parsing preview;
- row-level validation;
- duplicate detection;
- count of valid, invalid, and existing candidates;
- edit or remove before sending.

Do not send directly from unreviewed pasted text.

### E. Email preview

Provide preview before sending:

- invitation subject;
- sender;
- sample content;
- expiry information;
- explanation that the actual personal link is inserted at send time.

The preview must come from the same builder as the actual email.

### F. Send confirmation

Before batch sending, show:

- number of candidates;
- expiry period;
- duplicates skipped;
- invalid rows blocked.

After sending, show a result summary with successful, skipped, and failed records.

---

# 10. Team management

## 10.1 Users list

Administrator-only.

Display:

- user name;
- email;
- role;
- account state;
- password-change state;
- created date;
- last relevant activity if available.

## 10.2 Role explanation

Clearly explain:

- **Administrator:** can manage candidates, exports, data, and team access.
- **Viewer:** can review candidate progress and profiles.

## 10.3 Create user

Use a guided dialog or page:

- name;
- email;
- role;
- confirmation;
- temporary password revealed once.

The one-time password display must include:

- copy action;
- warning that it cannot be retrieved later;
- acknowledgement before closing.

## 10.4 User actions

- change role;
- reset password;
- remove account.

Each action must use a confirmation dialog. Prevent removal of the last administrator.

## 10.5 First sign-in

When `mustChangePassword` is true:

- block access to the operational shell;
- explain why the password must be changed;
- provide current password, new password, and confirmation;
- show password requirements;
- return the user to the intended admin location after success.

---

# 11. Data and audit experience

## 11.1 Separation of concerns

Create one administrator-only page with two clearly separated areas:

- **Audit activity**
- **Data retention and deletion**

Do not place purge controls at the bottom of the daily candidate dashboard.

## 11.2 Audit activity

Provide:

- date range filter;
- action filter;
- actor identifier presented as resolved user name where possible;
- subject link where the candidate still exists;
- timestamp;
- human-readable action;
- non-identifying metadata.

Audit rows must never display names or emails derived from stored audit metadata. UI resolution from current relational records is acceptable only where authorised and available.

## 11.3 Retention summary

Display:

- configured retention period;
- what will be deleted;
- what identity-free audit evidence remains;
- whether deletion is manual.

## 11.4 Delete all candidate data

Use a dedicated danger panel:

- clear consequences;
- count of affected candidates;
- type-the-phrase confirmation;
- final confirmation action;
- success receipt with deleted count.

This action must never be visually adjacent to routine export or invite actions.

---

# 12. Candidate experience

## 12.1 Candidate visual direction

The candidate experience must be:

- mobile-first;
- private and reassuring;
- light in cognitive load;
- free from admin visual density;
- readable on a mid-range Android phone;
- resilient to slow network conditions.

Use a simple top brand mark and progress context. Do not use the full admin sidebar or dashboard styling.

## 12.2 Entry and consent page

Required content:

- candidate greeting;
- purpose of the assessment;
- 34 statements;
- approximately 12 minutes;
- no right or wrong answers;
- what is collected;
- who sees it;
- retention period;
- how to request earlier deletion;
- consent checkbox;
- clear Start assessment button.

Improve scanability by using:

- short titled sections;
- restrained icons where helpful;
- a “Before you begin” summary card;
- plain language.

## 12.3 Assessment format

The existing one-page scrolling implementation may remain for functional compatibility, but the facade must improve orientation.

Required elements:

- sticky or persistent progress indicator;
- “X of 34 answered”;
- autosave status;
- clear response anchors from Strongly disagree to Strongly agree;
- large touch targets;
- one visually dominant item at a time within the reading flow;
- distinct but non-card-heavy separation between items.

Do not use:
- sliders;
- tiny radio buttons;
- colour alone to show selection;
- countdown timers;
- forced full-screen behaviour;
- guilt-inducing incomplete warnings.

## 12.4 Autosave communication

Show states:

- Saving…
- Saved
- Could not save — retrying
- Offline / reconnecting, if detectable

Do not claim an answer is saved until the request succeeds.

## 12.5 Resume behaviour

When a candidate returns:

- restore all responses;
- show a brief “Your previous answers were restored” notice;
- return to the first unanswered item or the previous approximate position;
- never ask for consent again after valid consent has been recorded.

## 12.6 Submission review

Before final submission:

- show completion count;
- highlight unanswered items;
- provide “Review unanswered” action;
- explain that responses cannot be changed after submission;
- use a confirmation step before final submission.

## 12.7 Completion page

Use neutral confirmation:

- assessment received;
- no further action required;
- responses will be reviewed with the rest of the application;
- contact instruction for link problems.

The same page may serve expired, revoked, and used links, but wording must remain non-disclosing.

---

# 13. Visual design system

## 13.1 Brand direction

Recommended identity:

> **Executive Navy + Governance Teal + Registry Blue + Cool Porcelain Neutrals**

This gives Afenda Talents a serious, modern HR-operations identity without looking like banking software or a generic SaaS starter.

## 13.2 Core palette

| Token | HEX | Use |
|---|---:|---|
| Executive Navy | `#14324A` | primary brand, headings, active navigation |
| Governance Teal | `#2E7D7A` | progress, positive operational accents |
| Registry Blue | `#1D5B79` | links, secondary actions, information states |
| Ink Charcoal | `#26333C` | primary text |
| Slate | `#5C6B75` | secondary text |
| Cool Porcelain | `#F4F7F8` | page background |
| White | `#FFFFFF` | surfaces |
| Border Mist | `#D9E2E7` | borders and separators |
| Amber Context | `#B7791F` | review-attention context |
| Destructive Red | `#B42318` | destructive actions only |

### Rules

- Do not use bright green to imply candidate quality.
- Do not use red for validity context.
- Reserve red for destructive actions and actual errors.
- Use amber for items requiring human review or follow-up.
- Ensure all combinations meet WCAG contrast requirements.

## 13.3 Typography

Use a modern, highly readable sans-serif.

Requirements:

- strong distinction between display, section, body, label, and metadata;
- tabular numerals for scores and counts;
- minimum 16 px candidate body copy;
- admin body copy generally 14–16 px;
- no excessive use of uppercase;
- raw statuses must be transformed into readable labels.

## 13.4 Spacing and density

- 4 px base spacing system.
- Common spacing: 8, 12, 16, 24, 32, 48.
- Admin tables may be compact but must remain touch- and keyboard-usable.
- Candidate screens must use more vertical breathing room.
- Avoid stacking many boxed cards with identical borders.

## 13.5 Shape and elevation

- border radius: restrained, generally 8–12 px;
- shadows: subtle and rare;
- use borders and background shifts before shadows;
- destructive dialogs may use stronger separation;
- pills are for compact statuses, filters, or metadata—not every label.

## 13.6 Icons

- use a consistent outline icon set;
- always pair unfamiliar icons with text;
- avoid decorative icon tiles;
- icon colour follows text hierarchy;
- never use icon colour alone to represent status.

---

# 14. Component requirements

## 14.1 PageHeader

Properties:

- eyebrow or breadcrumb;
- title;
- description;
- metadata;
- primary action;
- secondary action;
- responsive stacking.

## 14.2 StatusBadge

Must map internal states to:

- readable label;
- semantic tone;
- optional icon;
- accessible text.

## 14.3 MetricCard

Use only for high-value overview metrics.

Must include:

- label;
- value;
- context or change;
- optional action;
- no meaningless decorative chart.

## 14.4 WorkflowProgress

Shows candidate movement through the assessment lifecycle.

Must support:

- stage count;
- percentage;
- exception states;
- filter action;
- accessible text.

## 14.5 AttentionList

Must show:

- priority;
- subject;
- reason;
- timing context;
- action.

## 14.6 CandidateTable

Must support:

- sort;
- filter;
- search;
- sticky header;
- row actions;
- empty state;
- responsive cards;
- loading state;
- keyboard interaction.

## 14.7 DimensionScale

Must support:

- dimension label;
- numerical score;
- band;
- fixed boundaries;
- marker;
- explanation;
- print rendering;
- screen-reader equivalent.

## 14.8 ResponseContextCard

Must show:

- indicator name;
- observed/not observed;
- explanation;
- score-independence note.

## 14.9 Timeline

Must show:

- event;
- timestamp;
- actor where appropriate;
- status;
- no secret or token data.

## 14.10 ConfirmDialog

Required for:

- revoke;
- reset password;
- remove user;
- delete candidate.

Must contain:

- action title;
- consequence;
- affected subject;
- cancel;
- explicit action label.

## 14.11 TypedConfirmation

Required for purge-all.

## 14.12 Toast and inline feedback

- Toasts for completed background-like actions.
- Inline errors for form validation.
- Persistent page-level alerts for actions that require user resolution.
- Do not rely on toasts for critical failures.

---

# 15. Loading, empty, error, and success states

Every primary screen must define:

- initial loading;
- partial loading;
- empty state;
- no-filter-result state;
- recoverable error;
- access denied;
- success state.

## 15.1 Skeletons

Use skeletons matching the final layout. Avoid generic full-page spinners.

## 15.2 Errors

Error messages must state:

- what failed;
- whether data was saved;
- what the user can do next.

Do not expose technical error strings, token details, database terms, or internal identifiers.

## 15.3 Slow startup

Because the production data layer may cold-start, candidate entry must show a branded loading shell quickly rather than a blank screen.

---

# 16. Accessibility

Target **WCAG 2.2 AA**.

Required:

- complete keyboard navigation;
- visible focus rings;
- correct landmarks;
- no nested main landmarks;
- labels for every control;
- error association with fields;
- minimum touch target approximately 44×44 px;
- colour not used as the only signal;
- reduced-motion support;
- table alternatives on mobile;
- progress announced accessibly;
- charts and scales have text equivalents;
- print output remains legible in grayscale.

---

# 17. Responsive behaviour

## 17.1 Admin

### Desktop
- full sidebar;
- wide tables;
- multi-column overview.

### Tablet
- collapsible sidebar;
- two-column overview;
- horizontally scrollable tables only as a fallback.

### Mobile
- navigation drawer;
- stacked page header;
- table converts to structured candidate cards;
- actions remain labelled;
- filters use a sheet or drawer.

## 17.2 Candidate

Design mobile first.

- content width approximately 560–640 px maximum;
- sticky bottom action area;
- scale buttons fit without horizontal scrolling;
- no tiny metadata;
- progress remains visible;
- network feedback is clear.

---

# 18. Content and microcopy rules

## 18.1 Voice

- clear;
- respectful;
- neutral;
- direct;
- not clinical;
- not judgemental;
- not promotional.

## 18.2 Status wording

Prefer:

- Invitation sent
- Assessment started
- Completed
- Invitation expired
- Invitation revoked

Avoid exposing:

- SENT
- STARTED
- SCORED
- REVOKED

outside technical or audit contexts.

## 18.3 Assessment wording

Always reinforce:

- self-report;
- no pass/fail;
- no ranking;
- one input into a hiring decision;
- response context does not change scores.

## 18.4 Destructive wording

Use the exact object and consequence:

- “Delete candidate and assessment data”
- “Revoke this invitation”
- “Remove this team member”
- “Delete all candidate data”

Avoid vague labels such as “Remove,” “Clear,” or “Reset” without context.

---

# 19. Privacy and trust presentation

The interface must visibly reinforce existing privacy architecture:

- personal invitation links;
- access-controlled manager workspace;
- consent before questions;
- configured retention period;
- delete-one and purge-all mechanisms;
- identity-free audit persistence;
- no raw token exposure;
- role-based action visibility.

Trust messaging must describe actual implemented behaviour only.

---

# 20. Print requirements

Candidate profile printing must:

- remove navigation and interactive controls;
- include candidate identity and submission date;
- include all five dimensions;
- include response context;
- include item responses when expanded by print rules;
- include the self-report disclaimer;
- avoid clipped scales;
- remain understandable in grayscale;
- avoid forced one-page compression when content requires multiple pages.

The earlier “one clean page” goal should not override readability. A profile may span multiple well-formatted pages.

---

# 21. Motion and interaction

Allowed:

- subtle hover and press feedback;
- short disclosure transitions;
- progress movement;
- success confirmation.

Avoid:

- animated score counting;
- celebratory confetti;
- bouncing alerts;
- auto-rotating dashboard content;
- motion that implies candidate quality.

Respect `prefers-reduced-motion`.

---

# 22. UI/UX acceptance criteria

The UI/UX implementation is complete when:

1. A first-time hiring manager can explain the product purpose from the overview without training.
2. The overview identifies workflow status and actionable follow-up, not merely totals.
3. Candidate records can be found by search and useful filters.
4. Internal status codes are not exposed in routine UI.
5. Invitation creation includes parsing review and email preview.
6. Candidate profiles present all five dimensions without overall score, rank, recommendation, or pass/fail.
7. Response context is neutral and clearly separate from competency scores.
8. Self-reported time and server-observed time are distinguished.
9. Administrators and viewers see only actions permitted to their roles.
10. Candidate assessment works comfortably on a mid-range Android viewport.
11. Autosave status is visible and truthful.
12. Resume behaviour restores responses and directs the candidate to continue.
13. All destructive actions use appropriate confirmation patterns.
14. Purge controls are separated from daily workflow.
15. Empty, loading, error, and no-result states are purposefully designed.
16. Keyboard-only operation is possible.
17. Focus, contrast, touch targets, labels, and screen-reader descriptions meet WCAG 2.2 AA.
18. Candidate profiles print cleanly without admin chrome.
19. The application uses the approved colour, typography, spacing, and component rules consistently.
20. The UI does not add functionality prohibited by the MVP non-goals.

---

# 23. Delivery priorities

## Priority 1 — Facade correction

- rebuild admin shell;
- create meaningful overview;
- improve page headers;
- establish design tokens;
- replace raw statuses;
- define role-aware navigation.

## Priority 2 — Core operational workflows

- candidates workspace;
- invite review and preview;
- candidate detail timeline;
- clear action hierarchy;
- team management refinement.

## Priority 3 — Assessment profile quality

- dimension scales;
- responsible interpretation framing;
- response context;
- timing disclosure;
- item-response presentation;
- print report.

## Priority 4 — Candidate completion experience

- consent readability;
- progress and autosave;
- resume notice;
- review-before-submit;
- refined completion state.

## Priority 5 — Governance surfaces

- audit activity;
- retention summary;
- deletion and purge experience;
- accessibility and responsive QA.

---

# 24. Explicit non-goals for the redesign

The redesign must not introduce:

- candidate ranking;
- pass/fail recommendations;
- overall composite score;
- benchmarking or percentiles;
- AI-generated hiring decisions;
- candidate accounts;
- campaign management;
- multi-instrument authoring;
- scheduled reminders;
- interview scheduling;
- ATS integration;
- employee onboarding;
- performance management;
- analytics unrelated to the current assessment workflow.

---

# 25. Final design direction

The finished Afenda Talents interface should feel like a focused **hiring assessment operations workspace**, not a scaffolded CRUD application.

Its facade should communicate three layers clearly:

1. **Operational truth** — who has been invited, started, completed, expired, or needs action.
2. **Assessment insight** — five understandable dimensions with transparent response context.
3. **Governance and trust** — controlled access, consent, retention, audit, and deliberate destructive actions.

The design should be restrained, but never empty; informative, but never overwhelming; analytical, but never dehumanising.
