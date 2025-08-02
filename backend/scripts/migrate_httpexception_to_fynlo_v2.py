#!/usr/bin/env python3
"""
Enhanced Migration Script: HTTPException to FynloException
Version 2.0 - Improved import handling and file integrity
"""

import os
import re
import shutil
from typing import List, Dict, Tuple, Optional, Set
from datetime import datetime
import argparse
import json
from pathlib import Path

# Migration mapping based on status codes and patterns
STATUS_CODE_MAPPING = {
    400: "ValidationException",  # Default for 400
    401: "AuthenticationException",
    403: "AuthorizationException", 
    404: "ResourceNotFoundException",
    409: "ConflictException",
    422: "ValidationException",
    500: "FynloException",
    503: "ServiceUnavailableError"
}

# Pattern-based exception mapping (case-insensitive)
PATTERN_MAPPING = {
    # Auth patterns
    r"invalid credentials": "AuthenticationException",
    r"unauthorized": "AuthenticationException",
    r"authentication": "AuthenticationException",
    r"invalid token": "AuthenticationException",
    r"token expired": "AuthenticationException",
    r"session.*expired": "AuthenticationException",
    r"not authenticated": "AuthenticationException",
    
    # Authorization patterns
    r"permission": "AuthorizationException",
    r"forbidden": "AuthorizationException",
    r"access denied": "AuthorizationException",
    r"not allowed": "AuthorizationException",
    r"insufficient permissions": "AuthorizationException",
    
    # Resource patterns
    r"not found": "ResourceNotFoundException",
    r"does not exist": "ResourceNotFoundException",
    r"no such": "ResourceNotFoundException",
    r"cannot find": "ResourceNotFoundException",
    
    # Validation patterns
    r"invalid": "ValidationException",
    r"validation": "ValidationException",
    r"required": "ValidationException",
    r"must be": "ValidationException",
    r"bad request": "ValidationException",
    
    # Conflict patterns
    r"already exists": "ConflictException",
    r"duplicate": "ConflictException",
    r"conflict": "ConflictException",
    
    # Payment patterns
    r"payment": "PaymentException",
    r"transaction": "PaymentException",
    r"charge": "PaymentException",
    r"refund": "PaymentException",
    
    # Inventory patterns
    r"stock": "InventoryException",
    r"inventory": "InventoryException",
    r"out of stock": "InventoryException",
    r"insufficient": "InventoryException",
    
    # Service patterns
    r"service unavailable": "ServiceUnavailableError",
    r"temporarily unavailable": "ServiceUnavailableError",
    r"try again later": "ServiceUnavailableError"
}


