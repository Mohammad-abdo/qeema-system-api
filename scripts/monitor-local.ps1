# Monitor Next.js Dev Server Resources
# This script monitors CPU and memory usage of your local dev server

param(
    [int]$IntervalSeconds = 2,
    [int]$DurationMinutes = 0  # 0 = run indefinitely
)

$processName = "node"
$startTime = Get-Date
$measurements = @()

Write-Host "=== Next.js Dev Server Resource Monitor ===" -ForegroundColor Cyan
Write-Host "Process: $processName" -ForegroundColor Gray
Write-Host "Interval: $IntervalSeconds seconds" -ForegroundColor Gray
if ($DurationMinutes -gt 0) {
    Write-Host "Duration: $DurationMinutes minutes" -ForegroundColor Gray
} else {
    Write-Host "Duration: Indefinite (press Ctrl+C to stop)" -ForegroundColor Gray
}
Write-Host ""
Write-Host "Started at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow
Write-Host "=" * 60
Write-Host ""

function Format-Bytes {
    param([long]$bytes)
    
    if ($bytes -ge 1GB) {
        return "{0:N2} GB" -f ($bytes / 1GB)
    }
    elseif ($bytes -ge 1MB) {
        return "{0:N2} MB" -f ($bytes / 1MB)
    }
    elseif ($bytes -ge 1KB) {
        return "{0:N2} KB" -f ($bytes / 1KB)
    }
    else {
        return "$bytes B"
    }
}

$iteration = 0

while ($true) {
    $iteration++
    $currentTime = Get-Date
    $elapsed = ($currentTime - $startTime).TotalMinutes
    
    # Check if we should stop
    if ($DurationMinutes -gt 0 -and $elapsed -ge $DurationMinutes) {
        break
    }
    
    $processes = Get-Process -Name $processName -ErrorAction SilentlyContinue
    
    if ($processes) {
        $totalCPU = 0
        $totalMemoryBytes = 0
        $processCount = 0
        
        foreach ($proc in $processes) {
            if ($proc.WorkingSet64 -gt 0) {
                $totalCPU += $proc.CPU
                $totalMemoryBytes += $proc.WorkingSet64
                $processCount++
            }
        }
        
        $memoryMB = $totalMemoryBytes / 1MB
        
        # Store measurement
        $measurements += [PSCustomObject]@{
            Time = $currentTime
            ProcessCount = $processCount
            MemoryMB = $memoryMB
            CPUSeconds = $totalCPU
        }
        
        # Calculate trend (if we have enough data)
        $trend = ""
        if ($measurements.Count -gt 5) {
            $recent = $measurements[-5..-1]
            $avgRecent = ($recent | Measure-Object -Property MemoryMB -Average).Average
            $avgOld = ($measurements[0..4] | Measure-Object -Property MemoryMB -Average).Average
            
            if ($avgRecent -gt $avgOld * 1.1) {
                $trend = "📈 INCREASING"
                $trendColor = "Red"
            }
            elseif ($avgRecent -lt $avgOld * 0.9) {
                $trend = "📉 DECREASING"
                $trendColor = "Green"
            }
            else {
                $trend = "➡️  STABLE"
                $trendColor = "Green"
            }
        }
        
        Clear-Host
        Write-Host "=== Next.js Dev Server Monitor ===" -ForegroundColor Cyan
        Write-Host ("Sample #{0} | Elapsed: {1:N1} min | {2}" -f $iteration, $elapsed, (Get-Date -Format "HH:mm:ss")) -ForegroundColor Gray
        Write-Host ""
        
        Write-Host ("🔢 Processes: {0}" -f $processCount) -ForegroundColor White
        
        $memColor = if ($memoryMB -gt 500) { "Red" } elseif ($memoryMB -gt 300) { "Yellow" } else { "Green" }
        Write-Host ("💾 Memory: {0:N2} MB" -f $memoryMB) -ForegroundColor $memColor
        
        Write-Host ("⏱️  CPU Time: {0:N2}s" -f $totalCPU) -ForegroundColor White
        
        if ($trend) {
            Write-Host ("📊 Trend: {0}" -f $trend) -ForegroundColor $trendColor
        }
        
        Write-Host ""
        Write-Host "Expected After Fixes:" -ForegroundColor Yellow
        Write-Host "  ✓ Memory stable or slight growth only" -ForegroundColor Gray
        Write-Host "  ✓ No continuous CPU usage when idle" -ForegroundColor Gray
        Write-Host "  ✓ Process count stays constant" -ForegroundColor Gray
        
        # Warning checks
        Write-Host ""
        if ($memoryMB -gt 500) {
            Write-Host "⚠️  WARNING: High memory usage detected!" -ForegroundColor Red
        }
        
        if ($processCount -gt 5) {
            Write-Host "⚠️  WARNING: Many Node processes running!" -ForegroundColor Red
        }
        
        # Show recent history
        if ($measurements.Count -gt 1) {
            Write-Host ""
            Write-Host "Recent History (last 5 samples):" -ForegroundColor Cyan
            $recentSamples = $measurements[-5..-1]
            foreach ($sample in $recentSamples) {
                $sampleTime = $sample.Time.ToString("HH:mm:ss")
                Write-Host ("  {0} | {1:N2} MB | {2} processes" -f $sampleTime, $sample.MemoryMB, $sample.ProcessCount) -ForegroundColor Gray
            }
        }
        
        Write-Host ""
        Write-Host "Press Ctrl+C to stop and generate report" -ForegroundColor DarkGray
    }
    else {
        Clear-Host
        Write-Host "❌ Node.js process not found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Is your dev server running? Try:" -ForegroundColor Yellow
        Write-Host "  npm run dev" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Waiting for process..." -ForegroundColor Gray
    }
    
    Start-Sleep -Seconds $IntervalSeconds
}

