// Textos fijos del menú del cliente en cada idioma.
// Cada fila: [español, en, pt, fr, it, de, ru, zh, ja].
// Si el español termina en "*" es un PREFIJO: se traduce el comienzo del texto y se
// conserva lo que sigue (ej. "Total $1.200" -> "Gesamt $1.200").
// Los nombres de productos y categorías NO pasan por acá (se traducen aparte).
export const COLUMNAS = ['en', 'pt', 'fr', 'it', 'de', 'ru', 'zh', 'ja']

export const FILAS = [
  // Pantallas y botones
  ['Categorías', 'Categories', 'Categorias', 'Catégories', 'Categorie', 'Kategorien', 'Категории', '分类', 'カテゴリ'],
  ['Productos', 'Products', 'Produtos', 'Produits', 'Prodotti', 'Produkte', 'Товары', '产品', '商品'],
  ['Mi pedido', 'My order', 'Meu pedido', 'Ma commande', 'Il mio ordine', 'Meine Bestellung', 'Мой заказ', '我的订单', 'ご注文'],
  ['Salir', 'Exit', 'Sair', 'Quitter', 'Esci', 'Beenden', 'Выйти', '退出', '終了'],
  ['Enviar Pedido', 'Send order', 'Enviar pedido', 'Envoyer la commande', 'Invia ordine', 'Bestellung senden', 'Отправить заказ', '提交订单', '注文を送信'],
  ['Enviando...', 'Sending...', 'Enviando...', 'Envoi...', 'Invio...', 'Wird gesendet...', 'Отправка...', '发送中...', '送信中...'],
  ['Reintentar', 'Retry', 'Tentar novamente', 'Réessayer', 'Riprova', 'Erneut versuchen', 'Повторить', '重试', '再試行'],
  ['Enviar', 'Send', 'Enviar', 'Envoyer', 'Invia', 'Senden', 'Отправить', '发送', '送信'],
  ['Buscar', 'Search', 'Buscar', 'Rechercher', 'Cerca', 'Suchen', 'Найти', '查找', '検索'],
  ['Cargando...', 'Loading...', 'Carregando...', 'Chargement...', 'Caricamento...', 'Wird geladen...', 'Загрузка...', '加载中...', '読み込み中...'],
  ['Cerrado', 'Closed', 'Fechado', 'Fermé', 'Chiuso', 'Geschlossen', 'Закрыто', '已关闭', '閉店'],
  ['Pedido entregado', 'Order delivered', 'Pedido entregue', 'Commande livrée', 'Ordine consegnato', 'Bestellung geliefert', 'Заказ доставлен', '订单已送达', '注文は配達済みです'],
  ['Deslizá para girar · tocá la del centro para entrar', 'Swipe to rotate · tap the center one to enter', 'Deslize para girar · toque na do centro para entrar', 'Faites glisser pour tourner · touchez celle du centre pour entrer', 'Scorri per ruotare · tocca quella al centro per entrare', 'Wischen zum Drehen · die mittlere antippen zum Öffnen', 'Проведите, чтобы повернуть · коснитесь центральной, чтобы войти', '滑动旋转 · 点击中间的进入', 'スワイプで回転 · 中央をタップして開く'],

  // Datos del pedido
  ['Tu nombre', 'Your name', 'Seu nome', 'Votre nom', 'Il tuo nome', 'Ihr Name', 'Ваше имя', '您的姓名', 'お名前'],
  ['Tu teléfono', 'Your phone', 'Seu telefone', 'Votre téléphone', 'Il tuo telefono', 'Ihre Telefonnummer', 'Ваш телефон', '您的电话', 'お電話番号'],
  ['Dirección delivery', 'Delivery address', 'Endereço de entrega', 'Adresse de livraison', 'Indirizzo di consegna', 'Lieferadresse', 'Адрес доставки', '配送地址', '配達先住所'],
  ['Agregar delivery al pedido', 'Add delivery to the order', 'Adicionar entrega ao pedido', 'Ajouter la livraison à la commande', "Aggiungi la consegna all'ordine", 'Lieferung zur Bestellung hinzufügen', 'Добавить доставку к заказу', '订单添加外送', '注文にデリバリーを追加'],
  ['Retirar en el local', 'Pick up at the restaurant', 'Retirar no local', 'Retirer sur place', 'Ritiro in sede', 'Im Lokal abholen', 'Забрать в заведении', '到店自取', '店頭で受け取る'],
  ['Nombre y apellido', 'Full name', 'Nome completo', 'Nom et prénom', 'Nome e cognome', 'Vor- und Nachname', 'Имя и фамилия', '姓名', '氏名'],
  ['Ej: 351 555 1234', 'e.g. 351 555 1234', 'Ex.: 351 555 1234', 'Ex. : 351 555 1234', 'Es.: 351 555 1234', 'z. B. 351 555 1234', 'Напр.: 351 555 1234', '例如：351 555 1234', '例：351 555 1234'],
  ['Calle, número, barrio', 'Street, number, neighborhood', 'Rua, número, bairro', 'Rue, numéro, quartier', 'Via, numero, quartiere', 'Straße, Nummer, Viertel', 'Улица, дом, район', '街道、门牌号、街区', '通り、番地、地区'],

  // Totales y propina
  ['Subtotal*', 'Subtotal', 'Subtotal', 'Sous-total', 'Subtotale', 'Zwischensumme', 'Подытог', '小计', '小計'],
  ['Total*', 'Total', 'Total', 'Total', 'Totale', 'Gesamt', 'Итого', '总计', '合計'],
  ['Delivery*', 'Delivery', 'Entrega', 'Livraison', 'Consegna', 'Lieferung', 'Доставка', '外送', 'デリバリー'],
  ['Descuento promo*', 'Promo discount', 'Desconto promo', 'Remise promo', 'Sconto promo', 'Promo-Rabatt', 'Скидка по акции', '促销折扣', 'プロモ割引'],
  ['Propina para el mozo', 'Tip for the waiter', 'Gorjeta para o garçom', 'Pourboire pour le serveur', 'Mancia per il cameriere', 'Trinkgeld für den Kellner', 'Чаевые официанту', '给服务员的小费', 'ウェイターへのチップ'],
  ['Propina mozo*', 'Waiter tip', 'Gorjeta do garçom', 'Pourboire serveur', 'Mancia cameriere', 'Trinkgeld Kellner', 'Чаевые официанту', '服务员小费', 'ウェイターチップ'],
  ['Propina:*', 'Tip:', 'Gorjeta:', 'Pourboire :', 'Mancia:', 'Trinkgeld:', 'Чаевые:', '小费：', 'チップ：'],
  ['% del total', '% of total', '% do total', '% du total', '% del totale', '% vom Gesamtbetrag', '% от суммы', '% 占总额', '% / 合計'],
  ['Mesa*', 'Table', 'Mesa', 'Table', 'Tavolo', 'Tisch', 'Стол', '桌号', 'テーブル'],

  // Información del local
  ['Información', 'Information', 'Informações', 'Informations', 'Informazioni', 'Informationen', 'Информация', '信息', '情報'],
  ['Horario', 'Hours', 'Horário', 'Horaires', 'Orari', 'Öffnungszeiten', 'Часы работы', '营业时间', '営業時間'],
  ['Enviar mensaje', 'Send message', 'Enviar mensagem', 'Envoyer un message', 'Invia messaggio', 'Nachricht senden', 'Отправить сообщение', '发送消息', 'メッセージを送る'],
  ['Ubicación', 'Location', 'Localização', 'Localisation', 'Posizione', 'Standort', 'Местоположение', '位置', '場所'],
  ['Sin información cargada', 'No information available', 'Nenhuma informação cadastrada', 'Aucune information disponible', 'Nessuna informazione disponibile', 'Keine Informationen vorhanden', 'Информация отсутствует', '暂无信息', '情報がありません'],

  // Promociones y socios
  ['Promociones', 'Promotions', 'Promoções', 'Promotions', 'Promozioni', 'Aktionen', 'Акции', '促销活动', 'プロモーション'],
  ['Tus promociones', 'Your promotions', 'Suas promoções', 'Vos promotions', 'Le tue promozioni', 'Ihre Aktionen', 'Ваши акции', '您的优惠', 'あなたのプロモーション'],
  ['Ya soy socio', "I'm already a member", 'Já sou sócio', 'Je suis déjà membre', 'Sono già socio', 'Ich bin bereits Mitglied', 'Я уже участник', '我已是会员', '会員登録済みです'],
  ['Todavía no soy socio', "I'm not a member yet", 'Ainda não sou sócio', 'Je ne suis pas encore membre', 'Non sono ancora socio', 'Ich bin noch kein Mitglied', 'Я ещё не участник', '我还不是会员', 'まだ会員ではありません'],
  ['Hacete socio', 'Become a member', 'Torne-se sócio', 'Devenez membre', 'Diventa socio', 'Werde Mitglied', 'Стать участником', '成为会员', '会員になる'],
  ['Ingresá el WhatsApp con el que te suscribiste', 'Enter the WhatsApp number you signed up with', 'Digite o WhatsApp com o qual você se inscreveu', 'Saisissez le WhatsApp avec lequel vous vous êtes inscrit', 'Inserisci il WhatsApp con cui ti sei iscritto', 'Gib die WhatsApp-Nummer ein, mit der du dich angemeldet hast', 'Введите номер WhatsApp, с которым вы подписались', '请输入您订阅时使用的 WhatsApp 号码', '登録時のWhatsApp番号を入力してください'],
  ['Completá tus datos y te contactamos', "Fill in your details and we'll contact you", 'Preencha seus dados e entraremos em contato', 'Renseignez vos coordonnées et nous vous contacterons', 'Compila i tuoi dati e ti contatteremo', 'Gib deine Daten ein, wir melden uns', 'Заполните данные, и мы свяжемся с вами', '请填写您的信息，我们会联系您', '情報を入力してください。こちらからご連絡します'],

  // Avisos
  ['Elegí al menos un producto para el pedido', 'Choose at least one product for the order', 'Escolha pelo menos um produto para o pedido', 'Choisissez au moins un produit pour la commande', "Scegli almeno un prodotto per l'ordine", 'Wähle mindestens ein Produkt für die Bestellung', 'Выберите хотя бы один товар для заказа', '请至少选择一件产品', '注文する商品を1つ以上選んでください'],
  ['Error al enviar, intenta de nuevo', 'Error sending, please try again', 'Erro ao enviar, tente novamente', "Erreur d'envoi, veuillez réessayer", 'Errore di invio, riprova', 'Fehler beim Senden, bitte erneut versuchen', 'Ошибка отправки, попробуйте ещё раз', '发送失败，请重试', '送信に失敗しました。もう一度お試しください'],
  ['Error al enviar. Intentá de nuevo', 'Error sending, please try again', 'Erro ao enviar, tente novamente', "Erreur d'envoi, veuillez réessayer", 'Errore di invio, riprova', 'Fehler beim Senden, bitte erneut versuchen', 'Ошибка отправки, попробуйте ещё раз', '发送失败，请重试', '送信に失敗しました。もう一度お試しください'],
  ['Escribí tu opinión o consulta', 'Write your opinion or question', 'Escreva sua opinião ou dúvida', 'Écrivez votre avis ou votre question', 'Scrivi la tua opinione o domanda', 'Schreibe deine Meinung oder Frage', 'Напишите свой отзыв или вопрос', '请填写您的意见或问题', 'ご意見やご質問を入力してください'],
  ['Ingresá tu WhatsApp', 'Enter your WhatsApp', 'Digite seu WhatsApp', 'Saisissez votre WhatsApp', 'Inserisci il tuo WhatsApp', 'Gib deine WhatsApp-Nummer ein', 'Введите ваш WhatsApp', '请输入您的 WhatsApp', 'WhatsApp番号を入力してください'],
  ['Ingresá tu nombre y teléfono', 'Enter your name and phone', 'Digite seu nome e telefone', 'Saisissez votre nom et votre téléphone', 'Inserisci il tuo nome e telefono', 'Gib deinen Namen und deine Telefonnummer ein', 'Введите имя и телефон', '请输入姓名和电话', 'お名前とお電話番号を入力してください'],
  ['Ingresá un WhatsApp válido (mínimo 8 dígitos)', 'Enter a valid WhatsApp number (at least 8 digits)', 'Digite um WhatsApp válido (mínimo 8 dígitos)', 'Saisissez un WhatsApp valide (8 chiffres minimum)', 'Inserisci un WhatsApp valido (almeno 8 cifre)', 'Gib eine gültige WhatsApp-Nummer ein (mindestens 8 Ziffern)', 'Введите корректный WhatsApp (минимум 8 цифр)', '请输入有效的 WhatsApp 号码（至少 8 位）', '有効なWhatsApp番号を入力してください（8桁以上）'],
  ['No encontramos ese número. Completá tus datos para suscribirte', "We couldn't find that number. Fill in your details to subscribe", 'Não encontramos esse número. Preencha seus dados para se inscrever', "Nous n'avons pas trouvé ce numéro. Renseignez vos coordonnées pour vous inscrire", 'Non abbiamo trovato quel numero. Compila i tuoi dati per iscriverti', 'Diese Nummer wurde nicht gefunden. Gib deine Daten ein, um dich anzumelden', 'Номер не найден. Заполните данные, чтобы подписаться', '未找到该号码。请填写信息进行订阅', 'その番号は見つかりませんでした。登録するには情報を入力してください'],
  ['No se pudo confirmar la entrega. Intentá nuevamente.', "The delivery couldn't be confirmed. Please try again.", 'Não foi possível confirmar a entrega. Tente novamente.', "La livraison n'a pas pu être confirmée. Veuillez réessayer.", 'Impossibile confermare la consegna. Riprova.', 'Die Lieferung konnte nicht bestätigt werden. Bitte erneut versuchen.', 'Не удалось подтвердить доставку. Попробуйте ещё раз.', '无法确认送达，请重试。', '配達を確認できませんでした。もう一度お試しください。'],
  ['Nombre y WhatsApp son requeridos', 'Name and WhatsApp are required', 'Nome e WhatsApp são obrigatórios', 'Le nom et le WhatsApp sont obligatoires', 'Nome e WhatsApp sono obbligatori', 'Name und WhatsApp sind erforderlich', 'Имя и WhatsApp обязательны', '姓名和 WhatsApp 为必填项', 'お名前とWhatsAppは必須です'],
  ['Pedido enviado! Esperá un momento', 'Order sent! Please wait a moment', 'Pedido enviado! Aguarde um momento', 'Commande envoyée ! Un instant, s’il vous plaît', 'Ordine inviato! Attendi un momento', 'Bestellung gesendet! Bitte einen Moment warten', 'Заказ отправлен! Подождите немного', '订单已提交！请稍等', '注文を送信しました！少々お待ちください'],
  ['Recepción confirmada. ¡Gracias!', 'Receipt confirmed. Thank you!', 'Recebimento confirmado. Obrigado!', 'Réception confirmée. Merci !', 'Ricezione confermata. Grazie!', 'Empfang bestätigt. Danke!', 'Получение подтверждено. Спасибо!', '已确认收货。谢谢！', '受け取りを確認しました。ありがとうございます！'],
  ['Sin mesa asignada', 'No table assigned', 'Nenhuma mesa atribuída', 'Aucune table attribuée', 'Nessun tavolo assegnato', 'Kein Tisch zugewiesen', 'Стол не назначен', '未分配桌号', 'テーブルが割り当てられていません'],
  ['WhatsApp no disponible', 'WhatsApp not available', 'WhatsApp indisponível', 'WhatsApp non disponible', 'WhatsApp non disponibile', 'WhatsApp nicht verfügbar', 'WhatsApp недоступен', 'WhatsApp 不可用', 'WhatsAppは利用できません'],
  ['¡Gracias! Recibimos tu mensaje', 'Thank you! We received your message', 'Obrigado! Recebemos sua mensagem', 'Merci ! Nous avons reçu votre message', 'Grazie! Abbiamo ricevuto il tuo messaggio', 'Danke! Wir haben deine Nachricht erhalten', 'Спасибо! Мы получили ваше сообщение', '谢谢！我们已收到您的消息', 'ありがとうございます！メッセージを受け取りました'],
  ['¡Mozo llamado! Esperá un momento', 'Waiter called! Please wait a moment', 'Garçom chamado! Aguarde um momento', 'Serveur appelé ! Un instant, s’il vous plaît', 'Cameriere chiamato! Attendi un momento', 'Kellner gerufen! Bitte einen Moment warten', 'Официант вызван! Подождите немного', '已呼叫服务员！请稍等', 'ウェイターを呼びました！少々お待ちください'],
  ['Error al llamar mozo:*', 'Error calling the waiter:', 'Erro ao chamar o garçom:', "Erreur lors de l'appel du serveur :", 'Errore nella chiamata al cameriere:', 'Fehler beim Rufen des Kellners:', 'Ошибка вызова официанта:', '呼叫服务员出错：', 'ウェイター呼び出しエラー：'],
]
