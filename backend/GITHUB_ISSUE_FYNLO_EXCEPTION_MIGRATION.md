# GitHub Issue: Incomplete FynloException Migration - 203 Exception Calls Need Fixing

## 🐛 Bug Description

The HTTPException to FynloException migration is incomplete. Analysis reveals 203 incorrect exception calls across 25 files where exceptions are being called with wrong parameters.

## 🔍 Problem Details

### Issue 1: FynloException using 'code' instead of 'error_code' (85 occurrences)
```python
# Current (incorrect)
raise FynloException(message='Error', code='INTERNAL_ERROR')

# Should be
raise FynloException(message='Error', error_code='INTERNAL_ERROR')
```

### Issue 2: Specialized exceptions using unsupported 'code' parameter (118 occurrences)
```python
# Current (incorrect)
raise AuthenticationException(message='Failed', code='INVALID_TOKEN')
raise ValidationException(message='Invalid', code='BAD_REQUEST')

# Should be
raise AuthenticationException(message='Failed')
raise ValidationException(message='Invalid')
```

## 📊 Scope

- **Total issues**: 203
- **Files affected**: 25
- **Most affected files**:
  - api/v1/endpoints/payments.py (31 issues)
  - api/v1/endpoints/platform_settings.py (24 issues)
  - api/v1/endpoints/auth.py (20 issues)
  - api/v1/endpoints/config.py (20 issues)

## 🧪 Test Evidence

Created comprehensive test suite in `tests/test_fynlo_exception_migration.py` which fails due to these issues:
```
TypeError: AuthenticationException.__init__() got an unexpected keyword argument 'code'
```

## 🛠️ Fix Strategy

### Quick Fix for FynloException (85 issues)
```bash
find app -name '*.py' -exec sed -i '' 's/FynloException(\(.*\)code=/FynloException(\1error_code=/g' {} +
```

### Manual Review Required (118 issues)
Specialized exceptions need manual review as patterns vary. Key files:
- core/auth.py (8 issues)
- core/tenant_security.py (3 issues)
- core/dependencies.py (3 issues)
- api/v1/endpoints/auth.py (12 AuthenticationException issues)

## 📁 Related Files

- Test suite: `/backend/tests/test_fynlo_exception_migration.py`
- Analysis script: `/backend/scripts/analyze_exception_usage.py`
- Detailed report: `/backend/detailed_exception_report.txt`
- Test report: `/backend/FYNLO_EXCEPTION_MIGRATION_TEST_REPORT.md`

## ✅ Definition of Done

1. All 203 exception calls fixed
2. Test suite passes completely
3. No new incorrect usage patterns introduced
4. Pre-commit hook added to prevent regression

## 🚨 Priority

**HIGH** - This affects error handling throughout the entire backend, potentially causing 500 errors instead of proper error responses.

## Labels

- `bug`
- `backend`
- `error-handling`
- `technical-debt`
- `high-priority`