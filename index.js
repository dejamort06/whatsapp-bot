const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const pino = require('pino')
const qrcode = require('qrcode-terminal')

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.clear()
      console.log('📱 WhatsApp Web QR Kodunu Tara:\n')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
      console.log('❌ Bağlantı koptu. Tekrar bağlanıyor mu?', shouldReconnect)
      if (shouldReconnect) startBot()
    } else if (connection === 'open') {
      console.log('✅ Bot bağlandı ve çalışıyor.')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message) return
    if (msg.key.fromMe) return

    const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase()
    const sender = msg.key.remoteJid

    // Yasaklı kelimeler listesi
    const forbiddenWords = ['orospu', 'şerefsiz', 'piç', 'siktir']

    // Şikayet kelimeleri
    const complaintWords = ['şikayet', 'savcılık', 'karakol', 'paramı istiyorum']

    // 1. Küfür kontrolü
    if (forbiddenWords.some(w => text.includes(w))) {
      await sock.sendMessage(sender, { text: 'Lütfen saygılı olunuz. Küfür içeren mesajlar engellenmektedir.' })
      return
    }

    // 2. IBAN kontrolü (örnek TR + 24 rakam)
    if (text.match(/tr\d{24}/i)) {
      await sock.sendMessage(sender, { text: 'Güvenliğiniz için IBAN paylaşımı yapmayınız.' })
      return
    }

    // 3. Şikayet kelimeleri kontrolü
    if (complaintWords.some(w => text.includes(w))) {
      await sock.sendMessage(sender, {
        text: 'Şikayetlerinizi aşağıdaki form aracılığıyla iletebilirsiniz:\nhttps://docs.google.com/forms/d/e/1FAIpQLSe63XN8iqG7Otx8PNV33Hf8P4Y_obxWtXKFf50Dhi025a11uw/viewform?usp=header\nAyrıca tüketici hakem heyetine başvurabilirsiniz.'
      })
      return
    }

    // 4. Kurulum kelimesi kontrolü
    if (text.includes('kurulum')) {
      await sock.sendMessage(sender, {
        text: 'Uzaktan kurulum desteği için lütfen 5506987031 numarası ile WhatsApp\'tan iletişime geçin.'
      })
      return
    }

    // 5. Kargo kelimesi kontrolü
    if (text.includes('kargo')) {
      await sock.sendMessage(sender, {
        text: 'Kargo çıkışı yapıldıktan sonra teslimat 48 saat içerisinde gerçekleşmektedir. Sorun devam ederse 5506987031 numarası ile iletişime geçiniz.'
      })
      return
    }

    // 6. İade kelimesi kontrolü
    if (text.includes('iade')) {
      await sock.sendMessage(sender, {
        text: 'İade işlemleri için SMS ile gönderilen numaralarla iletişime geçiniz. Tekrar yazarsanız şikayet formunu paylaşırım.'
      })
      return
    }

    // 7. Modem/router kelimesi yerine "cihaz" cevabı
    if (text.includes('modem') || text.includes('router')) {
      await sock.sendMessage(sender, {
        text: 'Cihazınızla ilgili sorunuz için yardımcı olmaya hazırım.'
      })
      return
    }

    // Örnek temel selamlaşma cevabı
    if (text.includes('merhaba')) {
      await sock.sendMessage(sender, { text: 'Merhaba, size nasıl yardımcı olabilirim?' })
      return
    }

    // Opsiyonel: Diğer tüm mesajlara cevap
    // await sock.sendMessage(sender, { text: 'Mesajınızı aldım, en kısa sürede size döneceğiz.' })
  })
}

startBot()
