# Claude Duet (optional, preview)

Claude Duet is Anthropic's proactive assistant (research preview, announced 2026-10-21; US Pro/Max, waitlist). It can't read this folder and has no hooks, but it loads her Claude account's **memory, skills and connected apps**, and it takes instructions in its thread. So this folder is the slot for Duet:

| File | What it's for |
|---|---|
| `trading-coach-assistant/SKILL.md` | The skill Duet uses: what to watch (brief missing, before the open, report coming, limits, journal after the session), what never to do, under-60-word nudges. Edit this to change how Duet helps. |
| `first-message.md` | The message she pastes into Duet once, so it knows what to check and how often. |

Untested: written from the public Duet announcement before she had access. Her Claude should check it against Duet's real behaviour the first time she uses it and adjust the skill.

## Setting it up (her Claude does this with her, one step at a time)
1. Zip the `trading-coach-assistant` folder (her Claude makes `duet/trading-coach-assistant.zip`).
2. In Claude: **Customize → Skills → +** and upload that zip. (If the menu differs, search Claude's help for "upload a skill".)
3. Open Duet and paste the text from `first-message.md`.
4. Check: ask Duet "what will you tell me about tomorrow?" It should list the brief check, the open, any `[Mkt]` events and the journal nudge.

Duet works best once the Notion journal, the Morning Brief page and the calendar events are set up (setup steps 5, 9 and 10).