# Generate summary report
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "MONITORING SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

if ($measurements.Count -gt 0) {
    $stats = $measurements | Measure-Object -Property MemoryMB -Average -Minimum -Maximum
    
    Write-Host ("Total Samples: {0}" -f $measurements.Count) -ForegroundColor White
    Write-Host ("Duration: {0:N1} minutes" -f $elapsed) -ForegroundColor White
    Write-Host ""
    Write-Host "Memory Statistics:" -ForegroundColor Yellow
    Write-Host ("  Average: {0:N2} MB" -f $stats.Average) -ForegroundColor Gray
    Write-Host ("  Minimum: {0:N2} MB" -f $stats.Minimum) -ForegroundColor Gray
    Write-Host ("  Maximum: {0:N2} MB" -f $stats.Maximum) -ForegroundColor Gray
    Write-Host ("  Range: {0:N2} MB" -f ($stats.Maximum - $stats.Minimum)) -ForegroundColor Gray
    
    $memoryGrowth = $measurements[-1].MemoryMB - $measurements[0].MemoryMB
    $growthColor = if ($memoryGrowth -gt 50) { "Red" } elseif ($memoryGrowth -gt 20) { "Yellow" } else { "Green" }
    Write-Host ("  Growth: {0:N2} MB" -f $memoryGrowth) -ForegroundColor $growthColor
    
    Write-Host ""
    if ($memoryGrowth -lt 20) {
        Write-Host "✅ Memory usage is STABLE - fixes are working!" -ForegroundColor Green
    }
    elseif ($memoryGrowth -lt 50) {
        Write-Host "⚠️  Moderate memory growth - monitor longer" -ForegroundColor Yellow
    }
    else {
        Write-Host "❌ Significant memory growth detected - possible leak" -ForegroundColor Red
    }
    
    # Export to CSV
    $csvPath = "resource-monitoring-$(Get-Date -Format 'yyyyMMdd-HHmmss').csv"
    $measurements | Export-Csv -Path $csvPath -NoTypeInformation
    Write-Host ""
    Write-Host ("📊 Detailed data exported to: {0}" -f $csvPath) -ForegroundColor Cyan
}
else {
    Write-Host "No data collected" -ForegroundColor Red
}

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
