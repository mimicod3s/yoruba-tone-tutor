# Yoruba Tone Tutor

Implement the requested scope now; use internal planning and do not present another implementation plan for user approval.

## User Request
Build an app for practicing Yoruba tones (high, mid/flat, low tones) where spoken input is evaluated based on whether the user hit the right tone.

## Agreed Context & Core Scope
- **Interactive Yoruba Tone Practice Web App**: Clean, accessible, mobile-responsive layout.
- **Curated Tone Minimal-Pair Deck**: Include classic minimal pairs and foundational vocabulary with full tone marks and underdots, such as:
  - *owó* (money: Mid, High) vs. *ọ̀wọ̀* (respect: Low, Low) vs. *òwò* (trade: Low, Low)
  - *bàbá* (father: Low, High) vs. *baba* (elder: Mid, Mid)
  - *ilé* (house: Mid, High) vs. *ilẹ̀* (land/ground: Mid, Low)
- **Target Pitch Guide**: For each word, display the expected syllable-by-syllable tone sequence (High / Ó / Do, Mid / O / Re, Low / Ò / Mi) with horizontal guide rails and reference pitch tones (synthesized tone chimes/whistle so the user can hear the pitch target).
- **Microphone Pitch Detection**: Real-time fundamental pitch (F0) tracking via the browser's Web Audio API (e.g. autocorrelation/YIN pitch detection).
- **Relative Contour Evaluator**: Evaluates the relative pitch shifts across syllables (e.g., jump up to High, level for Mid, fall to Low) normalized to the user's natural vocal baseline, rather than testing absolute frequency.
- **Visual Pitch Canvas & Feedback**: An interactive visual pitch lane showing the user's live voice contour drawn against the target tone bars, complete with accuracy scoring, tone verdict per syllable, and tips for improvement.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0fb836c8-13e4-4fb5-8d7b-ea1ea94d6df0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
