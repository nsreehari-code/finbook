# clean_copilot_output.ps1
# Cleans copilot CLI output: filters noise and ensures JSON decision format.
# Called by copilot_wrapper.bat after copilot runs and after logging (raw log preserved).
# Usage: clean_copilot_output.ps1 <output_file>

param([Parameter(Mandatory)][string]$OutputFile)

if (-not (Test-Path $OutputFile)) { exit 0 }

$raw = [IO.File]::ReadAllText($OutputFile, [Text.Encoding]::UTF8)
if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }

# --- Step 1: Filter noise lines ---
$lines = $raw -split "`r?`n" | Where-Object {
    $_ -notmatch "^error: unknown option '--no-warnings'" -and
    $_ -notmatch "^Try 'copilot --help' for more information"
}
$cleaned = ($lines -join "`n").Trim()

# --- Step 1b: Strip copilot-cli tool operation lines ---
# These are internal tool invocations that leak into output:
#   ● Create/Read/Edit/List directory/Glob/Check ...
#   X Read ... (failed tool ops)
#   $ Get-Content/Set-Content ... (PowerShell invocations)
#   └ N lines/files found
#   ├ ... (tree lines)
#   "The agent decision has been simulated and saved to ..."
#   session-state file paths
$noiseLines = New-Object System.Collections.Generic.List[string]
$contentLines2 = New-Object System.Collections.Generic.List[string]
foreach ($line in ($cleaned -split "`n")) {
    $t = $line.TrimStart()
    if ($t -match '^[\u25cf\u2022] ' -or           # ● bullet tool ops
        $t -match '^X ' -or                          # X failed tool ops
        $t -match '^\$ ' -or                         # $ shell commands
        $t -match '^[\u2514\u251c]' -or              # └ ├ tree lines
        $t -match 'session-state.*\.json' -or        # session-state file refs
        $t -match 'agent.decision has been simulated' -or
        $t -match 'has been simulated and saved' -or
        $t -match '^\d+ (files?|lines?|matches?) found$' -or  # "3 files found"
        $t -match '^No matches found$' -or
        $t -match '^Path does not exist$' -or
        $t -match '^\d+ lines?( read)?$') {          # "1 line read"
        $noiseLines.Add($line)
    } else {
        $contentLines2.Add($line)
    }
}
$cleaned = ($contentLines2 -join "`n").Trim()

# Write noise to sidecar file for upstream visibility
$NoiseFile = $OutputFile + '.noise'
if ($noiseLines.Count -gt 0) {
    $noiseContent = "STRIPPED_LINES=$($noiseLines.Count)`n" + ($noiseLines -join "`n")
    [IO.File]::WriteAllText($NoiseFile, $noiseContent, [Text.Encoding]::UTF8)
} elseif (Test-Path $NoiseFile) {
    Remove-Item $NoiseFile -Force
}

# --- Step 2: Strip trailing usage stats ---
$statsPrefixes = @('Total usage est:', 'API time spent:', 'Total session time:',
                    'Total code changes:', 'Breakdown by AI model:', 'Session:')
$resultLines = New-Object System.Collections.Generic.List[string]
$hitStats = $false
foreach ($line in $cleaned -split "`n") {
    if (-not $hitStats) {
        foreach ($sp in $statsPrefixes) {
            if ($line.TrimStart().StartsWith($sp)) { $hitStats = $true; break }
        }
    }
    if (-not $hitStats) { $resultLines.Add($line) }
}
$cleaned = ($resultLines -join "`n").Trim()

if ([string]::IsNullOrWhiteSpace($cleaned)) {
    $json = '{"thought":"Copilot CLI returned empty response","action":"rest"}'
    [IO.File]::WriteAllText($OutputFile, $json, [Text.Encoding]::UTF8)
    exit 0
}

# --- Step 3: Check for existing JSON decision (has "action" key) ---
$foundJson = $null

# 3a: Look in ```json fenced blocks
if ($cleaned -match '(?s)``json\s*(.*?)```') {
    try {
        $obj = $Matches[1].Trim() | ConvertFrom-Json -ErrorAction Stop
        if ($obj.PSObject.Properties['action']) { $foundJson = $Matches[1].Trim() }
    } catch {}
}

# 3b: Scan for bare JSON objects with "action"
if (-not $foundJson) {
    $depth = 0; $start = -1
    for ($i = 0; $i -lt $cleaned.Length; $i++) {
        if ($cleaned[$i] -eq '{') {
            if ($depth -eq 0) { $start = $i }
            $depth++
        } elseif ($cleaned[$i] -eq '}') {
            $depth--
            if ($depth -eq 0 -and $start -ge 0) {
                $candidate = $cleaned.Substring($start, $i - $start + 1)
                try {
                    $obj = $candidate | ConvertFrom-Json -ErrorAction Stop
                    if ($obj.PSObject.Properties['action']) {
                        $foundJson = $candidate
                        break
                    }
                } catch {}
                $start = -1
            }
        }
    }
}

if ($foundJson) {
    # Write only the extracted JSON decision
    [IO.File]::WriteAllText($OutputFile, $foundJson, [Text.Encoding]::UTF8)
} else {
    # No JSON decision found — do NOT post raw output as a message.
    # Default to rest so the agent stays quiet rather than leaking tool noise.
    # Record the raw output in noise file so it's visible in agent logs.
    $NoiseFile = $OutputFile + '.noise'
    $fallbackNoise = "FALLBACK=no_json_decision`nRAW_LENGTH=$($cleaned.Length)`n---`n$cleaned"
    if (Test-Path $NoiseFile) {
        $existing = [IO.File]::ReadAllText($NoiseFile, [Text.Encoding]::UTF8)
        [IO.File]::WriteAllText($NoiseFile, "$existing`n$fallbackNoise", [Text.Encoding]::UTF8)
    } else {
        [IO.File]::WriteAllText($NoiseFile, $fallbackNoise, [Text.Encoding]::UTF8)
    }
    $decision = [ordered]@{
        thought = "Copilot CLI did not return a structured decision"
        action  = "rest"
    }
    $json = $decision | ConvertTo-Json -Depth 2 -Compress
    [IO.File]::WriteAllText($OutputFile, $json, [Text.Encoding]::UTF8)
}
