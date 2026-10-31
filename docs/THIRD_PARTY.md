# Third-party code and license review

Stage 1 and Stage 2 reviewed these projects before implementation. No source code, protocol implementation or assets were copied from them. Stage 2 records revisions, source study and design mapping in [REFERENCE_IMPLEMENTATION_MAP.md](REFERENCE_IMPLEMENTATION_MAP.md).

| Project | File reviewed | License found | Stage 1 use |
| --- | --- | --- | --- |
| [BitChat Android](https://github.com/permissionlesstech/bitchat-android) | Root LICENSE.md inspected in Stage 1 at main; Stage 2 source study pinned to `010789adde3d7d93b6f08f9b72e6d9a00e8fbe9d` | GNU General Public License v3.0 (GPL-3.0); README's public-domain statement does not replace the repository license | Read bounded relay, deduplication and BLE test guidance; no code reused |
| [ResQMesh](https://github.com/jangkayl/ResQMesh) | Root file listing and README on main, 2026-10-31 snapshot; commit history did not expose a full immutable revision during research | No root LICENSE, LICENSE.md or COPYING was present; no grant could be verified | Read GATT, SOS, custody lifecycle and reported delivery limitations; no code reused |
| [Knit](https://github.com/getknit/knit) | Root COPYING inspected in Stage 1 at main; Stage 2 source study pinned to `e2c89579eb131de046fb2bc07fb7718d5cc9d598` | GNU General Public License v3.0; README also says GPL-3.0-or-later | Read transport seam, router and store-and-forward architecture; no code reused |

The source for any future reuse must be tied to an exact commit and file, with its license reviewed at that revision. Do not rely on a README statement when the repository's exact license file is available. ResQMesh code remains excluded unless its maintainers provide a license grant. Its revision pin is an unresolved research limit; no derived code was used.
