# Database Migrations

This folder contains sequential SQL migrations. Each file is applied in order.

## Migration Naming
NNNN_description.sql - e.g., 0001_standardize_timestamps.sql

## Known Technical Debt

The following inconsistencies exist in db/schema.sql and need to be resolved via migration:

### Timestamp naming
- Some tables use createdAt (camelCase)
- Others use created_at (snake_case)
- Target: Standardize on created_at (snake_case - SQL convention)

### Duplicate tables
- cart vs cart_items - determine which is canonical
- wishlist vs wishlists - determine which is canonical
- Target: Keep one, migrate data, drop the other

### ID type consistency
- Some tables use TEXT PRIMARY KEY (UUID)
- Others use INTEGER PRIMARY KEY AUTOINCREMENT
- Target: Standardize on TEXT PRIMARY KEY with uuid() default for new tables

### Foreign key ordering
- Some CREATE TABLE statements reference tables defined later in the file
- Target: Reorder so referenced tables are defined first

## How to Apply a Migration

Local:
    wrangler d1 execute primeshieldhub-db --local --file=db/migrations/0001_xxx.sql

Production:
    wrangler d1 execute primeshieldhub-db --remote --file=db/migrations/0001_xxx.sql

## Migration Process

1. Create the migration file: db/migrations/0001_your_change.sql
2. Test locally: wrangler d1 execute primeshieldhub-db --local --file=...
3. Verify the API still works: cd backend && wrangler dev
4. Apply to production: wrangler d1 execute primeshieldhub-db --remote --file=...
5. Commit the migration file