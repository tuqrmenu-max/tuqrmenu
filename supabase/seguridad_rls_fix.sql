-- =====================================================
-- seguridad_rls_fix.sql
-- Corrige las politicas RLS que estaban abiertas con USING(true)
-- sin restriccion de rol, permitiendo que cualquiera con la
-- anon key lea/escriba datos de CUALQUIER socio.
--
-- LEEME ANTES DE CORRER ESTO:
-- 1) Es la parte mas sensible de todo lo que hicimos: si algo queda
--    mal escrito, un socio podria dejar de ver sus propios datos
--    en el dashboard (NO afecta a los clientes finales del menu
--    publico: esas rutas se mantienen igual de abiertas a proposito).
-- 2) Recomendado: correrlo primero en un proyecto de Supabase de
--    prueba (o en un horario de bajo trafico), y despues entrar al
--    dashboard de un par de socios reales para confirmar que
--    siguen viendo productos, mesas, pedidos, etc.
-- 3) Si algo se rompe, al final del archivo esta el SQL de
--    "rollback" para volver a las politicas viejas (abiertas) y
--    poder investigar con calma.
-- =====================================================


-- =====================================================
-- 1) FUNCIONES AUXILIARES (SECURITY DEFINER: pueden leer
--    clientes/vendedores/cliente_usuarios aunque esas tablas
--    tengan RLS, para poder decidir el permiso del usuario actual)
-- =====================================================

CREATE OR REPLACE FUNCTION mis_clientes_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM clientes WHERE user_id = auth.uid()
  UNION
  SELECT cliente_id FROM cliente_usuarios WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION es_vendedor()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM vendedores WHERE user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION es_superadmin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM vendedores WHERE user_id = auth.uid())
    AND NOT EXISTS(SELECT 1 FROM clientes WHERE user_id = auth.uid())
    AND NOT EXISTS(SELECT 1 FROM cliente_usuarios WHERE user_id = auth.uid())
$$;

-- =====================================================
-- 2) FUNCIONES RPC PARA EL MENU PUBLICO (asi el anon key
--    deja de necesitar SELECT directo sobre suscripciones /
--    promociones / promociones_cliente; solo puede llamar
--    a estas 2 funciones, que devuelven lo minimo necesario)
-- =====================================================

CREATE OR REPLACE FUNCTION buscar_suscripcion_por_whatsapp(p_cliente_id uuid, p_whatsapp text)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_objetivo text;
  v_id uuid;
BEGIN
  v_objetivo := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  IF length(v_objetivo) = 10 THEN
    v_objetivo := '54' || v_objetivo;
  END IF;
  IF v_objetivo = '' THEN
    RETURN NULL;
  END IF;

  SELECT s.id INTO v_id
  FROM suscripciones s
  WHERE s.cliente_id = p_cliente_id
    AND (
      CASE WHEN length(regexp_replace(coalesce(s.whatsapp,''), '\D','','g')) = 10
        THEN '54' || regexp_replace(coalesce(s.whatsapp,''), '\D','','g')
        ELSE regexp_replace(coalesce(s.whatsapp,''), '\D','','g')
      END
    ) = v_objetivo
  LIMIT 1;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION mis_promos_activas(p_suscripcion_id uuid)
