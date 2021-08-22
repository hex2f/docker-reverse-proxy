import net from 'net'
import ContainerManager from './container-manager'
import log from './log'
import fs from 'fs'
import YAML from 'yaml'
import https from 'https'
import sni from 'sni'
import http, { IncomingMessage, ServerResponse } from 'http'

export default class HTTPSServer {
  private readonly server: net.Server
  private readonly httpsServer: https.Server

  constructor (configPath: string, private readonly containers: ContainerManager, private readonly port: number) {
    this.server = net.createServer(this.handler.bind(this))
    const configContents = fs.readFileSync(configPath, 'utf8')
    const config = YAML.parse(configContents)
    log(config)
    this.httpsServer = https.createServer({
      key: fs.readFileSync(config.ssl.key),
      cert: fs.readFileSync(config.ssl.cert)
    }, this.httpsHandler.bind(this)).listen(port+1)

    this.listen()
  }

  async handler (socket: net.Socket): Promise<void> {
    const slignshot = new net.Socket()
    slignshot.on('error', () => socket.end())
    slignshot.on('end', () => socket.end())
    socket.once("data", (data) => {
      const host = sni(data);
      const isleah = host.endsWith('.leah.one')
      const ip = isleah ? 'localhost' : this.containers.resolveIP(host);
      if (ip === undefined) {
        return socket.end()
      }
      slignshot.connect({ host: isleah ? 'localhost' : ip, port: isleah ? (this.port+1) : 443 }, () => {
        slignshot.write(data)
        socket.pipe(slignshot).pipe(socket)
      })
    });
  }

  async httpsHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const host = req.headers.host
    if (host === undefined) {
      res.statusCode = 400
      res.end('Missing host header')
      return
    }
    const ip = this.containers.resolveIP(host)
    if (ip === undefined) {
      res.writeHead(404)
      res.end()
      return
    }
    const ricochet = http.request({
      host: ip,
      port: 80,
      path: req.url,
      method: req.method,
      headers: req.headers
    }, (response) => {
      res.writeHead(response.statusCode ?? 200, response.headers)
      response.pipe(res)
    })
    req.pipe(ricochet)
  }

  listen (): void {
    this.server.listen(this.port)
  }

  public close (): void {
    this.server.close()
  }
}
