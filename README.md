# Ocean

English | [中文](README.zh.md)

Ocean is a desktop workspace for AI agents, conversations and tools. Its plugin-based runtime connects model providers, development tools and optional browser or computer controls.

## Developer preview

Ocean is under active development. APIs and features may change. Read the [safety notice](SAFETY.md) before running it; a successful local build is not a security audit or a signed public release.

## Get started

Use this repository: [Ryltsevmg/Ocean](https://github.com/Ryltsevmg/Ocean). Access may be restricted while the public release is prepared. Do not use an upstream installer or an unverified npm package as an Ocean installation method.

For source setup and local Web/Desktop commands, follow the [development guide](docs/development.md). Requirements and command definitions are maintained in [package.json](package.json). Keep a backup of existing profiles before testing a new build.

## Documentation

- [User guide](docs/user/index.md)
- [Architecture](docs/architecture.md)
- [Contributing](CONTRIBUTING.md)
- [Safety](SAFETY.md)
- [Brand guidelines](docs/brand-guidelines.md)

The verification workflow in [GitHub Actions](.github/workflows/) runs on pull requests and pushes to main after this configuration is published. Linux packaging remains manual. Packaging currently produces unsigned artifacts; this is not an automatic update channel.

## Feedback

Report reproducible bugs through [Ocean issues](https://github.com/Ryltsevmg/Ocean/issues), subject to repository access, or contact [Ocean support](mailto:support@oceanharness.com); the [Telegram support bot](https://t.me/oceanchatsupportbot) remains an additional channel. Never post tokens, private session logs or personal data in a public issue.

## License and acknowledgements

[MIT](LICENSE). Source origins, retained copyright notices and dependency terms are documented in [Third-party notices](THIRD_PARTY_NOTICES.md).
