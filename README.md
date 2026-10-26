# Duelo de Reinos (Online)

Juego de tablero estilo Monopoly con duelos, cartas y guardianes. Juega en el navegador **online con sala de 8 dígitos** o en **mismo dispositivo**.

## Archivos

```
index.html      Juego completo (una sola página)
config.js       Dirección del servidor de salas (configurar una vez)
server/         Servidor de salas (Cloudflare Worker + Durable Object)
CREDITS.md      Créditos de arte y música (CC0)
.nojekyll       Necesario para GitHub Pages
```

## Cómo funciona

- **Anfitrión/Administrador**: El que crea la sala corre la partida en su dispositivo. Genera un código de **8 dígitos** y comparte el link.
- **Servidor relay**: El Worker de Cloudflare solo retransmite mensajes entre dispositivos. No guarda cuentas ni datos personales.
- **2 a 4 jugadores**: Por ahora soporta 2, 3 o 4 jugadores.
- **Reconexión**: Si alguien se desconecta vuelve a entrar con el mismo link/código. Si el anfitrión se cierra, se puede reabrir la sala con el mismo navegador para retomar.
- **Salas temporales**: Una sala sin conexiones se borra a los 30 minutos.

## 1) Subir a GitHub Pages

Creá un repositorio **público** en GitHub (Pages es gratis solo en repos públicos). Te dejo el ejemplo con tu usuario, cambialo si es distinto.

```bash
cd duelo-de-reinos
git init -b main
git add .
git commit -m "Duelo de Reinos online"
git remote add origin https://github.com/rvera-sys/duelo-de-reinos-online.git
git push -u origin main
```

Activar Pages:
1. Ir a **Settings → Pages**
2. **Build and deployment → Source: Deploy from a branch**
3. Branch: **main** / **/(root)**
4. Guardar

En unos minutos quedará en: `https://rvera-sys.github.io/duelo-de-reinos-online/`

## 2) Desplegar servidor de salas (Cloudflare Workers - Gratis)

Necesitás [Node.js](https://nodejs.org/) y cuenta en [Cloudflare](https://dash.cloudflare.com/).

```bash
cd server
npm install
npx wrangler login
npx wrangler deploy
```

Al terminar te va a mostrar una URL tipo:
`https://duelo-salas.TU-SUBDOMINIO.workers.dev`

Abrí `config.js` y editá:

```js
window.DUELO_WS = 'wss://duelo-salas.TU-SUBDOMINIO.workers.dev';
```

Guardá y subilo a GitHub:

```bash
git add config.js
git commit -m "Configurar servidor de salas"
git push
```

**Orígenes permitidos:** En `server/wrangler.toml` está `ALLOWED_ORIGINS`. Si cambiás usuario o dominio, actualizalo y volvé a hacer `npx wrangler deploy`.

## 3) Jugar

1. Abrí el juego desde GitHub Pages o local.
2. **Online → Crear partida (Anfitrión)**. Poné tu nombre y se crea la sala con un **código de 8 dígitos**.
3. Tocá **Copiar link** o **Compartir** y mandáselo a los demás.
4. Los demás entran con ese link/código → ponen su nombre → **Unirse**.
5. Cuando haya **>= 2 jugadores conectados**, el **anfitrión** elige reglas y toca **Empezar partida**.

## Probar local

```bash
# Terminal 1 - Servidor
cd server
npx wrangler dev

# Terminal 2 - Web
python -m http.server 8080
# o npx serve .
```

En `config.js` poner:
```js
window.DUELO_WS = 'ws://127.0.0.1:8787';
```

Abrir `http://localhost:8080`

## Notas
- El código de sala es de 8 dígitos, sin contraseñas. Es para partidas privadas entre conocidos.
- Plan gratuito de Cloudflare tiene límites, pero para partidas entre amigos es más que suficiente.

## Probarlo en tu computadora

```bash
cd server && npx wrangler dev          # servidor en ws://127.0.0.1:8787
# en otra terminal, en la raíz del repo:
python3 -m http.server 8080
```

Poné `window.DUELO_WS = 'ws://127.0.0.1:8787';` en `config.js` y abrí `http://localhost:8080` en dos pestañas.
(`localhost:8080` ya está permitido en `ALLOWED_ORIGINS`. Una página en HTTPS no puede usar `ws://`, solo `wss://`.)

## Límites a tener en cuenta

- El plan gratuito de Cloudflare tiene cupos diarios; si se superan, el servidor falla hasta que se reinician a las 00:00 UTC.
  Una partida entre amigos usa muy poco. Revisá los límites vigentes en la documentación de Durable Objects.
- El código de sala son 8 dígitos y no hay cuentas ni contraseñas: sirve para partidas privadas entre conocidos.
- Está probado con clientes simulados contra el servidor local. Falta probarlo con celulares reales y redes móviles.
