-- Politicas RLS para admin

-- Permitir INSERT en vendedores
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert vendedores' AND tablename = 'vendedores') THEN
    CREATE POLICY "Admin can insert vendedores" ON vendedores FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Permitir SELECT en vendedores
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read vendedores' AND tablename = 'vendedores') THEN
    CREATE POLICY "Admin can read vendedores" ON vendedores FOR SELECT USING (true);
  END IF;
END $$;

-- Permitir UPDATE en vendedores
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update vendedores' AND tablename = 'vendedores') THEN
    CREATE POLICY "Admin can update vendedores" ON vendedores FOR UPDATE USING (true);
  END IF;
END $$;

-- Permitir DELETE en vendedores
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete vendedores' AND tablename = 'vendedores') THEN
    CREATE POLICY "Admin can delete vendedores" ON vendedores FOR DELETE USING (true);
  END IF;
END $$;

-- Permitir SELECT en clientes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read clientes' AND tablename = 'clientes') THEN
    CREATE POLICY "Admin can read clientes" ON clientes FOR SELECT USING (true);
  END IF;
END $$;

-- Permitir SELECT en cliente_usuarios
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read cliente_usuarios' AND tablename = 'cliente_usuarios') THEN
    CREATE POLICY "Admin can read cliente_usuarios" ON cliente_usuarios FOR SELECT USING (true);
  END IF;
END $$;

-- Permitir SELECT en solicitudes_cliente
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read solicitudes' AND tablename = 'solicitudes_cliente') THEN
    CREATE POLICY "Admin can read solicitudes" ON solicitudes_cliente FOR SELECT USING (true);
  END IF;
END $$;

-- Permitir INSERT en solicitudes_cliente
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert solicitudes' AND tablename = 'solicitudes_cliente') THEN
    CREATE POLICY "Admin can insert solicitudes" ON solicitudes_cliente FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Permitir UPDATE en solicitudes_cliente
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update solicitudes' AND tablename = 'solicitudes_cliente') THEN
    CREATE POLICY "Admin can update solicitudes" ON solicitudes_cliente FOR UPDATE USING (true);
  END IF;
END $$;

-- Permitir DELETE en solicitudes_cliente
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete solicitudes' AND tablename = 'solicitudes_cliente') THEN
    CREATE POLICY "Admin can delete solicitudes" ON solicitudes_cliente FOR DELETE USING (true);
  END IF;
END $$;

-- Permitir INSERT en clientes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert clientes' AND tablename = 'clientes') THEN
    CREATE POLICY "Admin can insert clientes" ON clientes FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Permitir UPDATE en clientes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update clientes' AND tablename = 'clientes') THEN
    CREATE POLICY "Admin can update clientes" ON clientes FOR UPDATE USING (true);
  END IF;
END $$;

-- Permitir DELETE en clientes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete clientes' AND tablename = 'clientes') THEN
    CREATE POLICY "Admin can delete clientes" ON clientes FOR DELETE USING (true);
  END IF;
END $$;

-- Permitir INSERT en mesas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert mesas' AND tablename = 'mesas') THEN
    CREATE POLICY "Admin can insert mesas" ON mesas FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Permitir DELETE en mesas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete mesas' AND tablename = 'mesas') THEN
    CREATE POLICY "Admin can delete mesas" ON mesas FOR DELETE USING (true);
  END IF;
END $$;

-- Permitir SELECT en mesas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read mesas' AND tablename = 'mesas') THEN
    CREATE POLICY "Admin can read mesas" ON mesas FOR SELECT USING (true);
  END IF;
END $$;

-- Politicas para categorias
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read categorias' AND tablename = 'categorias') THEN
    CREATE POLICY "Admin can read categorias" ON categorias FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert categorias' AND tablename = 'categorias') THEN
    CREATE POLICY "Admin can insert categorias" ON categorias FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update categorias' AND tablename = 'categorias') THEN
    CREATE POLICY "Admin can update categorias" ON categorias FOR UPDATE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete categorias' AND tablename = 'categorias') THEN
    CREATE POLICY "Admin can delete categorias" ON categorias FOR DELETE USING (true);
  END IF;
END $$;

-- Politicas para productos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read productos' AND tablename = 'productos') THEN
    CREATE POLICY "Admin can read productos" ON productos FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert productos' AND tablename = 'productos') THEN
    CREATE POLICY "Admin can insert productos" ON productos FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update productos' AND tablename = 'productos') THEN
    CREATE POLICY "Admin can update productos" ON productos FOR UPDATE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete productos' AND tablename = 'productos') THEN
    CREATE POLICY "Admin can delete productos" ON productos FOR DELETE USING (true);
  END IF;
END $$;

-- Politicas para mesas_operacion
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read mesas_operacion' AND tablename = 'mesas_operacion') THEN
    CREATE POLICY "Admin can read mesas_operacion" ON mesas_operacion FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert mesas_operacion' AND tablename = 'mesas_operacion') THEN
    CREATE POLICY "Admin can insert mesas_operacion" ON mesas_operacion FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update mesas_operacion' AND tablename = 'mesas_operacion') THEN
    CREATE POLICY "Admin can update mesas_operacion" ON mesas_operacion FOR UPDATE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete mesas_operacion' AND tablename = 'mesas_operacion') THEN
    CREATE POLICY "Admin can delete mesas_operacion" ON mesas_operacion FOR DELETE USING (true);
  END IF;
