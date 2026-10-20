$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
Copy-Item .env apps/api/.env -Force
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $parts = $_.Split('=', 2)
  Set-Item -Path "Env:$($parts[0].Trim())" -Value $parts[1].Trim()
}
docker compose up -d postgres redis mailpit
npm install
npm run build -w @vmp/shared
npm run prisma:generate -w @vmp/api
npm run prisma:migrate -w @vmp/api
Push-Location apps/api
npx prisma db execute --url $env:MIGRATE_DATABASE_URL --file prisma/sql/grants.sql
Pop-Location
npm run db:seed
Write-Output "Ready. Start the API with npm run dev:api and the web app with npm run dev:web"
