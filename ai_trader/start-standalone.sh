#!/bin/bash
# =============================================================================
# AI Trader - Start Standalone Background Service (Unix/Linux/Mac)
# =============================================================================
# Usage: ./start-standalone.sh [options]
# Options:
#   --help, -h         Show help
#   --simulation, -s   Force simulation mode
#   --interval, -i N   Set decision interval to N minutes
# =============================================================================

set -e

# Parse arguments
SIMULATION=""
INTERVAL=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            echo ""
            echo "AI Trader - Standalone Background Service"
            echo "========================================="
            echo ""
            echo "Usage: ./start-standalone.sh [options]"
            echo ""
            echo "Options:"
            echo "  -h, --help         Show this help message"
            echo "  -s, --simulation   Force simulation mode (no real trades)"
            echo "  -i, --interval N   Set decision interval to N minutes"
            echo ""
            echo "Examples:"
            echo "  ./start-standalone.sh                # Normal start"
            echo "  ./start-standalone.sh -s             # Simulation mode"
            echo "  ./start-standalone.sh -i 5           # 5-minute intervals"
            echo ""
            exit 0
            ;;
        -s|--simulation)
            SIMULATION="true"
            shift
            ;;
        -i|--interval)
            INTERVAL="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                              ║${NC}"
echo -e "${CYAN}║     🤖 AI TRADER - STANDALONE BACKGROUND SERVICE 🤖         ║${NC}"
echo -e "${CYAN}║                                                              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Node.js
echo -e "${YELLOW}Checking prerequisites...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}   ❌ Node.js not found. Please install Node.js first.${NC}"
    echo -e "${YELLOW}   Download: https://nodejs.org/${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}   ✅ Node.js: $NODE_VERSION${NC}"

# Check .env.local
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}   ⚠️  No .env.local found - creating from example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        echo -e "${YELLOW}   📝 Please edit .env.local with your API keys${NC}"
    else
        echo -e "${RED}   ❌ No .env.example found. Please create .env.local manually.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}   ✅ Configuration: .env.local${NC}"
fi

# Set environment variables
export NODE_ENV=production

if [ "$SIMULATION" = "true" ]; then
    export SIMULATION_MODE=true
    echo -e "${YELLOW}   🎮 Mode: SIMULATION (forced)${NC}"
fi

if [ -n "$INTERVAL" ]; then
    export DECISION_INTERVAL_MS=$((INTERVAL * 60 * 1000))
    echo -e "${YELLOW}   ⏱️  Interval: $INTERVAL minutes (override)${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}🚀 Starting AI Trader Background Service...${NC}"
echo "📌 No web browser needed - this runs in the terminal only"
echo -e "${YELLOW}⛔ Press Ctrl+C to stop${NC}"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Change to script directory
cd "$(dirname "$0")"

# Start the standalone service
node standalone/index.js
