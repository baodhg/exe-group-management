param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('Identity', 'Group', 'JoinRequest')]
    [string] $Service,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $EfArguments
)

$ErrorActionPreference = 'Stop'
$folders = @{ Identity = 'IdentityService'; Group = 'GroupService'; JoinRequest = 'JoinRequestService' }
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    dotnet tool restore | Out-Null
    $extra = @()
    if ($EfArguments.Count -ge 2 -and $EfArguments[0] -eq 'migrations' -and $EfArguments[1] -eq 'add') {
        $extra = @('--output-dir', 'Data/Migrations')
    }

    $folder = $folders[$Service]
    dotnet tool run dotnet-ef @EfArguments `
        --project "src/$folder/ExeGroup.$Service.Repositories" `
        --startup-project "src/$folder/ExeGroup.$Service.API" `
        @extra
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Pop-Location
}
