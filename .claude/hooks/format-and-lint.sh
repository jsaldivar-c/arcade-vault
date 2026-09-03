#!/usr/bin/env bash
# PostToolUse hook: formats/lints the file just written or edited.
set -uo pipefail

payload="$(cat)"

file="$(node -e "
const j = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const f = (j.tool_input && j.tool_input.file_path) || (j.tool_response && j.tool_response.filePath);
if (f) console.log(f);
" <<< "$payload")"

if [ -z "$file" ] || [ ! -f "$file" ]; then
  exit 0
fi

npx --no-install prettier --ignore-unknown --write "$file"

case "$file" in
  *.js | *.jsx | *.mjs | *.cjs | *.ts | *.tsx)
    npx --no-install eslint --fix "$file"
    ;;
esac

exit 0
