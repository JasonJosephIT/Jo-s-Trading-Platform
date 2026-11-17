# trading-coach-assistant (plugin)

A Claude plugin with one skill: how to help Jo around her trading day. It nudges her when the morning brief is missing, before the open, before a scheduled market report, near her own limits, and when the day isn't journaled. Read-only; it never trades or gives trade ideas.

It's for Claude Duet (Anthropic's proactive assistant, research preview since 2026-10-21; US Pro/Max, waitlist), which has no hooks and can't read the Trading Coach folder but loads her account's skills, plugins, memory and connected apps. Regular Claude uses it too.

## Install (her Claude does this in setup step 11)

```
claude plugin marketplace add JasonJosephIT/Jo-s-Trading-Platform
claude plugin install trading-coach-assistant@trading-coach
```

Or in Claude Code: `/plugin install trading-coach-assistant --marketplace JasonJosephIT/Jo-s-Trading-Platform`

Both commands are pre-allowed in the folder's `.claude/settings.json`. If her permission option is set to accept all, Claude installs it with no clicks. Without the `claude` command (some Cowork sessions), Claude zips this folder into `trading-coach-assistant.plugin`; she clicks it and presses **Accept**.

## Duet
1. After installing, open Duet and paste the text from `first-message.md` (her Claude fills in the brackets).
2. Check: ask Duet "what will you tell me about tomorrow?" It should list the brief check, the open, any `[Mkt]` events and the journal nudge.
3. If Duet doesn't see the plugin, upload the skill alone: zip `skills/trading-coach-assistant`, then **Customize → Skills → +** in Claude.

Untested with Duet: written from the public announcement before she had access. Her Claude should check it the first time and adjust `skills/trading-coach-assistant/SKILL.md`.

Works best once the Notion journal, Morning Brief page and calendar events are set up (setup steps 5, 9 and 10).
