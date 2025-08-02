#!/bin/bash

# Targeted cherry-pick script for PR #467
# Only processes files that are actually different between branches

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counters
SUCCESS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

# Get list of files that are both safe AND different
echo "Finding files that are safe to cherry-pick and actually different..."
comm -12 <(sort /Users/arnauddecube/Documents/Fynlo/cashapp-fynlo/scripts/pr467-safe-files.txt) \
         <(git diff --name-only fix/eslint-import-order-v2 fix/eslint-imports-remaining | sort) \
         > /tmp/files-to-cherry-pick.txt

FILE_COUNT=$(wc -l < /tmp/files-to-cherry-pick.txt)
echo -e "${YELLOW}Found $FILE_COUNT files to cherry-pick${NC}\n"

# Function to cherry-pick a single file
cherry_pick_file() {
    local file="$1"
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    
    echo -n "[$TOTAL_COUNT/$FILE_COUNT] Cherry-picking: $file ... "
    
    if git checkout fix/eslint-imports-remaining -- "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        return 0
    else
        echo -e "${RED}✗${NC}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        return 1
    fi
}

# Process files in batches
BATCH_SIZE=25
BATCH_NUM=1
CURRENT_BATCH=0

echo -e "${YELLOW}Starting cherry-pick process...${NC}\n"

while IFS= read -r file; do
    cherry_pick_file "$file"
    CURRENT_BATCH=$((CURRENT_BATCH + 1))
    
    # Commit when batch is full
    if [ $CURRENT_BATCH -eq $BATCH_SIZE ]; then
        echo -e "\n${YELLOW}Committing batch $BATCH_NUM (files $((TOTAL_COUNT - BATCH_SIZE + 1))-$TOTAL_COUNT)${NC}"
        
        if [ $(git status --porcelain | wc -l) -gt 0 ]; then
            git add -A
            git commit -m "chore: cherry-pick batch $BATCH_NUM from PR #467

Cherry-picked $BATCH_SIZE non-conflicting files from fix/eslint-imports-remaining
Progress: $TOTAL_COUNT/$FILE_COUNT files processed"
            echo -e "${GREEN}✓ Committed batch $BATCH_NUM${NC}\n"
        fi
        
        BATCH_NUM=$((BATCH_NUM + 1))
        CURRENT_BATCH=0
    fi
done < /tmp/files-to-cherry-pick.txt

# Commit any remaining files
if [ $(git status --porcelain | wc -l) -gt 0 ]; then
    echo -e "\n${YELLOW}Committing final batch${NC}"
    git add -A
    git commit -m "chore: cherry-pick final batch from PR #467

Cherry-picked remaining non-conflicting files from fix/eslint-imports-remaining
Total: $TOTAL_COUNT files processed"
    echo -e "${GREEN}✓ Committed final batch${NC}"
fi

# Summary
echo -e "\n${YELLOW}=== Cherry-pick Summary ===${NC}"
echo -e "Total files attempted: $TOTAL_COUNT"
echo -e "${GREEN}Successfully cherry-picked: $SUCCESS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo -e "\nProcess completed!"

# Clean up
rm -f /tmp/files-to-cherry-pick.txt