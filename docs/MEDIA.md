# Media

All imagery and motion loops in Siegel were generated with **Higgsfield**, then encoded for the web
(H.264 MP4 with `+faststart`, WebP stills) into `public/media/`.

| File | Model | Used on |
|---|---|---|
| `hero-seal.webp`, `hero-loop.mp4` | GPT Image 2.5 → Kling 3.0 (start = end frame, seamless loop) | Landing hero, signed state, OG image |
| `stamp-start.webp`, `seal-press.mp4` | GPT Image 2.5 → Kling 3.0 | The "Sealed." moment after a client signs, landing |
| `chain-intact.webp`, `chain-loop.mp4` | GPT Image 2.5 → Kling 3.0 (loop) | Audit trail, verify page, dashboard, landing |
| `chain-broken.webp`, `chain-break.mp4` | GPT Image 2.5 → Kling 3.0 (start intact, end shattered) | Tampering detected (audit + verify), landing tamper demo |
| `notes-to-proposal.webp`, `notes-flow.mp4` | GPT Image 2.5 → Cinema Studio Video | AI drafting screen, landing |
| `wax-drop.webp`, `wax-drop.mp4` | GPT Image 2.5 → Cinema Studio Video (slow motion) | Login |
| `cover-{ember,ink,dawn,emerald}.webp`, `silk-loop.mp4` | GPT Image 2.5 → Kling 3.0 (loop) | Proposal covers (client page hero), landing CTA |
| `certificate.webp` | GPT Image 2.5 | Landing |
| `wax-disc.webp` | GPT Image 2.5 | Empty states |
| `pen.webp` | GPT Image 2.5 (transparent background) | The fountain pen that rests on the signature line and writes with the client |
| `pen-reveal.mp4` | GPT Image 2.5 (start + edited end frame) → Kling 3.0 | "Accept & sign" header: the cap comes off as the client arrives |

## Prompts

**Hero seal (16:9)**: Ultra-detailed macro product photograph: a glossy deep vermilion-red wax seal freshly pressed onto a thick, textured ivory cotton paper sheet. The seal bears a crisp, minimal geometric monogram letter S formed by two interlocking arcs, surrounded by a fine ring of tiny engraved tick marks like a precision dial. The paper edge falls away into a near-black void. Dramatic low-key studio lighting, warm amber rim light grazing the wax, specular highlights on the molten edges, a few floating ember sparks and soft smoke wisps. Shallow depth of field, 100mm macro lens, cinematic color grade, luxurious premium technology brand aesthetic. Composition: the seal sits in the right third of the frame, generous dark negative space on the left half.

*Motion*: Locked-off macro shot, almost still. A slow band of warm amber light sweeps across the glossy vermilion wax seal, making the embossed monogram glisten, then fades. Tiny ember sparks drift slowly upward, a thin wisp of smoke curls and dissipates. Seamless loop.

**Stamp (1:1)**: A heavy polished brass wax-seal stamp with a dark walnut wooden handle hovers a few centimeters above a fresh round pool of glossy molten vermilion-red wax on thick textured ivory cotton paper. Near-black background, dramatic warm amber rim lighting, thin wisps of smoke.

*Motion*: The brass seal stamp descends firmly and presses down into the molten wax, holds for a beat, then lifts away revealing a crisp embossed geometric monogram. A soft puff of smoke rises, warm light glints across the fresh seal.

**Hash chain (16:9)**: An elegant chain of interlocking translucent glass links floating diagonally through a dark void, each link faintly etched with tiny glowing lines of hexadecimal characters, lit from within by warm ember-orange and soft gold light, volumetric light rays, subtle floating particles, premium fintech aesthetic.

*Motion (loop)*: Pulses of golden light travel from link to link like data flowing through it.
*Motion (break)*: A link in the middle cracks, flashes alarm crimson red, and shatters into glowing glass fragments that drift apart in slow motion, breaking the chain in two.

**Notes → proposal (4:3)**: Scattered handwritten meeting notes on yellow legal paper; toward the right the paper fibers dissolve into glowing ember particles that stream across and reassemble into a crisp, elegantly typeset premium business proposal with a small vermilion wax seal.

**Covers (21:9)**: Abstract flowing silk waves in (ember) ink black, vermilion and amber gold · (ink) midnight navy and indigo liquid glass with iridescent highlights · (dawn) warm cream, pale peach and soft coral · (emerald) deep emerald and black with champagne gold.

**Fountain pen (1:1, transparent)**: Photorealistic studio product photograph of a single luxury fountain pen with its cap removed, ready to write. Glossy deep black precious-resin barrel, polished gold-plated trim rings, a large two-tone 18k gold nib with fine engraved scrollwork. Absolutely no logo, no emblem, no lettering, no brand marks. The pen points diagonally at exactly 45 degrees, nib tip at the lower left. Isolated on a transparent background, no cast shadow.

**Pen reveal (16:9)**: Start: a capped black-and-gold fountain pen floats horizontally in the right half of the frame above the edge of ivory cotton paper, near-black warm background, amber rim light, floating dust motes. End (edit of the start frame): same scene, the cap floats a few centimeters to the left, revealing the engraved gold nib.

*Motion*: Locked-off camera. After a short beat the cap slowly slides straight off to the left along the pen's axis, revealing the gold nib, which catches a glint of warm light. The pen body does not move.
