# Contributing to Ocean

English | [中文](CONTRIBUTING.zh.md)

Keep contributions focused, reviewable and reproducible. For a substantial feature, discuss the scope in an issue before implementation. A contribution is not a promise of acceptance or a release date.

## Before changing code

Read [AGENTS.md](AGENTS.md), the relevant package documentation and [development setup](docs/development.md). Use a separate branch; do not commit dependencies, build output, profiles, credentials or local execution logs. Back up data before testing migrations.

Prefer a plugin over changes to the agent loop. Preserve historical session fixtures and wire identifiers unless a reviewed migration explicitly changes them. Do not replace dependency names or model-provider identifiers as a branding exercise.

## Pull request checklist

- Explain the user-visible change, related issue and limitations.
- Include a focused regression test and report the exact commands and results, including skipped or failing checks.
- Update the owning documentation and paired translations; avoid duplicate status reports in the repository.
- For UI changes, include screenshots and test keyboard focus, error states and supported themes.
- Review cancellation, resource cleanup, permissions and profile compatibility where relevant.
- Keep unrelated changes separate. Do not disable checks to make the result appear successful.

See the [testing guide](docs/testing.md) for the relevant suites. Run focused tests before requesting review; changes affecting built packages also require the relevant build checks. The verification workflow is configured for pull requests and pushes to main. Check the result for the exact commit; local checks do not prove that hosted CI has run.

## Dependencies and attribution

Declare new dependencies and their licenses. Preserve upstream copyright, license and NOTICE files; record modifications to borrowed code. Update the [generated notices](THIRD_PARTY_NOTICES.md) through their generator, not by deleting required attribution. Changes to distributed non-permissive or proprietary components require a terms review.

AI-assisted contributions follow the same rules: the contributor must understand and review the diff, verify tests and avoid introducing private or unlicensed material. Never invent test results or compatibility claims.

## Reporting problems

Use [Ocean issues](https://github.com/Ryltsevmg/Ocean/issues) for non-sensitive bugs when repository access permits. Include the build identifier, OS, minimal reproduction and redacted diagnostics. For sensitive reports, contact [Ocean support](mailto:support@oceanharness.com) first to arrange a suitable private channel; the [Telegram support bot](https://t.me/oceanchatsupportbot) remains an additional channel. Do not send credentials or private data.

Contributions to MIT-covered code are submitted under the [repository license](LICENSE); separately licensed components retain their own terms. No additional CLA is specified here. Follow the [brand guidelines](docs/brand-guidelines.md), and do not imply endorsement by another project.
