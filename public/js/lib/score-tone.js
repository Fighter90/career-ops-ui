/**
 * score-tone.js — shared fit-score → tone mapping (v1.128.0).
 *
 * A four-tier
 * threshold (>=4.2 good / >=3.8 warn / >=3.0 muted / <3.0 bad) with a
 * letter-grade fallback (A/B/C/…), replacing our coarse ">=4 high / >=3 mid /
 * else low" split that mis-colored NaN and letter grades. Pure, CSP-safe.
 *
 * Exposed as window.ScoreTone (classic <script src>, like fit-score.js /
 * cv-diagnostics.js). No ESM export in the browser file.
 */
(function (root) {
  'use strict';

  /** First number in a score string ("4.1/5", "B+", "3.0", 4.2) → Number or NaN. */
  function scoreNum(s) {
    if (typeof s === 'number') return Number.isFinite(s) ? s : NaN;
    if (typeof s !== 'string') return NaN;
    const m = s.match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : NaN;
  }

  /**
   * Score (string or number) → one of 'good' | 'warn' | 'muted' | 'bad'.
   * Numeric thresholds first; if unparsable, fall back to the first letter
   * grade (A→good, B→warn, C→muted, else bad).
   */
  function scoreTone(score) {
    const num = scoreNum(score);
    if (!Number.isNaN(num)) {
      if (num >= 4.2) return 'good';
      if (num >= 3.8) return 'warn';
      if (num >= 3.0) return 'muted';
      return 'bad';
    }
    // No score at all (null / undefined / blank) is a not-yet-evaluated row —
    // neutral, never red. A real low grade ("D"/"F") still reads 'bad'.
    const s = (typeof score === 'string' ? score.trim() : '');
    if (!s) return 'muted';
    const g = s.toUpperCase()[0];
    if (g === 'A') return 'good';
    if (g === 'B') return 'warn';
    if (g === 'C') return 'muted';
    return 'bad';
  }

  /** Tone → the tracker's CSS class (4 tiers; muted is the neutral middle). */
  const TONE_CLASS = { good: 'score-high', warn: 'score-mid', muted: 'score-muted', bad: 'score-low' };
  function scoreClass(score) { return TONE_CLASS[scoreTone(score)]; }

  root.ScoreTone = { scoreNum, scoreTone, scoreClass };
})(typeof window !== 'undefined' ? window : globalThis);
