#!/usr/bin/env python3
"""
Fix final remaining HTTPExceptions in core modules.
This script targets the last HTTPExceptions that need to be migrated to FynloException.
"""

import os
import re
from typing import List, Tuple
from pathlib import Path

# Define the replacements for each file
REPLACEMENTS = {
    "app/core/tenant_security.py": [
        # Line 92-95: User has no restaurant assigned
        (
            r"raise HTTPException\(\s*status_code=status\.HTTP_403_FORBIDDEN,\s*detail=f?[\"']Access denied: User has no restaurant assigned[\"']\s*\)",
            "raise AuthenticationException(message='Access denied', code='ACCESS_DENIED')"
        ),
        # Line 108-111: Cross-tenant access attempt
        (
            r"raise HTTPException\(\s*status_code=status\.HTTP_403_FORBIDDEN,\s*detail=f[\"']Access denied: You can only \{operation\} data from your own restaurant[\"']\s*\)",
            "raise AuthenticationException(message='Access denied', code='ACCESS_DENIED')"
        ),
        # Line 184-187: Cross-restaurant operations
        (
            r"raise HTTPException\(\s*status_code=status\.HTTP_403_FORBIDDEN,\s*detail=f[\"']Access denied: Only platform owners can \{operation\} data between restaurants[\"']\s*\)",
            "raise AuthenticationException(message='Access denied', code='ACCESS_DENIED')"
        ),
    ],
    "app/core/two_factor_auth.py": [
        # Line 66: 2FA is only for platform owners
        (
            r"raise HTTPException\(status_code=status\.HTTP_403_FORBIDDEN, detail='2FA is only required for platform owners'\)",
            "raise AuthenticationException(message='Access denied', code='ACCESS_DENIED')"
        ),
        # Line 81: 2FA service unavailable
        (
            r"raise HTTPException\(status_code=status\.HTTP_503_SERVICE_UNAVAILABLE, detail='2FA service unavailable'\)",
            "raise FynloException(message='Service temporarily unavailable', code='SERVICE_UNAVAILABLE')"
        ),
        # Line 140: Invalid 2FA token
        (
            r"raise HTTPException\(status_code=status\.HTTP_401_UNAUTHORIZED, detail='Invalid 2FA token'\)",
            "raise AuthenticationException(message='Authentication failed', code='AUTHENTICATION_FAILED')"
        ),
        # Line 152: Invalid 2FA token (second occurrence)
        (
            r"raise HTTPException\(status_code=status\.HTTP_401_UNAUTHORIZED, detail='Invalid 2FA token'\)",
            "raise AuthenticationException(message='Authentication failed', code='AUTHENTICATION_FAILED')"
        ),
        # Line 154: 2FA service unavailable (second occurrence)
        (
            r"raise HTTPException\(status_code=status\.HTTP_503_SERVICE_UNAVAILABLE, detail='2FA service unavailable'\)",
            "raise FynloException(message='Service temporarily unavailable', code='SERVICE_UNAVAILABLE')"
        ),
    ],
    "app/core/auth.py": [
        # Remove the HTTPException import - it's imported but only caught, not raised
        (
            r"from fastapi import Depends, HTTPException, Header, Request",
            "from fastapi import Depends, Header, Request"
        ),
        # Remove HTTPException catch blocks - they're redundant now
        (
            r"    except HTTPException:\s*\n\s*raise",
            ""
        ),
        (
            r"    except HTTPException:\s*\n\s*return None",
            "    except (AuthenticationException, ValidationException, FynloException):\n        return None"
        ),
    ],
    "app/core/dependencies.py": [
        # Import the required exception and remove HTTPException import
        (
            r"from app.core.exceptions import AuthenticationException",
            "from app.core.exceptions import AuthenticationException, ResourceNotFoundException, FynloException"
        ),
        # Also need to add missing imports at top
        (
            r"from typing import Optional, Any\n",
            "from typing import Optional, Any\nfrom fastapi import Query, Depends, HTTPException\n"
        ),
        # Line 73-76: Resource not found
        (
            r"raise HTTPException\(\s*status_code=404,\s*detail=f\"\{resource_model\.__name__\} not found\"\s*\)",
            "raise ResourceNotFoundException(message=f'{resource_model.__name__} not found', resource_type=resource_model.__name__)"
        ),
        # Line 122-125: Cross-restaurant access
        (
            r"raise HTTPException\(\s*status_code=403,\s*detail=\"You can only access your own restaurant's data\"\s*\)",
            "raise AuthenticationException(message='Access denied', code='ACCESS_DENIED')"
        ),
    ],
    "app/core/production_guard.py": [
        # We need to check this file too as mentioned in the report
        # Let's add it to our check list
    ]
}

# Add the necessary imports for each file
FILE_IMPORTS = {
    "app/core/tenant_security.py": [
        "from app.core.exceptions import AuthenticationException, FynloException",
        "# Remove HTTPException import from fastapi"
    ],
    "app/core/two_factor_auth.py": [
        "from app.core.exceptions import AuthenticationException, FynloException",
        "# Remove HTTPException import from fastapi"
    ],
    "app/core/auth.py": [
        "# HTTPException import already being removed in replacements"
    ],
    "app/core/dependencies.py": [
        "# Imports already handled in replacements"
    ]
}

