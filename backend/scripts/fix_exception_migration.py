#!/usr/bin/env python3
"""
Fix FynloException Migration Issues

This script helps identify and fix incorrect exception usage after the 
HTTPException to FynloException migration.

The main issue is that specialized exception classes (AuthenticationException,
ValidationException, etc.) don't accept a 'code' parameter, but many files
are still trying to pass it.
"""

import os
import re
from pathlib import Path
from typing import List, Tuple, Dict

# Exception patterns to fix
PATTERNS = {
    # AuthenticationException with code parameter
    r'AuthenticationException\s*\(\s*message\s*=\s*[\'"][^\'"]+"?\s*,\s*code\s*=\s*[\'"][^\'"]+"?\s*\)': {
        'class': 'AuthenticationException',
        'fix_type': 'remove_code'
    },
    
    # ValidationException with code parameter
    r'ValidationException\s*\(\s*message\s*=\s*[\'"][^\'"]+"?\s*,\s*code\s*=\s*[\'"][^\'"]+"?\s*\)': {
        'class': 'ValidationException', 
        'fix_type': 'remove_code'
    },
    
    # FynloException with code instead of error_code
    r'FynloException\s*\(\s*message\s*=\s*[\'"][^\'"]+"?\s*,\s*code\s*=\s*[\'"]([^\'"]+"?)\s*\)': {
        'class': 'FynloException',
        'fix_type': 'rename_to_error_code'
    }
}

# Map of custom error codes to appropriate exception classes
ERROR_CODE_MAPPING = {
    'MISSING_AUTH_HEADER': ('AuthenticationException', None),
    'INVALID_TOKEN': ('AuthenticationException', None),
    'AUTHENTICATION_FAILED': ('AuthenticationException', None),
    'ACCESS_DENIED': ('AuthorizationException', None),
    'INACTIVE_USER': ('ValidationException', None),
    'BAD_REQUEST': ('ValidationException', None),
    'SERVICE_UNAVAILABLE': ('FynloException', 'SERVICE_UNAVAILABLE'),
    'OPERATION_NOT_ALLOWED': ('FynloException', 'OPERATION_NOT_ALLOWED'),
}


def find_issues(directory: str) -> Dict[str, List[Tuple[int, str, str]]]:
    """Find all incorrect exception usages in the codebase."""
    issues = {}
    
    for root, dirs, files in os.walk(directory):
        # Skip __pycache__ directories
        dirs[:] = [d for d in dirs if d != '__pycache__']
        
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                file_issues = scan_file(filepath)
                if file_issues:
                    issues[filepath] = file_issues
    
    return issues


def scan_file(filepath: str) -> List[Tuple[int, str, str]]:
    """Scan a single file for exception issues."""
    issues = []
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        for i, line in enumerate(lines):
            for pattern, info in PATTERNS.items():
                if re.search(pattern, line):
                    issues.append((i + 1, line.strip(), info['fix_type']))
                    
    except Exception as e:
        print(f"Error scanning {filepath}: {e}")
        
    return issues


def suggest_fix(line: str, fix_type: str) -> str:
    """Suggest a fix for the incorrect exception usage."""
    if fix_type == 'remove_code':
        # Remove the code parameter
        fixed = re.sub(r',\s*code\s*=\s*[\'"][^\'"]+"?', '', line)
        return fixed
    
    elif fix_type == 'rename_to_error_code':
        # Rename code to error_code
        fixed = re.sub(r'\bcode\s*=', 'error_code=', line)
        return fixed
    
    return line


def generate_report(issues: Dict[str, List[Tuple[int, str, str]]]) -> None:
    """Generate a report of all issues found."""
    total_issues = sum(len(file_issues) for file_issues in issues.values())
    
    print(f"# Exception Migration Issues Report")
    print(f"\nTotal issues found: {total_issues}")
    print(f"Files affected: {len(issues)}")
    print(f"\n## Issues by File:\n")
    
    for filepath, file_issues in sorted(issues.items()):
        print(f"\n### {filepath}")
        print(f"Issues: {len(file_issues)}\n")
        
        for line_no, line, fix_type in file_issues:
            print(f"Line {line_no}: {line}")
            suggested = suggest_fix(line, fix_type)
            if suggested != line:
                print(f"Suggested: {suggested}")
            print()


def main():
    """Main function to run the exception migration fixer."""
    import sys
    
    # Get the app directory
    app_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app')
    app_dir = os.path.normpath(app_dir)
    
    print(f"Scanning directory: {app_dir}")
    print("=" * 60)
    
    # Find all issues
    issues = find_issues(app_dir)
    
    if not issues:
        print("No exception migration issues found!")
        return
    
    # Generate report
    generate_report(issues)
    
    # Summary
    print("\n## Summary:")
    print("\nTo fix these issues:")
    print("1. AuthenticationException and ValidationException: Remove 'code' parameter")
    print("2. FynloException: Change 'code=' to 'error_code='")
    print("3. Consider using specialized exception classes instead of FynloException")
    print("\nExample fixes:")
    print("  Before: AuthenticationException(message='Failed', code='INVALID')")
    print("  After:  AuthenticationException(message='Failed')")
    print("\n  Before: FynloException(message='Error', code='CUSTOM_CODE')")
    print("  After:  FynloException(message='Error', error_code='CUSTOM_CODE')")


if __name__ == "__main__":
    main()