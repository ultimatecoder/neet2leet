## Delegation
For mechanical, single-file, fully-specified edits (boilerplate, test
scaffolds, docstrings, renames, commit messages), delegate via:
  qwen-do "<precise spec including file path and exact change>" < /dev/null
Always close stdin with `< /dev/null`: a run without it hung for 5+ min
with no output; the same call with stdin closed completed. Expect ~1 min
even for trivial tasks (local qwen3.5-9b via Ollama), so set the Bash
timeout to at least 300000 ms. macOS has no `timeout` command.
Then review the diff. Do not delegate architecture, concurrency,
security-sensitive code, or anything requiring cross-file reasoning.
