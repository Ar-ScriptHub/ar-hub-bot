const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');

// ==================== CONFIGURATION ====================
// PENTING: Jangan tulis token langsung di sini agar tidak dicolong jika repo ter-publish.
// Kita pakai process.env agar membaca data dari menu "Environment Variables" di Render.
const TOKEN = process.env.DISCORD_TOKEN; 
const CLIENT_ID = '1506935185059614821'; 

// Render akan otomatis memberikan nomor Port secara dinamis melalui process.env.PORT.
// Jika tidak ada (saat ditest lokal), dia akan memakai port 3000.
const PORT = process.env.PORT || 3000; 
// =======================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const expressApp = express();
const keyDatabase = new Map();

// Halaman utama (root) agar Render tahu kalau web server kamu aktif saat dicek/ping
expressApp.get('/', (req, res) => {
    res.send("AR Script Hub Web API is Online!");
});

// -------------------------------------------------------
// 1. DISCORD BOT SIDE (Logika Discord)
// -------------------------------------------------------
const commands = [
    new SlashCommandBuilder()
        .setName('getkey')
        .setDescription('Generate key AR Script Hub untuk 24 jam')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Sedang mendaftarkan slash commands...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Slash commands berhasil didaftarkan!');
    } catch (error) {
        console.error(error);
    }
})();

client.once('ready', () => {
    console.log(`Bot Discord online sebagai ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'getkey') {
        const userId = interaction.user.id;

        // Bikin key acak (Contoh: AR-XXXXXX)
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
            ephemeral: true
        });
    }
});

client.login(TOKEN);

// -------------------------------------------------------
// 2. WEB API SIDE (Pintu Gerbang untuk Roblox)
// -------------------------------------------------------
expressApp.get('/validate', (req, res) => {
    const userKey = req.query.key;

    if (!userKey) {
        return res.send("KEY_EMPTY");
    }

    // Cek apakah key ada di database
    if (keyDatabase.has(userKey)) {
        const keyData = keyDatabase.get(userKey);
        const currentTime = Date.now();

        // Cek apakah key sudah kadaluarsa (lewat 24 jam)
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

// Jalankan Web API di Port yang ditentukan oleh Render
expressApp.listen(PORT, () => {
    console.log(`Web API Key System berjalan di port ${PORT}`);
});