class HTTPExceptionMigratorV2:
    def __init__(self, backup_dir: str = "backup", dry_run: bool = False):
        self.backup_dir = backup_dir
        self.dry_run = dry_run
        self.migration_report = {
            "total_files": 0,
            "total_exceptions": 0,
            "migrated": [],
            "errors": [],
            "skipped": []
        }
        self.used_exceptions: Set[str] = set()
        
    def determine_exception_type(self, status_code: int, detail: str) -> Tuple[str, Dict[str, str]]:
        """Determine the appropriate FynloException type based on status code and message"""
        detail_lower = detail.lower() if detail else ""
        
        # Check pattern mapping first
        for pattern, exception_type in PATTERN_MAPPING.items():
            if re.search(pattern, detail_lower, re.IGNORECASE):
                self.used_exceptions.add(exception_type)
                return exception_type, self._get_exception_params(exception_type, status_code, detail)
        
        # Fall back to status code mapping
        exception_type = STATUS_CODE_MAPPING.get(status_code, "FynloException")
        self.used_exceptions.add(exception_type)
        return exception_type, self._get_exception_params(exception_type, status_code, detail)
    
    def _extract_resource_type(self, detail: str) -> str:
        """Extract resource type from error message"""
        detail_lower = detail.lower()
        resource_map = {
            "user": "User",
            "order": "Order", 
            "product": "Product",
            "menu": "Menu",
            "item": "Item",
            "restaurant": "Restaurant",
            "payment": "Payment",
            "transaction": "Transaction",
            "table": "Table",
            "customer": "Customer",
            "shift": "Shift",
            "employee": "Employee",
            "staff": "Staff",
            "report": "Report",
            "setting": "Setting",
            "configuration": "Configuration",
            "provider": "Provider"
        }
        
        for key, value in resource_map.items():
            if key in detail_lower:
                return value
        
        return "Resource"
    
    def _get_exception_params(self, exception_type: str, status_code: int, detail: str) -> Dict[str, str]:
        """Get appropriate parameters for each exception type"""
        params = {}
        
        if exception_type == "ResourceNotFoundException":
            resource = self._extract_resource_type(detail)
            params["resource"] = f'"{resource}"'
            
            # Add message if it's not the default
            if detail and detail.lower() != f"{resource.lower()} not found":
                params["message"] = f'"{detail}"'
                
        elif exception_type == "ValidationException":
            params["message"] = f'"{detail}"'
            
            # Try to extract field name from common patterns
            field_patterns = {
                r"(\w+)\s+is\s+required": r"\1",
                r"invalid\s+(\w+)": r"\1",
                r"(\w+)\s+must\s+be": r"\1",
                r"(\w+)\s+cannot\s+be": r"\1",
                r"missing\s+(\w+)": r"\1",
                r"field\s+['\"]?(\w+)['\"]?": r"\1"
            }
            
            detail_lower = detail.lower()
            for pattern, capture in field_patterns.items():
                match = re.search(pattern, detail_lower, re.IGNORECASE)
                if match:
                    field = match.group(1)
                    params["field"] = f'"{field}"'
                    break
                    
        elif exception_type in ["AuthenticationException", "AuthorizationException"]:
            params["message"] = f'"{detail}"'
            
        elif exception_type == "PaymentException":
            params["message"] = f'"{detail}"'
            
        elif exception_type == "InventoryException":
            params["message"] = f'"{detail}"'
            
        elif exception_type == "ConflictException":
            params["message"] = f'"{detail}"'
            
        elif exception_type == "ServiceUnavailableError":
            params["message"] = f'"{detail}"'
            
        elif exception_type == "FynloException":
            params["message"] = f'"{detail}"'
            params["status_code"] = str(status_code)
            
        return params
    
    def migrate_file(self, filepath: str) -> Tuple[bool, str, int]:
        """Migrate a single file"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Reset used exceptions for this file
            self.used_exceptions = set()
            
            # Count HTTPExceptions before migration
            http_exception_count = len(re.findall(r'raise\s+HTTPException\s*\(', content))
            
            if http_exception_count == 0:
                return False, "No HTTPException found", 0
            
            # Find all HTTPException raises
            pattern = r'raise\s+HTTPException\s*\([^)]*\)'
            
            # Handle multi-line HTTPExceptions
            extended_pattern = r'raise\s+HTTPException\s*\([^)]*(?:\n[^)]*)*\)'
            
            matches = list(re.finditer(extended_pattern, content, re.MULTILINE | re.DOTALL))
            
            if not matches:
                return False, "No HTTPException patterns matched", 0
            
            # Process matches in reverse order to preserve positions
            new_content = content
            migrated_count = 0
            
            for match in reversed(matches):
                original = match.group(0)
                migrated = self._migrate_single_exception(original)
                
                if migrated and migrated != original:
                    new_content = new_content[:match.start()] + migrated + new_content[match.end():]
                    migrated_count += 1
            
            if migrated_count > 0:
                # Update imports
                new_content = self._update_imports(new_content, filepath)
                
                # Save the file
                if not self.dry_run:
                    # Create backup
                    backup_path = os.path.join(self.backup_dir, os.path.basename(filepath) + '.bak')
                    os.makedirs(self.backup_dir, exist_ok=True)
                    shutil.copy2(filepath, backup_path)
                    
                    # Write migrated content
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                
                return True, f"Migrated {migrated_count} exceptions", migrated_count
            
            return False, "No exceptions could be migrated", 0
            
        except Exception as e:
            return False, f"Error: {str(e)}", 0
    
    def _migrate_single_exception(self, exception_str: str) -> Optional[str]:
        """Migrate a single HTTPException raise statement"""
        try:
            # Extract status_code
            status_match = re.search(r'status_code\s*=\s*(\d+)', exception_str)
            if not status_match:
                return None
            
            status_code = int(status_match.group(1))
            
            # Extract detail
            detail = ""
            detail_match = re.search(r'detail\s*=\s*(["\'])(.*?)\1', exception_str, re.DOTALL)
            if detail_match:
                detail = detail_match.group(2)
            else:
                # Handle f-strings
                detail_match = re.search(r'detail\s*=\s*(f["\'].*?["\'])', exception_str, re.DOTALL)
                if detail_match:
                    detail = detail_match.group(1)
            
            # Determine exception type
            exception_type, params = self.determine_exception_type(status_code, detail if not detail.startswith('f') else "")
            
            # Handle f-strings in detail
            if detail and detail.startswith('f'):
                params["message"] = detail
            
            # Build new exception
            param_str = ", ".join([f"{k}={v}" for k, v in params.items()])
            
            # Preserve indentation
            indent_match = re.match(r'^(\s*)', exception_str)
            indent = indent_match.group(1) if indent_match else ""
            
            return f"{indent}raise {exception_type}({param_str})"
            
        except Exception as e:
            print(f"Error migrating exception: {e}")
            return None
    
    def _update_imports(self, content: str, filepath: str) -> str:
        """Update imports to include FynloException classes"""
        lines = content.split('\n')
        
        # Check if already has FynloException imports
        has_fynlo_import = any('from app.core.exceptions import' in line for line in lines)
        
        if has_fynlo_import:
            # Update existing import
            for i, line in enumerate(lines):
                if 'from app.core.exceptions import' in line and 'FynloException' in line:
                    # Already has FynloException, add other needed exceptions
                    exceptions_to_add = list(self.used_exceptions - {'FynloException'})
                    if exceptions_to_add:
                        # Extract current imports
                        import_match = re.search(r'from app.core.exceptions import\s*\((.*?)\)', 
                                               '\n'.join(lines[i:]), re.DOTALL)
                        if import_match:
                            current_imports = [imp.strip() for imp in import_match.group(1).split(',')]
                            all_imports = sorted(set(current_imports + exceptions_to_add))
                            
                            # Find the end of the import statement
                            j = i
                            while j < len(lines) and ')' not in lines[j]:
                                j += 1
                            
                            # Replace the import
                            new_import = f"from app.core.exceptions import (\n"
                            for imp in all_imports:
                                new_import += f"    {imp},\n"
                            new_import = new_import.rstrip(',\n') + "\n)"
                            
                            lines[i:j+1] = new_import.split('\n')
                        else:
                            # Single line import
                            lines[i] = f"from app.core.exceptions import {', '.join(sorted(self.used_exceptions))}"
                    break
        else:
            # Add new import after other imports
            import_added = False
            for i, line in enumerate(lines):
                if line.startswith('from app.') and not import_added:
                    # Add after other app imports
                    exceptions = sorted(self.used_exceptions)
                    if len(exceptions) > 3:
                        new_import = "from app.core.exceptions import (\n"
                        for exc in exceptions:
                            new_import += f"    {exc},\n"
                        new_import = new_import.rstrip(',\n') + "\n)"
                        lines.insert(i + 1, new_import)
                    else:
                        lines.insert(i + 1, f"from app.core.exceptions import {', '.join(exceptions)}")
                    import_added = True
                    break
            
            if not import_added:
                # Add after last import
                last_import = 0
                for i, line in enumerate(lines):
                    if line.startswith('import ') or line.startswith('from '):
                        last_import = i
                
                exceptions = sorted(self.used_exceptions)
                if len(exceptions) > 3:
                    new_import = "\nfrom app.core.exceptions import (\n"
                    for exc in exceptions:
                        new_import += f"    {exc},\n"
                    new_import = new_import.rstrip(',\n') + "\n)"
                    lines.insert(last_import + 1, new_import)
                else:
                    lines.insert(last_import + 1, f"\nfrom app.core.exceptions import {', '.join(exceptions)}")
        
        # Remove HTTPException import if no longer needed
        if 'raise HTTPException(' not in content:
            for i, line in enumerate(lines):
                if 'from fastapi import' in line and 'HTTPException' in line:
                    imports = re.findall(r'\w+', line.split('import')[1])
                    imports = [imp for imp in imports if imp != 'HTTPException']
                    if imports:
                        lines[i] = f"from fastapi import {', '.join(imports)}"
                    else:
                        lines[i] = ''
        
        return '\n'.join(lines)
    
    def run_migration(self, target_files: List[str]):
        """Run migration on specified files"""
        print(f"\n{'DRY RUN - ' if self.dry_run else ''}Starting HTTPException to FynloException migration...")
        print(f"Target files: {len(target_files)}")
        
        self.migration_report["total_files"] = len(target_files)
        
        for filepath in target_files:
            print(f"\nProcessing: {filepath}")
            
            if not os.path.exists(filepath):
                print(f"  ⚠️  File not found, skipping")
                self.migration_report["skipped"].append({
                    "file": filepath,
                    "reason": "File not found"
                })
                continue
            
            success, message, count = self.migrate_file(filepath)
            
            if success and count > 0:
                print(f"  ✅ {message}")
                self.migration_report["migrated"].append({
                    "file": filepath,
                    "exceptions_migrated": count,
                    "message": message,
                    "exceptions_used": list(self.used_exceptions)
                })
                self.migration_report["total_exceptions"] += count
            elif not success:
                print(f"  ❌ {message}")
                self.migration_report["errors"].append({
                    "file": filepath,
                    "error": message
                })
            else:
                print(f"  ⏭️  {message}")
                self.migration_report["skipped"].append({
                    "file": filepath,
                    "reason": message
                })
        
        # Save report
        report_path = f"migration_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, 'w') as f:
            json.dump(self.migration_report, f, indent=2)
        
        print(f"\n{'='*60}")
        print(f"Migration {'(DRY RUN) ' if self.dry_run else ''}Complete!")
        print(f"Total files processed: {self.migration_report['total_files']}")
        print(f"Total exceptions migrated: {self.migration_report['total_exceptions']}")
        print(f"Files successfully migrated: {len(self.migration_report['migrated'])}")
        print(f"Files with errors: {len(self.migration_report['errors'])}")
        print(f"Files skipped: {len(self.migration_report['skipped'])}")
        print(f"\nDetailed report saved to: {report_path}")


def main():
    parser = argparse.ArgumentParser(description="Migrate HTTPException to FynloException V2")
    parser.add_argument(
        "--dry-run", 
        action="store_true", 
        help="Run in dry-run mode (no files will be modified)"
    )
    parser.add_argument(
        "--file", 
        type=str, 
        help="Migrate a specific file"
    )
    parser.add_argument(
        "--critical",
        action="store_true",
        help="Migrate critical files only (auth, payments, secure_payments)"
    )
    parser.add_argument(
        "--all", 
        action="store_true", 
        help="Migrate all files with HTTPException"
    )
    
    args = parser.parse_args()
    
    # Critical files (Phase 1)
    critical_files = [
        "app/api/v1/endpoints/auth.py",
        "app/api/v1/endpoints/payments.py",
        "app/api/v1/endpoints/secure_payments.py",
        "app/api/v1/endpoints/payment_configurations.py",
    ]
    
    # All files from the issue
    all_files = [
        "app/api/v1/endpoints/auth.py",
        "app/api/v1/endpoints/platform_settings_public.py",
        "app/api/v1/endpoints/secure_payment_provider_management.py",
        "app/api/v1/endpoints/fees.py",
        "app/api/v1/endpoints/payments.py",
        "app/api/v1/endpoints/payment_configurations.py",
        "app/api/v1/endpoints/config.py",
        "app/api/v1/endpoints/restaurants.py",
        "app/api/v1/endpoints/monitoring.py",
        "app/api/v1/endpoints/orders.py",
        "app/api/v1/endpoints/secure_payments.py",
        "app/api/v1/endpoints/tips.py",
        "app/api/v1/endpoints/dashboard.py",
        "app/api/v1/endpoints/platform_admin.py",
        "app/api/v1/endpoints/admin.py",
        "app/api/v1/endpoints/platform_settings.py",
        "app/api/v1/endpoints/recipes.py",
        "app/api/v1/endpoints/customers.py",
        "app/api/v1/endpoints/products_secure.py",
        "app/api/v1/endpoints/inventory.py"
    ]
    
    migrator = HTTPExceptionMigratorV2(dry_run=args.dry_run)
    
    if args.file:
        target_files = [args.file]
    elif args.critical:
        target_files = critical_files
    elif args.all:
        target_files = all_files
    else:
        print("Please specify --file <filepath>, --critical, or --all")
        return
    
    migrator.run_migration(target_files)


if __name__ == "__main__":
    main()