# Windows tool pitfalls

True of Claude Code on this machine: Windows 11, Git Bash, PowerShell 7.

- **Scripts with backslashes go in a file.** The Bash tool collapses `\\` to
  `\` anywhere in the command text, even inside single quotes or a quoted
  `<<'EOF'` heredoc, which silently changes regexes, Windows paths and escapes.
  Write the script to the scratchpad with the Write tool and run the file. That
  binds an orchestrator as much as its subagents.
- **Quoting across shells.** Run PowerShell with the PowerShell tool, never
  `pwsh -Command` from Bash: `$` and `\` in a regex get eaten on the way in,
  on top of the collapse above.
- **Commit messages:** write the message to a file and use `git commit -F
  <file>`. It works in every shell; multi-line `-m` with quotes and piped
  `-F -` both break in some of them.
- **Line endings.** The repo is LF (`.gitattributes`), but Python text-mode
  writes produce CRLF, and a Node script that splits on `\n` leaves `\r` behind
  in a CRLF file. The Edit tool keeps a file's endings. Check a file with
  `git ls-files --eol <file>` (`w/crlf` is wrong here).
- **Scripted edits that slice between markers** eat the rest of the file when a
  marker is missing (`indexOf` returns -1). Check `git diff --stat` for a line
  count that dropped. In JS, `replace` and `replaceAll` read `$&`, `` $` ``,
  `$'` and `$$` in a string replacement: pass `() => b`, or use
  `s.split(a).join(b)` (which replaces every match).
- **Paths.** Git Bash rewrites any argument, `--opt=` value or env var value
  that starts with a single `/`, whether or not the path exists: `/c/…` becomes
  `C:/…`, and `/dev/spine` becomes `C:/Program Files/Git/dev/spine`. A path
  inside a larger string, like a `node -e` script, is left alone, and Node on
  drive D: then reads `/c/…` as `D:\c\…`. Use `C:/…` in scripts, and prefix
  `MSYS_NO_PATHCONV=1` to keep an argument as typed.
- **PowerShell names.** `diff` is an alias for `Compare-Object`, and variable
  names ignore case (`$A` is `$a`).
