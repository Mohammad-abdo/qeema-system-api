#!/bin/bash

# Production Server Resource Monitoring Script
# For Ubuntu/Debian servers running the Next.js app

echo "==================================="
echo "Production Resource Monitor"
echo "==================================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "⚠️  Running as root. Consider running as regular user."
   echo ""
fi

# Configuration
INTERVAL=3  # seconds between checks
LOG_FILE="resource-monitor-$(date +%Y%m%d-%H%M%S).log"

echo "Configuration:"
echo "  Check Interval: ${INTERVAL}s"
echo "  Log File: $LOG_FILE"
echo ""
echo "Press Ctrl+C to stop and view summary"
echo ""

# Initialize counters
SAMPLE_COUNT=0
START_TIME=$(date +%s)

# Arrays to store measurements (for systems with bash 4+)
declare -a MEM_SAMPLES
declare -a CPU_SAMPLES

# Trap Ctrl+C to show summary
trap 'show_summary; exit 0' INT TERM

show_summary() {
    echo ""
    echo "==================================="
    echo "MONITORING SUMMARY"
    echo "==================================="
    echo ""
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    echo "Samples Collected: $SAMPLE_COUNT"
    echo "Duration: ${DURATION}s ($(($DURATION / 60)) minutes)"
    echo ""
    echo "Detailed log saved to: $LOG_FILE"
    echo ""
    
    if [ ${#MEM_SAMPLES[@]} -gt 0 ]; then
        # Calculate average memory
        MEM_SUM=0
        for mem in "${MEM_SAMPLES[@]}"; do
            MEM_SUM=$((MEM_SUM + mem))
        done
        MEM_AVG=$((MEM_SUM / ${#MEM_SAMPLES[@]}))
        
        echo "Memory Usage:"
        echo "  Average: ${MEM_AVG} MB"
        echo "  First: ${MEM_SAMPLES[0]} MB"
        echo "  Last: ${MEM_SAMPLES[-1]} MB"
        
        MEM_GROWTH=$((${MEM_SAMPLES[-1]} - ${MEM_SAMPLES[0]}))
        echo "  Growth: ${MEM_GROWTH} MB"
        
        if [ $MEM_GROWTH -lt 20 ]; then
            echo "  ✅ Memory is STABLE"
        elif [ $MEM_GROWTH -lt 50 ]; then
            echo "  ⚠️  Moderate memory growth"
        else
            echo "  ❌ Significant memory growth - investigate"
        fi
    fi
    
    echo ""
    echo "Review the log file for detailed metrics:"
    echo "  cat $LOG_FILE"
    echo ""
}

# Start monitoring
echo "Starting monitoring..."
echo "Timestamp,Memory_MB,CPU_Percent,Node_Processes,Swap_MB" | tee -a "$LOG_FILE"
echo ""

while true; do
    SAMPLE_COUNT=$((SAMPLE_COUNT + 1))
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Get memory usage (in MB)
    MEM_USED=$(free -m | grep "Mem:" | awk '{print $3}')
    SWAP_USED=$(free -m | grep "Swap:" | awk '{print $3}')
    
    # Get CPU usage
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
    
    # Count node processes
    NODE_PROCESSES=$(pgrep -c node || echo "0")
    
    # Store samples
    MEM_SAMPLES+=($MEM_USED)
    
    # Determine status indicators
    MEM_STATUS="✓"
    if [ "$MEM_USED" -gt 1000 ]; then
        MEM_STATUS="⚠️ "
    fi
    if [ "$MEM_USED" -gt 2000 ]; then
        MEM_STATUS="❌"
    fi
    
    CPU_STATUS="✓"
    CPU_INT=${CPU_USAGE%.*}
    if [ "$CPU_INT" -gt 50 ]; then
        CPU_STATUS="⚠️ "
    fi
    if [ "$CPU_INT" -gt 80 ]; then
        CPU_STATUS="❌"
    fi
    
    PROC_STATUS="✓"
    if [ "$NODE_PROCESSES" -gt 5 ]; then
        PROC_STATUS="⚠️ "
    fi
    if [ "$NODE_PROCESSES" -gt 10 ]; then
        PROC_STATUS="❌"
    fi
    
    # Display current status
    clear
    echo "=== Production Monitor - Sample #$SAMPLE_COUNT ==="
    echo "Time: $TIMESTAMP"
    echo ""
    echo "${MEM_STATUS} Memory: ${MEM_USED} MB (Swap: ${SWAP_USED} MB)"
    echo "${CPU_STATUS} CPU: ${CPU_USAGE}%"
    echo "${PROC_STATUS} Node Processes: $NODE_PROCESSES"
    echo ""
    echo "Expected After Fixes:"
    echo "  ✓ Memory stable or slight growth"
    echo "  ✓ CPU low when idle (<10%)"
    echo "  ✓ Process count constant (1-4)"
    echo ""
    
    # Check for issues
    if [ "$MEM_USED" -gt 1500 ]; then
        echo "⚠️  HIGH MEMORY USAGE DETECTED"
    fi
    
    if [ "$CPU_INT" -gt 50 ]; then
        echo "⚠️  HIGH CPU USAGE DETECTED"
        echo "   Top processes:"
        ps aux --sort=-%cpu | head -6
    fi
    
    if [ "$NODE_PROCESSES" -gt 5 ]; then
        echo "⚠️  MANY NODE PROCESSES DETECTED"
        echo "   Node processes:"
        ps aux | grep node | grep -v grep | head -5
    fi
    
    echo ""
    echo "Press Ctrl+C for summary | Logging to: $LOG_FILE"
    
    # Log to file
    echo "$TIMESTAMP,$MEM_USED,$CPU_USAGE,$NODE_PROCESSES,$SWAP_USED" >> "$LOG_FILE"
    
    sleep $INTERVAL
done
