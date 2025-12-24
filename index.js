const {
    default: makeWASocket,
    getAggregateVotesInPollMessage, 
    useMultiFileAuthState,
    DisconnectReason,
    getContentType,
    jidNormalizedUser,
    generateForwardMessageContent,
    generateWAMessageFromContent,
    prepareWAMessageMedia,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const P = require('pino');
const FileType = require('file-type');
const moment = require('moment-timezone');
const l = console.log;
var config = require('./settings');
const NodeCache = require('node-cache');
// const { spawn } = require('child_process');
// Telegram optional
// spawn('python3', ['lib/telegram_file_api.py'], { stdio: 'inherit' });
const util = require('util');
const mongoose = require('mongoose');
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const cheerio = require("cheerio");

var prefix = config.PREFIX;
const news = config.news;
var prefixRegex = config.PREFIX === "false" || config.PREFIX === "null" ? "^" : new RegExp('^[' + config.PREFIX + ']');

const {
    smsg,
    getBuffer,
    getGroupAdmins,
    getRandom,
    h2k,
    isUrl,
    Json,
    runtime,
    sleep,
    fetchJson,
    fetchBuffer,
    getFile
} = require('./lib/functions');

const {
    sms,
    downloadMediaMessage
} = require('./lib/msg');

var { updateCMDStore, isbtnID, getCMDStore, getCmdForCmdId, connectdb, input, get, updb, updfb } = require("./lib/database");
var { get_set , input_set } = require('./lib/set_db');        
const axios = require('axios');

function genMsgId() {
  const prefix = "3EB";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomText = prefix;

  for (let i = prefix.length; i < 22; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomText += characters.charAt(randomIndex);
  }   
  return randomText;
}    

const { File } = require('megajs');
const path = require('path');
const msgRetryCounterCache = new NodeCache();
const ownerNumber = config.OWNER_NUMBER;

//===================SESSION============================
if (!fs.existsSync(__dirname + '/lib/session/creds.json')) {
    if (config.SESSION_ID) {
      const sessdata = config.SESSION_ID.replace("𝐍𝐈𝐊𝐀-𝐌𝐃= ");
      const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
      filer.download((err, data) => {
        if (err) throw err;
        fs.writeFile(__dirname + '/lib/session/creds.json', data, () => {
          console.log("Session download completed !!");
        });
      });
    }
}

// <<==========PORTS===========>>
const express = require("express");
const app = express();
const port = process.env.PORT || 8000;

//====================================
async function connectToWA() {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/lib/session/');
    const conn = makeWASocket({
        logger: P({ level: "fatal" }).child({ level: "fatal" }),
        auth: state,
        defaultQueryTimeoutMs: undefined,
        msgRetryCounterCache
    });

    // Handle QR manually
    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) console.log("QR Code received, scan it via WA App");
        if (connection === 'close') {
            if (lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut) {
                connectToWA();
            }
        } else if (connection === 'open') {
            console.log('Bot connected ✅');
            // Plugins auto-load
            fs.readdirSync("./plugins/").forEach((plugin) => {
                if (path.extname(plugin).toLowerCase() == ".js") {
                    require("./plugins/" + plugin);
                }
            });
            console.log('Plugins installed ✅');
        }
    });

    conn.ev.on('creds.update', saveCreds);

    // ===== Message handling (button, list, poll, etc) =====
    conn.ev.on('messages.upsert', async (mek) => {
        mek = mek.messages[0];
        if (!mek.message) return;
        const m = sms(conn, mek);
        const type = getContentType(mek.message);
        const body = (type === 'conversation') ? mek.message.conversation :
                     (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : '';

        // Command prefix
        var isCmd = body.startsWith(prefix);	    
        var command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
        var args = body.trim().split(/ +/).slice(1);
        var q = args.join(' ');

        const isGroup = mek.key.remoteJid.endsWith('@g.us');
        const sender = mek.key.fromMe ? (conn.user.id.split(':')[0] + '@s.whatsapp.net') : (mek.key.participant || mek.key.remoteJid);
        const senderNumber = sender.split('@')[0];
        const botNumber = conn.user.id.split(':')[0];
        const isOwner = ownerNumber.includes(senderNumber);

        // ===== Run commands =====
        const events = require('./lib/command');
        const cmdName = isCmd ? command : false;
        if (isCmd) {
            const cmd = events.commands.find((cmd) => cmd.pattern === cmdName) || events.commands.find((cmd) => cmd.alias && cmd.alias.includes(cmdName));
            if (cmd) {
                try {
                    cmd.function(conn, mek, m, { from: mek.key.remoteJid, prefix, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber, isOwner });
                } catch (e) {
                    console.error("[PLUGIN ERROR] ", e);
                }
            }
        }
    });

    return conn;
}

// ===== Express Server =====
app.get("/", (req, res) => res.send("📟 Gojo-Md Working successfully!"));
app.listen(port, () => console.log(`Gojo-Md Server listening on port http://localhost:${port}`));

setTimeout(() => {
    connectToWA();
}, 3000);
