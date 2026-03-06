# CLAUDE.md

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Comment Style

**Consistent, purposeful comments. Not noise.**

### JSDoc for public APIs
Every exported function, interface, and type gets JSDoc documentation:
```typescript
/**
 * Brief description of what it does
 *
 * @param foo - Description of parameter
 * @returns Description of return value
 */
export function myFunction(foo: string): number { ... }
```

### JSDoc for types and interfaces
All interfaces and types get a JSDoc comment, and every field gets an inline `/** comment */`:
```typescript
/** Props for {@link MyComponent} */
interface MyComponentProps {
  /** Whether the dialog is visible */
  open: boolean;
  /** Called to close the dialog */
  onClose: () => void;
}

/** Single navigation link in the sidebar */
type NavItem = {
  /** Display text */
  label: string;
  /** Route path */
  href: string;
};
```

### Section markers inside functions
Use `/** SECTION NAME */` to mark logical sections within complex functions:
```typescript
function complexFunction() {
  /** PARSE OPTIONS */
  const { foo, bar } = options;

  /** VALIDATE INPUT */
  if (!foo) throw new Error('foo required');

  /** EXECUTE MAIN LOGIC */
  const result = doSomething(foo, bar);

  /** CLEANUP */
  return result;
}
```

Common section names: `STATE`, `REFS`, `GUARDS`, `HELPERS`, `CLEANUP`, `EFFECT 1: ...`, `HANDLE ERROR`

### Inline explanations
Use `// comment` for explaining specific logic:
```typescript
// Only sync if auto-sync is not explicitly disabled
const shouldAutoSync = options?.autoSync !== false;

// On Android, the native call blocks for ~10-15s if offline
if (Platform.OS === 'android') { ... }
```

### What NOT to comment
- Obvious code (`// increment counter` before `count++`)
- Code that's already clear from good naming
- Every single line - only where it adds value

## 6. Learn From Mistakes

**When corrected, codify the lesson. Don't repeat the same mistake twice.**

When the user corrects you or you discover a pattern/convention mid-session:
1. Acknowledge the mistake explicitly.
2. Propose a new rule or update to an existing section of this file that would have prevented it.
3. After user approval, add/update the rule in CLAUDE.md so future sessions benefit.

Examples of things worth capturing:
- File/folder conventions the user enforces (e.g. "utils go under `src/lib/utils/`")
- Naming patterns (e.g. "one function per file, kebab-case filename")
- Architectural preferences revealed through feedback
- Anti-patterns the user flags

Do NOT add rules speculatively. Only add rules that come from actual corrections or explicit user preferences expressed during a session.

## 7. Workflow Orchestration

### Plan Mode Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### Self-Improvement Loop

- After ANY correction from the user: update relevant files in `.claude/rules/` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## 8. Plan Files

**Store implementation plans in `.claude/plans/<feature-name>.md`**

- Plans live in `.claude/plans/` so Claude can reference them across sessions
- Use descriptive kebab-case names: `test-suite-design.md`, `push-notification-refactor.md`
- Include date and approval status at the top
- These are working documents — update them as the plan evolves

## 9. Task Management

1. **Plan First**: Write plan to `.claude/todo/<feature-or-task-name>.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `.claude/todo/<feature-or-task-name>.md`
6. **Capture Lessons**: Update relevant files in `.claude/rules/` after corrections

## 10. Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
