# Third-party code and license review

Stage 1 reviewed the exact repository license files before considering reuse. No source code, protocol implementation or assets were copied from these projects.

| Project | File reviewed | License found | Stage 1 use |
| --- | --- | --- | --- |
| [BitChat Android](https://github.com/permissionlesstech/bitchat-android) | Root LICENSE.md on main | GNU General Public License v3.0 (GPL-3.0); inspected as the full standard GPL-3.0 text | Architecture reading only; no code reused |
| [ResQMesh](https://github.com/jangkayl/ResQMesh) | Current repository root listing on main; no LICENSE, LICENSE.md or COPYING file is present | No repository license grant could be verified | Architecture reading only; no code reused |
| [Knit](https://github.com/getknit/knit) | Root COPYING on main | GNU General Public License v3.0; README states GPL-3.0-or-later | Architecture reading only; no code reused |

The source for any future reuse must be tied to an exact commit and file, with its license reviewed at that revision. Do not rely on a README statement when the repository's exact license file is available. ResQMesh code remains excluded unless its maintainers provide a license grant.
