---
title: "Contributing and support"
description: "Find the source, report a useful issue, and contribute to Inventatory."
---

## Source and license

The [desktop application repository](https://github.com/Kwiatens/Inventatory-Software) contains the C++ source, build instructions, tests, and developer documentation. It is licensed under **GPL-3.0-only**.

The supported build environment uses Visual Studio 2022 with C++ tools and CMake 3.20 or newer. Follow the repository's current instructions when building from source.

## Report a problem

Open an issue in the [official issue tracker](https://github.com/Kwiatens/Inventatory-Software/issues). Include:

- Your application version and relevant Windows/terminal details.
- The page or workflow involved.
- Steps to reproduce, the expected result, and what actually happened.
- A redacted screenshot or error message when useful.

Do not attach credentials, pairing secrets, or an unreviewed inventory database. Reduce data-related failures to a minimal example where possible.

## Contribute

Read the README and relevant developer documentation before changing behavior. Preserve the existing persistence, history, scanner, and keyboard/mouse interaction contracts. The repository includes the supported Release build and test commands.

## Documentation corrections

These public guides are concise adaptations of the application documentation. When reporting an inconsistency, include the guide URL and application version. The source documentation remains the reference for implementation-level behavior.

See the official [releases](https://github.com/Kwiatens/Inventatory-Software/releases) for downloads and version-specific notes.
