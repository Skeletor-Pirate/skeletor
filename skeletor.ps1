$dir = $PSScriptRoot
if (Test-Path "$dir\dist\index.js") {
  & node "$dir\dist\index.js" @args
} else {
  & npx --yes tsx "$dir\src\index.ts" @args
}
