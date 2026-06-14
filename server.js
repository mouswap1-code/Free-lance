const http = require('http');
const crypto = require('crypto');

// Configuration
const PORT = process.env.PORT || 8080;
const USERNAME = 'Came';
const PASSWORD = 'Came';
const VPS_HOST = '188.166.52.176';
const VPS_PORT = 22;  // Port SSH (ou autre service)

console.log('==========================================');
console.log('🔐 WebSocket Tunnel - Google Cloud Run');
console.log(`👤 Login: ${USERNAME} / ${PASSWORD}`);
console.log(`📡 VPS cible: ${VPS_HOST}:${VPS_PORT}`);
console.log('==========================================');

// Serveur HTTP
const server = http.createServer((req, res) => {
    const url = req.url;
    
    // Page d'accueil
    if (url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`WebSocket Tunnel OK\n\nwss://${req.headers.host}/ws\n\nLogin: ${USERNAME} / ${PASSWORD}\n`);
        return;
    }
    
    // Configuration client
    if (url === '/config') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`wss://${req.headers.host}/ws\nLogin: ${USERNAME}\nPassword: ${PASSWORD}\n`);
        return;
    }
    
    res.writeHead(404);
    res.end('Not Found\n');
});

// Gestion WebSocket
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
    
    // Connexion au VPS (SSH ou service personnalisé)
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
        
        // Transférer les données entre le client WebSocket et le VPS
        // (implémentation du protocole WebSocket nécessaire)
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
    console.log(`✅ Tunnel WebSocket actif sur le port ${PORT}`);
    console.log(`🔗 wss://${process.env.HOSTNAME || 'localhost'}/ws`);
});
