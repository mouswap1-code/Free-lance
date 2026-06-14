const http = require('http');
const crypto = require('crypto');

// Configuration
const PORT = process.env.PORT || 8080;
const USERNAME = 'moust';
const PASSWORD = 'moust';
const VPS_HOST = '57.129.106.133';
const VPS_PORT = 22;  // Port SSH
const VPS_IP = '57.129.106.133';

console.log('==========================================');
console.log('🔐 SSH over WebSocket - Google Cloud Run');
console.log(`👤 Login: ${USERNAME} / ${PASSWORD}`);
console.log(`📡 VPS cible: ${VPS_HOST}:${VPS_PORT}`);
console.log('==========================================');

// Serveur HTTP
const server = http.createServer((req, res) => {
    const url = req.url;
    const domain = req.headers.host || 'free-lance-75480392594.us-central1.run.app';
    
    // Page d'accueil
    if (url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`SSH over WebSocket Tunnel OK\n\nwss://${domain}/ws\n\nLogin: ${USERNAME} / ${PASSWORD}\n`);
        return;
    }
    
    // Configuration client WebSocket
    if (url === '/config') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`wss://${domain}/ws\nLogin: ${USERNAME}\nPassword: ${PASSWORD}\n`);
        return;
    }
    
    // === ROUTE SSH avec IP à la fin ===
    if (url === `/${VPS_IP}`) {
        const sshConfig = `🔐 SSH over WebSocket Configuration\n\n` +
            `WebSocket URL: wss://${domain}/ws\n` +
            `Authentication: Basic ${USERNAME}:${PASSWORD}\n` +
            `Destination: ${VPS_HOST}:${VPS_PORT} (SSH)\n\n` +
            `Command (websocat):\n` +
            `websocat --binary -H "Authorization: Basic $(echo -n '${USERNAME}:${PASSWORD}' | base64)" wss://${domain}/ws\n\n` +
            `Then: ssh -p 22 root@${VPS_HOST}`;
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(sshConfig);
        console.log(`🔗 Configuration SSH générée (IP: ${VPS_IP})`);
        return;
    }
    
    res.writeHead(404);
    res.end('Not Found\n');
});

// Gestion WebSocket (tunnel SSH)
server.on('upgrade', (req, socket, head) => {
    const url = req.url;
    console.log(`🔌 Nouvelle connexion WebSocket: ${url}`);
    
    // Vérifier le chemin
    if (url !== '/ws') {
        console.log(`❌ Chemin invalide: ${url}`);
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
    }
    
    // Authentification
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        console.log('❌ Authentification requise');
        socket.write('HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: Basic realm="WebSocket"\r\n\r\n');
        socket.destroy();
        return;
    }
    
    // Vérifier login/password
    const base64 = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64, 'base64').toString();
    const [username, password] = credentials.split(':');
    
    if (username !== USERNAME || password !== PASSWORD) {
        console.log(`❌ Authentification échouée: ${username}`);
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
    }
    
    console.log(`✅ Authentification réussie: ${username}`);
    
    // Connexion au VPS (SSH)
    const net = require('net');
    const vpsSocket = net.connect(VPS_PORT, VPS_HOST, () => {
        console.log(`🔗 Connecté au VPS ${VPS_HOST}:${VPS_PORT}`);
        
        // Réponse WebSocket upgrade
        const acceptKey = req.headers['sec-websocket-key'];
        const acceptValue = crypto
            .createHash('sha1')
            .update(acceptKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
            .digest('base64');
        
        socket.write([
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${acceptValue}`,
            '\r\n'
        ].join('\r\n'));
        
        // Transférer les données (tunnel binaire)
        vpsSocket.pipe(socket);
        socket.pipe(vpsSocket);
    });
    
    vpsSocket.on('error', (err) => {
        console.error(`❌ Erreur VPS: ${err.message}`);
        socket.destroy();
    });
    
    socket.on('error', (err) => {
        console.error(`❌ Erreur WebSocket: ${err.message}`);
        vpsSocket.destroy();
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Tunnel SSH over WebSocket actif sur le port ${PORT}`);
    console.log(`🔗 wss://${process.env.HOSTNAME || 'localhost'}/ws`);
});
