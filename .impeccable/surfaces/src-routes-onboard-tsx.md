---
version: 1
slug: "src-routes-onboard-tsx"
primary_target: "src/routes/onboard.tsx"
related_targets: []
---

# Student onboarding (`/onboard`)

Mode: Operate (a guided task). Dials: DESIGN_VARIANCE 3, MOTION_INTENSITY 4, VISUAL_DENSITY 5 (lighter than the trading screens; first-time users).

## Job and audience
A student who signed in with a university email, often from the landing page's "Join as a student". They are deciding whether to trust us with a transcript. They need to know what is kept, what is deleted, what is public and what they give up (the insider rule) before uploading anything, then get through review quickly and see something worth the effort at the end.

## Steps
1. Email OTP (input-otp). The university domain marks the account as a student; a non-university email continues as a trader and is told why.
2. Consent: what is stored (course codes, terms, optional grade bands), what is deleted (the PDF, right after confirmation), what is public (aggregates only, counts rounded to 5, never below 25 people), the insider rule. One explicit "I agree" action.
3. Upload: drag-and-drop or choose a PDF (max 10 MB). Private bucket, own folder.
4. Parsing with streamed steps: uploading, reading, matching courses, tagging skills, ready for review. Each step shows real progress from the Edge Function; failures name the problem and offer retry or manual entry.
5. Review table: every parsed course (code, title, term, grade) editable; delete rows; add a course by searching the catalog; for courses not in the catalog, confirm the suggested skill tags. Program and graduation year confirmed here.
6. Confirm: one primary action; the PDF is deleted right after.
7. Skill profile reveal: weighted skill bars from the confirmed courses.
8. Your cohorts: the cohorts they are now in (live ones only), with the insider rule in one line, linking to /me.

## States and ranges
Transcripts of 1 to 150 courses; titles up to 200 characters including non-Latin text; unknown courses 0 to 20; parse failure; non-PDF; oversized file; zero cohorts matched (explain that cohorts need 25 people and that new cohorts are proposed over time).

## Direction contract
THESIS: Consent you can read in ten seconds. The privacy terms are four short statements with the exact facts, not a legal wall or a checkbox buried under a button; refuses the "upload to unlock your score" growth funnel.
OWN-WORLD: Same world as the trading screens: cool paper ground, ink text, cobalt for the one primary action per step, hairline-ruled review table, Schibsted Grotesk with tabular figures.
STORY: The student understands what happens to their data, uploads, watches real progress, fixes what the parser got wrong, confirms, then sees their skills and the cohorts they joined, framed as what traders believe, never what they are worth.
FIRST VIEWPORT: Single centered column (max 640px) with a slim step indicator above the step's h1; the step's single primary action is always visible without scrolling; the review step widens to 960px for the table.
FORM: Brief-pinned world (BRIEF §12); no concept roll. Signature move: the four-statement consent card, reused verbatim in "What we store" on the landing page.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
