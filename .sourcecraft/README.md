# SourceCraft release preparation

English | [中文](README.zh.md)

This reference describes the disabled Ocean-Chat CI template. `ci.yaml.example` does not activate a workflow. Its syntax follows the existing Runne SourceCraft configuration; it has not been validated by a SourceCraft run. The official workflow reference is https://sourcecraft.dev/portal/docs/ru/sourcecraft/operations/ci-cd/create-workflow.

## Activation checklist

Confirm the owner namespace, private repository, runner architecture and available quota. Review the template before renaming it to `ci.yaml`. Keep verification and unsigned packaging manual until a successful run establishes the runner dependencies. Run both tasks against the same immutable commit. Retain build logs, artifact hashes and a normal graphical launch report. Container checks do not establish Wayland, tray or desktop-launch readiness. ARM64 needs a matching runner and the existing `package:linux:arm64` command; do not label x64 output as ARM64.

No workflow publishes a release, modifies an update feed or loads signing keys. A checksum detects changed bytes but is not a cryptographic signature. Namespace, signing identity and release endpoint remain unconfigured. SourceCraft CLI authentication must succeed before remote setup; an authorized browser session does not establish CLI access.

## Signing requirements

Linux targets currently produce unsigned archives. Choose a release-signing scheme, trusted public-key distribution and verification procedure before adding signatures. Do not invent a key or treat a checksum as a signature. Keep private keys outside the checkout and provide them only to an isolated protected release runner; untrusted pull requests must never receive release secrets.

macOS requires a macOS runner, Developer ID Application identity, Apple team ID, certificate access and notarization credentials. The existing [macOS template](../apps/desktop/config/macos-packaging/macos-signing.env.example) names the supported inputs. Windows requires a Windows runner, trusted code-signing certificate, SignTool and the configured key container or token. The existing [Windows template](../apps/desktop/config/windows-packaging/windows-signing.env.example) names those inputs. Do not copy either private configuration into Git.

Before enabling publication, review repository permissions, protected release references, manual approval, artifact retention, signing verification and the intended Ocean update endpoint. Existing upstream upload commands are not authorization to publish Ocean artifacts to DeepSeek infrastructure.