RETURNS TABLE(codigo text, titulo text, descripcion text, tipo text, categoria text, producto_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pc.codigo, p.titulo, p.descripcion, p.tipo, p.categoria, p.producto_id
  FROM promociones_cliente pc
  JOIN promociones p ON p.id = pc.promocion_id
  WHERE pc.suscripcion_id = p_suscripcion_id
    AND coalesce(pc.usada::boolean, false) = false
    AND coalesce(pc.activa::boolean, true) = true
    AND (p.fecha_envio IS NULL OR p.fecha_envio <= now())
$$;

GRANT EXECUTE ON FUNCTION buscar_suscripcion_por_whatsapp(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION mis_promos_activas(uuid) TO anon, authenticated;

-- =====================================================
-- 2b) ASIGNAR PROMOS A NUEVOS SUSCRIPTOS
--     El menu publico llama a esto despues de insertar
--     en suscripciones para asignar automaticamente las
--     promos marcadas como "para_nuevos".
-- =====================================================
CREATE OR REPLACE FUNCTION asignar_promos_nuevos(p_cliente_id uuid, p_suscripcion_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer := 0;
  v_promo record;
BEGIN
  FOR v_promo IN
    SELECT p.id FROM promociones p
    WHERE p.cliente_id = p_cliente_id
      AND coalesce(p.para_nuevos, false) = true
      AND NOT EXISTS (
        SELECT 1 FROM promociones_cliente pc
        WHERE pc.promocion_id = p.id
          AND pc.suscripcion_id = p_suscripcion_id
      )
  LOOP
    INSERT INTO promociones_cliente (promocion_id, suscripcion_id)
    VALUES (v_promo.id, p_suscripcion_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION asignar_promos_nuevos(uuid, uuid) TO anon, authenticated;


-- =====================================================
-- 3) CLIENTES (el "socio"/negocio)
--    SELECT sigue abierto (el menu publico necesita leer
--    nombre/whatsapp/logo/menu_url de cualquier negocio por su
--    link). Se cierra INSERT/UPDATE/DELETE al dueño autenticado.
-- =====================================================
DROP POLICY IF EXISTS "Admin can read clientes" ON clientes;
DROP POLICY IF EXISTS "Admin can insert clientes" ON clientes;
DROP POLICY IF EXISTS "Admin can update clientes" ON clientes;
DROP POLICY IF EXISTS "Admin can delete clientes" ON clientes;
DROP POLICY IF EXISTS "Publico puede leer clientes (menu)" ON clientes;
DROP POLICY IF EXISTS "Superadmin o vendedor puede crear clientes" ON clientes;
DROP POLICY IF EXISTS "Dueno puede actualizar su cliente" ON clientes;
DROP POLICY IF EXISTS "Superadmin puede borrar clientes" ON clientes;

CREATE POLICY "Publico puede leer clientes (menu)" ON clientes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Superadmin o vendedor puede crear clientes" ON clientes FOR INSERT TO authenticated WITH CHECK (es_superadmin() OR es_vendedor());
CREATE POLICY "Dueno puede actualizar su cliente" ON clientes FOR UPDATE TO authenticated USING (user_id = auth.uid() OR es_superadmin());
CREATE POLICY "Superadmin puede borrar clientes" ON clientes FOR DELETE TO authenticated USING (es_superadmin());


-- =====================================================
-- 4) CATEGORIAS / PRODUCTOS
--    SELECT abierto (menu publico). Escritura solo dueño/staff.
-- =====================================================
DROP POLICY IF EXISTS "Admin can read categorias" ON categorias;
DROP POLICY IF EXISTS "Admin can insert categorias" ON categorias;
DROP POLICY IF EXISTS "Admin can update categorias" ON categorias;
DROP POLICY IF EXISTS "Admin can delete categorias" ON categorias;
DROP POLICY IF EXISTS "Publico puede leer categorias (menu)" ON categorias;
DROP POLICY IF EXISTS "Dueno o staff puede crear categorias" ON categorias;
DROP POLICY IF EXISTS "Dueno o staff puede editar categorias" ON categorias;
DROP POLICY IF EXISTS "Dueno o staff puede borrar categorias" ON categorias;

CREATE POLICY "Publico puede leer categorias (menu)" ON categorias FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Dueno o staff puede crear categorias" ON categorias FOR INSERT TO authenticated WITH CHECK (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede editar categorias" ON categorias FOR UPDATE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede borrar categorias" ON categorias FOR DELETE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));

DROP POLICY IF EXISTS "Admin can read productos" ON productos;
DROP POLICY IF EXISTS "Admin can insert productos" ON productos;
DROP POLICY IF EXISTS "Admin can update productos" ON productos;
DROP POLICY IF EXISTS "Admin can delete productos" ON productos;
DROP POLICY IF EXISTS "Publico puede leer productos (menu)" ON productos;
DROP POLICY IF EXISTS "Dueno o staff puede crear productos" ON productos;
DROP POLICY IF EXISTS "Dueno o staff puede editar productos" ON productos;
DROP POLICY IF EXISTS "Dueno o staff puede borrar productos" ON productos;

CREATE POLICY "Publico puede leer productos (menu)" ON productos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Dueno o staff puede crear productos" ON productos FOR INSERT TO authenticated WITH CHECK (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede editar productos" ON productos FOR UPDATE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede borrar productos" ON productos FOR DELETE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));


-- =====================================================
-- 5) MESAS (config de mesas del dashboard, sin uso anonimo directo)
-- =====================================================
DROP POLICY IF EXISTS "Admin can read mesas" ON mesas;
DROP POLICY IF EXISTS "Admin can insert mesas" ON mesas;
DROP POLICY IF EXISTS "Admin can update mesas" ON mesas;
DROP POLICY IF EXISTS "Admin can delete mesas" ON mesas;
DROP POLICY IF EXISTS "Dueno o staff puede leer mesas" ON mesas;
DROP POLICY IF EXISTS "Dueno o staff puede crear mesas" ON mesas;
DROP POLICY IF EXISTS "Dueno o staff puede editar mesas" ON mesas;
DROP POLICY IF EXISTS "Dueno o staff puede borrar mesas" ON mesas;