END $$;

-- Politicas para comensales
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read comensales' AND tablename = 'comensales') THEN
    CREATE POLICY "Admin can read comensales" ON comensales FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert comensales' AND tablename = 'comensales') THEN
    CREATE POLICY "Admin can insert comensales" ON comensales FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update comensales' AND tablename = 'comensales') THEN
    CREATE POLICY "Admin can update comensales" ON comensales FOR UPDATE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete comensales' AND tablename = 'comensales') THEN
    CREATE POLICY "Admin can delete comensales" ON comensales FOR DELETE USING (true);
  END IF;
END $$;

-- Politicas para pedidos_qr
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read pedidos_qr' AND tablename = 'pedidos_qr') THEN
    CREATE POLICY "Admin can read pedidos_qr" ON pedidos_qr FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert pedidos_qr' AND tablename = 'pedidos_qr') THEN
    CREATE POLICY "Admin can insert pedidos_qr" ON pedidos_qr FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete pedidos_qr' AND tablename = 'pedidos_qr') THEN
    CREATE POLICY "Admin can delete pedidos_qr" ON pedidos_qr FOR DELETE USING (true);
  END IF;
END $$;

-- Politicas para pedidos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read pedidos' AND tablename = 'pedidos') THEN
    CREATE POLICY "Admin can read pedidos" ON pedidos FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert pedidos' AND tablename = 'pedidos') THEN
    CREATE POLICY "Admin can insert pedidos" ON pedidos FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update pedidos' AND tablename = 'pedidos') THEN
    CREATE POLICY "Admin can update pedidos" ON pedidos FOR UPDATE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete pedidos' AND tablename = 'pedidos') THEN
    CREATE POLICY "Admin can delete pedidos" ON pedidos FOR DELETE USING (true);
  END IF;
END $$;

-- Politicas para pedidos_qr (INSERT y UPDATE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert pedidos_qr' AND tablename = 'pedidos_qr') THEN
    CREATE POLICY "Admin can insert pedidos_qr" ON pedidos_qr FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update pedidos_qr' AND tablename = 'pedidos_qr') THEN
    CREATE POLICY "Admin can update pedidos_qr" ON pedidos_qr FOR UPDATE USING (true);
  END IF;
END $$;

-- Politicas para suscripciones
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read suscripciones' AND tablename = 'suscripciones') THEN
    CREATE POLICY "Admin can read suscripciones" ON suscripciones FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert suscripciones' AND tablename = 'suscripciones') THEN
    CREATE POLICY "Admin can insert suscripciones" ON suscripciones FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update suscripciones' AND tablename = 'suscripciones') THEN
    CREATE POLICY "Admin can update suscripciones" ON suscripciones FOR UPDATE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete suscripciones' AND tablename = 'suscripciones') THEN
    CREATE POLICY "Admin can delete suscripciones" ON suscripciones FOR DELETE USING (true);
  END IF;
END $$;

-- Politicas para promociones
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read promociones' AND tablename = 'promociones') THEN
    CREATE POLICY "Admin can read promociones" ON promociones FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert promociones' AND tablename = 'promociones') THEN
    CREATE POLICY "Admin can insert promociones" ON promociones FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete promociones' AND tablename = 'promociones') THEN
    CREATE POLICY "Admin can delete promociones" ON promociones FOR DELETE USING (true);
  END IF;
END $$;

-- Politicas para promociones_cliente
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read promociones_cliente' AND tablename = 'promociones_cliente') THEN
    CREATE POLICY "Admin can read promociones_cliente" ON promociones_cliente FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert promociones_cliente' AND tablename = 'promociones_cliente') THEN
    CREATE POLICY "Admin can insert promociones_cliente" ON promociones_cliente FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete promociones_cliente' AND tablename = 'promociones_cliente') THEN
    CREATE POLICY "Admin can delete promociones_cliente" ON promociones_cliente FOR DELETE USING (true);
  END IF;
END $$;

-- Politicas para cliente_usuarios (INSERT y UPDATE)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert cliente_usuarios' AND tablename = 'cliente_usuarios') THEN
    CREATE POLICY "Admin can insert cliente_usuarios" ON cliente_usuarios FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update cliente_usuarios' AND tablename = 'cliente_usuarios') THEN
    CREATE POLICY "Admin can update cliente_usuarios" ON cliente_usuarios FOR UPDATE USING (true);
  END IF;
END $$;

-- Politicas para pedido_items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can read pedido_items' AND tablename = 'pedido_items') THEN
    CREATE POLICY "Admin can read pedido_items" ON pedido_items FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can insert pedido_items' AND tablename = 'pedido_items') THEN
    CREATE POLICY "Admin can insert pedido_items" ON pedido_items FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update pedido_items' AND tablename = 'pedido_items') THEN
    CREATE POLICY "Admin can update pedido_items" ON pedido_items FOR UPDATE USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can delete pedido_items' AND tablename = 'pedido_items') THEN
    CREATE POLICY "Admin can delete pedido_items" ON pedido_items FOR DELETE USING (true);
  END IF;
END $$;

-- Politicas para UPDATE en mesas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can update mesas' AND tablename = 'mesas') THEN
    CREATE POLICY "Admin can update mesas" ON mesas FOR UPDATE USING (true);
  END IF;
END $$;
