You are generating 14 Instagram Reel concepts for Keith J. Skaggs Jr., 22yo solo founder of 1Commerce LLC.

POSITIONING: Ex-trades (worked in blue-collar trades until Oct 2025, then transitioned to software), now a self-taught operator building a commerce infrastructure empire from the Pacific Northwest. Philosophy: "Cathedral Principle" = building what outlasts you. Serious operator, PNW industrial aesthetic, 1Commerce LLC / UnifyOne.

DISTRIBUTE CONCEPTS:
- 6 operator_wisdom: 7-15s, aspirational B-roll + on-screen quote, trending audio. Need broll_prompt.
- 4 build_in_public: 15-30s, screen recording or office talking-head. Recording needed. No broll_prompt.
- 2 trades_to_tech: 30-60s, story-driven talking-head. Recording needed. No broll_prompt.
- 2 pnw_identity: 5-10s, aesthetic B-roll only (industrial, rainy, drone, urban exploration, Cascade mountains). Need broll_prompt.

HOOK PATTERNS (use these, reject "Watch this"/"Wait for it"):
1. Contradiction — "I run 6 companies at 22. I'm also terrified most days."
2. Hyper-specific relatability — "If you've ever opened Stripe at 2am on a Sunday..."
3. Timeframe collapse — "6 months ago I was swinging a hammer. This morning I shipped a SaaS."
4. POV disguising advice — "POV: solo founder trying to register for GSA at 1am."
5. Bold claim + proof — "I built this in 3 weeks for $237. Here's the stack."

OUTPUT: Return ONLY a JSON array of 14 objects. No markdown fences, no preamble. Each object:
{
  "pillar": "operator_wisdom" | "build_in_public" | "trades_to_tech" | "pnw_identity",
  "hook": "First 3 seconds copy, max 12 words, one of the 5 patterns",
  "script": "Full voiceover or dialogue, matched to pillar duration",
  "text_overlay": "On-screen text (can be same as hook or supplementary)",
  "caption": "IG caption, 1-2 sentences ending in CTA or question. Max 180 chars.",
  "hashtags": ["5-8", "hashtags", "niche+broad mix", "avoid banned tags"],
  "broll_prompt": "For operator_wisdom and pnw_identity only. Cinematic visual description for Veo 3.1. 9:16 vertical. Include: subject, lighting, movement, lens language, mood. No text in video. NULL for talking-head pillars.",
  "audio_suggestion": "Vibe description for Keith to pick trending audio manually. e.g. 'moody lofi piano, 120bpm' or 'aggressive hip-hop build'",
  "duration_seconds": 5-60
}

CONSTRAINTS:
- No generic hustle-culture clichés ("grind", "hustle harder", "no excuses")
- No "Millionaire mindset" tropes
- Reference specific tech (Supabase, Stripe, Netlify, n8n) in build_in_public — not vague "building my business"
- Trades-to-tech stories should feel grounded and specific, not inspirational platitudes
- PNW identity reels should evoke place, not people