CREATE POLICY "Dueno o staff puede leer mesas" ON mesas FOR SELECT TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede crear mesas" ON mesas FOR INSERT TO authenticated WITH CHECK (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede editar mesas" ON mesas FOR UPDATE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede borrar mesas" ON mesas FOR DELETE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));


-- =====================================================
-- 6) MESAS_OPERACION / COMENSALES / PEDIDOS_QR
--    OJO: el menu publico (cliente final sin login, mesa QR) hace
--    SELECT + INSERT + UPDATE anonimos sobre estas 3 tablas para que
--    el pedido y el "llamar mozo" funcionen sin cuenta. Hoy no hay
--    forma de saber "esta anon request es de la mesa X del local Y"
--    sin un token de sesion real, asi que dejamos esas 3 operaciones
--    abiertas a anon (riesgo residual explicado en el .txt aparte).
--    Lo que SI cerramos: el DELETE (el menu publico nunca borra), y
--    el dashboard autenticado queda restringido al dueño/staff, en
--    vez de poder leer/tocar mesas de otros locales.
-- =====================================================
DROP POLICY IF EXISTS "Admin can read mesas_operacion" ON mesas_operacion;
DROP POLICY IF EXISTS "Admin can insert mesas_operacion" ON mesas_operacion;
DROP POLICY IF EXISTS "Admin can update mesas_operacion" ON mesas_operacion;
DROP POLICY IF EXISTS "Admin can delete mesas_operacion" ON mesas_operacion;
DROP POLICY IF EXISTS "Publico puede operar mesas_operacion (pedidos QR)" ON mesas_operacion;
DROP POLICY IF EXISTS "Publico puede crear mesas_operacion (pedidos QR)" ON mesas_operacion;
DROP POLICY IF EXISTS "Publico puede actualizar mesas_operacion (llamar mozo)" ON mesas_operacion;
DROP POLICY IF EXISTS "Dueno o staff puede leer mesas_operacion" ON mesas_operacion;
DROP POLICY IF EXISTS "Dueno o staff puede crear mesas_operacion" ON mesas_operacion;
DROP POLICY IF EXISTS "Dueno o staff puede editar mesas_operacion" ON mesas_operacion;
DROP POLICY IF EXISTS "Dueno o staff puede borrar mesas_operacion" ON mesas_operacion;

