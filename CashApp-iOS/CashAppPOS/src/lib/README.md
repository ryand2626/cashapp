# Library Configuration Files

This directory contains configuration files for third-party services.

## Security Requirements

**CRITICAL**: Never hardcode API keys, tokens, or sensitive URLs in these files.

All credentials MUST be provided via environment variables:
- Use `Config` from `react-native-config` to access environment variables
- Validate that required environment variables are set
- Fail fast with clear error messages if configuration is missing
- Never provide hardcoded fallback values for sensitive data

## Required Environment Variables

### Supabase Authentication
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key

See `.env.example` for all required environment variables.