This project is an AI-assisted 837 encounter validation system.

Principles:
- Deterministic validation rules are the source of truth
- AI is advisory only
- No business logic in UI files
- Modular architecture required

Structure:
- /ui = UI components
- /rules = validation logic
- /data = models
- /agent = AI layer

Constraints:
- Do not break existing UI behavior
- Do not duplicate logic