CREATE POLICY "Publico puede operar mesas_operacion (pedidos QR)" ON mesas_operacion FOR SELECT TO anon USING (true);
CREATE POLICY "Publico puede crear mesas_operacion (pedidos QR)" ON mesas_operacion FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Publico puede actualizar mesas_operacion (llamar mozo)" ON mesas_operacion FOR UPDATE TO anon USING (true);
CREATE POLICY "Dueno o staff puede leer mesas_operacion" ON mesas_operacion FOR SELECT TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede crear mesas_operacion" ON mesas_operacion FOR INSERT TO authenticated WITH CHECK (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede editar mesas_operacion" ON mesas_operacion FOR UPDATE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede borrar mesas_operacion" ON mesas_operacion FOR DELETE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));

DROP POLICY IF EXISTS "Admin can read comensales" ON comensales;
DROP POLICY IF EXISTS "Admin can insert comensales" ON comensales;
DROP POLICY IF EXISTS "Admin can update comensales" ON comensales;
DROP POLICY IF EXISTS "Admin can delete comensales" ON comensales;
DROP POLICY IF EXISTS "Publico puede leer comensales (pedidos QR)" ON comensales;
DROP POLICY IF EXISTS "Publico puede crear comensales (pedidos QR)" ON comensales;
DROP POLICY IF EXISTS "Dueno o staff puede leer comensales" ON comensales;
DROP POLICY IF EXISTS "Dueno o staff puede crear comensales" ON comensales;
DROP POLICY IF EXISTS "Dueno o staff puede editar comensales" ON comensales;
DROP POLICY IF EXISTS "Dueno o staff puede borrar comensales" ON comensales;

CREATE POLICY "Publico puede leer comensales (pedidos QR)" ON comensales FOR SELECT TO anon USING (true);
CREATE POLICY "Publico puede crear comensales (pedidos QR)" ON comensales FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Dueno o staff puede leer comensales" ON comensales FOR SELECT TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede crear comensales" ON comensales FOR INSERT TO authenticated WITH CHECK (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede editar comensales" ON comensales FOR UPDATE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede borrar comensales" ON comensales FOR DELETE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));

DROP POLICY IF EXISTS "Admin can read pedidos_qr" ON pedidos_qr;
DROP POLICY IF EXISTS "Admin can insert pedidos_qr" ON pedidos_qr;
DROP POLICY IF EXISTS "Admin can update pedidos_qr" ON pedidos_qr;
DROP POLICY IF EXISTS "Admin can delete pedidos_qr" ON pedidos_qr;
DROP POLICY IF EXISTS "Publico puede leer pedidos_qr" ON pedidos_qr;
DROP POLICY IF EXISTS "Publico puede crear pedidos_qr" ON pedidos_qr;
DROP POLICY IF EXISTS "Dueno o staff puede leer pedidos_qr" ON pedidos_qr;
DROP POLICY IF EXISTS "Dueno o staff puede editar pedidos_qr" ON pedidos_qr;
DROP POLICY IF EXISTS "Dueno o staff puede borrar pedidos_qr" ON pedidos_qr;

CREATE POLICY "Publico puede leer pedidos_qr" ON pedidos_qr FOR SELECT TO anon USING (true);
CREATE POLICY "Publico puede crear pedidos_qr" ON pedidos_qr FOR INSERT TO anon WITH CHECK (true);
-- pedidos_qr no tiene cliente_id directo: se llega a el via comensales.cliente_id
CREATE POLICY "Dueno o staff puede leer pedidos_qr" ON pedidos_qr FOR SELECT TO authenticated USING (comensal_id IN (SELECT id FROM comensales WHERE cliente_id IN (SELECT mis_clientes_ids())));
CREATE POLICY "Dueno o staff puede editar pedidos_qr" ON pedidos_qr FOR UPDATE TO authenticated USING (comensal_id IN (SELECT id FROM comensales WHERE cliente_id IN (SELECT mis_clientes_ids())));
CREATE POLICY "Dueno o staff puede borrar pedidos_qr" ON pedidos_qr FOR DELETE TO authenticated USING (comensal_id IN (SELECT id FROM comensales WHERE cliente_id IN (SELECT mis_clientes_ids())));


