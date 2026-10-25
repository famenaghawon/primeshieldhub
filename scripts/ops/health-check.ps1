cd $PSScriptRoot\..\..
"═══ PrimeShieldHub Repo Health ═══"
""
"── Sync ──"
git fetch -q origin
$local  = git rev-parse HEAD
$remote = git rev-parse origin/main
if ($local -eq $remote) { "✅ local == origin/main ($local)" }
else { "⚠️  local ($local) != origin ($remote)" }

"── Size ──"
git count-objects -vH | Select-String "size-pack"

"── Bloat check ──"
$big = git rev-list --objects --all |
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' |
  Select-String '^blob' | ForEach-Object {
    $p = $_ -split ' ', 4
    if ([int]$p[2] -gt 500000) { "{0,12}  {1}" -f $p[2], $p[3] }
  }
if ($big) { "⚠️  files >500KB in history:"; $big } else { "✅ No blobs >500KB" }

"── Secrets in HEAD ──"
$leaks = git grep -inE 'r8_[A-Za-z0-9]{20,}|sk_live_|sk_test_|FLWSECK[_-]'
if ($leaks) { "⚠️  potential secrets:"; $leaks } else { "✅ No secrets in HEAD" }

"── Dead paths ──"
"nvm/ tracked: " + ((git ls-files | Where-Object { $_ -match '^nvm/' } | Measure-Object).Count)
"*fix*.js in backend: " + ((git ls-files "backend/*fix*.js" | Measure-Object).Count)
"backend/schema.sql: " + ((git ls-files "backend/schema.sql" | Measure-Object).Count)

"── Required files ──"
foreach ($f in 'db/schema.sql', 'README.md', '.env.example', '.gitignore', '.gitattributes') {
  if (Test-Path $f) { "✅ $f" } else { "❌ $f MISSING" }
}
