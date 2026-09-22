# Supabase database trust certificate

`supabase-prod-ca-2021.crt` is Supabase's public root CA, downloaded from the
**Download Certificate** link in the project's Database settings on 2026-09-23:

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

It is public certificate material, not a password or private key. The database
configuration uses it only for Supabase hosts, unless `DATABASE_SSL_CA` supplies
an explicit replacement. Hostname and certificate verification remain enabled.

If Supabase rotates its CA, obtain the replacement through the project's
Database settings and update this certificate; do not disable TLS verification.

Reference: https://supabase.com/docs/guides/platform/ssl-enforcement
