---
description: "Ocean sidebar artwork registered through the client slot system."
kind: "package-reference"
---

# @ocean/ocean-client-ui-brand-official

English | [中文](README.zh.md)

## Summary

This package registers the Ocean sidebar mark and wordmark. Registration does not depend on a build profile. It contributes browser presentation only, with no home-background animation or model requests.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount this plugin in a client composition to occupy `sidebar.brand.mark` and `sidebar.brand.name`. The mark uses `FishLogo`; the name uses `BrandWordmark` with `includeMark={false}` so the independently slotted mark is not repeated. The wordmark renders “Ocean”. The package accepts no artwork configuration and does not read `DSH_CLIENT_BUILD_PROFILE`.

For another identity, omit this package and compose a different package for the sidebar slots. This package does not occupy the conversation hero-mark slot or `conversation.hero.frame`.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The [client entry](src/client/index.ts) installs both occupants through nested `ctx.slots.inject()` calls, so their registrations follow the sidebar declarations. [Brand components](src/client/Brand.tsx) render the shared [mark](../ui-primitives/src/FishLogo.tsx) and [wordmark](../ui-primitives/src/BrandWordmark.tsx). The mark receives its size from the slot owner. Both primitives render decorative SVG; neither starts an animation or registers click handling.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [ui-sidebar](../ui-sidebar/README.md) — declares the two sidebar brand slots and renders their fallbacks.
- [UI primitives](../ui-primitives/README.md) — owns the shared brand components.
- [Web client architecture](../../../docs/subsystems/web-client.md) — client plugin loading and slot registration.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package contributes browser presentation only and adds nothing to model requests.

#### KV Cache effect

None; the package neither assembles nor sends provider requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Alternative sidebar artwork requires another slot occupant package; this package has no identity-selection configuration.
- Home feedback, conversation hero artwork, and the browser title are outside this package's registrations.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