-- =====================================================
-- 7) PEDIDOS (pedidos por WhatsApp/delivery, gestionados desde el dashboard)
-- =====================================================
DROP POLICY IF EXISTS "Admin can read pedidos" ON pedidos;
DROP POLICY IF EXISTS "Admin can insert pedidos" ON pedidos;
DROP POLICY IF EXISTS "Admin can update pedidos" ON pedidos;
DROP POLICY IF EXISTS "Admin can delete pedidos" ON pedidos;
DROP POLICY IF EXISTS "Dueno o staff puede leer pedidos" ON pedidos;
DROP POLICY IF EXISTS "Dueno o staff puede crear pedidos" ON pedidos;
DROP POLICY IF EXISTS "Dueno o staff puede editar pedidos" ON pedidos;
DROP POLICY IF EXISTS "Dueno o staff puede borrar pedidos" ON pedidos;

CREATE POLICY "Dueno o staff puede leer pedidos" ON pedidos FOR SELECT TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede crear pedidos" ON pedidos FOR INSERT TO authenticated WITH CHECK (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede editar pedidos" ON pedidos FOR UPDATE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede borrar pedidos" ON pedidos FOR DELETE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));

-- pedido_items: solo si la tabla existe en tu proyecto (en varios entornos no existe)
DO $$ BEGIN
  IF to_regclass('public.pedido_items') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin can read pedido_items" ON pedido_items';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can insert pedido_items" ON pedido_items';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can update pedido_items" ON pedido_items';
    EXECUTE 'DROP POLICY IF EXISTS "Admin can delete pedido_items" ON pedido_items';
    EXECUTE 'DROP POLICY IF EXISTS "Dueno o staff puede leer pedido_items" ON pedido_items';
    EXECUTE 'DROP POLICY IF EXISTS "Dueno o staff puede crear pedido_items" ON pedido_items';
    EXECUTE 'DROP POLICY IF EXISTS "Dueno o staff puede editar pedido_items" ON pedido_items';
    EXECUTE 'DROP POLICY IF EXISTS "Dueno o staff puede borrar pedido_items" ON pedido_items';
    EXECUTE 'CREATE POLICY "Dueno o staff puede leer pedido_items" ON pedido_items FOR SELECT TO authenticated USING (pedido_id IN (SELECT id FROM pedidos WHERE cliente_id IN (SELECT mis_clientes_ids())))';
    EXECUTE 'CREATE POLICY "Dueno o staff puede crear pedido_items" ON pedido_items FOR INSERT TO authenticated WITH CHECK (pedido_id IN (SELECT id FROM pedidos WHERE cliente_id IN (SELECT mis_clientes_ids())))';
    EXECUTE 'CREATE POLICY "Dueno o staff puede editar pedido_items" ON pedido_items FOR UPDATE TO authenticated USING (pedido_id IN (SELECT id FROM pedidos WHERE cliente_id IN (SELECT mis_clientes_ids())))';
    EXECUTE 'CREATE POLICY "Dueno o staff puede borrar pedido_items" ON pedido_items FOR DELETE TO authenticated USING (pedido_id IN (SELECT id FROM pedidos WHERE cliente_id IN (SELECT mis_clientes_ids())))';
  END IF;
END $$;


