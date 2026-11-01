-- Align database roles with the app: owner / admin / manager / sales_rep / viewer.
-- Kept in its own migration: a new enum value can't be used in the transaction that adds it.
alter type public.app_role rename value 'employee' to 'sales_rep';
alter type public.app_role add value if not exists 'owner' before 'admin';
