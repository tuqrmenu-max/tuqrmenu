-- =====================================================
-- enable_rls.sql
-- Activa Row Level Security en todas las tablas del proyecto
-- Sin esto, las policies NO aplican y las tablas quedan
-- accesibles para cualquiera con la anon key (badge UNRESTRICTED)
-- Ignora tablas que no existen (ej: pedidos_items)
-- Ejecutar en Supabase Dashboard -> SQL Editor
-- =====================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'vendedores',
    'clientes',
    'solicitudes_cliente',
    'mesas',
    'categorias',
    'productos',
    'mesas_operacion',
    'comensales',
    'pedidos_qr',
    'pedidos',
    'suscripciones',
    'promociones',
    'promociones_cliente',
    'cliente_usuarios',
    'socios_solicitud'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