-- =====================================================
-- 8) SUSCRIPCIONES / PROMOCIONES / PROMOCIONES_CLIENTE
--    Ya no necesitan SELECT anonimo directo: el menu publico ahora
--    usa las funciones RPC de la seccion 2. Anon solo puede INSERTAR
--    una suscripcion (formulario "Hacete socio").
-- =====================================================
DROP POLICY IF EXISTS "Admin can read suscripciones" ON suscripciones;
DROP POLICY IF EXISTS "Admin can insert suscripciones" ON suscripciones;
DROP POLICY IF EXISTS "Admin can update suscripciones" ON suscripciones;
DROP POLICY IF EXISTS "Admin can delete suscripciones" ON suscripciones;
DROP POLICY IF EXISTS "Publico puede suscribirse" ON suscripciones;
DROP POLICY IF EXISTS "Dueno o staff puede leer suscripciones" ON suscripciones;
DROP POLICY IF EXISTS "Dueno o staff puede editar suscripciones" ON suscripciones;
DROP POLICY IF EXISTS "Dueno o staff puede borrar suscripciones" ON suscripciones;

CREATE POLICY "Publico puede suscribirse" ON suscripciones FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Dueno o staff puede leer suscripciones" ON suscripciones FOR SELECT TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede editar suscripciones" ON suscripciones FOR UPDATE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede borrar suscripciones" ON suscripciones FOR DELETE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));

DROP POLICY IF EXISTS "Admin can read promociones" ON promociones;
DROP POLICY IF EXISTS "Admin can insert promociones" ON promociones;
DROP POLICY IF EXISTS "Admin can delete promociones" ON promociones;
DROP POLICY IF EXISTS "Admin can update promociones" ON promociones;
DROP POLICY IF EXISTS "Dueno o staff puede leer promociones" ON promociones;
DROP POLICY IF EXISTS "Dueno o staff puede crear promociones" ON promociones;
DROP POLICY IF EXISTS "Dueno o staff puede editar promociones" ON promociones;
DROP POLICY IF EXISTS "Dueno o staff puede borrar promociones" ON promociones;

CREATE POLICY "Dueno o staff puede leer promociones" ON promociones FOR SELECT TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede crear promociones" ON promociones FOR INSERT TO authenticated WITH CHECK (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede editar promociones" ON promociones FOR UPDATE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));
CREATE POLICY "Dueno o staff puede borrar promociones" ON promociones FOR DELETE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()));

DROP POLICY IF EXISTS "Admin can read promociones_cliente" ON promociones_cliente;
DROP POLICY IF EXISTS "Admin can insert promociones_cliente" ON promociones_cliente;
DROP POLICY IF EXISTS "Admin can delete promociones_cliente" ON promociones_cliente;
DROP POLICY IF EXISTS "Admin can update promociones_cliente" ON promociones_cliente;
DROP POLICY IF EXISTS "Dueno o staff puede leer promociones_cliente" ON promociones_cliente;
DROP POLICY IF EXISTS "Dueno o staff puede crear promociones_cliente" ON promociones_cliente;
DROP POLICY IF EXISTS "Dueno o staff puede editar promociones_cliente" ON promociones_cliente;
DROP POLICY IF EXISTS "Dueno o staff puede borrar promociones_cliente" ON promociones_cliente;

CREATE POLICY "Dueno o staff puede leer promociones_cliente" ON promociones_cliente FOR SELECT TO authenticated USING (promocion_id IN (SELECT id FROM promociones WHERE cliente_id IN (SELECT mis_clientes_ids())));
CREATE POLICY "Dueno o staff puede crear promociones_cliente" ON promociones_cliente FOR INSERT TO authenticated WITH CHECK (promocion_id IN (SELECT id FROM promociones WHERE cliente_id IN (SELECT mis_clientes_ids())));
CREATE POLICY "Dueno o staff puede editar promociones_cliente" ON promociones_cliente FOR UPDATE TO authenticated USING (promocion_id IN (SELECT id FROM promociones WHERE cliente_id IN (SELECT mis_clientes_ids())));
CREATE POLICY "Dueno o staff puede borrar promociones_cliente" ON promociones_cliente FOR DELETE TO authenticated USING (promocion_id IN (SELECT id FROM promociones WHERE cliente_id IN (SELECT mis_clientes_ids())));


