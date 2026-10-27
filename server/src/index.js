// Servidor de salas para Duelo de Reinos.
// Un Durable Object por sala (código de 8 dígitos). Solo retransmite mensajes:
// las reglas del juego las corre el dispositivo del administrador (host).

const MAX_PLAYERS = 4;
const IDLE_MS = 30 * 60 * 1000;

function cleanName(s) {
  s = String(s || '').normalize('NFC').replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ _-]/g, '').trim().slice(0, 12);
  return s || 'Jugador';
}
function rid() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
function allowed(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!origin) return true;
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (list.includes(origin)) return true;
  if (origin.endsWith('.github.io')) return true;
  if (origin.includes('pages.dev')) return true;
  if (origin.includes('localhost')) return true;
  if (origin.includes('127.0.0.1')) return true;
  return true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/room\/(\d{8})$/);
    if (!m) return new Response('Duelo de Reinos: servidor de salas', { status: 200 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Se esperaba WebSocket', { status: 426 });
    // if (!allowed(request, env)) return new Response('Origen no permitido', { status: 403 });
    const stub = env.ROOMS.get(env.ROOMS.idFromName(m[1]));
    return stub.fetch(request);
  },
};

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async getMeta() {
    return (await this.state.storage.get('meta')) || null;
  }
  async putMeta(meta) {
    await this.state.storage.put('meta', meta);
    await this.state.storage.setAlarm(Date.now() + IDLE_MS);
  }

  sockets(role) {
    return this.state.getWebSockets(role);
  }

  send(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch (e) { /* socket cerrado */ }
  }

  roster(meta) {
    return meta.seats.map((s) => ({ pid: s.pid, name: s.name, online: this.isOnline(s.pid) }));
  }
  isOnline(pid) {
    return this.state.getWebSockets('p' + pid).filter((s) => s !== this.except).length > 0;
  }
  broadcastLobby(meta) {
    const msg = { t: 'lobby', players: this.roster(meta), started: !!meta.started, max: MAX_PLAYERS };
    for (const ws of this.state.getWebSockets()) if (ws !== this.except) this.send(ws, msg);
  }

  refuse(code, reason) {
    const pair = new WebSocketPair();
    const server = pair[1];
    this.state.acceptWebSocket(server, ['reject']);
    this.send(server, { t: 'error', code, reason });
    server.close(code, reason);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    const token = url.searchParams.get('token') || '';
    const name = cleanName(url.searchParams.get('name'));
    let meta = await this.getMeta();

    if (role === 'host') {
      if (!meta) {
        meta = { hostToken: rid(), seats: [{ pid: 0, name, token: '' }], started: false, snap: null };
      } else if (meta.hostToken !== token) {
        return this.refuse(4003, 'Ese código ya está en uso');
      }
      meta.seats[0].name = name;
      await this.putMeta(meta);
      for (const old of this.sockets('host')) { try { old.close(4001, 'Reemplazado por otra conexión'); } catch (e) {} }
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1], ['host', 'p0']);
      this.send(pair[1], { t: 'hello', pid: 0, token: meta.hostToken, snap: meta.snap, started: meta.started });
      for (const ws of this.sockets('guest')) this.send(ws, { t: 'host_on' });
      this.broadcastLobby(meta);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (role === 'guest') {
      if (!meta) return this.refuse(4004, 'La sala no existe');
      let seat = token ? meta.seats.find((s) => s.token === token && s.pid > 0) : null;
      if (!seat) {
        if (meta.started) return this.refuse(4005, 'La partida ya empezó');
        if (meta.seats.length >= MAX_PLAYERS) return this.refuse(4006, 'La sala está llena');
        let nm = name, n = 2;
        while (meta.seats.some((s) => s.name === nm)) nm = name.slice(0, 10) + ' ' + n++;
        seat = { pid: Math.max(...meta.seats.map((x) => x.pid)) + 1, name: nm, token: rid() };
        meta.seats.push(seat);
      } else {
        for (const old of this.sockets('p' + seat.pid)) { try { old.close(4001, 'Reemplazado por otra conexión'); } catch (e) {} }
      }
      await this.putMeta(meta);
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1], ['guest', 'p' + seat.pid]);
      this.send(pair[1], { t: 'hello', pid: seat.pid, token: seat.token, name: seat.name, started: meta.started });
      for (const h of this.sockets('host')) this.send(h, { t: 'join', pid: seat.pid, name: seat.name });
      if (!this.sockets('host').length) this.send(pair[1], { t: 'host_off' });
      this.broadcastLobby(meta);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    return new Response('Rol inválido', { status: 400 });
  }

  async webSocketMessage(ws, data) {
    if (typeof data !== 'string' || data.length > 262144) return;
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }
    const tags = this.state.getTags(ws);
    const meta = await this.getMeta();
    if (!meta) return;
    if (tags.includes('host')) {
      if (msg.t === 'start') { meta.started = true; await this.putMeta(meta); this.broadcastLobby(meta); return; }
      if (msg.t === 'end') { meta.started = false; meta.snap = null; await this.putMeta(meta); this.broadcastLobby(meta); return; }
      if (msg.t === 'save') { meta.snap = msg.s || null; await this.putMeta(meta); return; }
      if (msg.t === 'kick') {
        for (const s of this.sockets('p' + msg.pid)) { try { s.close(4007, 'El administrador te quitó de la sala'); } catch (e) {} }
        meta.seats = meta.seats.filter((x) => x.pid !== msg.pid || x.pid === 0);
        await this.putMeta(meta); this.broadcastLobby(meta); return;
      }
      if (msg.t === 'to') {
        const out = JSON.stringify({ t: 'm', m: msg.m });
        if (msg.pid === 'all') for (const g of this.sockets('guest')) { try { g.send(out); } catch (e) {} }
        else for (const g of this.sockets('p' + msg.pid)) { try { g.send(out); } catch (e) {} }
      }
      return;
    }
    if (tags.includes('guest')) {
      const pidTag = tags.find((t) => /^p\d+$/.test(t));
      const pid = pidTag ? parseInt(pidTag.slice(1), 10) : -1;
      if (msg.t === 'g') {
        const out = JSON.stringify({ t: 'g', from: pid, m: msg.m });
        for (const h of this.sockets('host')) { try { h.send(out); } catch (e) {} }
      }
    }
  }

  async webSocketClose(ws, code, reason) {
    await this.afterClose(ws);
  }
  async webSocketError(ws) {
    await this.afterClose(ws);
  }
  async afterClose(ws) {
    const tags = this.state.getTags(ws);
    if (tags.includes('reject')) return;
    const meta = await this.getMeta();
    if (!meta) return;
    this.except = ws;
    if (tags.includes('host') && !this.sockets('host').filter((s) => s !== ws).length) {
      for (const g of this.sockets('guest')) this.send(g, { t: 'host_off' });
    }
    this.broadcastLobby(meta);
    this.except = null;
  }

  async alarm() {
    if (this.state.getWebSockets().length === 0) {
      await this.state.storage.deleteAll();
    } else {
      await this.state.storage.setAlarm(Date.now() + IDLE_MS);
    }
  }
}
