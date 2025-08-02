#!/bin/bash

# Script to replace console.log/info/debug with logger

echo "Converting console statements to logger..."

# Find all TypeScript/TSX files with console statements
files=$(find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "console\.\(log\|info\|debug\)" | grep -v "logger.ts")

total=$(echo "$files" | wc -l | tr -d ' ')
echo "Found $total files with console statements to fix"

fixed=0
for file in $files; do
    # Skip if file already imports logger
    if grep -q "import.*logger.*from" "$file"; then
        # Just replace console statements
        sed -i '' \
            -e 's/console\.log(/logger.info(/g' \
            -e 's/console\.info(/logger.info(/g' \
            -e 's/console\.debug(/logger.debug(/g' \
            "$file"
    else
        # Need to add logger import first
        # Calculate relative path to utils/logger
        dir=$(dirname "$file")
        # Count how many directories deep we are from src
        depth=$(echo "$dir" | tr '/' '\n' | grep -c '^')
        
        # Generate the relative import path
        import_path=""
        if [ "$depth" -eq 1 ]; then
            import_path="./utils/logger"
        elif [ "$depth" -eq 2 ]; then
            import_path="../utils/logger"
        elif [ "$depth" -eq 3 ]; then
            import_path="../../utils/logger"
        else
            import_path="../../../utils/logger"
        fi
        
        # Add import at the top after other imports
        if grep -q "^import" "$file"; then
            # Find the last import line
            last_import_line=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)
            
            # Insert logger import after the last import
            sed -i '' "${last_import_line}a\\
import { logger } from '$import_path';
" "$file"
        else
            # No imports, add at the beginning
            sed -i '' "1i\\
import { logger } from '$import_path';\\

" "$file"
        fi
        
        # Replace console statements
        sed -i '' \
            -e 's/console\.log(/logger.info(/g' \
            -e 's/console\.info(/logger.info(/g' \
            -e 's/console\.debug(/logger.debug(/g' \
            "$file"
    fi
    
    ((fixed++))
    echo "Fixed: $file ($fixed/$total)"
done

echo -e "\n✅ Converted console statements in $fixed files"