-- =====================================================
-- 9) CLIENTE_USUARIOS (staff: mozo/cajero/socio de un negocio)
-- =====================================================
DROP POLICY IF EXISTS "Admin can read cliente_usuarios" ON cliente_usuarios;
DROP POLICY IF EXISTS "Admin can insert cliente_usuarios" ON cliente_usuarios;
DROP POLICY IF EXISTS "Admin can update cliente_usuarios" ON cliente_usuarios;
DROP POLICY IF EXISTS "Admin can delete cliente_usuarios" ON cliente_usuarios;
DROP POLICY IF EXISTS "Uno mismo o el dueno puede leer cliente_usuarios" ON cliente_usuarios;
DROP POLICY IF EXISTS "El dueno puede crear cliente_usuarios" ON cliente_usuarios;
DROP POLICY IF EXISTS "El dueno puede editar cliente_usuarios" ON cliente_usuarios;
DROP POLICY IF EXISTS "El dueno puede borrar cliente_usuarios" ON cliente_usuarios;

CREATE POLICY "Uno mismo o el dueno puede leer cliente_usuarios" ON cliente_usuarios FOR SELECT TO authenticated USING (user_id = auth.uid() OR cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid()) OR es_superadmin());
CREATE POLICY "El dueno puede crear cliente_usuarios" ON cliente_usuarios FOR INSERT TO authenticated WITH CHECK (cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid()) OR es_superadmin());
CREATE POLICY "El dueno puede editar cliente_usuarios" ON cliente_usuarios FOR UPDATE TO authenticated USING (cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid()) OR es_superadmin());
CREATE POLICY "El dueno puede borrar cliente_usuarios" ON cliente_usuarios FOR DELETE TO authenticated USING (cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid()) OR es_superadmin());


-- =====================================================
-- 10) VENDEDORES (plataforma: solo superadmin gestiona; cada
--     vendedor puede ver/editar su propia fila)
-- =====================================================
DROP POLICY IF EXISTS "Admin can read vendedores" ON vendedores;
DROP POLICY IF EXISTS "Admin can insert vendedores" ON vendedores;
DROP POLICY IF EXISTS "Admin can update vendedores" ON vendedores;
DROP POLICY IF EXISTS "Admin can delete vendedores" ON vendedores;
DROP POLICY IF EXISTS "Uno mismo o superadmin puede leer vendedores" ON vendedores;
DROP POLICY IF EXISTS "Superadmin puede crear vendedores" ON vendedores;
DROP POLICY IF EXISTS "Uno mismo o superadmin puede editar vendedores" ON vendedores;
DROP POLICY IF EXISTS "Superadmin puede borrar vendedores" ON vendedores;

CREATE POLICY "Uno mismo o superadmin puede leer vendedores" ON vendedores FOR SELECT TO authenticated USING (user_id = auth.uid() OR es_superadmin());
CREATE POLICY "Superadmin puede crear vendedores" ON vendedores FOR INSERT TO authenticated WITH CHECK (es_superadmin());
CREATE POLICY "Uno mismo o superadmin puede editar vendedores" ON vendedores FOR UPDATE TO authenticated USING (user_id = auth.uid() OR es_superadmin());
CREATE POLICY "Superadmin puede borrar vendedores" ON vendedores FOR DELETE TO authenticated USING (es_superadmin());


