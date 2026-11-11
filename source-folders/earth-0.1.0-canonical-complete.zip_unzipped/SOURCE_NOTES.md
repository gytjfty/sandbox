# Source and baseline notes

Repository: https://github.com/gytjfty/sandbox

The repository was checked during this consolidation and still contains the four extracted historical source directories. No repository write, commit, tag or deployment was performed.

The immediate consolidation baseline is the repaired complete project and 1080p+ replacement renderer delivered earlier in this conversation. Those source listings are available in the conversation and were reorganized into this complete distribution; this is not a byte-for-byte repack of an old repository archive. The user reported the repaired version working before this cleanup. That report does not certify this new refactor.

The historical comparison was unrestricted-building (recorded as working in commit cfcc28033384ffae9097aba8c5dd67f4d6c295ea) versus material-editor-physics (first broken version). Later recovery patches are not the architectural baseline. The restored cut-only shader, material ledger and limited sphere solver derive from that investigation.

The authoritative-worker proposal was implemented in the preceding repair, not retrospectively claimed to have been part of the original architecture. The current cleanup preserves it and the existing save format. The restored 1080p+ resolution policy is incorporated without automatic downscaling.

Automated fixtures are synthetic. No actual user save or measured GPU report was bundled, altered, or used as proof of compatibility/performance. Read TEST_RESULTS.json and docs/ACCEPTANCE.md for the distinction between verified CPU/mock behavior and outstanding on-device checks.

Repository listing source for this response: [github_mcp_direct:0].
