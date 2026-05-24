# Squad Handoff Template: Feature or Bug Plan

Use this template when creating an implementation plan with the user for a feature or bug fix.

## Work Item
- **Type:** `Feature` or `Bug Fix`
- **Title:** `<short title>`
- **Summary:** `<one paragraph problem/opportunity statement>`

## Goal
<Describe the desired end state and user-visible behavior.>

## Business Rules / Requirements
- <Rule 1>
- <Rule 2>
- <Rule 3>

## Acceptance Criteria
- <Given/When/Then or bullet criteria>
- <Expected output/state>
- <Error/edge behavior>

## Workflow Requirements
1. Create a GitHub issue with the plan before making changes.
2. Create branches for each major change.
3. Make multiple commits on each branch.
4. Create Pull Requests to merge each branch into `main`.
5. In every Pull Request, include a `Quality Assurance / Manual Test` section that lists the features and functionality the user should validate.

## What to Inspect First
- `<primary files/modules>`
- `<related API routes>`
- `<shared libraries/services>`
- `<tests to update>`

## Suggested Branch Plan
- **Branch 1:** `<core data/logic change>`
- **Branch 2:** `<API/integration wiring>`
- **Branch 3:** `<tests/cleanup/docs>`

## Expected Work
- Audit all mutation paths that can affect the target behavior.
- Ensure all paths use one shared source-of-truth computation.
- Keep UI changes minimal unless required to fix behavior.
- Add tests for happy path, edge cases, and regressions.
- Validate integration paths if external systems are involved.

## Output I Want Back
- Files changed
- Why each change was needed
- Test results
- Any manual QA steps I should run in the UI

## Notes
- Prefer the smallest safe fix that satisfies acceptance criteria.
- Keep existing architecture and conventions unless a change is required.
- Call out assumptions and follow-up items explicitly.

## PR Checklist Reminder
- [ ] PR includes `Quality Assurance / Manual Test` section.
- [ ] QA section lists exact features/flows I should validate.
- [ ] Test commands and results are included.
- [ ] Risks and rollback notes are documented.