-- =====================================================
-- 11) SOLICITUDES_CLIENTE (leads que carga cada vendedor)
-- =====================================================
DROP POLICY IF EXISTS "Admin can read solicitudes" ON solicitudes_cliente;
DROP POLICY IF EXISTS "Admin can insert solicitudes" ON solicitudes_cliente;
DROP POLICY IF EXISTS "Admin can update solicitudes" ON solicitudes_cliente;
DROP POLICY IF EXISTS "Admin can delete solicitudes" ON solicitudes_cliente;
DROP POLICY IF EXISTS "Vendedor dueno o superadmin puede leer solicitudes" ON solicitudes_cliente;
DROP POLICY IF EXISTS "Vendedor puede crear solicitudes" ON solicitudes_cliente;
DROP POLICY IF EXISTS "Vendedor dueno o superadmin puede editar solicitudes" ON solicitudes_cliente;
DROP POLICY IF EXISTS "Vendedor dueno o superadmin puede borrar solicitudes" ON solicitudes_cliente;

CREATE POLICY "Vendedor dueno o superadmin puede leer solicitudes" ON solicitudes_cliente FOR SELECT TO authenticated USING (vendedor_id IN (SELECT id FROM vendedores WHERE user_id = auth.uid()) OR es_superadmin());
CREATE POLICY "Vendedor puede crear solicitudes" ON solicitudes_cliente FOR INSERT TO authenticated WITH CHECK (vendedor_id IN (SELECT id FROM vendedores WHERE user_id = auth.uid()) OR es_superadmin());
CREATE POLICY "Vendedor dueno o superadmin puede editar solicitudes" ON solicitudes_cliente FOR UPDATE TO authenticated USING (vendedor_id IN (SELECT id FROM vendedores WHERE user_id = auth.uid()) OR es_superadmin());
CREATE POLICY "Vendedor dueno o superadmin puede borrar solicitudes" ON solicitudes_cliente FOR DELETE TO authenticated USING (vendedor_id IN (SELECT id FROM vendedores WHERE user_id = auth.uid()) OR es_superadmin());


-- =====================================================
-- 12) SOCIOS_SOLICITUD (tabla legacy: no la usa el codigo actual,
--     el formulario "Hacete socio" hoy escribe en `suscripciones`.
--     La dejamos igual de restringida por las dudas, sin romper nada.)
-- =====================================================
DO $$ BEGIN
  IF to_regclass('public.socios_solicitud') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can read socios_solicitud" ON socios_solicitud';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can delete socios_solicitud" ON socios_solicitud';
    EXECUTE 'DROP POLICY IF EXISTS "Dueno o staff puede leer socios_solicitud" ON socios_solicitud';
    EXECUTE 'DROP POLICY IF EXISTS "Dueno o staff puede borrar socios_solicitud" ON socios_solicitud';
    EXECUTE 'CREATE POLICY "Dueno o staff puede leer socios_solicitud" ON socios_solicitud FOR SELECT TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()))';
    EXECUTE 'CREATE POLICY "Dueno o staff puede borrar socios_solicitud" ON socios_solicitud FOR DELETE TO authenticated USING (cliente_id IN (SELECT mis_clientes_ids()))';
  END IF;
END $$;


-- =====================================================
-- ROLLBACK (solo si algo se rompe y necesitas volver rapido a las
-- politicas abiertas de antes, mientras lo revisamos con calma).
-- Descomenta y corre esta seccion completa.
-- =====================================================
-- DROP POLICY IF EXISTS "Publico puede leer clientes (menu)" ON clientes;
-- DROP POLICY IF EXISTS "Superadmin o vendedor puede crear clientes" ON clientes;
-- DROP POLICY IF EXISTS "Dueno puede actualizar su cliente" ON clientes;
-- DROP POLICY IF EXISTS "Superadmin puede borrar clientes" ON clientes;
-- CREATE POLICY "Admin can read clientes" ON clientes FOR SELECT USING (true);
-- CREATE POLICY "Admin can insert clientes" ON clientes FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Admin can update clientes" ON clientes FOR UPDATE USING (true);
-- CREATE POLICY "Admin can delete clientes" ON clientes FOR DELETE USING (true);
-- (repetir el patron equivalente para cada tabla si hace falta;
--  el archivo rls_policies.sql original tiene el texto exacto de
--  cada policy vieja para copiar y pegar)
