const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');

// ==================== CONFIGURATION ====================
// Tetap mempertahankan variabel bawaan asli Anda yang tidak boleh diubah
const TOKEN = process.env.DISCORD_TOKEN; 
const CLIENT_ID = '1506935185059614821'; 
const PORT = process.env.PORT || 7860; 

// ==================== INITIALIZATION ====================
// Inisialisasi Bot Discord dengan Intents yang dioptimasi
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Inisialisasi Web API Express & Database Memory
const expressApp = express();
const keyDatabase = new Map();

// ==================== SLASH COMMAND REGISTRATION ====================
const commands = [
    new SlashCommandBuilder()
        .setName('getkey')
        .setDescription('Generate key lisensi AR Script Hub untuk 24 jam')
].map(command => command.toJSON());

// PERBAIKAN: Meningkatkan waktu tunggu timeout ke 30 detik (30000ms) 
// Ini membantu menembus keterbatasan delay jaringan pada sistem Hugging Face
const rest = new REST({ 
    version: '10',
    timeout: 30000 
}).setToken(TOKEN);

// Fungsi pendaftaran command dibuat terpisah agar tidak membuat aplikasi crash jika timeout
async function registerSlashCommands() {
    try {
        console.log('⏳ Sedang mendaftarkan slash commands ke Discord...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );
        console.log('✅ Slash commands berhasil didaftarkan secara global!');
    } catch (error) {
        console.error('⚠️ Gagal mendaftarkan slash commands (Timeout/Network Error):', error.message);
        console.log('💡 Catatan: Bot tetap berjalan. Masalah ini biasanya karena network hosting ke Discord sedang tidak stabil.');
    }
}

// ==================== DISCORD BOT EVENTS ====================
client.once('ready', () => {
    console.log(`🤖 Bot Discord online sebagai ${client.user.tag}!`);
    // Jalankan pendaftaran command setelah bot dipastikan online
    registerSlashCommands();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'getkey') {
        const userId = interaction.user.id;                        
        
        // Membuat key acak (Contoh: AR-XXXXXX)
        const generatedKey = 'AR-' + Math.random().toString(36).substring(2, 9).toUpperCase();
        const expiryTime = Date.now() + (24 * 60 * 60 * 1000); // 24 Jam dari sekarang

        // Simpan ke database memory
        keyDatabase.set(generatedKey, {
            userId: userId,
            expiresAt: expiryTime
        });

        await interaction.reply({
            content: `🔑 **KEY BERHASIL DIGENERATE!**\n\n` +                                          
                      `• **Key:** \`${generatedKey}\` (Klik untuk copy)\n` +                                          
                      `• **Durasi:** Berlaku selama 24 Jam.\n\n` +                                          
                      `*Silakan paste key ini ke dalam script AR Hub di Roblox.*`,
            ephemeral: true // Hanya bisa dilihat oleh user yang mengetik perintah
        });
    }
});

// Menjalankan login Discord langsung ke gateway resmi tanpa proxy yang rawan mati
if (TOKEN) {
    console.log("⏳ Mencoba menghubungkan langsung ke Gateway Resmi Discord...");
    client.login(TOKEN).catch(err => {
        console.error("❌ Gagal Login ke Discord Bot. Periksa kembali DISCORD_TOKEN Anda:", err.message);
    });
} else {
    console.error("❌ ERROR: DISCORD_TOKEN tidak ditemukan di Environment Variables hosting Anda!");
}

// ==================== WEB API ENDPOINTS ====================
// Halaman utama (root) agar platform hosting tahu kalau web server aktif (mencegah komplain port)
expressApp.get('/', (req, res) => {
    res.send("AR Script Hub Web API is Online!");
});

// Pintu Gerbang Validasi untuk Script Roblox
expressApp.get('/validate', (req, res) => {
    // Menambahkan pengaman trim() untuk membersihkan spasi kotor dari TextBox Roblox
    const userKey = req.query.key ? req.query.key.trim() : null;

    if (!userKey) {
        return res.send("KEY_EMPTY");
    }

    // Cek apakah key terdaftar di database memory
    if (keyDatabase.has(userKey)) {
        const keyData = keyDatabase.get(userKey);
        const currentTime = Date.now();

        // Cek apakah key sudah kadaluarsa (lewat 24 jam di sisi server)
        if (currentTime > keyData.expiresAt) {
            keyDatabase.delete(userKey); // Hapus key yang expired dari database
            return res.send("EXPIRED");
        }

        // Jika lolos semua pengecekan, kirim balasan VALID ke Roblox
        return res.send("VALID");
    } else {
        // Jika key tidak ditemukan
        return res.send("INVALID");
    }
});

// Jalankan Web API Express
expressApp.listen(PORT, () => {
    console.log(`🌐 Web API Key System berjalan di port ${PORT}`);
});