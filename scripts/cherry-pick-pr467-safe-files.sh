#!/bin/bash

# Cherry-pick safe files from PR #467 in batches
# This script applies non-conflicting changes from fix/eslint-imports-remaining

# Don't exit on error - we want to continue even if some files fail
# set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counters
SUCCESS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

# Function to cherry-pick a file
cherry_pick_file() {
    local file="$1"
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    
    if git checkout fix/eslint-imports-remaining -- "$file" 2>/dev/null; then
        echo -e "${GREEN}✓ Cherry-picked: $file${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        return 0
    else
        echo -e "${RED}✗ Failed: $file${NC}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        return 1
    fi
}

# Function to commit batch
commit_batch() {
    local batch_name="$1"
    local file_count=$(git status --porcelain | wc -l)
    
    if [ $file_count -gt 0 ]; then
        echo -e "\n${YELLOW}Committing batch: $batch_name ($file_count files)${NC}"
        git add .
        git commit -m "chore: cherry-pick $batch_name from PR #467

Cherry-picked non-conflicting changes from fix/eslint-imports-remaining
Part of ESLint import order fixes"
        echo -e "${GREEN}✓ Committed $batch_name${NC}\n"
    else
        echo -e "${YELLOW}No changes to commit for $batch_name${NC}\n"
    fi
}

echo "Starting cherry-pick process from PR #467..."
echo "Source branch: fix/eslint-imports-remaining"
echo "Target branch: $(git branch --show-current)"
echo ""

# Batch 1: ESLint and Prettier configs
echo -e "${YELLOW}=== Batch 1: ESLint and Prettier Configuration ===${NC}"
cherry_pick_file "CashApp-iOS/CashAppPOS/.eslintrc.js"
cherry_pick_file "CashApp-iOS/CashAppPOS/.prettierrc.json"
cherry_pick_file ".pre-commit-config.yaml"
cherry_pick_file "backend/.mcp-python-linting.json"
commit_batch "ESLint and Prettier configuration"

# Batch 2: TypeScript configs
echo -e "${YELLOW}=== Batch 2: TypeScript Configuration ===${NC}"
cherry_pick_file "CashApp-iOS/CashAppPOS/tsconfig.json"
cherry_pick_file ".typescript-strict-migration.md"
commit_batch "TypeScript configuration"

# Batch 3: Documentation and MD files
echo -e "${YELLOW}=== Batch 3: Documentation Files ===${NC}"
for file in $(grep -E "\.md$" /Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/scripts/pr467-safe-files.txt | head -20); do
    cherry_pick_file "$file"
done
commit_batch "documentation files"

# Batch 4: Agent files
echo -e "${YELLOW}=== Batch 4: Claude Agent Files ===${NC}"
for file in $(grep "^\.claude/agents/" /Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/scripts/pr467-safe-files.txt); do
    cherry_pick_file "$file"
done
commit_batch "Claude agent files"

# Batch 5: Scripts and automation
echo -e "${YELLOW}=== Batch 5: Scripts and Automation ===${NC}"
for file in $(grep -E "\.(sh|js|py)$" /Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/scripts/pr467-safe-files.txt | grep -E "(scripts/|test_|check_|fix_)" | head -30); do
    cherry_pick_file "$file"
done
commit_batch "scripts and automation files"

# Batch 6: Test files
echo -e "${YELLOW}=== Batch 6: Test Files ===${NC}"
for file in $(grep -E "(test|spec)\.(ts|tsx|js|py)$" /Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/scripts/pr467-safe-files.txt | head -30); do
    cherry_pick_file "$file"
done
commit_batch "test files"

# Batch 7: JSON config files
echo -e "${YELLOW}=== Batch 7: JSON Configuration ===${NC}"
for file in $(grep "\.json$" /Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/scripts/pr467-safe-files.txt | head -20); do
    cherry_pick_file "$file"
done
commit_batch "JSON configuration files"

# Batch 8: Service files
echo -e "${YELLOW}=== Batch 8: Service Files ===${NC}"
for file in $(grep -E "Service\.(ts|tsx)$" /Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/scripts/pr467-safe-files.txt | head -20); do
    cherry_pick_file "$file"
done
commit_batch "service files"

# Batch 9: Component files
echo -e "${YELLOW}=== Batch 9: Component Files ===${NC}"
for file in $(grep -E "components/.*\.(tsx|ts)$" /Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/scripts/pr467-safe-files.txt | head -20); do
    cherry_pick_file "$file"
done
commit_batch "component files"

# Batch 10: Remaining files in smaller chunks
echo -e "${YELLOW}=== Batch 10+: Remaining Files ===${NC}"
BATCH_NUM=10
BATCH_SIZE=20
CURRENT_BATCH=()

while IFS= read -r file; do
    # Skip if already processed
    if git log --oneline -1 --grep="$file" >/dev/null 2>&1; then
        continue
    fi
    
    CURRENT_BATCH+=("$file")
    
    if [ ${#CURRENT_BATCH[@]} -eq $BATCH_SIZE ]; then
        for f in "${CURRENT_BATCH[@]}"; do
            cherry_pick_file "$f"
        done
        commit_batch "remaining files batch $BATCH_NUM"
        BATCH_NUM=$((BATCH_NUM + 1))
        CURRENT_BATCH=()
    fi
done < /Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/scripts/pr467-safe-files.txt

# Handle any remaining files
if [ ${#CURRENT_BATCH[@]} -gt 0 ]; then
    for f in "${CURRENT_BATCH[@]}"; do
        cherry_pick_file "$f"
    done
    commit_batch "remaining files final batch"
fi

# Final summary
echo -e "\n${YELLOW}=== Cherry-pick Summary ===${NC}"
echo -e "Total files processed: $TOTAL_COUNT"
echo -e "${GREEN}Successfully cherry-picked: $SUCCESS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"

if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "\n${YELLOW}Note: Some files failed to cherry-pick. This might be due to:${NC}"
    echo "- Files being deleted in the source branch"
    echo "- Files already being up-to-date"
    echo "- Unexpected conflicts"
fi

echo -e "\n${GREEN}Cherry-pick process completed!${NC}"
echo "You can now review the changes and push when ready."