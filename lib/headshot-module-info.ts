/**
 * Hand-maintained facts about the vendored `lib/headshot-diffusion.js`.
 *
 * The convention, same as `lib/headshot-diffusion.d.ts`: the module itself is
 * copied byte-for-byte out of `~/Documents/headshot_diffusion/dist/` and is
 * never edited, so anything the site needs to KNOW about it lives in a sibling
 * file that a human updates at every re-vendor. The types are one such file;
 * this is the other.
 *
 * ⚠️ UPDATE THIS AT EVERY RE-VENDOR, and back it with a parity run. Its truth
 * comes from `dist/test_parity.mjs` having been run against this exact module
 * (both models PASS, plus the v2 option smokes), not from anything the module
 * announces about itself — it exports no version marker.
 *
 * Why a constant instead of sniffing the module: the v1 sampler SILENTLY
 * IGNORED unknown `generate()` options. Passing `init` to it ran a full
 * from-noise sample while a UI gated on "did that option do anything?" claimed
 * a morph. There is no runtime test that separates "ignored the option" from
 * "honoured it" without a reference output, so the capability is declared here
 * by the person who vendored the file.
 */

/**
 * True for the v2 module: `generate()` accepts `init` (+ `strength`) and
 * starts the descent from a forward-noised image instead of pure noise.
 *
 * Vendored 2026-09-12 from the 256/128 two-model bundle; parity re-run on that
 * copy (256 max|Δ| 3.14e-5, 128 max|Δ| 6.71e-6, init+strength smoke ran 14 of
 * 25 steps and returned finite output).
 */
export const MODULE_SUPPORTS_TRANSITIONS = true;