def fix_file(file_path: str, replacements: List[Tuple[str, str]], imports_to_add: List[str]) -> int:
    """Fix HTTPExceptions in a single file."""
    full_path = Path("/Users/ryandavidson/Desktop/cashapp-fynlo-main/backend") / file_path
    
    if not full_path.exists():
        print(f"❌ File not found: {full_path}")
        return 0
    
    with open(full_path, 'r') as f:
        content = f.read()
    
    original_content = content
    changes = 0
    
    # First, handle imports
    if imports_to_add:
        for import_instruction in imports_to_add:
            if import_instruction.startswith("# Remove"):
                # Remove HTTPException import
                content = re.sub(
                    r"from fastapi import ([^,\n]+, )?HTTPException(, [^,\n]+)?",
                    lambda m: f"from fastapi import {m.group(1) or ''}{m.group(2)[2:] if m.group(2) else ''}".strip().rstrip(','),
                    content
                )
                # Clean up any double commas or trailing commas
                content = re.sub(r"from fastapi import\s*,", "from fastapi import", content)
                content = re.sub(r",\s*,", ",", content)
                content = re.sub(r",\s*\n", "\n", content)
            elif not import_instruction.startswith("#"):
                # Add new import after existing imports
                if import_instruction not in content:
                    # Find the last import statement
                    import_pattern = r"((?:from|import)\s+[^\n]+\n)+"
                    match = re.search(import_pattern, content)
                    if match:
                        end_pos = match.end()
                        content = content[:end_pos] + import_instruction + "\n" + content[end_pos:]
                        changes += 1
    
    # Apply replacements
    for pattern, replacement in replacements:
        if pattern.strip():  # Skip empty patterns
            new_content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
            if new_content != content:
                changes += 1
                content = new_content
    
    # Write back if changed
    if content != original_content:
        with open(full_path, 'w') as f:
            f.write(content)
        print(f"✅ Fixed {changes} issues in {file_path}")
        return changes
    else:
        print(f"ℹ️  No changes needed in {file_path}")
        return 0

def main():
    """Main function to fix all remaining HTTPExceptions."""
    print("🔧 Fixing final HTTPExceptions in core modules...")
    print("=" * 60)
    
    total_changes = 0
    
    # First, let's check production_guard.py
    prod_guard_path = Path("/Users/ryandavidson/Desktop/cashapp-fynlo-main/backend/app/core/production_guard.py")
    if prod_guard_path.exists():
        print("\n📄 Checking production_guard.py...")
        with open(prod_guard_path, 'r') as f:
            content = f.read()
        
        # Check for HTTPException usage
        http_exceptions = re.findall(r'raise HTTPException.*', content)
        if http_exceptions:
            print(f"Found {len(http_exceptions)} HTTPExceptions in production_guard.py")
            # Add replacements for production_guard.py
            REPLACEMENTS["app/core/production_guard.py"] = []
            for exc in http_exceptions:
                if "403" in exc or "forbidden" in exc.lower():
                    REPLACEMENTS["app/core/production_guard.py"].append(
                        (re.escape(exc), "raise AuthenticationException(message='Access denied', code='ACCESS_DENIED')")
                    )
                elif "404" in exc:
                    REPLACEMENTS["app/core/production_guard.py"].append(
                        (re.escape(exc), "raise ResourceNotFoundException(message='Resource not found', resource_type='Resource')")
                    )
                else:
                    REPLACEMENTS["app/core/production_guard.py"].append(
                        (re.escape(exc), "raise FynloException(message='Operation not allowed', code='OPERATION_NOT_ALLOWED')")
                    )
            
            FILE_IMPORTS["app/core/production_guard.py"] = [
                "from app.core.exceptions import AuthenticationException, FynloException, ResourceNotFoundException"
            ]
    
    # Process each file
    for file_path, replacements in REPLACEMENTS.items():
        if replacements:  # Only process files with replacements
            imports = FILE_IMPORTS.get(file_path, [])
            changes = fix_file(file_path, replacements, imports)
            total_changes += changes
    
    print("\n" + "=" * 60)
    print(f"✅ Total changes made: {total_changes}")
    
    # Final check for any remaining HTTPExceptions
    print("\n🔍 Scanning for any remaining HTTPExceptions...")
    remaining = []
    
    for file_path in REPLACEMENTS.keys():
        full_path = Path("/Users/ryandavidson/Desktop/cashapp-fynlo-main/backend") / file_path
        if full_path.exists():
            with open(full_path, 'r') as f:
                content = f.read()
            
            # Check for HTTPException usage (excluding imports and except blocks)
            matches = re.findall(r'raise HTTPException.*', content)
            if matches:
                remaining.append((file_path, len(matches)))
    
    if remaining:
        print("\n⚠️  Still found HTTPExceptions in:")
        for file_path, count in remaining:
            print(f"  - {file_path}: {count} instances")
    else:
        print("✅ No HTTPExceptions found in core modules!")

if __name__ == "__main__":
    main()