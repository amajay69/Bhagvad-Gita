# Product Brief (v0.1)

Name: Gita Manan. Tagline: "Insights from the Gita". Built on GitaViśva by Himanshu Mohanty (MIT licence; his copyright notice stays).

## 1. Who it is for

Working people in India who feel the pull between work and life: pressure, guilt, burnout, comparison, anger, confusion.
They are devotees or curious about the Gita, not scholars. They are not technical.

## 2. The promise

"Write what is on your mind. A gentle guide reads it with you and shows you what the Gita says, through a story you will remember and one small thing to try tomorrow."

## 3. Core loop (only 3 screens)

1. **Write**: today's journal entry. Type, speak, or upload a photo of a handwritten diary page.
2. **Sit with the guide**: pick one entry, or "my last 7 days".
3. **Response**, always in the same shape:
   - one line that shows it understood
   - a short story (Mahabharata characters, or an everyday office or family scene)
   - one verse, in simple words
   - one small action for tomorrow

## 4. Voice of the guide

- A sarathi (guide) who narrates what Krishna teaches. The AI never speaks as Krishna.
- English as the main language, with Hindi or Hinglish lines for impact.
- Simple words, short answers. No Sanskrit jargon unless explained.
- Stories can come from any source (Mahabharata, Ramayana, Puranas, saints' lives, everyday life). Every story is labelled with its source. The AI never makes up a story and attributes it to a scripture or saint.

## 5. Memory: a lifelong companion

- Builds a private profile over time: recurring worries, themes, what helped before.
- The guide can say "Last month you wrote about the same fear at work...".
- The user can see, edit and delete what is remembered.
- Saved as a file on the user's computer, with export for backup. No account, no server database.

## 6. AI providers (user brings own key)

| Provider | Role | Note |
|---|---|---|
| Groq | Default | Free tier. Text, voice (Whisper), image (vision model). |
| Gemini | Optional | Free tier. Shown with warning: Google may read and use entries. |
| Claude / OpenAI | Optional, paid | Best storytelling quality. |

Exact model names to be verified at build time.

## 7. Keep from GitaViśva vs hide

- **Keep (engine, invisible):** 701 verses, translations, commentaries, search, journal-to-verse linking, safety check, recitation.
- **Hide from main flow:** 3D graph, Lineage, multi-script reader, 20-commentary compare. May stay under an "Explore more" link.

## 8. Safety

If an entry shows serious distress or self-harm, the guide responds with care and shows helplines first:
Tele-MANAS 14416 (free, 24x7, government of India). Verses come after, never instead.

## 9. Distribution

- Free, open source, not commercial.
- Runs on the user's own machine.
- v1: install with Node.js. Later: one-click Windows and Mac installer.

## 10. Out of scope for v1

Login, cloud sync, mobile app, payments, multiple users on one machine, daily reminders.

## 11. Open questions

None at the moment.
